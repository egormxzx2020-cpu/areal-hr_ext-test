/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  // 1. Таблица метаданных файлов (FILES)
  // Включает updated_at и deleted_at по требованию ТЗ и замечаниям ментора
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS files (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      name varchar(255) NOT NULL,
      file_path varchar(500) NOT NULL,
      mime_type varchar(100) NOT NULL,
      size integer NOT NULL,
      created_at timestamptz DEFAULT current_timestamp NOT NULL,
      updated_at timestamptz DEFAULT current_timestamp NOT NULL,
      deleted_at timestamptz
    );
  `);

  // 2. Таблица сотрудников (EMPLOYEES)
  // Поля паспорта строго ограничены типами: серия varchar(4), номер varchar(6), код подразделения varchar(7)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS employees (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      last_name varchar(100) NOT NULL,
      first_name varchar(100) NOT NULL,
      middle_name varchar(100),
      birth_date date NOT NULL,
      passport_series varchar(4) NOT NULL,
      passport_number varchar(6) NOT NULL,
      passport_issue_date date NOT NULL,
      passport_department_code varchar(7) NOT NULL,
      passport_issued_by varchar(255) NOT NULL,
      reg_region varchar(100) NOT NULL,
      reg_city varchar(100) NOT NULL,
      reg_street varchar(150) NOT NULL,
      reg_house varchar(20) NOT NULL,
      reg_building varchar(20),
      reg_apartment varchar(20),
      created_at timestamptz DEFAULT current_timestamp NOT NULL,
      updated_at timestamptz DEFAULT current_timestamp NOT NULL,
      deleted_at timestamptz
    );
  `);

  // 3. Связующая таблица «сотрудник - сканы паспорта» (EMPLOYEE_PASSPORT_FILES)
  // Назначен составной первичный ключ PRIMARY KEY (employee_id, file_id) для исключения дублей
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS employee_passport_files (
      employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      file_id uuid NOT NULL REFERENCES files(id) ON DELETE RESTRICT,
      PRIMARY KEY (employee_id, file_id)
    );
  `);

  // 4. Индексы для ускорения поиска и фильтрации
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_employees_last_name
    ON employees (last_name)
    WHERE deleted_at IS NULL;
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_employees_passport
    ON employees (passport_series, passport_number)
    WHERE deleted_at IS NULL;
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_employee_passport_files_file_id
    ON employee_passport_files (file_id);
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS employee_passport_files;`);
  pgm.sql(`DROP TABLE IF EXISTS employees;`);
  pgm.sql(`DROP TABLE IF EXISTS files;`);
};