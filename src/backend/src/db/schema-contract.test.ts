/**
 * Schema contract drift tests (T2, AC-2).
 *
 * `schema-contract.ts` carries the normative DDL verbatim. These tests parse the
 * contract, every numbered migration (`migrations/*.sql`) and the consolidated
 * `schema.sql` into normalized table/column/index metadata and prove two-way
 * coverage: every contract table/column exists in the shipped SQL and every
 * shipped table/column exists in the contract. The pinned-attribute test anchors
 * the exact defaults, NOT NULL constraints, primary/foreign/unique constraints
 * and the two `users` functional unique indexes that must survive a recreated
 * table. The real-Postgres catalog equivalence lives in
 * `schema-contract-postgres.test.ts`.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REQUIRED_TABLES } from './schema-contract.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(HERE, 'migrations');

interface ColumnShape {
  readonly type: string;
  readonly nullable: boolean;
  readonly defaultValue: string | null;
  readonly primaryKey: boolean;
  readonly unique: boolean;
  readonly references: string | null;
}

interface TableShape {
  readonly columns: Map<string, ColumnShape>;
}

interface IndexShape {
  readonly name: string;
  readonly table: string;
  readonly unique: boolean;
  readonly expression: string;
}

interface SchemaShape {
  readonly tables: Map<string, TableShape>;
  readonly indexes: IndexShape[];
}

/** Removes `--` line comments (none of the shipped SQL hides `;` or `--` in a literal). */
function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '');
}

/**
 * Splits a DDL file into statements. The shipped files contain no semicolon inside
 * a string literal or dollar-quoted block, so a plain split is exact for them; any
 * unexpected fragment is ignored by {@link applyStatement} and caught by the
 * table/column coverage assertions that follow.
 */
function splitStatements(sql: string): string[] {
  return stripComments(sql)
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter((statement) => statement.length > 0);
}

/** Splits a CREATE TABLE body on top-level commas (keeps `NUMERIC(18,2)` intact). */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  for (const char of body) {
    if (char === "'") {
      inString = !inString;
      current += char;
      continue;
    }
    if (!inString) {
      if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        depth -= 1;
      } else if (char === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
    }
    current += char;
  }
  if (current.trim() !== '') {
    parts.push(current.trim());
  }
  return parts;
}

function parseColumnDefinition(definition: string): ColumnShape {
  const normalized = definition.replace(/\s+/g, ' ').trim();
  const typeMatch = normalized.match(/^([A-Za-z]+(?:\([^)]*\))?)/);
  if (typeMatch === null) {
    throw new Error(`could not parse column type from: ${definition}`);
  }
  const defaultMatch = normalized.match(/\bDEFAULT\s+(.+)$/);
  const referencesMatch = normalized.match(
    /\bREFERENCES\s+([a-z_]+\s*\([a-z_]+\)(?:\s+ON DELETE [A-Z]+)?)/i,
  );
  const primaryKey = /\bPRIMARY KEY\b/.test(normalized);
  const notNull = /\bNOT NULL\b/.test(normalized);
  return {
    type: typeMatch[1].toLowerCase(),
    nullable: !notNull && !primaryKey,
    defaultValue: defaultMatch === null ? null : defaultMatch[1],
    primaryKey,
    unique: /\bUNIQUE\b/.test(normalized),
    references:
      referencesMatch === null ? null : referencesMatch[1].replace(/\s+/g, ' ').trim(),
  };
}

function requireTable(shape: SchemaShape, name: string): TableShape {
  const table = shape.tables.get(name);
  if (table === undefined) {
    throw new Error(`DDL does not define required table: ${name}`);
  }
  return table;
}

function createShape(): SchemaShape {
  return { tables: new Map<string, TableShape>(), indexes: [] };
}

