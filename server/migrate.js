import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
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
  const dir = new URL('../db/migrations/', import.meta.url);
  const files = (await readdir(dir))
    .filter((name) => /^\d{3}_[a-z0-9_-]+\.sql$/i.test(name))
    .sort();
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS botverse_schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    for (const file of files) {
      const match = file.match(/^(\d{3})_(.+)\.sql$/i);
      const version = Number(match[1]);
      const name = match[2].replace(/_/g, ' ');
      const existing = await client.query('SELECT version FROM botverse_schema_migrations WHERE version = $1', [version]);
      if (existing.rowCount) {
        console.log('Migration ' + version + ' already applied; skipping.');
        continue;
      }
      const sql = await readFile(new URL(file, dir), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO botverse_schema_migrations (version, name) VALUES ($1, $2)', [version, name]);
        await client.query('COMMIT');
        console.log('Migration ' + version + ' applied successfully.');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
