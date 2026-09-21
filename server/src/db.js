import './env.js';
import sql from 'mssql';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/**
 * Connection settings. Either:
 *   DATABASE_URL  = ADO-style ("Server=tcp:host,1433;Initial Catalog=db;User ID=u;Password=p;Encrypt=true")
 *                   or URL-style ("mssql://user:pass@host:1433/db?encrypt=true")
 * or discrete:
 *   DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD            (SQL authentication)
 *   DB_SERVER, DB_NAME, DB_AUTH=aad                     (Azure AD: az login locally, Managed Identity in Azure)
 */
function buildConfig() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const { DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD, DB_AUTH, DB_PORT } = process.env;
  if (!DB_SERVER || !DB_NAME) throw new Error('Database not configured: set DATABASE_URL, or DB_SERVER and DB_NAME (see .env.example)');
  const cfg = {
    server: DB_SERVER,
    port: Number(DB_PORT) || 1433,
    database: DB_NAME,
    options: { encrypt: true, trustServerCertificate: process.env.DB_TRUST_CERT === '1' },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 60000,
    requestTimeout: 60000,
  };
  if (DB_AUTH === 'aad') cfg.authentication = { type: 'azure-active-directory-default', options: {} };
  else { cfg.user = DB_USER; cfg.password = DB_PASSWORD; }
  return cfg;
}

let pool = null;

/** Connects (retrying while a serverless Azure SQL database resumes) and ensures the schema exists. */
export async function initDb() {
  if (pool) return pool;
  const cfg = buildConfig();
  const attempts = 6;
  for (let i = 1; i <= attempts; i++) {
    try {
      pool = await new sql.ConnectionPool(cfg).connect();
      break;
    } catch (err) {
      const resuming = /40613|not currently available|ETIMEOUT|ESOCKET/i.test(String(err.message) + String(err.code));
      if (!resuming || i === attempts) throw err;
      console.log(`Database not ready (${err.code || err.message.slice(0, 60)}); retrying in 10s (${i}/${attempts})…`);
      await new Promise(r => setTimeout(r, 10000));
    }
  }
  await pool.request().batch(SCHEMA);
  return pool;
}

export async function closeDb() { if (pool) { await pool.close(); pool = null; } }

function paramType(v) {
  if (typeof v === 'number') return Number.isInteger(v) && Math.abs(v) < 2147483647 ? sql.Int : sql.Float;
  if (typeof v === 'boolean') return sql.Bit;
  if (v instanceof Date) return sql.DateTime2;
  return sql.NVarChar;
}

/** Replace positional `?` placeholders with @p0, @p1… and bind values. */
function bind(request, text, params) {
  let i = 0;
  const converted = text.replace(/\?/g, () => `@p${i++}`);
  if (i !== params.length) throw new Error(`SQL expects ${i} params but got ${params.length}: ${text.slice(0, 80)}`);
  params.forEach((v, idx) => request.input(`p${idx}`, paramType(v), v === undefined ? null : v));
  return converted;
}

function makeQ(getRunner) {
  const exec = async (text, params) => {
    const request = getRunner().request();
    return request.query(bind(request, text, params));
  };
  return {
    all: async (text, ...params) => (await exec(text, params)).recordset ?? [],
    get: async (text, ...params) => (await exec(text, params)).recordset?.[0],
    run: async (text, ...params) => {
      const isInsert = /^\s*INSERT/i.test(text);
      const r = await exec(isInsert ? `${text}; SELECT CAST(SCOPE_IDENTITY() AS INT) AS id` : text, params);
      const sets = r.recordsets || [];
      return { lastInsertRowid: isInsert ? sets[sets.length - 1]?.[0]?.id : undefined, changes: r.rowsAffected?.[0] ?? 0 };
    },
  };
}

/** Query helpers on the shared pool: q.all(sql, ...params), q.get(...), q.run(...) */
export const q = makeQ(() => {
  if (!pool) throw new Error('Database not initialised: call initDb() first');
  return pool;
});

/** Run several statements atomically: await tx(async t => { await t.run(...); }) */
export async function tx(fn) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const result = await fn(makeQ(() => transaction));
    await transaction.commit();
    return result;
  } catch (err) {
    await transaction.rollback().catch(() => {});
    throw err;
  }
}

/**
 * Schema. SQL Server forbids multiple cascade paths to one table, so only the
 * single-path relations cascade (project→shares/items→contracts, user→shares/feedback).
 * transactions, documents and feedback are cleaned up explicitly in cascade.js.
 */
