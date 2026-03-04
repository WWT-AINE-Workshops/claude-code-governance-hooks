import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openDb } from './db';
import { DB_FILE } from './paths';
import { resetDatabase } from './seed';

mkdirSync(dirname(DB_FILE), { recursive: true });
const db = openDb(DB_FILE);
resetDatabase(db);
const n = (t: string) => db.prepare(`SELECT COUNT(*) FROM ${t}`).pluck().get();
console.log(`Reset ${DB_FILE}: ${n('users')} users, ${n('tasks')} tasks`);
db.close();
