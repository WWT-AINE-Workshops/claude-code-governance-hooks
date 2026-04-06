import { describe, expect, it } from 'vitest';
import { buildControlPlane } from '../src/app';

const fixed = () => new Date('2026-04-06T09:00:00Z');

describe('control plane', () => {
  it('starts in run mode', async () => {
    const app = buildControlPlane({ now: fixed });
    const res = await app.inject({ method: 'GET', url: '/v1/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      mode: 'run',
      tools: [],
      reason: '',
      changedAt: '2026-04-06T09:00:00.000Z',
    });
  });

  it('halts with a reason, then resumes', async () => {
    const app = buildControlPlane({ now: fixed });
    const halt = await app.inject({
      method: 'POST',
      url: '/v1/halt',
      payload: { reason: 'drill' },
    });
    expect(halt.json()).toMatchObject({ mode: 'halt', reason: 'drill' });
    expect((await app.inject({ method: 'GET', url: '/v1/status' })).json().mode).toBe('halt');
    const resume = await app.inject({ method: 'POST', url: '/v1/resume' });
    expect(resume.json()).toMatchObject({ mode: 'run', reason: '', tools: [] });
  });

  it('suspends named tools only', async () => {
    const app = buildControlPlane({ now: fixed });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/suspend',
      payload: { reason: 'vendor incident', tools: ['WebFetch'] },
    });
    expect(res.json()).toMatchObject({ mode: 'suspend', tools: ['WebFetch'] });
  });

  it('rejects a halt with no reason', async () => {
    const app = buildControlPlane({ now: fixed });
    const res = await app.inject({ method: 'POST', url: '/v1/halt', payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/reason/);
  });

  it('answers health', async () => {
    const app = buildControlPlane();
    expect((await app.inject({ method: 'GET', url: '/health' })).json()).toEqual({ ok: true });
  });
});
