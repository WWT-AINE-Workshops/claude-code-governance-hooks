import { buildApp } from '../src/app';
import { openDb } from '../src/db';
import { seed } from '../src/seed';

export function makeTestApp(opts: { now?: () => Date } = {}) {
  const db = openDb(':memory:');
  seed(db);
  const app = buildApp({ db, now: opts.now });
  return { app, db };
}
