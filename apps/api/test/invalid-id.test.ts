import { describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers';

const BAD_IDS = ['abc', '0x10', '1.0', '1e0', '%201', '0', '-1'];

describe('a malformed task id', () => {
  it.each(BAD_IDS)('GET /api/tasks/%s returns 400', async (id) => {
    const { app } = makeTestApp();
    const res = await app.inject({ method: 'GET', url: `/api/tasks/${id}` });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid id' });
  });

  it('PATCH /api/tasks/abc returns 400', async () => {
    const { app } = makeTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/abc',
      payload: { status: 'done' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid id' });
  });
});
