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
  // Неизменяемый журнал аудита изменений (AUDIT_LOGS)
  // deleted_at отсутствует по ТЗ (журнал не редактируется и не удаляется)
  // entity_id имеет тип UUID, полиморфная ссылка на сущности системы
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      changed_at timestamptz DEFAULT current_timestamp NOT NULL,
      user_id uuid,
      entity_type varchar(50) NOT NULL,
      entity_id uuid NOT NULL,
      changed_fields jsonb NOT NULL
    );
  `);

  // Составной индекс для быстрого поиска истории по сущности
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
    ON audit_logs (entity_type, entity_id);
  `);

  // Индекс для выборки общего журнала в хронологическом порядке
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at
    ON audit_logs (changed_at DESC);
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_audit_logs_changed_at;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_audit_logs_entity;`);
  pgm.sql(`DROP TABLE IF EXISTS audit_logs;`);
};