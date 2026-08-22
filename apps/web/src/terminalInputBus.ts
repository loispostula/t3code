import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";

interface TerminalInputTarget {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly terminalId: string;
}

type TerminalInputReceiver = (text: string) => void;

const receivers = new Map<string, TerminalInputReceiver>();
const pendingTextByTerminal = new Map<string, string[]>();

function targetKey(target: TerminalInputTarget): string {
  return `${scopedThreadKey(target)}:${target.terminalId}`;
}

/** Delivers text to a terminal surface, or queues it until that surface mounts. */
export function sendTextToTerminal(target: TerminalInputTarget, text: string): void {
  if (text.length === 0) return;

  const key = targetKey(target);
  const receiver = receivers.get(key);
  if (receiver) {
    receiver(text);
    return;
  }

  const pending = pendingTextByTerminal.get(key);
  if (pending) {
    pending.push(text);
  } else {
    pendingTextByTerminal.set(key, [text]);
  }
}

/** Registers the mounted surface that owns terminal paste encoding. */
export function registerTerminalInputReceiver(
  target: TerminalInputTarget,
  receiver: TerminalInputReceiver,
): () => void {
  const key = targetKey(target);
  receivers.set(key, receiver);

  const pending = pendingTextByTerminal.get(key);
  if (pending) {
    pendingTextByTerminal.delete(key);
    for (const text of pending) receiver(text);
  }

  return () => {
    if (receivers.get(key) === receiver) receivers.delete(key);
  };
}

export function clearPendingTerminalInput(target: TerminalInputTarget): void {
  pendingTextByTerminal.delete(targetKey(target));
}
