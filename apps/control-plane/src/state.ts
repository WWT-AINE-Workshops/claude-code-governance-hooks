export const MODES = ['run', 'halt', 'suspend'] as const;
export type Mode = (typeof MODES)[number];

export interface ControlStatus {
  mode: Mode;
  tools: string[];
  reason: string;
  changedAt: string;
}

export class ControlState {
  private status: ControlStatus;

  constructor(private readonly now: () => Date = () => new Date()) {
    this.status = { mode: 'run', tools: [], reason: '', changedAt: this.now().toISOString() };
  }

  get(): ControlStatus {
    return { ...this.status, tools: [...this.status.tools] };
  }

  set(mode: Mode, reason = '', tools: string[] = []): ControlStatus {
    this.status = { mode, tools, reason, changedAt: this.now().toISOString() };
    return this.get();
  }
}
