import type { EnvironmentId } from "@t3tools/contracts";
import type { TimestampFormat } from "@t3tools/contracts/settings";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import {
  pickSnoozePreset as pickSharedSnoozePreset,
  resolveSnoozePresets as resolveSharedSnoozePresets,
  snoozeUntilThreadPreset,
  snoozeWakeLabel,
  type SnoozePreset,
} from "@t3tools/client-runtime/state/thread-settled";
import { sortThreads } from "@t3tools/client-runtime/state/thread-sort";

import { appAtomRegistry } from "../rpc/atomRegistry";
import { serverEnvironment } from "../state/server";
import { formatShortTimestamp } from "../timestampFormat";
import { toastManager } from "./ui/toast";

export { snoozeWakeLabel, type SnoozePreset };

const MAX_SNOOZE_TARGETS = 10;

/** The snooze menu for a thread, from its environment's presets, read when the menu opens. */
export function resolveSnoozePresets(
  now: Date,
  timestampFormat: TimestampFormat,
  environmentId: EnvironmentId,
): ReadonlyArray<SnoozePreset> {
  return resolveSharedSnoozePresets(now, snoozeOptions(timestampFormat, environmentId));
}

/** A shown menu choice as picked; see the shared `pickSnoozePreset`. */
export function pickSnoozePreset(
  shown: ReadonlyArray<SnoozePreset>,
  id: string,
  timestampFormat: TimestampFormat,
  environmentId: EnvironmentId,
): SnoozePreset | undefined {
  const picked = pickSharedSnoozePreset({
    shown,
    id,
    now: new Date(),
    ...snoozeOptions(timestampFormat, environmentId),
  });
  if (!picked) {
    toastManager.add({
      type: "warning",
      title: "Could not snooze thread",
      description: "That snooze time has passed. Choose another time.",
    });
  }
  return picked;
}

function snoozeOptions(timestampFormat: TimestampFormat, environmentId: EnvironmentId) {
  const presets = appAtomRegistry.get(
    serverEnvironment.settingsValueAtom(environmentId),
  )?.snoozePresets;
  return {
    ...(presets ? { presets } : {}),
    formatTime: (date: Date) => formatShortTimestamp(date.toISOString(), timestampFormat),
  };
}

/**
 * until-thread presets for the threads a snooze can wait on: same project,
 * visible in the sidebar and not settled, most recently active first.
 */
export function resolveSnoozeTargets(
  thread: Pick<EnvironmentThreadShell, "environmentId" | "projectId" | "id">,
  threads: ReadonlyArray<
    Pick<
      EnvironmentThreadShell,
      | "environmentId"
      | "projectId"
      | "id"
      | "title"
      | "archivedAt"
      | "settledOverride"
      | "lineage"
      | "createdAt"
      | "updatedAt"
      | "latestUserMessageAt"
    >
  >,
  now: Date,
): ReadonlyArray<SnoozePreset> {
  const candidates = threads.filter(
    (candidate) =>
      candidate.environmentId === thread.environmentId &&
      candidate.projectId === thread.projectId &&
      candidate.id !== thread.id &&
      candidate.archivedAt === null &&
      candidate.settledOverride !== "settled" &&
      candidate.lineage.relationshipToParent !== "subagent",
  );
  return sortThreads(candidates, "updated_at")
    .slice(0, MAX_SNOOZE_TARGETS)
    .map((candidate) => snoozeUntilThreadPreset(now, { id: candidate.id, title: candidate.title }));
}

/** Tooltip naming the thread a snooze waits on; null for timer-only snoozes. */
export function snoozeTargetTooltip(
  thread: Pick<EnvironmentThreadShell, "environmentId" | "snoozedUntilThreadId">,
  threads: ReadonlyArray<Pick<EnvironmentThreadShell, "environmentId" | "id" | "title">>,
): string | null {
  const targetId = thread.snoozedUntilThreadId;
  if (targetId === null) return null;
  const target = threads.find(
    (candidate) => candidate.environmentId === thread.environmentId && candidate.id === targetId,
  );
  return `Until "${target?.title ?? "a deleted thread"}" settles`;
}
