/**
 * A lightweight pub/sub for runtime execution progress, decoupling the runner
 * from UI panels. The graph panel subscribes to colour nodes as tasks complete.
 */

type Status = 'ok' | 'changed' | 'failed' | 'skipped' | 'unreachable';

export interface RuntimeEvent {
  kind: 'play' | 'task' | 'result';
  label: string;
  status?: Status;
  detail?: string;
}

type Listener = (e: RuntimeEvent) => void;

const listeners = new Set<Listener>();

export function subscribeRuntime(listener: Listener): { dispose(): void } {
  listeners.add(listener);
  return { dispose: () => listeners.delete(listener) };
}

export function emitRuntime(e: RuntimeEvent): void {
  for (const l of listeners) l(e);
}

export { type Status };
