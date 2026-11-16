const argon2 = require('argon2');

/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void>}
 */
exports.up = async (pgm) => {
  // 1. Таблица пользователей системы (USERS)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      last_name varchar(100) NOT NULL,
      first_name varchar(100) NOT NULL,
      middle_name varchar(100),
      login varchar(100) NOT NULL,
      password_hash varchar(255) NOT NULL,
      role varchar(20) NOT NULL CHECK (role IN ('admin', 'hr_manager')),
      created_at timestamptz DEFAULT current_timestamp NOT NULL,
      updated_at timestamptz DEFAULT current_timestamp NOT NULL,
      deleted_at timestamptz
    );
  `);

  // 2. Частичный уникальный индекс на логин среди активных пользователей
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_active
    ON users (login)
    WHERE deleted_at IS NULL;
  `);

  // 3. Внешний ключ и индекс для связи журнала аудита с автором изменений
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
    ON audit_logs (user_id);
  `);

  pgm.sql(`
    ALTER TABLE audit_logs
    ADD CONSTRAINT fk_audit_logs_user_id
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  `);

  // 4. Создание первичного администратора (пароль по умолчанию: Admin123!)
  const initialPasswordHash = await argon2.hash('Admin123!', {
    type: argon2.argon2id,
  });
  const escapedHash = initialPasswordHash.replace(/'/g, "''");

  pgm.sql(`
    INSERT INTO users (last_name, first_name, middle_name, login, password_hash, role)
    VALUES (
      'Администратор',
      'Системный',
      NULL,
      'admin',
      '${escapedHash}',
      'admin'
    )
    ON CONFLICT DO NOTHING;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void>}
 */
exports.down = async (pgm) => {
  pgm.sql(`ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS fk_audit_logs_user_id;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_audit_logs_user_id;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_users_login_active;`);
  pgm.sql(`DROP TABLE IF EXISTS users;`);
};