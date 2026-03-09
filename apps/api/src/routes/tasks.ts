import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, TASK_STATUSES } from '@tasklane/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app';
import { HttpError, notFound, toId } from '../errors';
import { createTask, getTask, listTasks, setTaskStatus, userExists } from '../repo';

// Keeps (page - 1) * pageSize inside what SQLite accepts as an OFFSET.
const MAX_PAGE = 100_000;

const ListQuery = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

const CreateBody = z.object({
  title: z.string().trim().min(1).max(200),
  assigneeId: z.number().int().positive().nullable().default(null),
});

const PatchBody = z.object({ status: z.enum(TASK_STATUSES) });

export function taskRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { db } = deps;
  const now = deps.now ?? (() => new Date());

  app.get('/api/tasks', async (request) => listTasks(db, ListQuery.parse(request.query)));

  app.get<{ Params: { id: string } }>('/api/tasks/:id', async (request) => {
    const id = toId(request.params.id);
    const task = getTask(db, id);
    if (!task) throw notFound(`Task ${id}`);
    return task;
  });

  app.post('/api/tasks', async (request, reply) => {
    const body = CreateBody.parse(request.body);
    if (body.assigneeId !== null && !userExists(db, body.assigneeId)) {
      throw new HttpError(400, `Unknown assignee ${body.assigneeId}`);
    }
    return reply.code(201).send(createTask(db, body, now()));
  });

  app.patch<{ Params: { id: string } }>('/api/tasks/:id', async (request) => {
    const id = toId(request.params.id);
    const { status } = PatchBody.parse(request.body);
    const task = setTaskStatus(db, id, status);
    if (!task) throw notFound(`Task ${id}`);
    return task;
  });
}
