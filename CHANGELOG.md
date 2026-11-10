# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.7] - 2026-11-10

### Added

- Playbook builder form (webview): create tasks via fields (module + options),
  generate full playbooks, and scaffold role structures — with YAML auto-generated.
- Step-by-step runner: list a playbook's tasks and run them one by one via
  `--start-at-task`.
- Form-based module options with autocomplete (from the built-in module catalog).

## [0.1.6] - 2026-11-10

### Fixed

- Package runtime dependency `yaml` into the VSIX (fixes "Cannot find module yaml" on activation).
- Change default run keybinding off `ctrl+shift+p` (was hijacking the command palette).

## [0.1.5] - 2026-11-10

### Changed

- Use the official Ansible logomark (red circle, white "A") for the Activity Bar
  icon and extension icon.

## [0.1.4] - 2026-11-10

### Added

- Ansible YAML validation schemas (requirements, meta, tasks, vars, galaxy,
  ansible-lint config, molecule, rulebooks) from ansible-lint/navigator/molecule.
- Smart editor defaults for Ansible files (2-space indent, quick suggestions,
  advanced auto-indent) — matching the Red Hat Ansible extension.
- Extended file recognition: roles/tasks/handlers/vars/meta/playbooks patterns,
  plus `# code: language=ansible` first-line trigger.

## [0.1.3] - 2026-11-10

### Fixed

- Ensure all commands are in activationEvents (fixes "command not found" when
  clicking sidebar actions before the extension activates).

## [0.1.2] - 2026-11-10

### Added

- Activity Bar explorer — a tree view in the left sidebar, always visible when a
  folder is open, showing playbooks, roles, and inventory with run/graph/module actions.

## [0.1.1] - 2026-11-10

### Added

- Browsable module reference panel (`Ansible: Show modules reference`) — a
  dedicated webview with searchable module list, docs and options.

### Fixed

- Restored the lint setup (missing `eslint.config.mjs`, added `typescript-eslint`).
- Cleaned up lint issues (useless escapes, unused vars/imports, control char regex).

## [0.1.0] - 2026-11-10

### Added

- Ansible/Jinja2 syntax highlighting (TextMate grammars).
- Module autocomplete (40+ modules, per-module options, playbook keywords).
- Run playbook from the editor and command palette.
- `ansible-lint` diagnostics on save and on demand.
- Interactive project graph (roles, playbooks, dependencies) in a webview.
- Secret detection (AWS keys, private keys, plain-text passwords/tokens).
- "Wrap in vault" Code Action for detected secrets.
- Debug helpers: `--list-tasks` and `--start-at-task`.
- Sequential run queue (`run-queue.yml` or multi-select) in a notebook style.
- File icons for playbooks, roles, and inventories.

[0.1.7]: https://github.com/vscode-ansible/extension/releases/tag/v0.1.7
[0.1.6]: https://github.com/vscode-ansible/extension/releases/tag/v0.1.6
[0.1.5]: https://github.com/vscode-ansible/extension/releases/tag/v0.1.5
[0.1.4]: https://github.com/vscode-ansible/extension/releases/tag/v0.1.4
[0.1.3]: https://github.com/vscode-ansible/extension/releases/tag/v0.1.3
[0.1.2]: https://github.com/vscode-ansible/extension/releases/tag/v0.1.2
[0.1.1]: https://github.com/vscode-ansible/extension/releases/tag/v0.1.1
[0.1.0]: https://github.com/ansible-ide/vscode-extension/releases/tag/v0.1.0
