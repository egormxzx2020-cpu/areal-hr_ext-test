# Areal HR — Система кадрового учета (areal-hr_ext-test)

Веб-приложение для специалистов по кадрам: ведение многоуровневой организационной структуры компаний, отделов и должностей, кадровый учет сотрудников, версионирование кадровых перемещений и аудит изменений.

---

## 1. Стек технологий и инструментарий

* **Операционная система:** Windows 11 Pro (с подсистемой WSL2 / Docker Desktop)
* **Среда разработки (IDE):** Visual Studio Code (с расширениями GitLens, Draw.io Integration, Docker)
* **СУБД:** PostgreSQL 17 в изолированном Docker-контейнере (`areal_postgres`), порт `5432`
* **Проектирование схемы данных:** Draw.io (исходник: `docs/schema.drawio`, графическая схема: `docs/schema.png`)
* **Backend:** Node.js v22 LTS, NestJS 10, pg (сырой пул соединений `pg.Pool`, без ORM по ТЗ), node-pg-migrate, Joi (валидация данных), Argon2id (планируется на этапе реализации модуля авторизации по ТЗ)
* **Frontend:** Vue.js 3.5, Quasar Framework v2, Vite, Axios
* **Тестирование:** Jest (юнит-тесты бизнес-логики)
* **Архитектурный стиль:** REST API (`http://localhost:3000` для API, `http://localhost:9000` для UI)

---

## 2. Внешний вид интерфейса

![Интерфейс управления справочниками](docs/ui-preview.png)

---

## 3. Схема базы данных

Архитектура базы данных спроектирована в соответствии с техническим заданием и требованиями к мягкому удалению (**Soft Delete** через метку `deleted_at timestamptz`):

* Исходная схема в формате Draw.io: [`docs/schema.drawio`](docs/schema.drawio)
* Экспортированное графическое представление: [`docs/schema.png`](docs/schema.png)

### Основные сущности и ограничения:
* **organizations** — организации (`name` уникально среди неудаленных записей `WHERE deleted_at IS NULL`).
* **departments** — древовидная структура отделов (`organization_id`, `parent_id` с индексами; частичный уникальный индекс `(organization_id, parent_id, name) NULLS NOT DISTINCT WHERE deleted_at IS NULL`; рекурсивная защита от циклов `A → B → A` на уровне сервиса).
* **positions** — должности (`name` уникально среди неудаленных записей `WHERE deleted_at IS NULL`).
* **employees** — сотрудники с паспортом и адресом (серия `varchar(4)`, номер `varchar(6)`, код подразделения `varchar(7)`).
* **files** — каталог файлов и сканов (`updated_at`, `deleted_at`).
* **employee_passport_files** — связующая таблица со сканами паспортов с составным первичным ключом `PRIMARY KEY (employee_id, file_id)`.
* **personnel_actions** — журнал кадровых приказов (`hire`, `transfer_dept`, `change_salary`, `fire`) с поддержкой `updated_at` и `deleted_at`.
* **users** — системные пользователи с ограничением ролей `CHECK (role IN ('admin', 'hr_manager'))` и логином `UNIQUE WHERE deleted_at IS NULL`.
* **audit_logs** — неизменяемый журнал аудита изменений (`entity_id uuid`, `changed_fields jsonb`, прямая связь по внешнему ключу только к `users.id`).

---

## 4. Инструкция по первому запуску (Quick Start)

### Предварительные требования
1. Установлен и запущен **Docker Desktop** (индикатор в левом нижнем углу должен быть зеленым — `Engine running`).
2. Установлена среда выполнения **Node.js** (версия 20 LTS или 22 LTS).

