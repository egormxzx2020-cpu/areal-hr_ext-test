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
  // Таблица кадровых операций (PERSONNEL_ACTIONS)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS personnel_actions (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
      action_type varchar(20) NOT NULL CHECK (action_type IN ('hire', 'transfer_dept', 'change_salary', 'fire')),
      department_id uuid REFERENCES departments(id) ON DELETE RESTRICT,
      position_id uuid REFERENCES positions(id) ON DELETE RESTRICT,
      salary numeric(12, 2),
      action_date date NOT NULL,
      created_at timestamptz DEFAULT current_timestamp NOT NULL,
      updated_at timestamptz DEFAULT current_timestamp NOT NULL,
      deleted_at timestamptz
    );
  `);

  // Индексы на внешние ключи и выборку хронологии
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_personnel_actions_employee_id
    ON personnel_actions (employee_id);
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_personnel_actions_department_id
    ON personnel_actions (department_id);
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_personnel_actions_position_id
    ON personnel_actions (position_id);
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_personnel_actions_emp_date
    ON personnel_actions (employee_id, action_date DESC, created_at DESC);
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_personnel_actions_emp_date;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_personnel_actions_position_id;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_personnel_actions_department_id;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_personnel_actions_employee_id;`);
  pgm.sql(`DROP TABLE IF EXISTS personnel_actions;`);
};