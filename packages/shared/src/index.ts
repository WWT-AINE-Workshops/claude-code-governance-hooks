export const TASK_STATUSES = ['todo', 'doing', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Task {
  id: number;
  title: string;
  status: TaskStatus;
  assigneeId: number | null;
  createdAt: string;
}

export interface TaskPage {
  items: Task[];
  total: number;
  page: number;
  pageSize: number;
}

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;
