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
  // 1. Индексы на внешние ключи departments
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_departments_organization_id
    ON departments (organization_id);
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_departments_parent_id
    ON departments (parent_id);
  `);

  // 2. Частичный уникальный индекс на наименование организации
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_name_unique
    ON organizations (name)
    WHERE deleted_at IS NULL;
  `);

  // 3. Частичный уникальный индекс на наименование должности
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_positions_name_unique
    ON positions (name)
    WHERE deleted_at IS NULL;
  `);

  // 4. Частичный составной уникальный индекс для отделов
  // NULLS NOT DISTINCT гарантирует уникальность и для корневых отделов (где parent_id IS NULL)
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_org_parent_name_unique
    ON departments (organization_id, parent_id, name)
    NULLS NOT DISTINCT
    WHERE deleted_at IS NULL;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_departments_org_parent_name_unique;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_positions_name_unique;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_organizations_name_unique;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_departments_parent_id;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_departments_organization_id;`);
};