import { describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers';

describe('GET /api/health', () => {
  it('reports ok', async () => {
    const { app } = makeTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
