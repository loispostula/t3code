import { describe, expect, it } from "vite-plus/test";

import { parseForkBuild } from "./forkUpdates";

describe("parseForkBuild", () => {
  it("reads owner, repository and branch", () => {
    expect(parseForkBuild(" loispostula/t3code:feat/x ")).toEqual({
      owner: "loispostula",
      name: "t3code",
      branch: "feat/x",
    });
  });

  it("treats an upstream build or a malformed stamp as no fork", () => {
    expect(parseForkBuild("")).toBeNull();
    expect(parseForkBuild("loispostula/t3code")).toBeNull();
  });
});