function applyStatement(shape: SchemaShape, statement: string): void {
  const createTable = statement.match(
    /^CREATE TABLE IF NOT EXISTS\s+([a-z_]+)\s*\(([\s\S]*)\)$/,
  );
  if (createTable !== null) {
    const columns = new Map<string, ColumnShape>();
    for (const segment of splitTopLevel(createTable[2])) {
      if (/^(?:PRIMARY|UNIQUE|CHECK|CONSTRAINT|FOREIGN)\b/i.test(segment)) {
        continue;
      }
      const match = segment.match(/^([a-z_]+)\s+([\s\S]+)$/);
      if (match === null) {
        throw new Error(`could not parse column definition: ${segment}`);
      }
      columns.set(match[1], parseColumnDefinition(match[2]));
    }
    shape.tables.set(createTable[1], { columns });
    return;
  }

  const createIndex = statement.match(
    /^CREATE\s+(UNIQUE\s+)?INDEX IF NOT EXISTS\s+([a-z_]+)\s+ON\s+([a-z_]+)\s*\(([\s\S]*)\)$/,
  );
  if (createIndex !== null) {
    shape.indexes.push({
      name: createIndex[2],
      table: createIndex[3],
      unique: (createIndex[1] ?? '').trim().toUpperCase() === 'UNIQUE',
      expression: createIndex[4].replace(/\s+/g, ' ').trim(),
    });
    return;
  }

  const addColumn = statement.match(
    /^ALTER TABLE\s+([a-z_]+)\s+ADD COLUMN IF NOT EXISTS\s+([a-z_]+)\s+([\s\S]+)$/i,
  );
  if (addColumn !== null) {
    requireTable(shape, addColumn[1]).columns.set(
      addColumn[2],
      parseColumnDefinition(addColumn[3]),
    );
    return;
  }

  const setNotNull = statement.match(
    /^ALTER TABLE\s+([a-z_]+)\s+ALTER COLUMN\s+([a-z_]+)\s+SET NOT NULL$/i,
  );
  if (setNotNull !== null) {
    const table = requireTable(shape, setNotNull[1]);
    const column = table.columns.get(setNotNull[2]);
    if (column === undefined) {
      throw new Error(`DDL alters missing column: ${setNotNull[1]}.${setNotNull[2]}`);
    }
    table.columns.set(setNotNull[2], { ...column, nullable: false });
    return;
  }

  const setDefault = statement.match(
    /^ALTER TABLE\s+([a-z_]+)\s+ALTER COLUMN\s+([a-z_]+)\s+SET DEFAULT\s+([\s\S]+)$/i,
  );
  if (setDefault !== null) {
    const table = requireTable(shape, setDefault[1]);
    const column = table.columns.get(setDefault[2]);
    if (column === undefined) {
      throw new Error(`DDL alters missing column: ${setDefault[1]}.${setDefault[2]}`);
    }
    table.columns.set(setDefault[2], { ...column, defaultValue: setDefault[3].trim() });
  }
}

function applyDdl(shape: SchemaShape, sql: string): void {
  for (const statement of splitStatements(sql)) {
    applyStatement(shape, statement);
  }
}

function readContractShape(): SchemaShape {
  const shape = createShape();
  for (const table of REQUIRED_TABLES) {
    applyDdl(shape, table.statements.join('\n'));
  }
  return shape;
}

function readMigrationShapes(): SchemaShape {
  const shape = createShape();
  const names = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const name of names) {
    applyDdl(shape, readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8'));
  }
  return shape;
}

function readSchemaFileShape(): SchemaShape {
  const shape = createShape();
  applyDdl(shape, readFileSync(path.join(HERE, 'schema.sql'), 'utf8'));
  return shape;
}

function sortedColumns(table: TableShape): string[] {
  return [...table.columns.keys()].sort();
}

interface ColumnSelection {
  readonly [table: string]: readonly string[];
}

/** Picks concrete columns so one assertion pins their exact normalized shape. */
function selectColumns(
  shape: SchemaShape,
  selection: ColumnSelection,
): Record<string, Record<string, ColumnShape>> {
  const picked: Record<string, Record<string, ColumnShape>> = {};
  for (const [tableName, columnNames] of Object.entries(selection)) {
    const table = requireTable(shape, tableName);
    const columns: Record<string, ColumnShape> = {};
    for (const columnName of columnNames) {
      const column = table.columns.get(columnName);
      if (column === undefined) {
        throw new Error(`DDL does not define required column: ${tableName}.${columnName}`);
      }
      columns[columnName] = column;
    }
    picked[tableName] = columns;
  }
  return picked;
}

