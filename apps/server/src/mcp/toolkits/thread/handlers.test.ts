import {
  EnvironmentId,
  ProviderInstanceId,
  ThreadId,
  type OrchestrationCommand,
} from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import { OrchestrationCommandInvariantError } from "../../../orchestration/Errors.ts";
import { OrchestrationEngineService } from "../../../orchestration/Services/OrchestrationEngine.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import { ThreadToolkitHandlersLive } from "./handlers.ts";
import { ThreadToolkit } from "./tools.ts";

const THREAD_ID = ThreadId.make("thread-1");

const makeHarness = Effect.fn("makeThreadToolkitHarness")(function* (reject = false) {
  const commands = yield* Ref.make<ReadonlyArray<OrchestrationCommand>>([]);
  const dependencies = Layer.mergeAll(
    Layer.mock(OrchestrationEngineService)({
      readEvents: () => Stream.empty,
      dispatch: (command) =>
        reject
          ? Effect.fail(
              new OrchestrationCommandInvariantError({
                commandType: command.type,
                detail: "thread is gone",
              }),
            )
          : Ref.update(commands, (recorded) => [...recorded, command]).pipe(
              Effect.as({ sequence: 1 }),
            ),
      streamDomainEvents: Stream.empty,
      latestSequence: Effect.succeed(0),
    }),
    Layer.succeed(
      Crypto.Crypto,
      Crypto.make({
        randomBytes: (size) => new Uint8Array(size).fill(7),
        digest: (_algorithm, data) => Effect.succeed(data),
      }),
    ),
  );
  const toolkit = yield* ThreadToolkit.pipe(
    Effect.provide(ThreadToolkitHandlersLive.pipe(Layer.provide(dependencies))),
  );
  const call = (title: string) =>
    toolkit.handle("set_thread_title", { title }).pipe(
      Stream.unwrap,
      Stream.runCollect,
      Effect.map((chunk) => chunk.at(-1)!.result),
      Effect.provideService(McpInvocationContext.McpInvocationContext, {
        environmentId: EnvironmentId.make("environment-1"),
        threadId: THREAD_ID,
        providerSessionId: "provider-session-1",
        providerInstanceId: ProviderInstanceId.make("claude"),
        capabilities: new Set<McpInvocationContext.McpCapability>(),
        issuedAt: 1,
      }),
      Effect.provide(dependencies),
    );
  return { commands, call };
});

describe("thread toolkit handlers", () => {
  it.effect("renames the token's thread through thread.meta.update", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness();
      const result = yield* harness.call("DEV-123: Fix the login redirect");
      expect(result).toEqual({ title: "DEV-123: Fix the login redirect" });
      expect(yield* Ref.get(harness.commands)).toMatchObject([
        {
          type: "thread.meta.update",
          threadId: THREAD_ID,
          title: "DEV-123: Fix the login redirect",
        },
      ]);
    }),
  );

  it.effect("reports a rejected rename as a tool failure", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness(true);
      const error = yield* harness.call("DEV-123: Gone").pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "ThreadTitleUpdateFailedError" });
    }),
  );
});
