import type { TimestampFormat } from "@t3tools/contracts/settings";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import {
  resolveSnoozePresets as resolveSharedSnoozePresets,
  snoozeUntilThreadPreset,
  snoozeWakeLabel,
  type SnoozePreset,
} from "@t3tools/client-runtime/state/thread-settled";
import { sortThreads } from "@t3tools/client-runtime/state/thread-sort";

import { formatShortTimestamp, parseTimestampDate } from "../timestampFormat";

export { snoozeWakeLabel, type SnoozePreset };

const DAY_MS = 24 * 60 * 60 * 1_000;
const MAX_SNOOZE_TARGETS = 10;

function timeOfDayLabel(date: Date, timestampFormat: TimestampFormat): string {
  return formatShortTimestamp(date.toISOString(), timestampFormat);
}

export function resolveSnoozePresets(
  now: Date,
  timestampFormat: TimestampFormat,
): ReadonlyArray<SnoozePreset> {
  return resolveSharedSnoozePresets(now).map((preset) => {
    const wake = parseTimestampDate(preset.snoozedUntil);
    if (wake === null) return preset;
    const time = timeOfDayLabel(wake, timestampFormat);
    return {
      ...preset,
      whenLabel:
        preset.id === "next-week"
          ? `${wake.toLocaleDateString(undefined, { weekday: "short" })} ${time}`
          : time,
    };
  });
}

/**
 * Human wake time for menus and toasts: "tomorrow 9:00", "Mon 9:00",
 * "17:30" (today).
 */
export function snoozeWakeDescription(
  snoozedUntil: string,
  now: Date,
  timestampFormat: TimestampFormat,
): string {
  const wake = parseTimestampDate(snoozedUntil);
  if (wake === null) return "";
  const time = timeOfDayLabel(wake, timestampFormat);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayDelta = Math.floor((wake.getTime() - startOfToday.getTime()) / DAY_MS);
  if (dayDelta === 0) return time;
  if (dayDelta === 1) return `tomorrow ${time}`;
  const weekday = wake.toLocaleDateString(undefined, { weekday: "short" });
  if (dayDelta < 7) return `${weekday} ${time}`;
  const date = wake.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${date}, ${time}`;
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
