# Constructor (Ansible wizard) — user guide

The Constructor is a step-by-step builder that helps you write Ansible
playbooks, roles, and tasks without memorising module options. Run it from the
command palette (**Ansible: Constructor**) or the editor toolbar.

## 1. Choose what to build

The Constructor starts by asking one question: **Playbook**, **Role**, or
**Task**.

- **Playbook** — a named play with hosts, privilege escalation, and one or more
  tasks.
- **Role** — scaffolds a full role structure under `roles/<name>/`.
- **Task** — a single `- name:` task block, inserted where your cursor is.

## 2. Fill in the guided fields

Each step highlights what to do next. For a Playbook, enter the play name and
hosts. For each task:

1. Pick a module (autocomplete across the built-in catalog).
2. Fill the **required** options (marked with `*`).
3. Add optional options as key/value rows if needed.

The bottom hint always tells you the next action.

## 3. Generate

Press **Generate**. The Constructor either:

- inserts the YAML at the cursor in the active playbook, or
- writes the role files to disk (for a Role).

## Variables

Open the **Variables** tab to view and edit every `group_vars/`, `host_vars/`,
and role `defaults/` file in the project. Values round-trip as YAML (scalars,
lists, and dictionaries), and encrypted vault files are shown as `[encrypted]`
and never edited as plain structure.

## Secrets

Open the **Secrets** tab to manage `ansible-vault` files:

- **Encrypt** — wrap a vars file in `ansible-vault`.
- **Decrypt** — unwrap it back to plain YAML.
- **View** — show the decrypted content in an output channel.

Plain-text values that look like secrets (passwords, tokens, API keys) are
flagged by the detector; use Encrypt rather than saving them in the clear.

## Language

The Constructor and panels follow `ansibleToolkit.language`. Set it to `en`,
`ru`, or `auto` (default — follows the VS Code display language). Colors always
follow the active VS Code theme.
