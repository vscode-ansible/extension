export interface ModuleEntry {
  name: string;
  doc: string;
  /** Must-have options for the module to do anything useful. */
  required: string[];
  /** Optional options commonly used with the module. */
  optional: string[];
  /** Coarse category tags for filtering in the wizard. */
  tags: string[];
}

/**
 * Flat list of all options (required + optional) in a stable order.
 * Kept as a function (not a field) so callers always get the reconciled list;
 * existing consumers read options through this helper.
 */
export function moduleOptions(m: ModuleEntry): string[] {
  return [...m.required, ...m.optional];
}

function mod(
  name: string,
  doc: string,
  tags: string[],
  required: string[] = [],
  optional: string[] = [],
): ModuleEntry {
  return { name, doc, tags, required, optional };
}

export const ANSIBLE_MODULES: ModuleEntry[] = [
  mod('apt', 'Manage packages (Debian/Ubuntu)', ['package'], ['name'], ['state', 'update_cache', 'cache_valid_time', 'install_recommends', 'autoremove']),
  mod('yum', 'Manage packages (RHEL/CentOS)', ['package'], ['name'], ['state', 'update_only', 'disable_gpg_check', 'enablerepo']),
  mod('dnf', 'Manage packages (Fedora)', ['package'], ['name'], ['state', 'autoremove', 'disable_gpg_check']),
  mod('pip', 'Manage Python packages', ['package'], ['name'], ['state', 'executable', 'virtualenv', 'requirements']),
  mod('shell', 'Execute a shell command', ['exec'], [], ['cmd', 'chdir', 'creates', 'removes', 'stdin', 'executable']),
  mod('command', 'Execute a command (no shell)', ['exec'], [], ['argv', 'chdir', 'creates', 'removes', 'stdin']),
  mod('copy', 'Copy files to remote hosts', ['file'], ['dest'], ['src', 'content', 'owner', 'group', 'mode', 'backup', 'force']),
  mod('template', 'Render a Jinja2 template', ['file'], ['src', 'dest'], ['owner', 'group', 'mode', 'backup', 'validate']),
  mod('file', 'Manage files/directories/links', ['file'], ['path'], ['state', 'owner', 'group', 'mode', 'recurse', 'src', 'selevel']),
  mod('service', 'Manage services', ['service'], ['name'], ['state', 'enabled', 'pattern', 'runlevel', 'sleep']),
  mod('systemd', 'Manage systemd units', ['service'], ['name'], ['state', 'enabled', 'daemon_reload', 'scope', 'masked']),
  mod('user', 'Manage users', ['identity'], ['name'], ['state', 'uid', 'group', 'groups', 'shell', 'home', 'password', 'system', 'append']),
  mod('group', 'Manage groups', ['identity'], ['name'], ['state', 'gid', 'system']),
  mod('lineinfile', 'Manage lines in a file', ['file'], ['path', 'line'], ['regexp', 'state', 'insertafter', 'insertbefore', 'backrefs', 'create']),
  mod('blockinfile', 'Manage blocks in a file', ['file'], ['path', 'block'], ['state', 'marker', 'insertafter', 'insertbefore', 'create']),
  mod('replace', 'Regexp replacement in a file', ['file'], ['path', 'regexp', 'replace'], ['backup', 'after', 'before']),
  mod('git', 'Clone/update a git repository', ['vcs'], ['repo', 'dest'], ['version', 'branch', 'force', 'clone', 'update', 'depth', 'accept_hostkey']),
  mod('unarchive', 'Extract archives', ['file'], ['src', 'dest'], ['remote_src', 'owner', 'group', 'mode', 'creates', 'extra_opts']),
  mod('get_url', 'Download files by URL', ['network'], ['url', 'dest'], ['owner', 'group', 'mode', 'checksum', 'validate_certs', 'headers', 'timeout']),
  mod('uri', 'Make HTTP requests', ['network'], ['url'], ['method', 'body', 'status_code', 'headers', 'return_content', 'validate_certs', 'follow_redirects']),
  mod('assert', 'Assert conditions', ['debug'], ['that'], ['fail_msg', 'success_msg', 'quiet']),
  mod('fail', 'Force a failure', ['debug'], [], ['msg']),
  mod('debug', 'Print debug information', ['debug'], [], ['msg', 'var', 'verbosity']),
  mod('set_fact', 'Set variables', ['debug'], ['key_value'], ['cacheable']),
  mod('include_tasks', 'Dynamically include tasks', ['flow'], ['file'], ['apply', 'free-form']),
  mod('import_tasks', 'Statically import tasks', ['flow'], ['file'], ['free-form']),
  mod('include_role', 'Dynamically include a role', ['flow'], ['name'], ['tasks_from', 'vars_from', 'defaults_from', 'apply']),
  mod('import_role', 'Statically import a role', ['flow'], ['name'], ['tasks_from', 'vars_from', 'defaults_from']),
  mod('wait_for', 'Wait for a condition/port', ['network'], [], ['host', 'port', 'path', 'state', 'timeout', 'delay', 'sleep']),
  mod('pause', 'Pause execution', ['flow'], [], ['minutes', 'seconds', 'prompt', 'echo']),
  mod('stat', 'Get file information', ['file'], ['path'], ['get_checksum', 'get_mime', 'checksum_algorithm', 'follow']),
  mod('find', 'Find files by pattern', ['file'], ['path'], ['patterns', 'recurse', 'file_type', 'age', 'size', 'hidden']),
  mod('cron', 'Manage cron jobs', ['service'], ['name'], ['minute', 'hour', 'day', 'month', 'weekday', 'job', 'user', 'state']),
  mod('hostname', 'Set the hostname', ['system'], ['name'], []),
  mod('mount', 'Manage mount points', ['system'], ['path', 'src', 'fstype'], ['state', 'opts', 'dump', 'passno']),
  mod('firewalld', 'Manage firewalld', ['system', 'network'], [], ['service', 'port', 'state', 'permanent', 'immediate', 'zone']),
  mod('selinux', 'Manage SELinux', ['system'], [], ['policy', 'state']),
  mod('docker_container', 'Manage Docker containers', ['container'], ['name', 'image'], ['state', 'ports', 'env', 'volumes', 'networks', 'restart_policy']),
  mod('docker_image', 'Manage Docker images', ['container'], ['name'], ['source', 'state', 'build', 'force', 'tag']),
  mod('ansible.builtin.meta', 'Meta directives (flush_handlers, etc.)', ['flow'], [], ['free-form']),
  mod('hosts', 'Target hosts (play directive)', ['system'], [], []),
];

