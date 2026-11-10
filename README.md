# Ansible Toolkit

Всё для работы с Ansible прямо в VS Code: подсветка синтаксиса, автодополнение,
запуск плейбуков, линтер, граф проекта, поиск секретов и удобный справочник
модулей.

## Что умеет

- **Справочник модулей** — отдельное окно со списком всех модулей Ansible
  (`apt`, `yaml`, `copy`, `template`, `docker_container` и ещё 40+) и их
  параметрами. Удобно, когда не помнишь, как называется опция.
- **Подсветка синтаксиса** — YAML/Ansible и Jinja2 (`{{ }}`, `{% %}`, фильтры,
  спецпеременные `ansible_*`).
- **Автодополнение** — имена модулей, их параметры и ключевые слова плейбука.
- **Запуск плейбуков** — из редактора и палитры команд в терминал, с
  дефолтным инвентарём.
- **ansible-lint** — диагностика при сохранении и по вызову.
- **Граф проекта** — интерактивный граф ролей и плейбуков (зависимости из
  `roles/*/meta/main.yml`, `import_playbook`).
- **Поиск секретов** — AWS-ключи, приватные ключи, пароли/токены в открытом
  виде, с быстрым действием «обернуть в vault».
- **Запуск по очереди** — последовательный запуск плейбуков/команд как в
  ноутбуке, с прогрессом. Шаги берутся из `run-queue.yml` или выбором файлов.

## Установка

### Из .vsix (готовый пакет)

```bash
cd extension
npm install
npm run compile
npx vsce package
```

В VS Code: **Extensions** → **…** → **Install from VSIX…** → выбери
`ansible-toolkit-0.1.0.vsix`.

### Из исходников (для разработки)

```bash
cd extension
npm install
npm run compile
```

Открой папку `extension` в VS Code и нажми **F5** (Run Extension). Конфигурация
запуска уже в `.vscode/launch.json`.

## Требования

- VS Code 1.85+
- `ansible-playbook` и `ansible-inventory` в PATH (или укажи путь в настройках)
- (необязательно) `ansible-lint` — для линтера

## Настройки

| Ключ | По умолчанию | Описание |
|------|--------------|-----------|
| `ansibleToolkit.ansiblePlaybookPath` | `ansible-playbook` | Путь к `ansible-playbook`. |
| `ansibleToolkit.ansibleLintPath` | `ansible-lint` | Путь к `ansible-lint`. |
| `ansibleToolkit.lint.enabled` | `true` | Включить диагностику линтера. |
| `ansibleToolkit.lint.onSave` | `true` | Линтить после сохранения. |
| `ansibleToolkit.secrets.enabled` | `true` | Включить поиск секретов. |
| `ansibleToolkit.defaultInventory` | `` | Инвентарь по умолчанию. |

## Команды (Ctrl+Shift+P)

- `Ansible: Run playbook` — запустить текущий плейбук
- `Ansible: Run ansible-lint` — запустить линтер
- `Ansible: Show project graph` — показать граф проекта
- `Ansible: Show modules reference` — открыть справочник модулей
- `Ansible: List playbook tasks` — список задач плейбука
- `Ansible: Run from task` — запуск с указанной задачи (`--start-at-task`)
- `Ansible: Find secrets in project` — найти секреты в проекте
- `Ansible: Run playbooks in sequence (queue)` — последовательный запуск

## Последовательный запуск (run-queue.yml)

Чтобы запускать плейбуки один за другим, создай в корне проекта `run-queue.yml`:

```yaml
commands:
  - name: Установить зависимости
    run: ansible-playbook deps.yml
  - name: Настроить хосты
    playbook: configure.yml
  - name: Деплой
    playbook: deploy.yml
  - ansible-playbook post-deploy.yml   # просто строка команды тоже работает
```

Каждый шаг запускается только после завершения предыдущего. Прогресс и вывод —
в канале «Ansible Run Queue». Если файла нет, команда предложит выбрать
плейбуки списком.

## Структура проекта

```
extension/
├── package.json              # манифест расширения
├── language-configuration.json
├── tsconfig.json
├── syntaxes/                 # TextMate-грамматики (Ansible + Jinja2)
├── fileicons/                # иконки файлов
└── src/
    ├── extension.ts          # точка входа, регистрация команд
    ├── runner.ts             # запуск playbook/lint/list-tasks
    ├── lint.ts               # разбор вывода ansible-lint
    ├── queue.ts              # очередь запуска (run-queue.yml)
    ├── completion/           # автодополнение и справочник модулей
    ├── secrets/              # поиск секретов
    ├── graph/                # графы (парсеры + webview-панель)
    └── debug/                # list-tasks, start-at-task
```

## Тесты

```bash
npm test
```
