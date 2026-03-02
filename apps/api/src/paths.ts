import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const API_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DB_FILE = process.env.TASKLANE_DB ?? join(API_ROOT, 'data', 'tasklane.db');
