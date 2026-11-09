# Ansible Toolkit

A full-featured VS Code extension that turns the editor into a complete working
environment for developing and debugging Ansible projects.

## Features

- **Syntax highlighting** — YAML/Ansible and Jinja2 templates (`{{ }}`, `{% %}`,
  filters, `ansible_*` special variables).
- **Autocomplete** — module names (apt, yum, copy, template, systemd, docker and
  40+ more), options for the current module, and playbook keywords.
- **Run playbooks** — from the editor and the command palette into the integrated
  terminal, with a default inventory.
- **ansible-lint** — diagnostics on save and on demand, with messages parsed into
  editor problems.
- **Graphs** — an interactive graph of roles and playbooks (dependencies from
  `roles/*/meta/main.yml`, `import_playbook`), plus an execution graph
  (`ok`/`changed`/`failed`/`unreachable`).
- **Secret detection** — scans for AWS access keys, private keys, and plain-text
  passwords/tokens, with a "wrap in vault" Code Action.
- **Debugging helpers** — task listing (`--list-tasks`) and running from a
  specific task (`--start-at-task`).
- **Sequential runs (colab-style)** — run playbooks/commands in order with a
  progress log, like notebook cells. Steps come from a `run-queue.yml` file or a
  multi-select of `.yml` files.

## Installation

### From .vsix (prebuilt package)

1. Build the package:
   ```bash
   cd vscode-extension
   npm install
   npm run compile
   npx vsce package
   ```
2. In VS Code: `Extensions` → `...` → `Install from VSIX...` → select
   `ansible-toolkit-0.1.0.vsix`.

### From source (development)

```bash
cd vscode-extension
npm install
npm run compile
```

Then open the `vscode-extension` folder in VS Code and press F5 (Run Extension).
The launch configuration is already provided in `.vscode/launch.json`.

## Requirements

- VS Code 1.85+
- `ansible-playbook` and `ansible-inventory` on PATH (or set the path in
  settings).
- (optional) `ansible-lint` on PATH for the linter.

## Settings

| Key | Default | Description |
|-----|---------|-------------|
| `ansibleToolkit.ansiblePlaybookPath` | `ansible-playbook` | Path to `ansible-playbook`. |
| `ansibleToolkit.ansibleLintPath` | `ansible-lint` | Path to `ansible-lint`. |
| `ansibleToolkit.lint.enabled` | `true` | Enable linter diagnostics. |
| `ansibleToolkit.lint.onSave` | `true` | Lint after saving. |
| `ansibleToolkit.secrets.enabled` | `true` | Enable secret scanning. |
| `ansibleToolkit.defaultInventory` | `` | Default inventory. |

## Commands (Ctrl+Shift+P)

- `Ansible: Run playbook`
- `Ansible: Run ansible-lint`
- `Ansible: Show project graph`
- `Ansible: List playbook tasks`
- `Ansible: Run from task`
- `Ansible: Find secrets in project`
- `Ansible: Run playbooks in sequence (queue)`

## Sequential runs (run-queue.yml)

To run playbooks one after another, create a `run-queue.yml` file in the project
root:

```yaml
commands:
  - name: Install dependencies
    run: ansible-playbook deps.yml
  - name: Configure hosts
    playbook: configure.yml
  - name: Deploy
    playbook: deploy.yml
  - ansible-playbook post-deploy.yml   # bare command strings also work
```

Each step only starts after the previous one finishes. Progress and output are
written to the "Ansible Run Queue" output channel. If the file is absent, the
command offers a multi-select of playbooks instead.

## Project structure

```
vscode-extension/
├── package.json              # extension manifest
├── language-configuration.json
├── tsconfig.json
├── syntaxes/                 # TextMate grammars (Ansible + Jinja2)
├── fileicons/                # file icons
└── src/
    ├── extension.ts          # entry point, command registration
    ├── runner.ts             # playbook/lint/list-tasks execution
    ├── lint.ts               # ansible-lint output parser
    ├── queue.ts              # sequential run queue (run-queue.yml)
    ├── completion/           # autocomplete (dictionary + provider)
    ├── secrets/              # secret detection
    ├── graph/                # graphs (parsers + webview panel)
    └── debug/                # debug helpers (list-tasks, start-at-task)
```

## Tests

```bash
npm test
```