const SCHEMA = `
IF OBJECT_ID('rz_users','U') IS NULL
CREATE TABLE rz_users (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(200) NOT NULL,
  email NVARCHAR(320) NOT NULL UNIQUE,
  password_hash NVARCHAR(200) NOT NULL,
  role NVARCHAR(10) NOT NULL CHECK (role IN ('admin','user')),
  phone NVARCHAR(50) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('rz_projects','U') IS NULL
CREATE TABLE rz_projects (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(200) NOT NULL,
  location NVARCHAR(300) NULL,
  description NVARCHAR(MAX) NULL,
  type NVARCHAR(50) NOT NULL DEFAULT 'building',
  total_investment DECIMAL(18,2) NOT NULL DEFAULT 0,
  status NVARCHAR(30) NOT NULL DEFAULT 'active',
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('rz_project_shares','U') IS NULL
CREATE TABLE rz_project_shares (
  id INT IDENTITY(1,1) PRIMARY KEY,
  project_id INT NOT NULL REFERENCES rz_projects(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES rz_users(id) ON DELETE CASCADE,
  share_percent DECIMAL(7,4) NOT NULL CHECK (share_percent > 0 AND share_percent <= 100),
  invested_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  CONSTRAINT uq_rz_project_shares UNIQUE (project_id, user_id)
);

IF OBJECT_ID('rz_items','U') IS NULL
CREATE TABLE rz_items (
  id INT IDENTITY(1,1) PRIMARY KEY,
  project_id INT NOT NULL REFERENCES rz_projects(id) ON DELETE CASCADE,
  name NVARCHAR(200) NOT NULL,
  type NVARCHAR(50) NOT NULL DEFAULT 'shop',
  floor NVARCHAR(50) NULL,
  area_sqft DECIMAL(12,2) NULL,
  expected_rent DECIMAL(18,2) NOT NULL DEFAULT 0,
  status NVARCHAR(20) NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant','rented','maintenance')),
  notes NVARCHAR(MAX) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('rz_contracts','U') IS NULL
CREATE TABLE rz_contracts (
  id INT IDENTITY(1,1) PRIMARY KEY,
  item_id INT NOT NULL REFERENCES rz_items(id) ON DELETE CASCADE,
  tenant_name NVARCHAR(200) NOT NULL,
  tenant_phone NVARCHAR(50) NULL,
  tenant_email NVARCHAR(320) NULL,
  tenant_id_number NVARCHAR(100) NULL,
  tenant_address NVARCHAR(500) NULL,
  business_name NVARCHAR(200) NULL,
  start_date NVARCHAR(10) NOT NULL,
  end_date NVARCHAR(10) NOT NULL,
  monthly_rent DECIMAL(18,2) NOT NULL DEFAULT 0,
  deposit DECIMAL(18,2) NOT NULL DEFAULT 0,
  payment_day INT NOT NULL DEFAULT 1,
  status NVARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','terminated')),
  notes NVARCHAR(MAX) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('rz_transactions','U') IS NULL
CREATE TABLE rz_transactions (
  id INT IDENTITY(1,1) PRIMARY KEY,
  project_id INT NOT NULL REFERENCES rz_projects(id),
  item_id INT NULL REFERENCES rz_items(id),
  contract_id INT NULL REFERENCES rz_contracts(id),
  type NVARCHAR(10) NOT NULL CHECK (type IN ('income','expense')),
  category NVARCHAR(50) NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  [date] NVARCHAR(10) NOT NULL,
  description NVARCHAR(1000) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('rz_documents','U') IS NULL
CREATE TABLE rz_documents (
  id INT IDENTITY(1,1) PRIMARY KEY,
  project_id INT NOT NULL REFERENCES rz_projects(id),
  item_id INT NULL REFERENCES rz_items(id),
  contract_id INT NULL REFERENCES rz_contracts(id),
  title NVARCHAR(300) NOT NULL,
  category NVARCHAR(50) NOT NULL DEFAULT 'other',
  file_name NVARCHAR(200) NOT NULL,
  original_name NVARCHAR(300) NOT NULL,
  mime_type NVARCHAR(100) NULL,
  size INT NULL,
  uploaded_by INT NULL REFERENCES rz_users(id) ON DELETE SET NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('rz_feedback','U') IS NULL
CREATE TABLE rz_feedback (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL REFERENCES rz_users(id) ON DELETE CASCADE,
  project_id INT NOT NULL REFERENCES rz_projects(id),
  item_id INT NULL REFERENCES rz_items(id),
  message NVARCHAR(MAX) NOT NULL,
  admin_reply NVARCHAR(MAX) NULL,
  replied_at DATETIME2 NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('rz_settings','U') IS NULL
CREATE TABLE rz_settings (
  [key] NVARCHAR(50) PRIMARY KEY,
  value NVARCHAR(MAX) NOT NULL,
  updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rz_items_items_project' AND object_id = OBJECT_ID('rz_items')) CREATE INDEX ix_rz_items_items_project ON rz_items(project_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rz_contracts_contracts_item' AND object_id = OBJECT_ID('rz_contracts')) CREATE INDEX ix_rz_contracts_contracts_item ON rz_contracts(item_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rz_transactions_tx_project' AND object_id = OBJECT_ID('rz_transactions')) CREATE INDEX ix_rz_transactions_tx_project ON rz_transactions(project_id, [date]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rz_transactions_tx_item' AND object_id = OBJECT_ID('rz_transactions')) CREATE INDEX ix_rz_transactions_tx_item ON rz_transactions(item_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rz_project_shares_shares_user' AND object_id = OBJECT_ID('rz_project_shares')) CREATE INDEX ix_rz_project_shares_shares_user ON rz_project_shares(user_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rz_documents_docs_project' AND object_id = OBJECT_ID('rz_documents')) CREATE INDEX ix_rz_documents_docs_project ON rz_documents(project_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rz_feedback_feedback_project' AND object_id = OBJECT_ID('rz_feedback')) CREATE INDEX ix_rz_feedback_feedback_project ON rz_feedback(project_id);
`;
