export interface ModuleEntry {
  name: string;
  doc: string;
  options: string[];
}

export const ANSIBLE_MODULES: ModuleEntry[] = [
  { name: 'apt', doc: 'Управление пакетами (Debian/Ubuntu)', options: ['name', 'state', 'update_cache', 'cache_valid_time', 'install_recommends', 'autoremove'] },
  { name: 'yum', doc: 'Управление пакетами (RHEL/CentOS)', options: ['name', 'state', 'update_only', 'disable_gpg_check', 'enablerepo'] },
  { name: 'dnf', doc: 'Управление пакетами (Fedora)', options: ['name', 'state', 'autoremove', 'disable_gpg_check'] },
  { name: 'pip', doc: 'Управление Python-пакетами', options: ['name', 'state', 'executable', 'virtualenv', 'requirements'] },
  { name: 'shell', doc: 'Выполнение shell-команды', options: ['cmd', 'chdir', 'creates', 'removes', 'stdin', 'executable'] },
  { name: 'command', doc: 'Выполнение команды (без shell)', options: ['argv', 'chdir', 'creates', 'removes', 'stdin'] },
  { name: 'copy', doc: 'Копирование файлов на удалённый хост', options: ['src', 'dest', 'content', 'owner', 'group', 'mode', 'backup', 'force'] },
  { name: 'template', doc: 'Рендеринг Jinja2-шаблона', options: ['src', 'dest', 'owner', 'group', 'mode', 'backup', 'validate'] },
  { name: 'file', doc: 'Управление файлами/каталогами/ссылками', options: ['path', 'state', 'owner', 'group', 'mode', 'recurse', 'src', 'selevel'] },
  { name: 'service', doc: 'Управление сервисами', options: ['name', 'state', 'enabled', 'pattern', 'runlevel', 'sleep'] },
  { name: 'systemd', doc: 'Управление systemd-юнитами', options: ['name', 'state', 'enabled', 'daemon_reload', 'scope', 'masked'] },
  { name: 'user', doc: 'Управление пользователями', options: ['name', 'state', 'uid', 'group', 'groups', 'shell', 'home', 'password', 'system', 'append'] },
  { name: 'group', doc: 'Управление группами', options: ['name', 'state', 'gid', 'system'] },
  { name: 'lineinfile', doc: 'Управление строками в файле', options: ['path', 'regexp', 'line', 'state', 'insertafter', 'insertbefore', 'backrefs', 'create'] },
  { name: 'blockinfile', doc: 'Управление блоками в файле', options: ['path', 'block', 'state', 'marker', 'insertafter', 'insertbefore', 'create'] },
  { name: 'replace', doc: 'Замена по regexp в файле', options: ['path', 'regexp', 'replace', 'backup', 'after', 'before'] },
  { name: 'git', doc: 'Клонирование/обновление git-репозитория', options: ['repo', 'dest', 'version', 'branch', 'force', 'clone', 'update', 'depth', 'accept_hostkey'] },
  { name: 'unarchive', doc: 'Распаковка архивов', options: ['src', 'dest', 'remote_src', 'owner', 'group', 'mode', 'creates', 'extra_opts'] },
  { name: 'get_url', doc: 'Скачивание файлов по URL', options: ['url', 'dest', 'owner', 'group', 'mode', 'checksum', 'validate_certs', 'headers', 'timeout'] },
  { name: 'uri', doc: 'HTTP-запросы', options: ['url', 'method', 'body', 'status_code', 'headers', 'return_content', 'validate_certs', 'follow_redirects'] },
  { name: 'assert', doc: 'Проверка условий', options: ['that', 'fail_msg', 'success_msg', 'quiet'] },
  { name: 'fail', doc: 'Принудительная ошибка', options: ['msg'] },
  { name: 'debug', doc: 'Вывод отладочной информации', options: ['msg', 'var', 'verbosity'] },
  { name: 'set_fact', doc: 'Установка переменных', options: ['key_value', 'cacheable'] },
  { name: 'include_tasks', doc: 'Динамический include задач', options: ['file', 'apply', 'free-form'] },
  { name: 'import_tasks', doc: 'Статический import задач', options: ['file', 'free-form'] },
  { name: 'include_role', doc: 'Динамический include роли', options: ['name', 'tasks_from', 'vars_from', 'defaults_from', 'apply'] },
  { name: 'import_role', doc: 'Статический import роли', options: ['name', 'tasks_from', 'vars_from', 'defaults_from'] },
  { name: 'wait_for', doc: 'Ожидание условия/порта', options: ['host', 'port', 'path', 'state', 'timeout', 'delay', 'sleep'] },
  { name: 'pause', doc: 'Пауза выполнения', options: ['minutes', 'seconds', 'prompt', 'echo'] },
  { name: 'stat', doc: 'Получение информации о файле', options: ['path', 'get_checksum', 'get_mime', 'checksum_algorithm', 'follow'] },
  { name: 'find', doc: 'Поиск файлов по шаблону', options: ['path', 'patterns', 'recurse', 'file_type', 'age', 'size', 'hidden'] },
  { name: 'cron', doc: 'Управление cron-задачами', options: ['name', 'minute', 'hour', 'day', 'month', 'weekday', 'job', 'user', 'state'] },
  { name: 'hostname', doc: 'Установка hostname', options: ['name'] },
  { name: 'mount', doc: 'Управление точками монтирования', options: ['path', 'src', 'fstype', 'state', 'opts', 'dump', 'passno'] },
  { name: 'firewalld', doc: 'Управление firewalld', options: ['service', 'port', 'state', 'permanent', 'immediate', 'zone'] },
  { name: 'selinux', doc: 'Управление SELinux', options: ['policy', 'state'] },
  { name: 'docker_container', doc: 'Управление контейнерами Docker', options: ['name', 'image', 'state', 'ports', 'env', 'volumes', 'networks', 'restart_policy'] },
  { name: 'docker_image', doc: 'Управление образами Docker', options: ['name', 'source', 'state', 'build', 'force', 'tag'] },
  { name: 'ansible.builtin.meta', doc: 'Мета-директивы (flush_handlers и т.п.)', options: ['free-form'] },
  { name: 'hosts', doc: 'Целевые хосты (директива play)', options: [] },
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

/** Сопоставление префикса с названием модуля для частичного ввода. */
export function filterModules(prefix: string, limit = 30): ModuleEntry[] {
  const p = prefix.toLowerCase();
  return ANSIBLE_MODULES.filter((m) => m.name.toLowerCase().startsWith(p)).slice(0, limit);
}

export function moduleByName(name: string): ModuleEntry | undefined {
  return ANSIBLE_MODULES.find((m) => m.name === name);
}
