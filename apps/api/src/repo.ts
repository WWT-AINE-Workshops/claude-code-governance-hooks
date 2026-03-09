import type { Task, TaskPage, TaskStatus } from '@tasklane/shared';
import type { Db } from './db';

interface TaskRow {
  id: number;
  title: string;
  status: TaskStatus;
  assignee_id: number | null;
  created_at: string;
}

const toTask = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  status: r.status,
  assigneeId: r.assignee_id,
  createdAt: r.created_at,
});

export function listTasks(
  db: Db,
  opts: { status?: TaskStatus; page: number; pageSize: number },
): TaskPage {
  const where = opts.status ? 'WHERE status = ?' : '';
  const args = opts.status ? [opts.status] : [];
  const total = db
    .prepare(`SELECT COUNT(*) FROM tasks ${where}`)
    .pluck()
    .get(...args) as number;
  const rows = db
    .prepare(`SELECT * FROM tasks ${where} ORDER BY id LIMIT ? OFFSET ?`)
    .all(...args, opts.pageSize, (opts.page - 1) * opts.pageSize) as TaskRow[];
  return { items: rows.map(toTask), total, page: opts.page, pageSize: opts.pageSize };
}

export function getTask(db: Db, id: number): Task | undefined {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
  return row && toTask(row);
}

export function userExists(db: Db, id: number): boolean {
  return db.prepare('SELECT 1 FROM users WHERE id = ?').get(id) !== undefined;
}

export function createTask(
  db: Db,
  input: { title: string; assigneeId: number | null },
  now: Date,
): Task {
  const info = db
    .prepare('INSERT INTO tasks (title, status, assignee_id, created_at) VALUES (?, ?, ?, ?)')
    .run(input.title, 'todo', input.assigneeId, now.toISOString());
  return getTask(db, Number(info.lastInsertRowid))!;
}

export function setTaskStatus(db: Db, id: number, status: TaskStatus): Task | undefined {
  db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, id);
  return getTask(db, id);
}
