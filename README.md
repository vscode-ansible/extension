# Ansible Toolkit

Ansible support for VS Code: syntax highlighting, module autocomplete, a
step-by-step **Constructor** wizard, playbook runner, linting, project graphs,
secret detection, and an ansible-vault-aware secrets manager.

## Features

- **Constructor (wizard)** — a step-by-step builder that walks you from
  *"what do you want to build?"* to a Playbook, Role, or Task. It proposes the
  next action at every step, autocompletes module names, and enforces the
  required options for each module. See [docs/user-guide.md](docs/user-guide.md).
- **Module reference** — a dedicated panel listing every module (`apt`, `copy`,
  `template`, `docker_container`, and more) with required vs. optional options.
- **Syntax highlighting** — Ansible YAML and Jinja2 (`{{ }}`, `{% %}`, filters,
  `ansible_*` special variables).
- **Autocomplete** — module names, their options, and playbook keywords.
- **Playbook runner** — run from the editor or command palette into a terminal,
  with a default inventory.
- **Step runner** — list a playbook's tasks and run them one by one via
  `--start-at-task`.
- **Variables store** — read and edit `group_vars/`, `host_vars/`, and role
  `defaults/` in the Constructor.
- **Secrets / vault** — detect plain-text secrets and encrypt/decrypt/view
  files with `ansible-vault`, directly from the Constructor.
- **Playbook selection** — pick a playbook from a dropdown, or click a node in
  the project graph.
- **ansible-lint** — diagnostics on save and on demand.
- **Project graph** — an interactive graph of roles and playbooks (dependencies
  from `roles/*/meta/main.yml` and `import_playbook`).
- **Sequential run queue** — run playbooks/commands one after another like a
  notebook (`run-queue.yml` or multi-select).

## Installation

### From source

```bash
cd extension
npm install
npm run compile
```

Then open the `extension` folder in VS Code and press **F5** (Run Extension).
The launch configuration is already in `.vscode/launch.json`.

### Package as VSIX

```bash
cd extension
npm install
npm run compile
npx vsce package
```

In VS Code: **Extensions** → **…** → **Install from VSIX…** → select the
generated `.vsix`.

## Requirements

- VS Code 1.85+
- `ansible-playbook` and `ansible-inventory` on `PATH` (or set their paths in
  settings)
- (optional) `ansible-lint` — for linting
- (optional) `ansible-vault` — for the secrets manager

## Settings

| Key | Default | Description |
|-----|---------|-------------|
| `ansibleToolkit.ansiblePlaybookPath` | `ansible-playbook` | Path to `ansible-playbook`. |
| `ansibleToolkit.ansibleLintPath` | `ansible-lint` | Path to `ansible-lint`. |
| `ansibleToolkit.ansibleVaultPath` | `ansible-vault` | Path to `ansible-vault`. |
| `ansibleToolkit.language` | `auto` | UI language (`auto`, `en`, `ru`). `auto` follows the VS Code display language. |
| `ansibleToolkit.lint.enabled` | `true` | Enable lint diagnostics. |
| `ansibleToolkit.lint.onSave` | `true` | Lint after each save. |
| `ansibleToolkit.secrets.enabled` | `true` | Enable secret scanning. |
| `ansibleToolkit.defaultInventory` | `` | Default inventory (e.g. `inventory/hosts.yml`). |

## Commands (Ctrl+Shift+P)

- `Ansible: Constructor` — open the step-by-step builder.
- `Ansible: Run playbook` — run the current playbook.
- `Ansible: Run tasks step by step` — open the step runner.
- `Ansible: Run ansible-lint` — run the linter.
- `Ansible: Show project graph` — show the project graph.
- `Ansible: Show modules reference` — open the module reference.
- `Ansible: List playbook tasks` — list the tasks of the current playbook.
- `Ansible: Run from task` — run from a chosen task (`--start-at-task`).
- `Ansible: Find secrets in project` — scan the project for secrets.
- `Ansible: Run playbooks in sequence (queue)` — run a queue of playbooks.

## Sequential run (`run-queue.yml`)

Create a `run-queue.yml` in the project root:

```yaml
commands:
  - name: Install dependencies
    run: ansible-playbook deps.yml
  - name: Configure hosts
    playbook: configure.yml
  - name: Deploy
    playbook: deploy.yml
  - ansible-playbook post-deploy.yml   # a bare command string also works
```

Each step runs only after the previous one finishes. Progress and output are
written to the "Ansible Run Queue" output channel. If no queue file exists, the
command offers a multi-select of playbooks.

## Guides

- [Constructor walkthrough](docs/user-guide.md) — variables, secrets, and
  playbook selection.

## Project structure

```
extension/
├── package.json              # extension manifest
├── language-configuration.json
├── tsconfig.json
├── syntaxes/                 # TextMate grammars (Ansible + Jinja2)
├── fileicons/                # file icons
├── icons/                    # activity bar icon
└── src/
    ├── extension.ts          # entry point, command registration
    ├── runner.ts             # playbook/lint/list-tasks execution
    ├── lint.ts               # ansible-lint output parsing
    ├── queue.ts              # run queue (run-queue.yml)
    ├── completion/           # autocomplete and module reference
    ├── wizard/               # the Constructor wizard (state + panel)
    ├── vars/                 # variables store
    ├── secrets/              # secret scanning + ansible-vault
    ├── picker/               # playbook selection
    ├── i18n/                 # Russian/English catalogs
    ├── theme/                # theme-adaptive CSS helpers
    ├── graph/                # graphs (parsers + webview panel)
    └── debug/                # list-tasks, start-at-task
```

## Tests

```bash
npm test
```
