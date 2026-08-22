import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  clearPendingTerminalInput,
  registerTerminalInputReceiver,
  sendTextToTerminal,
} from "./terminalInputBus";

const target = {
  environmentId: EnvironmentId.make("environment-1"),
  threadId: ThreadId.make("thread-1"),
  terminalId: "terminal-1",
};

describe("terminalInputBus", () => {
  it("delivers text to a mounted terminal", () => {
    const receive = vi.fn();
    const unregister = registerTerminalInputReceiver(target, receive);

    sendTextToTerminal(target, "git status");

    expect(receive).toHaveBeenCalledWith("git status");
    unregister();
  });

  it("queues text while a terminal surface mounts", () => {
    const receive = vi.fn();
    sendTextToTerminal(target, "pnpm test");

    const unregister = registerTerminalInputReceiver(target, receive);

    expect(receive).toHaveBeenCalledWith("pnpm test");
    unregister();
  });

  it("can discard text when opening the terminal fails", () => {
    const receive = vi.fn();
    sendTextToTerminal(target, "rm protected-file");
    clearPendingTerminalInput(target);

    const unregister = registerTerminalInputReceiver(target, receive);

    expect(receive).not.toHaveBeenCalled();
    unregister();
  });
});
