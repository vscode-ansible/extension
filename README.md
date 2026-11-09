# Ansible Toolkit

Многофункциональное расширение для VS Code, превращающее редактор в рабочую среду
для разработки и отладки Ansible-проектов.

## Возможности

- **Подсветка синтаксиса** — YAML/Ansible и Jinja2-шаблоны (`{{ }}`, `{% %}`,
  фильтры, специальные переменные `ansible_*`).
- **Автокомплит** — имена модулей (apt, yum, copy, template, systemd, docker и
  более 40 штук), опции конкретного модуля и ключевые слова плейбука.
- **Запуск playbook** — из редактора и панели команд в интегрированный терминал,
  с инвентарём по умолчанию.
- **ansible-lint** — диагностика при сохранении и по команде, с парсингом
  сообщений в проблемы редактора.
- **Графы** — интерактивный граф ролей и плейбуков (зависимости
  `roles/*/meta/main.yml`, `import_playbook`), а также граф выполнения
  `ansible-playbook` (ok/changed/failed/unreachable).
- **Определение секретов** — сканирование на AWS access keys, приватные ключи и
  пароли/токены в открытом виде, с Code Action «обернуть в vault».
- **Дебаг-удобства** — список задач (`--list-tasks`), запуск с конкретной задачи
  (`--start-at-task`).
- **Запуск по очереди (colab-стиль)** — последовательный запуск плейбуков/команд
  с прогресс-логом, как клетки ноутбука. Источник шагов — файл `run-queue.yml`
  или мультивыбор `.yml` файлов через QuickPick.

## Установка

### Из .vsix (готовый пакет)

1. Соберите пакет:
   ```bash
   cd vscode-extension
   npm install
   npm run compile
   npx vsce package
   ```
2. В VS Code: `Extensions` → `...` → `Install from VSIX...` → выберите
   `ansible-toolkit-0.1.0.vsix`.

### Из исходников (разработка)

```bash
cd vscode-extension
npm install
npm run compile
```

Затем в VS Code откройте папку `vscode-extension` и нажмите F5 (Run Extension),
предварительно установив запуск конфигурацию `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    }
  ]
}
```

## Требования

- VS Code 1.85+
- `ansible-playbook` и `ansible-inventory` на PATH (или укажите путь в
  настройках).
- (опционально) `ansible-lint` на PATH для линтера.

## Настройки

| Ключ | По умолчанию | Описание |
|------|--------------|----------|
| `ansibleToolkit.ansiblePlaybookPath` | `ansible-playbook` | Путь к `ansible-playbook`. |
| `ansibleToolkit.ansibleLintPath` | `ansible-lint` | Путь к `ansible-lint`. |
| `ansibleToolkit.lint.enabled` | `true` | Включить диагностику линтера. |
| `ansibleToolkit.lint.onSave` | `true` | Линтить после сохранения. |
| `ansibleToolkit.secrets.enabled` | `true` | Включить сканирование секретов. |
| `ansibleToolkit.defaultInventory` | `` | Инвентарь по умолчанию. |

## Команды (Ctrl+Shift+P)

- `Ansible: Запустить playbook`
- `Ansible: Запустить ansible-lint`
- `Ansible: Показать граф проекта`
- `Ansible: Список задач playbook`
- `Ansible: Запустить с конкретной задачи`
- `Ansible: Найти секреты в проекте`
- `Ansible: Запустить плейбуки по очереди (queue)`

## Очередь запуска (run-queue.yml)

Для последовательного запуска создайте в корне проекта файл `run-queue.yml`:

```yaml
commands:
  - name: Установка зависимостей
    run: ansible-playbook deps.yml
  - name: Настройка хостов
    playbook: configure.yml
  - name: Деплой
    playbook: deploy.yml
  - ansible-playbook post-deploy.yml   # голые строки тоже работают
```

Порядок и паузы: каждый шаг выполняется только после завершения предыдущего.
Прогресс и вывод пишутся в OutputChannel «Ansible Run Queue». Если файла нет —
команда предложит выбрать плейбуки вручную (мультивыбор).

## Структура

```
vscode-extension/
├── package.json              # манифест расширения
├── language-configuration.json
├── tsconfig.json
├── syntaxes/                 # TextMate-грамматики (Ansible + Jinja2)
├── fileicons/                # иконки файлов
└── src/
    ├── extension.ts          # точка входа, регистрация команд
    ├── runner.ts             # запуск playbook / lint / list-tasks
    ├── lint.ts               # парсер ansible-lint в диагностику
    ├── completion/           # автокомплит (словарь + провайдер)
    ├── secrets/              # детекция секретов
    ├── graph/                # графы (парсеры + webview-панель)
    └── debug/                # логика дебага (list-tasks, start-at-task)
```

## Тесты

```bash
npm test
```
