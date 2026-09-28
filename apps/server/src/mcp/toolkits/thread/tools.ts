import { TrimmedNonEmptyString } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import * as Tool from "effect/unstable/ai/Tool";
import * as Toolkit from "effect/unstable/ai/Toolkit";

import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as OrchestrationEngine from "../../../orchestration/Services/OrchestrationEngine.ts";

export class ThreadTitleUpdateFailedError extends Schema.TaggedError<ThreadTitleUpdateFailedError>()(
  "ThreadTitleUpdateFailedError",
  { cause: Schema.Defect() },
) {
  override get message(): string {
    return "Could not rename the thread.";
  }
}

export const SetThreadTitleInput = Schema.Struct({
  title: TrimmedNonEmptyString.annotate({
    description: "The new thread title, for example DEV-123: Fix the login redirect.",
  }),
});

const SetThreadTitleTool = Tool.make("set_thread_title", {
  description:
    "Rename this thread in T3 Code. The title counts as a manual rename, so T3 Code stops generating titles for the thread.",
  parameters: SetThreadTitleInput,
  success: Schema.Struct({ title: Schema.String }),
  failure: ThreadTitleUpdateFailedError,
  dependencies: [
    McpInvocationContext.McpInvocationContext,
    OrchestrationEngine.OrchestrationEngineService,
  ],
})
  .annotate(Tool.Title, "Set thread title")
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false);

export const ThreadToolkit = Toolkit.make(SetThreadTitleTool);
