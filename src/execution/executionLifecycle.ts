export type ExecutionState =
  | "DISCOVERED" | "QUALIFIED" | "RISK_APPROVED" | "BUILT"
  | "SIMULATED" | "SUBMITTED" | "CONFIRMED" | "RECONCILED"
  | "SETTLED" | "REJECTED" | "FAILED";

export type ExecutionEvent = {
  id: string;
  state: ExecutionState;
  timestamp: number;
  txHash?: string;
  reason?: string;
  realizedPnlUsd?: number;
};

const transitions: Record<ExecutionState, ExecutionState[]> = {
  DISCOVERED: ["QUALIFIED", "REJECTED"],
  QUALIFIED: ["RISK_APPROVED", "REJECTED"],
  RISK_APPROVED: ["BUILT", "REJECTED"],
  BUILT: ["SIMULATED", "REJECTED"],
  SIMULATED: ["SUBMITTED", "REJECTED"],
  SUBMITTED: ["CONFIRMED", "FAILED"],
  CONFIRMED: ["RECONCILED", "FAILED"],
  RECONCILED: ["SETTLED", "FAILED"],
  SETTLED: [],
  REJECTED: [],
  FAILED: []
};

export class ExecutionLifecycle {
  private state: ExecutionState = "DISCOVERED";
  private readonly events: ExecutionEvent[] = [];

  constructor(readonly id: string) {
    this.record("DISCOVERED");
  }

  transition(next: ExecutionState, meta: Omit<ExecutionEvent, "id" | "state" | "timestamp"> = {}): ExecutionEvent {
    if (!transitions[this.state].includes(next)) {
      throw new Error(`INVALID_EXECUTION_TRANSITION:${this.state}->${next}`);
    }
    this.state = next;
    return this.record(next, meta);
  }

  private record(state: ExecutionState, meta: Omit<ExecutionEvent, "id" | "state" | "timestamp"> = {}): ExecutionEvent {
    const event = { id: this.id, state, timestamp: Date.now(), ...meta };
    this.events.push(event);
    return event;
  }

  current(): ExecutionState { return this.state; }
  history(): readonly ExecutionEvent[] { return this.events; }
}
