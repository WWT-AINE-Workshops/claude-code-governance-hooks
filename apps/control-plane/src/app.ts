import Fastify, { type FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';
import { ControlState } from './state';

const HaltBody = z.object({ reason: z.string().trim().min(1).max(200) });
const SuspendBody = HaltBody.extend({ tools: z.array(z.string().trim().min(1)).min(1) });

export interface ControlPlaneDeps {
  now?: () => Date;
  logger?: boolean;
}

export function buildControlPlane(deps: ControlPlaneDeps = {}): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false });
  const state = new ControlState(deps.now);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      const message = error.issues
        .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
        .join('; ');
      return reply.code(400).send({ error: message });
    }
    const err = error as Error & { statusCode?: number };
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: err.message });
    }
    request.log.error(err);
    return reply.code(500).send({ error: 'internal error' });
  });

  app.get('/health', async () => ({ ok: true }));
  app.get('/v1/status', async () => state.get());

  app.post('/v1/halt', async (request) => {
    const { reason } = HaltBody.parse(request.body ?? {});
    request.log.warn({ reason }, 'halt');
    return state.set('halt', reason);
  });

  app.post('/v1/suspend', async (request) => {
    const { reason, tools } = SuspendBody.parse(request.body ?? {});
    request.log.warn({ reason, tools }, 'suspend');
    return state.set('suspend', reason, tools);
  });

  app.post('/v1/resume', async (request) => {
    request.log.info('resume');
    return state.set('run');
  });

  return app;
}
