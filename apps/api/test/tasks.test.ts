import { describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers';

const get = (url: string) => makeTestApp().app.inject({ method: 'GET', url });

describe('GET /api/tasks', () => {
  it('returns the first page of 10 by default', async () => {
    const res = await get('/api/tasks');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ total: 12, page: 1, pageSize: 10 });
    expect(body.items).toHaveLength(10);
    expect(body.items[0]).toEqual({
      id: 1,
      title: 'Draft the Q3 roadmap outline',
      status: 'done',
      assigneeId: 1,
      createdAt: '2026-09-01T09:00:00.000Z',
    });
  });

  it('pages through the rest', async () => {
    const body = (await get('/api/tasks?page=2')).json();
    expect(body.items.map((t: { id: number }) => t.id)).toEqual([11, 12]);
  });

  it('honours pageSize and filters by status', async () => {
    const body = (await get('/api/tasks?status=todo&pageSize=3')).json();
    expect(body).toMatchObject({ total: 6, page: 1, pageSize: 3 });
    expect(body.items).toHaveLength(3);
    expect(body.items.every((t: { status: string }) => t.status === 'todo')).toBe(true);
  });

  it.each([
    'pageSize=0',
    'pageSize=51',
    'page=0',
    'page=x',
    'page=100001',
    'page=1e308',
    'status=blocked',
  ])('rejects ?%s with 400', async (q) => {
    const res = await get(`/api/tasks?${q}`);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toEqual(expect.any(String));
  });

  it('accepts the maximum pageSize of 50', async () => {
    expect((await get('/api/tasks?pageSize=50')).json().items).toHaveLength(12);
  });
});

describe('GET /api/tasks/:id', () => {
  it('returns one task', async () => {
    const res = await get('/api/tasks/4');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: 4, status: 'doing', assigneeId: 2 });
  });

  it('returns 404 for a task that does not exist', async () => {
    const res = await get('/api/tasks/999');
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Task 999 not found' });
  });
});

describe('POST /api/tasks', () => {
  const post = (payload: unknown) =>
    makeTestApp({ now: () => new Date('2026-10-01T08:00:00.000Z') }).app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: payload as object,
    });

  it('creates a todo task', async () => {
    const res = await post({ title: '  Ship it  ', assigneeId: 2 });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      id: 13,
      title: 'Ship it',
      status: 'todo',
      assigneeId: 2,
      createdAt: '2026-10-01T08:00:00.000Z',
    });
  });

  it('allows no assignee', async () => {
    expect((await post({ title: 'Loose end' })).json().assigneeId).toBeNull();
  });

  it.each([
    ['a missing title', {}],
    ['a blank title', { title: '   ' }],
    ['a title over 200 characters', { title: 'x'.repeat(201) }],
    ['a non-numeric assignee', { title: 'x', assigneeId: 'me' }],
    ['an unknown assignee', { title: 'x', assigneeId: 99 }],
  ])('rejects %s with 400', async (_name, payload) => {
    const res = await post(payload);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toEqual(expect.any(String));
  });
});

describe('PATCH /api/tasks/:id', () => {
  const patch = (id: number | string, payload: unknown) => {
    const { app } = makeTestApp();
    return app.inject({ method: 'PATCH', url: `/api/tasks/${id}`, payload: payload as object });
  };

  it('changes the status', async () => {
    const res = await patch(7, { status: 'doing' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: 7, status: 'doing' });
  });

  it('rejects an unknown status with 400', async () => {
    expect((await patch(7, { status: 'blocked' })).statusCode).toBe(400);
  });

  it('returns 404 for a task that does not exist', async () => {
    expect((await patch(999, { status: 'done' })).statusCode).toBe(404);
  });
});
