import { describe, expect, it } from "vitest";
import type { IPCRAEStatusSnapshot } from "./context.js";
import { evaluateIPCRAEWritePolicy } from "./policy.js";

function makeStatus(overrides: Partial<IPCRAEStatusSnapshot> = {}): IPCRAEStatusSnapshot {
  return {
    contextPath: "/tmp/.ipcrae/context.md",
    instructionsPath: "/tmp/.ipcrae/instructions.md",
    phaseIndexPath: "/tmp/Phases/index.md",
    cdeMode: "normal",
    missingRequiredPaths: [],
    ...overrides,
  };
}

describe("evaluateIPCRAEWritePolicy", () => {
  it("allows stable writes in normal CDE mode", () => {
    const result = evaluateIPCRAEWritePolicy(makeStatus({ cdeMode: "normal" }), "stable");
    expect(result.allowed).toBe(true);
  });

  it("blocks stable writes in degraded CDE mode", () => {
    const result = evaluateIPCRAEWritePolicy(
      makeStatus({
        cdeMode: "degraded",
        missingRequiredPaths: ["/tmp/.ipcrae/instructions.md"],
      }),
      "stable",
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("degraded");
    expect(result.reason).toContain("/tmp/.ipcrae/instructions.md");
  });

  it("allows volatile writes in degraded CDE mode", () => {
    const result = evaluateIPCRAEWritePolicy(
      makeStatus({ cdeMode: "degraded", missingRequiredPaths: ["x"] }),
      "volatile",
    );
    expect(result.allowed).toBe(true);
  });
});
