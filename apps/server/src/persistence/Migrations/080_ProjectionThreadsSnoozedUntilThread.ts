import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const columns = yield* sql<{ readonly name: string }>`
    PRAGMA table_info(orchestration_v2_projection_threads)
  `;

  if (!columns.some((column) => column.name === "snoozed_until_thread_id")) {
    yield* sql`
      ALTER TABLE orchestration_v2_projection_threads
      ADD COLUMN snoozed_until_thread_id TEXT
    `;
  }

  // Settling, archiving, or deleting a thread looks up the threads snoozed until it.
  yield* sql`
    CREATE INDEX IF NOT EXISTS orchestration_v2_projection_threads_snoozed_until_thread_idx
    ON orchestration_v2_projection_threads(snoozed_until_thread_id)
    WHERE snoozed_until_thread_id IS NOT NULL
  `;
});