function uuidId(): ColumnShape {
  return {
    type: 'uuid',
    nullable: false,
    defaultValue: 'gen_random_uuid()',
    primaryKey: true,
    unique: false,
    references: null,
  };
}

function timestampNow(): ColumnShape {
  return {
    type: 'timestamptz',
    nullable: false,
    defaultValue: 'now()',
    primaryKey: false,
    unique: false,
    references: null,
  };
}

const CONTRACT_SHAPE = readContractShape();
const SCHEMA_FILE_SHAPE = readSchemaFileShape();
const MIGRATION_SHAPE = readMigrationShapes();

describe('schema contract tables', () => {
  it('declares exactly the five required tables in dependency order', () => {
    expect(REQUIRED_TABLES.map((table) => table.name)).toEqual([
      'users',
      'sessions',
      'verification_tokens',
      'user_economy',
      'schema_migrations',
    ]);
    expect([...CONTRACT_SHAPE.tables.keys()]).toEqual([
      'users',
      'sessions',
      'verification_tokens',
      'user_economy',
      'schema_migrations',
    ]);
  });

  it('declares every required column in the normative DDL order', () => {
    expect(
      REQUIRED_TABLES.map((table) => ({ name: table.name, columns: [...table.columns] })),
    ).toEqual([
      {
        name: 'users',
        columns: [
          'id',
          'username',
          'email',
          'password_hash',
          'verified',
          'failed_login_attempts',
          'locked_until',
          'created_at',
          'updated_at',
        ],
      },
      {
        name: 'sessions',
        columns: ['id', 'user_id', 'token_hash', 'expires_at', 'created_at', 'last_seen_at'],
      },
      {
        name: 'verification_tokens',
        columns: ['id', 'user_id', 'token_hash', 'expires_at', 'used_at', 'created_at'],
      },
      {
        name: 'user_economy',
        columns: [
          'user_id',
          'coins',
          'clicks',
          'faces_destroyed',
          'cubes_destroyed',
          'economy_revision',
          'upgrades',
          'lootboxes',
          'keys',
          'parts',
          'appearance',
          'customization_version',
          'last_seen_at',
          'updated_at',
        ],
      },
      {
        name: 'schema_migrations',
        columns: ['name', 'applied_at'],
      },
    ]);

    for (const table of REQUIRED_TABLES) {
      const parsed = requireTable(CONTRACT_SHAPE, table.name);
      expect([...parsed.columns.keys()]).toEqual([...table.columns]);
    }
  });

  it('uses only idempotent creation statements (no ALTER, DROP or DML)', () => {
    expect(
      REQUIRED_TABLES.map((table) => [table.name, table.statements.length] as const),
    ).toEqual([
      ['users', 3],
      ['sessions', 1],
      ['verification_tokens', 1],
      ['user_economy', 1],
      ['schema_migrations', 1],
    ]);

    for (const table of REQUIRED_TABLES) {
      expect(table.statements[0].startsWith(`CREATE TABLE IF NOT EXISTS ${table.name} (`)).toBe(
        true,
      );
      for (const statement of table.statements) {
        expect(statement).toMatch(/^CREATE (?:TABLE|UNIQUE INDEX) IF NOT EXISTS /);
        expect(statement.endsWith(';')).toBe(true);
        expect(statement).not.toMatch(/\b(?:DROP TABLE|DROP INDEX|ALTER TABLE|INSERT INTO|DELETE FROM)\b/);
      }
    }
  });
});

