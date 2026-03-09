import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import type { Db } from './db';
import { HttpError } from './errors';
import { healthRoutes } from './routes/health';
import { taskRoutes } from './routes/tasks';

export interface AppDeps {
  db: Db;
  now?: () => Date;
  logger?: boolean;
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) return reply.code(error.status).send({ error: error.message });
    if (error instanceof ZodError) {
      const message = error.issues
        .map((i) => `${i.path.join('.') || 'value'}: ${i.message}`)
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

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({ error: `Route ${request.method} ${request.url} not found` }),
  );

  healthRoutes(app);
  taskRoutes(app, deps);
  return app;
}
