import { existsSync } from 'node:fs';
import { buildApp } from './app';
import { openDb } from './db';
import { DB_FILE } from './paths';

if (!existsSync(DB_FILE)) {
  console.error(`No database at ${DB_FILE}. Run "npm run setup" first.`);
  process.exit(1);
}

const app = buildApp({ db: openDb(DB_FILE), logger: true });
const port = Number(process.env.PORT ?? 3001);

app.listen({ port, host: '127.0.0.1' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
