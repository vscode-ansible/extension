import * as path from 'node:path';
import { spawn } from 'node:child_process';
import * as vscode from 'vscode';
import { parseRunArgs } from './debug/pure';

export interface SpawnResult {
  code: number;
  output: string;
}

/** Runs a process capturing stdout+stderr and returns the exit code. */
export function runCommand(
  executable: string,
  args: string[],
  cwd?: string,
  onChunk?: (chunk: string) => void,
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      shell: process.platform === 'win32',
      env: { ...process.env },
    });
    let output = '';
    child.stdout?.on('data', (d: Buffer) => {
      const text = d.toString();
      output += text;
      onChunk?.(text);
    });
    child.stderr?.on('data', (d: Buffer) => {
      const text = d.toString();
      output += text;
      onChunk?.(text);
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => resolve({ code: code ?? -1, output }));
  });
}

/** Writes to the integrated VS Code terminal and returns it. */
export function writeToTerminal(name: string, command: string, cwd?: string): vscode.Terminal {
  const terminal = vscode.window.createTerminal({ name, cwd });
  terminal.show();
  terminal.sendText(command);
  return terminal;
}

function configExecutable(key: 'ansiblePlaybookPath' | 'ansibleLintPath'): string {
  const cfg = vscode.workspace.getConfiguration('ansibleToolkit');
  return cfg.get<string>(key) ?? (key === 'ansiblePlaybookPath' ? 'ansible-playbook' : 'ansible-lint');
}

/** Path of ansible-playbook from config (or PATH). */
export function playbookExecutable(): string {
  return configExecutable('ansiblePlaybookPath');
}

export function lintExecutable(): string {
  return configExecutable('ansibleLintPath');
}

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function relToWorkspace(filePath: string): string {
  const root = workspaceRoot();
  if (!root) return path.basename(filePath);
  return path.relative(root, filePath) || path.basename(filePath);
}

/** Builds the ansible-playbook command for a playbook file. */
export function buildPlaybookCommand(playbookPath: string, extraArgs: string[] = []): string {
  const exec = playbookExecutable();
  const rel = relToWorkspace(playbookPath);
  const cfg = vscode.workspace.getConfiguration('ansibleToolkit');
  const inventory = cfg.get<string>('defaultInventory') ?? '';
  const args = parseRunArgs([exec, inventory ? `-i ${inventory}` : '', ...extraArgs, rel].join(' '));
  return [args[0] ?? exec, ...args.slice(1)].join(' ');
}

/** Runs the playbook in a terminal. */
export function runPlaybookInTerminal(playbookPath: string, extraArgs: string[] = []): void {
  const command = buildPlaybookCommand(playbookPath, extraArgs);
  writeToTerminal('ansible-playbook', command, workspaceRoot());
}

/** Runs ansible-lint and returns raw output (for diagnostic parsing). */
export async function runLint(projectRoot: string): Promise<SpawnResult> {
  const exec = lintExecutable();
  try {
    return await runCommand(exec, ['.'], projectRoot);
  } catch (err) {
    return { code: -1, output: String(err) };
  }
}

/** Gets the task list via ansible-playbook --list-tasks. */
export async function listTasks(playbookPath: string): Promise<string> {
  const exec = playbookExecutable();
  const rel = relToWorkspace(playbookPath);
  try {
    const res = await runCommand(exec, ['--list-tasks', rel], workspaceRoot());
    return res.output;
  } catch (err) {
    return String(err);
  }
}

/** A single command in a sequential run queue (colab-style). */
export interface RunStep {
  /** Human-readable step title. */
  title: string;
  /** Full command or playbook file name (if `isPlaybook`). */
  command: string;
  /** true — treat command as a .yml path and build via buildPlaybookCommand. */
  isPlaybook?: boolean;
}

/**
 * Sequentially runs steps in a single OutputChannel, waiting for
 * each command to finish before starting the next. Each step is separated by
 * a banner in the output, like a notebook cell.
 */
export async function runSequential(
  steps: RunStep[],
  onStepStart?: (step: RunStep, index: number, total: number) => void,
  onStepEnd?: (step: RunStep, index: number, code: number) => void,
): Promise<void> {
  const channel = vscode.window.createOutputChannel('Ansible Run Queue');
  channel.show(false);

  const divider = '─'.repeat(64);
  const cwd = workspaceRoot();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const command = step.isPlaybook ? buildPlaybookCommand(step.command) : step.command;

    channel.appendLine(divider);
    channel.appendLine(`Step ${i + 1}/${steps.length} — ${step.title}`);
    channel.appendLine(`$ ${command}`);
    channel.appendLine(divider);

    onStepStart?.(step, i, steps.length);

    const [exec, ...rest] = parseRunArgs(command);
    if (!exec) {
      channel.appendLine('(skipped: empty command)');
      continue;
    }

    const res = await runCommand(exec, rest, cwd, (chunk) => channel.append(chunk));
    channel.appendLine('');
    channel.appendLine(`→ exit code: ${res.code}`);
    onStepEnd?.(step, i, res.code);
  }

  channel.appendLine(divider);
  channel.appendLine('Queue finished.');
}
