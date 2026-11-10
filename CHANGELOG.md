# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.2]: https://github.com/vscode-ansible/extension/releases/tag/v0.1.2
[0.1.1]: https://github.com/vscode-ansible/extension/releases/tag/v0.1.1
[0.1.0]: https://github.com/ansible-ide/vscode-extension/releases/tag/v0.1.0
