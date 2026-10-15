import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || '';
if (!connectionString) throw new Error('DATABASE_URL is required to run migrations.');

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: true },
  max: 1,
  connectionTimeoutMillis: 10000,
});

try {
  const sql = await readFile(new URL('../db/migrations/001_initial.sql', import.meta.url), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE TABLE IF NOT EXISTS botverse_schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const applied = await client.query('SELECT version FROM botverse_schema_migrations WHERE version = $1', [1]);
    if (applied.rowCount) {
      console.log('Migration 001 already applied; no changes made.');
      await client.query('COMMIT');
    } else {
      await client.query(sql);
      await client.query('INSERT INTO botverse_schema_migrations (version, name) VALUES ($1, $2)', [1, 'initial BOTVERSE schema']);
      await client.query('COMMIT');
      console.log('Migration 001 applied successfully.');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