### Шаг 1. Клонирование репозитория и настройка переменных окружения
```bash
git clone [https://github.com/](https://github.com/)<ваш-логин>/areal-hr_ext-test.git
cd areal-hr_ext-test

# Создание локального .env на основе шаблона
copy .env.example .env


### Шаг 2. Запуск PostgreSQL 17 в Docker
Bash
docker compose up -d
Проверить статус контейнера можно командой docker ps. Контейнер areal_postgres должен иметь статус Up и проброс портов 0.0.0.0:5432->5432/tcp.

Шаг 3. Инициализация и запуск Backend API
В первом окне терминала выполните:

Bash
cd api
npm ci
npm run migrate up
npm run start:dev
REST API доступен по адресу: http://localhost:3000

Проверка доступности эндпоинтов: http://localhost:3000/organizations, http://localhost:3000/departments, http://localhost:3000/positions

### Шаг 4. Инициализация и запуск Frontend UI
Во втором окне терминала выполните:

Bash
cd app
npm ci
npm run dev
Веб-интерфейс Quasar доступен по адресу: http://localhost:9000

### Шаг 5. Запуск юнит-тестов бэкенда
Bash
cd api
npm run test
Быстрый запуск для Windows (батник)
Для ежедневной разработки в корне проекта подготовлен пакетный файл start-dev.bat. Двойной клик по файлу автоматически проверяет и поднимает PostgreSQL в Docker, а затем открывает два отдельных окна консоли со службами бэкенда и фронтенда.

## 5. Справочник по работе с Git
Все коммиты в репозитории формируются регулярно, небольшими логическими порциями и со строгим соблюдением соглашения Conventional Commits на русском языке:

feat(scope): ... — добавление нового функционала;

fix(scope): ... — исправление ошибок и багов;

refactor(scope): ... — оптимизация структуры кода без изменения поведения;

docs: ... — правки документации, схем и README;

test(scope): ... — добавление или правка тестов;

chore: ... — настройка сборки, пакетов, линтера или конфигурации.

Основные команды Git в консоли (терминале)
Просмотр состояния файлов и рабочего каталога:

Bash
git status
Индексация файлов (Staging):

Bash
git add <путь-к-файлу>       # Добавить конкретный файл в индекс
git add api/                # Добавить директорию бэкенда
git add app/                # Добавить директорию фронтенда
git add .                   # Подготовить все измененные файлы в текущей папке
Фиксация изменений (Commit):

Bash
git commit -m "feat(api): добавление валидации данных через joi"
git commit -m "fix(app): устранение ошибки выпадающего списка отделов"
git commit -m "docs: актуализация er-диаграммы и инструкций"
Отправка локальных коммитов на GitHub:

Bash
git push origin main
Получение и слияние изменений из удаленного репозитория:

Bash
git pull origin main
Работа с ветками:

Bash
git branch                  # Список локальных веток
git checkout -b <имя-ветки> # Создать ветку и переключиться на нее
git checkout main           # Переключиться на основную ветку
Просмотр истории коммитов (компактный граф):

Bash
git log --oneline --graph --decorate -n 10
Работа с Git в графическом интерфейсе Visual Studio Code (GUI)
Панель контроля версий (Source Control): вызывается сочетанием клавиш Ctrl + Shift + G или нажатием иконки ветвления на левой панели активности.

Индексация файлов:

Клик по значку + напротив конкретного файла переносит его в секцию Staged Changes.

Клик по значку + напротив общего заголовка Changes подготавливает все измененные файлы одновременно.

Создание коммита: введите содержательное сообщение коммита в верхнее текстовое поле ввода и нажмите комбинацию клавиш Ctrl + Enter (либо синюю кнопку Commit).

Синхронизация с GitHub: нажмите кнопку Sync Changes со стрелками в строке состояния внизу слева, либо перейдите в меню панели ... ➔ Push / Pull.

Просмотр различий (Diff Viewer): клик по любому файлу в списке изменений открывает параллельное сравнение «до/после» с подсветкой добавленных и удаленных строк.

## 6. Структура проекта
areal-hr_ext-test/
├── /api/                                # Серверная часть (NestJS 10, CommonJS)
│   ├── /migrations/                     # Миграции базы данных (node-pg-migrate)
│   │   ├── *_init_orgs_depts_positions.js
│   │   ├── *_add_indexes_and_constraints.js
│   │   ├── *_create_employees_and_files.js
│   │   ├── *_create_audit_logs_table.js
│   │   └── *_create_personnel_actions_table.js
│   ├── /src/
│   │   ├── /audit/                      # Сквозной журнал истории изменений (AUDIT_LOGS)
│   │   │   ├── audit.controller.ts
│   │   │   ├── audit.module.ts
│   │   │   ├── audit.service.ts
│   │   │   └── audit.service.spec.ts
│   │   ├── /common/                     # Общие фильтры и пайпы валидации
│   │   │   ├── /filters/
│   │   │   │   ├── pg-exception.filter.ts      # Перехват PG 23505 -> 409 Conflict, 23503 -> 400
│   │   │   │   └── pg-exception.filter.spec.ts
│   │   │   └── /pipes/
│   │   │       └── joi-validation.pipe.ts      # Пайп валидации схем с русскими ошибками
│   │   ├── /database/                   # Подключение пула PostgreSQL и изоляция констант
│   │   │   ├── database.constants.ts    # Константа PG_CONNECTION для тестов
│   │   │   └── database.module.ts
│   │   ├── /departments/                # Дерево отделов (CTE-проверка циклов, 409 Conflict)
│   │   │   ├── departments.controller.ts
│   │   │   ├── departments.dto.ts
│   │   │   ├── departments.module.ts
│   │   │   ├── departments.service.ts
│   │   │   └── departments.service.spec.ts
│   │   ├── /employees/                  # Сотрудники (календарные даты, транзакции, сканы)
│   │   │   ├── employees.controller.ts
│   │   │   ├── employees.dto.ts
│   │   │   ├── employees.module.ts
│   │   │   ├── employees.service.ts
│   │   │   └── employees.service.spec.ts
│   │   ├── /files/                      # Загрузка сканов Multer и фоновая очистка orphan-файлов
│   │   │   ├── files.constants.ts
│   │   │   ├── files.controller.ts
│   │   │   ├── files.module.ts
│   │   │   ├── files.service.ts
│   │   │   └── files.service.spec.ts
│   │   ├── /organizations/              # Организации (Soft Delete, контроль связей)
│   │   │   ├── organizations.controller.ts
│   │   │   ├── organizations.dto.ts
│   │   │   ├── organizations.module.ts
│   │   │   └── organizations.service.ts
│   │   ├── /personnel-actions/          # Кадровые операции (машина состояний, срезы)
│   │   │   ├── personnel-actions.controller.ts
│   │   │   ├── personnel-actions.dto.ts
│   │   │   ├── personnel-actions.module.ts
│   │   │   ├── personnel-actions.service.ts
│   │   │   └── personnel-actions.service.spec.ts
│   │   ├── /positions/                  # Должности (уникальность, мягкое удаление)
│   │   │   ├── positions.controller.ts
│   │   │   ├── positions.dto.ts
│   │   │   ├── positions.module.ts
│   │   │   └── positions.service.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── /uploads/                        # Локальное хранилище документов
│   │   └── /passports/
│   ├── .env
│   ├── package.json
│   └── tsconfig.json
├── /app/                                # Клиентская часть (Quasar v2, Vue 3, Vite)
│   ├── /src/
│   │   ├── /boot/
│   │   │   └── axios.js                 # HTTP-клиент с переменной VITE_API_URL
│   │   ├── /layouts/
│   │   │   └── MainLayout.vue
│   │   ├── /pages/
│   │   │   ├── IndexPage.vue            # Реестр, приказы, история, формы и справочники
│   │   │   └── ErrorNotFound.vue
│   │   └── /router/
│   │       └── routes.js
│   ├── .env
│   ├── package.json
│   └── quasar.config.js
├── /containers/                         # Конфигурации контейнеризации (подготовка к этапу деплоя)
│   ├── /api/
│   └── /app/
├── /docs/                               # Схемы данных и документация
│   ├── schema.drawio
│   └── schema.png
├── .env.example                         # Пример переменных окружения
├── .gitignore
├── docker-compose.yml                   # Запуск PostgreSQL 17
├── start-dev.bat                        # Скрипт одновременного запуска API и UI в dev-режиме
└── README.md                # Главная документация проекта


## 7. Статус реализации проекта
**Неделя 1 (Инфраструктура и проектирование):

Спроектирована ER-диаграмма в Draw.io со всеми типами, связями и частичными индексами.

Развернут изолированный контейнер PostgreSQL 17 в Docker.

**Неделя 2 (Справочники организаций, отделов и должностей):

CRUD-операции с поддержкой мягкого удаления (deleted_at).

Рекурсивный CTE-поиск циклических зависимостей в дереве отделов (A → B → A).

Защита от удаления сущностей с активными дочерними связями (статус 409 Conflict).

Единый JoiValidationPipe, защита UUID через ParseUUIDPipe, частичные уникальные индексы.

**Неделя 3 (Сотрудники и файлы документов):

Миграции employees, files и связующей employee_passport_files с составным PK (employee_id, file_id).

Модуль FilesModule на Multer (лимит 10 МБ, проверка MIME-типов, отдача потоком StreamableFile).

Регламентная очистка непривязанных (сиротских) файлов документов с диска и из БД.

Строгая валидация паспортов и календарных дат; транзакционная привязка сканов в БД.

**Неделя 4 (Кадровые операции и история изменений):

Сквозной модуль аудита audit_logs (JSONB-дельта { field: { old, new } }, автоматическая фиксация изменений).

Таблица personnel_actions с ограничением CHECK (action_type IN ('hire', 'transfer_dept', 'change_salary', 'fire')).

Машина состояний: валидация жизненного цикла сотрудника (нельзя уволить неустроенного, нельзя принять повторно без увольнения, проверка дат).

Расчет актуального кадрового среза (отдел, должность, оклад, статус) через LEFT JOIN LATERAL.

UI Quasar: проведение кадровых приказов в модальных окнах, таймлайн истории перемещений в личном деле.