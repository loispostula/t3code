import { ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  buildThreadActionMenuItems,
  resolveSnoozeTarget,
  type ThreadActionMenuState,
} from "./threadActionMenu.logic";

const baseState: ThreadActionMenuState = {
  canOperate: true,
  branch: null,
  projectFilter: null,
  isPinned: false,
  isSettled: false,
  autoSettleEnabled: true,
  isSnoozed: false,
  canSnoozeNow: true,
  isRegeneratingTitle: false,
  isRunning: false,
  supports: {
    settlement: true,
    autoSettleOptOut: true,
    snooze: true,
    pinning: true,
    titleRegeneration: true,
  },
  snoozePresets: [
    { id: "hour", label: "In 1 hour", whenLabel: "3:00 PM", snoozedUntil: "2026-08-07T15:00:00Z" },
  ],
  snoozeTargets: [],
};

const target = {
  id: "until-thread",
  label: "Ship the API",
  whenLabel: "",
  snoozedUntil: "2026-09-06T14:00:00Z",
  untilThread: { id: ThreadId.make("thread-api"), title: "Ship the API" },
};

describe("buildThreadActionMenuItems", () => {
  it.each([false, true])(
    "disables both lifecycle directions without permission (reversed: %s)",
    (reversed) => {
      const items = buildThreadActionMenuItems({
        ...baseState,
        canOperate: false,
        isPinned: reversed,
        isSettled: reversed,
        isSnoozed: reversed,
      });
      const expected = reversed
        ? [
            "unpin",
            "unsettle",
            "unsnooze",
            "rename",
            "regenerate-title",
            "auto-settle",
            "archive",
            "delete",
          ]
        : [
            "pin",
            "settle",
            "snooze",
            "rename",
            "regenerate-title",
            "auto-settle",
            "archive",
            "delete",
          ];
      expect(items.filter((item) => item.disabled).map((item) => item.id)).toEqual(expected);
      expect(
        items.find((item) => item.id === "snooze")?.children?.every((child) => child.disabled) ??
          true,
      ).toBe(true);
    },
  );

  it("disables archive and turning into a project while the thread is running", () => {
    const items = buildThreadActionMenuItems({
      ...baseState,
      isRunning: true,
      canTurnIntoProject: true,
    });
    expect(items.find((item) => item.id === "archive")?.disabled).toBe(true);
    expect(items.find((item) => item.id === "turn-into-project")?.disabled).toBe(true);
  });

  it("nests snooze-until-thread targets and resolves clicks back to them", () => {
    const state = { ...baseState, snoozeTargets: [target] };
    const snooze = buildThreadActionMenuItems(state).find((item) => item.id === "snooze");
    expect(snooze?.children?.map((child) => child.id)).toEqual([
      "snooze:hour",
      "snooze-until",
      "snooze:custom",
    ]);
    const until = snooze?.children?.find((child) => child.id === "snooze-until");
    expect(until?.children).toEqual([{ id: "snooze-until:thread-api", label: "Ship the API" }]);
    expect(resolveSnoozeTarget("snooze-until:thread-api", [target])).toBe(target);
    expect(resolveSnoozeTarget("snooze:hour", [target])).toBeUndefined();
  });
});
