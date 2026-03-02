import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, TASK_STATUSES } from '../src';

describe('shared constants', () => {
  it('lists the three task statuses in board order', () => {
    expect(TASK_STATUSES).toEqual(['todo', 'doing', 'done']);
  });

  it('keeps the default page size within the maximum', () => {
    expect(DEFAULT_PAGE_SIZE).toBeLessThanOrEqual(MAX_PAGE_SIZE);
  });
});