export const ANSIBLE_KEYWORDS: string[] = [
  'name',
  'hosts',
  'tasks',
  'handlers',
  'roles',
  'vars',
  'vars_files',
  'vars_prompt',
  'become',
  'become_user',
  'become_method',
  'gather_facts',
  'connection',
  'strategy',
  'serial',
  'order',
  'environment',
  'tags',
  'pre_tasks',
  'post_tasks',
  'ignore_errors',
  'ignore_unreachable',
  'changed_when',
  'failed_when',
  'register',
  'when',
  'loop',
  'with_items',
  'with_dict',
  'notify',
  'delegate_to',
  'delegate_facts',
  'run_once',
  'any_errors_fatal',
  'check_mode',
  'diff',
  'timeout',
  'until',
  'retries',
  'delay',
  'collections',
  'module_defaults',
];

/** Filter modules by a name prefix for partial input. */
export function filterModules(prefix: string, limit = 30): ModuleEntry[] {
  const p = prefix.toLowerCase();
  return ANSIBLE_MODULES.filter((m) => m.name.toLowerCase().startsWith(p)).slice(0, limit);
}

export function moduleByName(name: string): ModuleEntry | undefined {
  return ANSIBLE_MODULES.find((m) => m.name === name);
}

/** All unique tags across the catalog, sorted. */
export function listModuleTags(): string[] {
  const set = new Set<string>();
  for (const m of ANSIBLE_MODULES) for (const t of m.tags) set.add(t);
  return [...set].sort();
}

/** Modules carrying the given tag. */
export function filterModulesByTag(tag: string): ModuleEntry[] {
  return ANSIBLE_MODULES.filter((m) => m.tags.includes(tag));
}
