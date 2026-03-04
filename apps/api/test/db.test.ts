import { describe, expect, it } from 'vitest';
import { migrate, openDb } from '../src/db';
import { resetDatabase, seed } from '../src/seed';

describe('openDb / seed', () => {
  it('applies the migrations and is idempotent', () => {
    const db = openDb(':memory:');
    expect(db.prepare('SELECT name FROM schema_migrations').pluck().all()).toEqual([
      '001_init.sql',
    ]);
    expect(migrate(db)).toEqual([]);
  });

  it('seeds 3 users and 12 tasks', () => {
    const db = openDb(':memory:');
    seed(db);
    expect(db.prepare('SELECT COUNT(*) FROM users').pluck().get()).toBe(3);
    expect(db.prepare('SELECT COUNT(*) FROM tasks').pluck().get()).toBe(12);
  });

  it('enforces the status check and foreign keys', () => {
    const db = openDb(':memory:');
    expect(() =>
      db.prepare("INSERT INTO tasks (title, status, created_at) VALUES ('x', 'nope', 'now')").run(),
    ).toThrow(/CHECK/);
    expect(() =>
      db
        .prepare("INSERT INTO tasks (title, assignee_id, created_at) VALUES ('x', 99, 'now')")
        .run(),
    ).toThrow(/FOREIGN KEY/);
  });
});

describe('resetDatabase', () => {
  it('restores the seed data after changes', () => {
    const db = openDb(':memory:');
    seed(db);
    db.prepare('DELETE FROM tasks').run();
    resetDatabase(db);
    expect(db.prepare('SELECT COUNT(*) FROM tasks').pluck().get()).toBe(12);
  });
});
