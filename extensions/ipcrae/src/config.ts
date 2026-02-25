import { homedir } from "node:os";
import { resolve } from "node:path";

export type IPCRAEContextMode = "minimal" | "compact" | "full";

export type IPCRAEConfig = {
  ipcraeRoot: string;
  contextMode: IPCRAEContextMode;
  autoJournal: boolean;
  autoCapture: boolean;
  domain?: string;
  projectSlug?: string;
  contextCacheTtlMs: number;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function expandTilde(input: string): string {
  if (input === "~") {
    return homedir();
  }
  if (input.startsWith("~/")) {
    return resolve(homedir(), input.slice(2));
  }
  return input;
}

function asMode(value: unknown): IPCRAEContextMode {
  return value === "minimal" || value === "compact" || value === "full" ? value : "compact";
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asPositiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function resolveIPCRAEConfig(
  value: unknown,
  resolvePath?: (input: string) => string,
): IPCRAEConfig {
  const raw = asObject(value);
  const rootRaw = asOptionalString(raw.ipcraeRoot) ?? "~/IPCRAE";
  const expanded = expandTilde(rootRaw);
  const ipcraeRoot = resolvePath && !rootRaw.startsWith("~") ? resolvePath(rootRaw) : expanded;

  return {
    ipcraeRoot,
    contextMode: asMode(raw.contextMode),
    autoJournal: asBoolean(raw.autoJournal, true),
    autoCapture: asBoolean(raw.autoCapture, true),
    domain: asOptionalString(raw.domain),
    projectSlug: asOptionalString(raw.projectSlug) ?? "openclawIPCRAE",
    contextCacheTtlMs: asPositiveNumber(raw.contextCacheTtlMs, 5 * 60 * 1000),
  };
}
