export interface ModuleEntry {
  name: string;
  doc: string;
  options: string[];
}

export const ANSIBLE_MODULES: ModuleEntry[] = [
  { name: 'apt', doc: 'Manage packages (Debian/Ubuntu)', options: ['name', 'state', 'update_cache', 'cache_valid_time', 'install_recommends', 'autoremove'] },
  { name: 'yum', doc: 'Manage packages (RHEL/CentOS)', options: ['name', 'state', 'update_only', 'disable_gpg_check', 'enablerepo'] },
  { name: 'dnf', doc: 'Manage packages (Fedora)', options: ['name', 'state', 'autoremove', 'disable_gpg_check'] },
  { name: 'pip', doc: 'Manage Python packages', options: ['name', 'state', 'executable', 'virtualenv', 'requirements'] },
  { name: 'shell', doc: 'Execute a shell command', options: ['cmd', 'chdir', 'creates', 'removes', 'stdin', 'executable'] },
  { name: 'command', doc: 'Execute a command (no shell)', options: ['argv', 'chdir', 'creates', 'removes', 'stdin'] },
  { name: 'copy', doc: 'Copy files to remote hosts', options: ['src', 'dest', 'content', 'owner', 'group', 'mode', 'backup', 'force'] },
  { name: 'template', doc: 'Render a Jinja2 template', options: ['src', 'dest', 'owner', 'group', 'mode', 'backup', 'validate'] },
  { name: 'file', doc: 'Manage files/directories/links', options: ['path', 'state', 'owner', 'group', 'mode', 'recurse', 'src', 'selevel'] },
  { name: 'service', doc: 'Manage services', options: ['name', 'state', 'enabled', 'pattern', 'runlevel', 'sleep'] },
  { name: 'systemd', doc: 'Manage systemd units', options: ['name', 'state', 'enabled', 'daemon_reload', 'scope', 'masked'] },
  { name: 'user', doc: 'Manage users', options: ['name', 'state', 'uid', 'group', 'groups', 'shell', 'home', 'password', 'system', 'append'] },
  { name: 'group', doc: 'Manage groups', options: ['name', 'state', 'gid', 'system'] },
  { name: 'lineinfile', doc: 'Manage lines in a file', options: ['path', 'regexp', 'line', 'state', 'insertafter', 'insertbefore', 'backrefs', 'create'] },
  { name: 'blockinfile', doc: 'Manage blocks in a file', options: ['path', 'block', 'state', 'marker', 'insertafter', 'insertbefore', 'create'] },
  { name: 'replace', doc: 'Regexp replacement in a file', options: ['path', 'regexp', 'replace', 'backup', 'after', 'before'] },
  { name: 'git', doc: 'Clone/update a git repository', options: ['repo', 'dest', 'version', 'branch', 'force', 'clone', 'update', 'depth', 'accept_hostkey'] },
  { name: 'unarchive', doc: 'Extract archives', options: ['src', 'dest', 'remote_src', 'owner', 'group', 'mode', 'creates', 'extra_opts'] },
  { name: 'get_url', doc: 'Download files by URL', options: ['url', 'dest', 'owner', 'group', 'mode', 'checksum', 'validate_certs', 'headers', 'timeout'] },
  { name: 'uri', doc: 'Make HTTP requests', options: ['url', 'method', 'body', 'status_code', 'headers', 'return_content', 'validate_certs', 'follow_redirects'] },
  { name: 'assert', doc: 'Assert conditions', options: ['that', 'fail_msg', 'success_msg', 'quiet'] },
  { name: 'fail', doc: 'Force a failure', options: ['msg'] },
  { name: 'debug', doc: 'Print debug information', options: ['msg', 'var', 'verbosity'] },
  { name: 'set_fact', doc: 'Set variables', options: ['key_value', 'cacheable'] },
  { name: 'include_tasks', doc: 'Dynamically include tasks', options: ['file', 'apply', 'free-form'] },
  { name: 'import_tasks', doc: 'Statically import tasks', options: ['file', 'free-form'] },
  { name: 'include_role', doc: 'Dynamically include a role', options: ['name', 'tasks_from', 'vars_from', 'defaults_from', 'apply'] },
  { name: 'import_role', doc: 'Statically import a role', options: ['name', 'tasks_from', 'vars_from', 'defaults_from'] },
  { name: 'wait_for', doc: 'Wait for a condition/port', options: ['host', 'port', 'path', 'state', 'timeout', 'delay', 'sleep'] },
  { name: 'pause', doc: 'Pause execution', options: ['minutes', 'seconds', 'prompt', 'echo'] },
  { name: 'stat', doc: 'Get file information', options: ['path', 'get_checksum', 'get_mime', 'checksum_algorithm', 'follow'] },
  { name: 'find', doc: 'Find files by pattern', options: ['path', 'patterns', 'recurse', 'file_type', 'age', 'size', 'hidden'] },
  { name: 'cron', doc: 'Manage cron jobs', options: ['name', 'minute', 'hour', 'day', 'month', 'weekday', 'job', 'user', 'state'] },
  { name: 'hostname', doc: 'Set the hostname', options: ['name'] },
  { name: 'mount', doc: 'Manage mount points', options: ['path', 'src', 'fstype', 'state', 'opts', 'dump', 'passno'] },
  { name: 'firewalld', doc: 'Manage firewalld', options: ['service', 'port', 'state', 'permanent', 'immediate', 'zone'] },
  { name: 'selinux', doc: 'Manage SELinux', options: ['policy', 'state'] },
  { name: 'docker_container', doc: 'Manage Docker containers', options: ['name', 'image', 'state', 'ports', 'env', 'volumes', 'networks', 'restart_policy'] },
  { name: 'docker_image', doc: 'Manage Docker images', options: ['name', 'source', 'state', 'build', 'force', 'tag'] },
  { name: 'ansible.builtin.meta', doc: 'Meta directives (flush_handlers, etc.)', options: ['free-form'] },
  { name: 'hosts', doc: 'Target hosts (play directive)', options: [] },
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