describe('schema contract versus schema.sql', () => {
  it('covers the same tables in both directions', () => {
    expect([...SCHEMA_FILE_SHAPE.tables.keys()].sort()).toEqual(
      [...CONTRACT_SHAPE.tables.keys()].sort(),
    );
    expect([...SCHEMA_FILE_SHAPE.tables.keys()].sort()).toEqual([
      'schema_migrations',
      'sessions',
      'user_economy',
      'users',
      'verification_tokens',
    ]);
  });

  it('covers the same columns with identical types, nullability and defaults', () => {
    for (const [name, contractTable] of CONTRACT_SHAPE.tables) {
      const schemaTable = requireTable(SCHEMA_FILE_SHAPE, name);
      expect(sortedColumns(schemaTable)).toEqual(sortedColumns(contractTable));
      for (const [columnName, contractColumn] of contractTable.columns) {
        const schemaColumn = schemaTable.columns.get(columnName);
        expect(schemaColumn).toEqual(contractColumn);
      }
    }
  });

  it('covers the same primary, foreign and unique constraints', () => {
    const constraintColumns = {
      sessions: ['user_id', 'token_hash'],
      user_economy: ['user_id'],
      verification_tokens: ['user_id', 'token_hash'],
    };
    expect(selectColumns(SCHEMA_FILE_SHAPE, constraintColumns)).toEqual(
      selectColumns(CONTRACT_SHAPE, constraintColumns),
    );
  });

  it('covers the same index definitions', () => {
    expect(SCHEMA_FILE_SHAPE.indexes).toEqual([
      {
        name: 'users_username_lower_uq',
        table: 'users',
        unique: true,
        expression: 'lower(username)',
      },
      {
        name: 'users_email_lower_uq',
        table: 'users',
        unique: true,
        expression: 'lower(email)',
      },
    ]);
    expect(SCHEMA_FILE_SHAPE.indexes).toEqual(CONTRACT_SHAPE.indexes);
  });
});

describe('schema contract versus migrations 001-007', () => {
  it('covers every migration table and column in both directions', () => {
    expect([...MIGRATION_SHAPE.tables.keys()].sort()).toEqual(
      [...CONTRACT_SHAPE.tables.keys()].sort(),
    );

    for (const [name, migratedTable] of MIGRATION_SHAPE.tables) {
      const contractTable = requireTable(CONTRACT_SHAPE, name);
      expect(sortedColumns(migratedTable)).toEqual(sortedColumns(contractTable));
      for (const [columnName, migratedColumn] of migratedTable.columns) {
        const contractColumn = contractTable.columns.get(columnName);
        expect(contractColumn).toEqual(migratedColumn);
      }
    }
  });

  it('covers every migration index in both directions', () => {
    expect(MIGRATION_SHAPE.indexes).toEqual(CONTRACT_SHAPE.indexes);
  });
});

