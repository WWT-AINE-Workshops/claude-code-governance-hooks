import type { TaskStatus } from '@tasklane/shared';
import { migrate, type Db } from './db';

export const USERS = [
  { id: 1, name: 'Mira Castillo', email: 'mira.castillo@tasklane.test' },
  { id: 2, name: 'Theo Lindqvist', email: 'theo.lindqvist@tasklane.test' },
  { id: 3, name: 'Noor Haddad', email: 'noor.haddad@tasklane.test' },
];

type SeedTask = [title: string, status: TaskStatus, assigneeId: number | null];

export const TASKS: SeedTask[] = [
  ['Draft the Q3 roadmap outline', 'done', 1],
  ['Set up the staging database', 'done', 2],
  ['Review the onboarding checklist', 'done', 3],
  ['Fix the login redirect loop', 'doing', 2],
  ['Write release notes for 1.4', 'doing', 1],
  ['Audit the dependency licences', 'doing', 3],
  ['Add rate limiting to the public API', 'todo', 2],
  ['Replace the placeholder logo', 'todo', 1],
  ['Plan the customer interview round', 'todo', 3],
  ['Archive last quarter’s tickets', 'todo', null],
  ['Document the backup procedure', 'todo', 2],
  ['Schedule the team retro', 'todo', null],
];

const day = (n: number) => `2026-09-${String(n).padStart(2, '0')}T09:00:00.000Z`;

export function seed(db: Db): void {
  const insertUser = db.prepare('INSERT INTO users (id, name, email) VALUES (@id, @name, @email)');
  const insertTask = db.prepare(
    'INSERT INTO tasks (id, title, status, assignee_id, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  db.transaction(() => {
    for (const u of USERS) insertUser.run(u);
    TASKS.forEach(([title, status, assignee], i) =>
      insertTask.run(i + 1, title, status, assignee, day(i + 1)),
    );
  })();
}

export function resetDatabase(db: Db): void {
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .pluck()
        .all() as string[];
      for (const name of tables) db.exec(`DROP TABLE IF EXISTS "${name}"`);
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
  migrate(db);
  seed(db);
}
