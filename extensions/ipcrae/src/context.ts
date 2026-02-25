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

function normalizeBlock(title: string, body: string | null | undefined): string | null {
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

function asSlug(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-");
  return normalized.replace(/^-+|-+$/g, "") || undefined;
}

async function readStateMetadata(
  statePath: string,
  ttlMs: number,
): Promise<{ domain?: string; projectSlug?: string }> {
  const raw = await readTextCached(statePath, ttlMs);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      domain: asSlug(parsed.domain),
      projectSlug: asSlug(parsed.projectSlug),
    };
  } catch {
    return {};
  }
}

export type IPCRAEStatusSnapshot = {
  domain?: string;
  projectSlug?: string;
  contextPath: string;
  instructionsPath: string;
  phaseIndexPath: string;
  projectTrackingPath?: string;
  instructionsSummary?: string;
  phaseSummary?: string;
  projectTrackingSummary?: string;
  cdeMode: "normal" | "degraded";
  missingRequiredPaths: string[];
};

export async function readIPCRAEStatusSnapshot(
  config: IPCRAEConfig,
): Promise<IPCRAEStatusSnapshot> {
  const contextPath = join(config.ipcraeRoot, ".ipcrae", "context.md");
  const instructionsPath = join(config.ipcraeRoot, ".ipcrae", "instructions.md");
  const statePath = join(config.ipcraeRoot, ".ipcrae", "state.json");
  const phaseIndexPath = join(config.ipcraeRoot, "Phases", "index.md");

  const contextMd = await readTextCached(contextPath, config.contextCacheTtlMs);
  const stateMeta = await readStateMetadata(statePath, config.contextCacheTtlMs);
  const domain = config.domain ?? stateMeta.domain ?? detectDomain(contextMd);
  const projectSlug =
    config.projectSlug ?? stateMeta.projectSlug ?? extractProjectSlugFromContext(contextMd);
  const projectTrackingPath = projectSlug
    ? join(config.ipcraeRoot, "Projets", projectSlug, "tracking.md")
    : undefined;

  const [instructions, phaseIndex, tracking] = await Promise.all([
    readTextCached(instructionsPath, config.contextCacheTtlMs),
    readTextCached(phaseIndexPath, config.contextCacheTtlMs),
    projectTrackingPath ? readTextCached(projectTrackingPath, config.contextCacheTtlMs) : null,
  ]);

  const missingRequiredPaths = [
    contextMd ? null : contextPath,
    instructions ? null : instructionsPath,
    phaseIndex ? null : phaseIndexPath,
  ].filter((value): value is string => Boolean(value));

  return {
    domain,
    projectSlug,
    contextPath,
    instructionsPath,
    phaseIndexPath,
    projectTrackingPath,
    instructionsSummary: instructions ? truncateText(instructions.trim(), 900) : undefined,
    phaseSummary: phaseIndex ? truncateText(phaseIndex.trim(), 900) : undefined,
    projectTrackingSummary: tracking ? truncateText(tracking.trim(), 900) : undefined,
    cdeMode: missingRequiredPaths.length ? "degraded" : "normal",
    missingRequiredPaths,
  };
}

export async function buildIPCRAEContext(config: IPCRAEConfig): Promise<string> {
  const contextPath = join(config.ipcraeRoot, ".ipcrae", "context.md");
  const instructionsPath = join(config.ipcraeRoot, ".ipcrae", "instructions.md");
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
  const [ruleZeroMd, instructionsMd, domainMemory] = await Promise.all([
    readTextCached(ruleZeroPath, config.contextCacheTtlMs),
    readTextCached(instructionsPath, config.contextCacheTtlMs),
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
      "Instructions",
      config.contextMode === "compact" ? truncateText(instructionsMd ?? "", 1200) : instructionsMd,
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