describe('schema contract pinned attributes', () => {
  it('pins the id defaults, NOT NULL constraints and every application-critical default', () => {
    expect(
      selectColumns(CONTRACT_SHAPE, {
        users: [
          'id',
          'verified',
          'failed_login_attempts',
          'locked_until',
          'created_at',
          'updated_at',
        ],
        sessions: ['id', 'token_hash', 'expires_at', 'created_at', 'last_seen_at'],
        verification_tokens: ['id', 'token_hash', 'expires_at', 'used_at', 'created_at'],
        user_economy: [
          'user_id',
          'coins',
          'clicks',
          'faces_destroyed',
          'cubes_destroyed',
          'economy_revision',
          'upgrades',
          'lootboxes',
          'keys',
          'parts',
          'appearance',
          'customization_version',
          'last_seen_at',
          'updated_at',
        ],
        schema_migrations: ['applied_at'],
      }),
    ).toEqual({
      users: {
        id: uuidId(),
        verified: {
          type: 'boolean',
          nullable: false,
          defaultValue: 'FALSE',
          primaryKey: false,
          unique: false,
          references: null,
        },
        failed_login_attempts: {
          type: 'int',
          nullable: false,
          defaultValue: '0',
          primaryKey: false,
          unique: false,
          references: null,
        },
        locked_until: {
          type: 'timestamptz',
          nullable: true,
          defaultValue: null,
          primaryKey: false,
          unique: false,
          references: null,
        },
        created_at: timestampNow(),
        updated_at: timestampNow(),
      },
      sessions: {
        id: uuidId(),
        token_hash: {
          type: 'text',
          nullable: false,
          defaultValue: null,
          primaryKey: false,
          unique: true,
          references: null,
        },
        expires_at: {
          type: 'timestamptz',
          nullable: false,
          defaultValue: null,
          primaryKey: false,
          unique: false,
          references: null,
        },
        created_at: timestampNow(),
        last_seen_at: timestampNow(),
      },
      verification_tokens: {
        id: uuidId(),
        token_hash: {
          type: 'text',
          nullable: false,
          defaultValue: null,
          primaryKey: false,
          unique: true,
          references: null,
        },
        expires_at: {
          type: 'timestamptz',
          nullable: false,
          defaultValue: null,
          primaryKey: false,
          unique: false,
          references: null,
        },
        used_at: {
          type: 'timestamptz',
          nullable: true,
          defaultValue: null,
          primaryKey: false,
          unique: false,
          references: null,
        },
        created_at: timestampNow(),
      },
      user_economy: {
        user_id: {
          type: 'uuid',
          nullable: false,
          defaultValue: null,
          primaryKey: true,
          unique: false,
          references: 'users(id) ON DELETE CASCADE',
        },
        coins: {
          type: 'numeric(18,2)',
          nullable: false,
          defaultValue: '0',
          primaryKey: false,
          unique: false,
          references: null,
        },
        clicks: {
          type: 'bigint',
          nullable: false,
          defaultValue: '0',
          primaryKey: false,
          unique: false,
          references: null,
        },
        faces_destroyed: {
          type: 'bigint',
          nullable: false,
          defaultValue: '0',
          primaryKey: false,
          unique: false,
          references: null,
        },
        cubes_destroyed: {
          type: 'bigint',
          nullable: false,
          defaultValue: '0',
          primaryKey: false,
          unique: false,
          references: null,
        },
        economy_revision: {
          type: 'bigint',
          nullable: false,
          defaultValue: '0',
          primaryKey: false,
          unique: false,
          references: null,
        },
        upgrades: {
          type: 'jsonb',
          nullable: false,
          defaultValue: "'{}'::jsonb",
          primaryKey: false,
          unique: false,
          references: null,
        },
        lootboxes: {
          type: 'int',
          nullable: false,
          defaultValue: '0',
          primaryKey: false,
          unique: false,
          references: null,
        },
        keys: {
          type: 'int',
          nullable: false,
          defaultValue: '0',
          primaryKey: false,
          unique: false,
          references: null,
        },
        parts: {
          type: 'jsonb',
          nullable: false,
          defaultValue: "'{}'::jsonb",
          primaryKey: false,
          unique: false,
          references: null,
        },
        appearance: {
          type: 'jsonb',
          nullable: false,
          defaultValue: "'{}'::jsonb",
          primaryKey: false,
          unique: false,
          references: null,
        },
        customization_version: {
          type: 'int',
          nullable: false,
          defaultValue: '2',
          primaryKey: false,
          unique: false,
          references: null,
        },
        last_seen_at: timestampNow(),
        updated_at: timestampNow(),
      },
      schema_migrations: {
        applied_at: timestampNow(),
      },
    });
  });

  it('pins the foreign keys and the nullable FK column', () => {
    expect(
      selectColumns(CONTRACT_SHAPE, {
        sessions: ['user_id'],
        verification_tokens: ['user_id'],
      }),
    ).toEqual({
      sessions: {
        user_id: {
          type: 'uuid',
          nullable: true,
          defaultValue: null,
          primaryKey: false,
          unique: false,
          references: 'users(id) ON DELETE CASCADE',
        },
      },
      verification_tokens: {
        user_id: {
          type: 'uuid',
          nullable: false,
          defaultValue: null,
          primaryKey: false,
          unique: false,
          references: 'users(id) ON DELETE CASCADE',
        },
      },
    });
  });
});
