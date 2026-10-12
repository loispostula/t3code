import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { resolveSnoozeTargets } from "./Sidebar.snooze";

describe("resolveSnoozeTargets", () => {
  const environmentId = EnvironmentId.make("env-1");
  const projectId = ProjectId.make("project-1");
  function shell(id: string, latestUserMessageAt: string, overrides: object = {}) {
    return {
      environmentId,
      projectId,
      id: ThreadId.make(id),
      title: `Title ${id}`,
      archivedAt: null,
      settledOverride: null,
      lineage: {
        parentThreadId: null,
        relationshipToParent: null,
        rootThreadId: ThreadId.make(id),
      },
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: latestUserMessageAt,
      latestUserMessageAt,
      ...overrides,
    } as const;
  }

  it("lists unsettled threads of the same project, most recently active first", () => {
    const self = shell("self", "2026-09-05T00:00:00.000Z");
    const targets = resolveSnoozeTargets(
      self,
      [
        self,
        shell("older", "2026-09-02T00:00:00.000Z"),
        shell("newer", "2026-09-04T00:00:00.000Z"),
        shell("settled", "2026-09-04T00:00:00.000Z", { settledOverride: "settled" }),
        shell("archived", "2026-09-04T00:00:00.000Z", { archivedAt: "2026-09-04T00:00:00.000Z" }),
        shell("other-project", "2026-09-04T00:00:00.000Z", {
          projectId: ProjectId.make("project-2"),
        }),
        shell("subagent", "2026-09-04T00:00:00.000Z", {
          lineage: {
            parentThreadId: ThreadId.make("newer"),
            relationshipToParent: "subagent",
            rootThreadId: ThreadId.make("newer"),
          },
        }),
      ],
      new Date("2026-09-05T00:00:00.000Z"),
    );
    expect(targets.map((target) => target.untilThread?.id)).toEqual(["newer", "older"]);
    expect(targets[0]).toMatchObject({ id: "until-thread", label: "Title newer" });
  });

  it("caps the list at ten threads", () => {
    const self = shell("self", "2026-09-05T00:00:00.000Z");
    const others = Array.from({ length: 12 }, (_, index) =>
      shell(`thread-${index}`, `2026-09-0${(index % 4) + 1}T00:00:00.000Z`),
    );
    expect(resolveSnoozeTargets(self, others, new Date("2026-09-05T00:00:00.000Z"))).toHaveLength(
      10,
    );
  });
});
