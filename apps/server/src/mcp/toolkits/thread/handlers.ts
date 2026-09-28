import { CommandId } from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";

import * as OrchestrationEngine from "../../../orchestration/Services/OrchestrationEngine.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import { ThreadTitleUpdateFailedError, ThreadToolkit } from "./tools.ts";

const make = Effect.gen(function* () {
  const engine = yield* OrchestrationEngine.OrchestrationEngineService;
  const crypto = yield* Crypto.Crypto;

  return ThreadToolkit.of({
    set_thread_title: ({ title }) =>
      Effect.gen(function* () {
        // Every token is scoped to one thread, so renaming it needs no capability.
        const { threadId } = yield* McpInvocationContext.McpInvocationContext;
        const uuid = yield* crypto.randomUUIDv4.pipe(Effect.orDie);
        yield* engine
          .dispatch({
            type: "thread.meta.update",
            commandId: CommandId.make(`server:mcp-thread-title:${threadId}:${uuid}`),
            threadId,
            title,
          })
          .pipe(
            Effect.catchCause((cause) =>
              Cause.hasInterruptsOnly(cause)
                ? Effect.failCause(cause as Cause.Cause<never>)
                : Effect.fail(new ThreadTitleUpdateFailedError({ cause })),
            ),
          );
        return { title };
      }),
  });
});

export const ThreadToolkitHandlersLive = ThreadToolkit.toLayer(make);
