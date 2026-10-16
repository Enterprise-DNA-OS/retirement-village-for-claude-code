#!/usr/bin/env node
// Loads supabase/seed.sql: one fictional retirement village operator. Idempotent, safe to run twice.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';

export async function seed(db) {
  await db.exec('BEGIN');
  try { await db.exec(readFileSync(path.join(REPO_ROOT, 'supabase', 'seed.sql'), 'utf8')); await db.exec('COMMIT'); }
  catch (e) { await db.exec('ROLLBACK'); throw e; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const db = await getDb();
  try { await seed(db); console.log('Seed loaded: a fictional operator with three villages (NZ, NSW, QLD). Every name and record is invented.'); }
  finally { await db.close(); }
}
