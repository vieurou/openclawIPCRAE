import type { IPCRAEStatusSnapshot } from "./context.js";

export type IPCRAEWriteStability = "volatile" | "stable";

export type IPCRAEWritePolicyResult = {
  allowed: boolean;
  reason?: string;
};

export function evaluateIPCRAEWritePolicy(
  status: IPCRAEStatusSnapshot,
  stability: IPCRAEWriteStability,
): IPCRAEWritePolicyResult {
  if (stability === "volatile") {
    return { allowed: true };
  }
  if (status.cdeMode === "normal") {
    return { allowed: true };
  }

  const missing = status.missingRequiredPaths.length
    ? status.missingRequiredPaths.join(", ")
    : "unknown prerequisites";
  return {
    allowed: false,
    reason:
      `IPCRAE write policy blocked: CDE mode is degraded. Missing required files: ${missing}. ` +
      "Use /capture-local for volatile notes, then restore required CDE files before stable writes.",
  };
}
