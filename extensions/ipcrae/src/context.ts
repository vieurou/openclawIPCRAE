import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { IPCRAEConfig } from "./config.js";

type CacheEntry = { expiresAt: number; value: string };

const textCache = new Map<string, CacheEntry>();

async function readTextCached(path: string, ttlMs: number): Promise<string | null> {
  const now = Date.now();
  const cached = textCache.get(path);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  try {
    const value = await readFile(path, "utf8");
    textCache.set(path, { value, expiresAt: now + ttlMs });
    return value;
  } catch {
    return null;
  }
}

function truncateText(input: string, maxChars: number): string {
  if (input.length <= maxChars) {
    return input;
  }
  return `${input.slice(0, Math.max(0, maxChars - 20)).trimEnd()}\n\n[truncated]`;
}

function normalizeBlock(title: string, body: string | null): string | null {
  if (!body) {
    return null;
  }
  const trimmed = body.trim();
  if (!trimmed) {
    return null;
  }
  return `## ${title}\n${trimmed}`;
}

function detectDomain(contextMd: string | null): string | undefined {
  if (!contextMd) {
    return undefined;
  }
  const match = contextMd.match(/Domaine actif:\s*([a-z0-9_-]+)/i);
  return match?.[1]?.trim();
}

function extractProjectSlugFromContext(contextMd: string | null): string | undefined {
  if (!contextMd) {
    return undefined;
  }
  const match = contextMd.match(/Projet actif:\s*([a-z0-9_-]+)/i);
  return match?.[1]?.trim();
}

export type IPCRAEStatusSnapshot = {
  domain?: string;
  projectSlug?: string;
  phaseIndexPath: string;
  projectTrackingPath?: string;
  phaseSummary?: string;
  projectTrackingSummary?: string;
};

export async function readIPCRAEStatusSnapshot(
  config: IPCRAEConfig,
): Promise<IPCRAEStatusSnapshot> {
  const contextPath = join(config.ipcraeRoot, ".ipcrae", "context.md");
  const phaseIndexPath = join(config.ipcraeRoot, "Phases", "index.md");

  const contextMd = await readTextCached(contextPath, config.contextCacheTtlMs);
  const domain = config.domain ?? detectDomain(contextMd);
  const projectSlug = config.projectSlug ?? extractProjectSlugFromContext(contextMd);
  const projectTrackingPath = projectSlug
    ? join(config.ipcraeRoot, "Projets", projectSlug, "tracking.md")
    : undefined;

  const [phaseIndex, tracking] = await Promise.all([
    readTextCached(phaseIndexPath, config.contextCacheTtlMs),
    projectTrackingPath ? readTextCached(projectTrackingPath, config.contextCacheTtlMs) : null,
  ]);

  return {
    domain,
    projectSlug,
    phaseIndexPath,
    projectTrackingPath,
    phaseSummary: phaseIndex ? truncateText(phaseIndex.trim(), 900) : undefined,
    projectTrackingSummary: tracking ? truncateText(tracking.trim(), 900) : undefined,
  };
}

export async function buildIPCRAEContext(config: IPCRAEConfig): Promise<string> {
  const contextPath = join(config.ipcraeRoot, ".ipcrae", "context.md");
  const ruleZeroPath = join(
    config.ipcraeRoot,
    ".ipcrae",
    "prompts",
    "core_ai_pretreatment_gate.md",
  );

  const contextMd = await readTextCached(contextPath, config.contextCacheTtlMs);
  if (!contextMd) {
    return "";
  }

  const status = await readIPCRAEStatusSnapshot(config);
  const domain = status.domain;
  const memoryPath = domain ? join(config.ipcraeRoot, "memory", `${domain}.md`) : null;
  const [ruleZeroMd, domainMemory] = await Promise.all([
    readTextCached(ruleZeroPath, config.contextCacheTtlMs),
    memoryPath ? readTextCached(memoryPath, config.contextCacheTtlMs) : null,
  ]);

  if (config.contextMode === "minimal") {
    return [
      "# IPCRAE Context (minimal)",
      normalizeBlock("Global Context", truncateText(contextMd.trim(), 2200)),
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  const blocks: Array<string | null> = [
    "# IPCRAE Context",
    normalizeBlock(
      "Rule 0",
      config.contextMode === "compact" ? truncateText(ruleZeroMd ?? "", 1200) : ruleZeroMd,
    ),
    normalizeBlock(
      "Global Context",
      config.contextMode === "compact" ? truncateText(contextMd.trim(), 2200) : contextMd,
    ),
    normalizeBlock(
      `Domain Memory${domain ? ` (${domain})` : ""}`,
      config.contextMode === "compact" ? truncateText(domainMemory ?? "", 1400) : domainMemory,
    ),
    normalizeBlock("Active Phase", status.phaseSummary),
    normalizeBlock(
      `Project Tracking${status.projectSlug ? ` (${status.projectSlug})` : ""}`,
      status.projectTrackingSummary,
    ),
  ];

  return blocks.filter(Boolean).join("\n\n");
}
