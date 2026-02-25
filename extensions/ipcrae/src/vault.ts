import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

export type JournalEntry = {
  sessionId: string;
  messageCount: number;
  durationMs?: number;
  agentId?: string;
};

function formatDateYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatTime(date: Date): string {
  return date.toISOString().slice(11, 19);
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "capture"
  );
}

export async function writeJournalEntry(
  ipcraeRoot: string,
  date: Date,
  entry: JournalEntry,
): Promise<string> {
  const ymd = formatDateYmd(date);
  const dir = join(ipcraeRoot, "Journal", "Daily", ymd);
  const filePath = join(dir, "openclaw.md");
  await mkdir(dir, { recursive: true });

  const duration = typeof entry.durationMs === "number" ? `${entry.durationMs} ms` : "n/a";
  const block = [
    `## OpenClaw session ${formatTime(date)}`,
    `- sessionId: ${entry.sessionId}`,
    `- agentId: ${entry.agentId ?? "unknown"}`,
    `- messageCount: ${entry.messageCount}`,
    `- durationMs: ${duration}`,
    "",
  ].join("\n");

  await appendFile(filePath, block, "utf8");
  return filePath;
}

export type CaptureEntry = {
  text: string;
  channel?: string;
  senderId?: string;
  projectSlug?: string;
};

export type LocalNoteEntry = {
  text: string;
  channel?: string;
  senderId?: string;
  projectSlug?: string;
};

export type KnowledgeEntry = {
  text: string;
  title?: string;
  projectSlug?: string;
  domain?: string;
  tags?: string[];
  sources?: string[];
  strict?: boolean;
};

export type PromoteLocalNoteEntry = {
  localNotePath: string;
  title?: string;
  projectSlug?: string;
  domain?: string;
  tags?: string[];
};

function stripMarkdownHeading(input: string): string {
  return input
    .split("\n")
    .filter((line) => !line.trim().startsWith("## Note ") && !line.trim().startsWith("- "))
    .join("\n")
    .trim();
}

export async function promoteLocalNoteToKnowledge(
  ipcraeRoot: string,
  entry: PromoteLocalNoteEntry,
): Promise<{ knowledgePath: string; sourcePath: string }> {
  const sourcePath = entry.localNotePath.trim();
  if (!sourcePath) {
    throw new Error("Missing local note path");
  }
  const raw = await readFile(sourcePath, "utf8");
  const text = stripMarkdownHeading(raw);
  if (!text) {
    throw new Error(`Local note is empty: ${sourcePath}`);
  }

  const derivedTitle = entry.title?.trim() || basename(sourcePath, ".md");
  const knowledgePath = await writeKnowledgeNote(ipcraeRoot, {
    text,
    title: derivedTitle,
    projectSlug: entry.projectSlug,
    domain: entry.domain,
    tags: entry.tags,
    sources: [sourcePath],
  });

  return { knowledgePath, sourcePath };
}

export async function captureInbox(ipcraeRoot: string, entry: CaptureEntry): Promise<string> {
  const dir = join(ipcraeRoot, "Inbox", "idees");
  await mkdir(dir, { recursive: true });

  const now = new Date();
  const prefix = now.toISOString().replace(/[:]/g, "-").replace(/\..+$/, "");
  const titleSeed = entry.text.split(/\s+/).slice(0, 8).join(" ");
  const filePath = join(dir, `${prefix}-${slugify(titleSeed)}.md`);

  const content = [
    "---",
    "type: inbox",
    `created: ${now.toISOString()}`,
    entry.channel ? `channel: ${entry.channel}` : null,
    entry.senderId ? `sender: ${entry.senderId}` : null,
    entry.projectSlug ? `project: ${entry.projectSlug}` : null,
    "---",
    "",
    `# Capture ${formatDateYmd(now)}`,
    "",
    entry.text.trim(),
    "",
  ]
    .filter(Boolean)
    .join("\n");

  await writeFile(filePath, content, "utf8");
  return filePath;
}

export async function writeLocalNote(ipcraeRoot: string, entry: LocalNoteEntry): Promise<string> {
  const now = new Date();
  const ymd = formatDateYmd(now);
  const dir = join(ipcraeRoot, ".ipcrae-project", "local-notes", ymd);
  const filePath = join(dir, "openclaw.md");
  await mkdir(dir, { recursive: true });

  const block = [
    `## Note ${formatTime(now)}`,
    entry.channel ? `- channel: ${entry.channel}` : null,
    entry.senderId ? `- sender: ${entry.senderId}` : null,
    entry.projectSlug ? `- project: ${entry.projectSlug}` : null,
    "",
    entry.text.trim(),
    "",
  ]
    .filter(Boolean)
    .join("\n");

  await appendFile(filePath, block, "utf8");
  return filePath;
}

function normalizeTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .replace(/-{2,}/g, "-");
}

function assertValidKnowledgeDomain(domain: string | undefined): string {
  const normalized = normalizeTag(domain ?? "");
  if (!normalized) {
    throw new Error("Invalid knowledge domain: expected a non-empty domain (letters/numbers/_/-).");
  }
  return normalized;
}

function assertValidKnowledgeTags(tags: string[] | undefined): string[] {
  const normalizedTags = (tags ?? []).map(normalizeTag).filter(Boolean);
  if (!normalizedTags.length) {
    throw new Error(
      "Invalid knowledge tags: provide at least one tag (letters/numbers/_/- after normalization).",
    );
  }
  return normalizedTags;
}

function assertValidKnowledgeSources(sources: string[] | undefined, strict: boolean): string[] {
  const normalizedSources = (sources ?? []).map((source) => source.trim()).filter(Boolean);
  if (strict && !normalizedSources.length) {
    throw new Error(
      "Invalid knowledge sources: at least one source path is required in strict mode.",
    );
  }
  return normalizedSources;
}

export async function writeKnowledgeNote(
  ipcraeRoot: string,
  entry: KnowledgeEntry,
): Promise<string> {
  const now = new Date();
  const ymd = formatDateYmd(now);
  const dir = join(ipcraeRoot, "Knowledge");
  await mkdir(dir, { recursive: true });
  const strict = entry.strict ?? true;

  const title = entry.title?.trim() || entry.text.split(/\s+/).slice(0, 8).join(" ") || "knowledge";
  const filePath = join(dir, `${ymd}-${slugify(title)}.md`);
  const domain = assertValidKnowledgeDomain(entry.domain);
  const tags = assertValidKnowledgeTags(entry.tags ?? [domain]);
  const sources = assertValidKnowledgeSources(entry.sources, strict);
  const sourceLines = sources.map((source) => `  - path: ${source}`);

  const content = [
    "---",
    "type: knowledge",
    `tags: [${tags.join(", ")}]`,
    entry.projectSlug ? `project: ${entry.projectSlug}` : null,
    `domain: ${domain}`,
    "status: stable",
    "sources:",
    ...sourceLines,
    `created: ${ymd}`,
    `updated: ${ymd}`,
    "---",
    "",
    `# ${title}`,
    "",
    entry.text.trim(),
    "",
  ]
    .filter(Boolean)
    .join("\n");

  await writeFile(filePath, content, "utf8");
  return filePath;
}

export type ProjectSyncEntry = {
  projectSlug: string;
  domain?: string;
  actionText?: string;
};

function asSection(title: string, body: string): string {
  return `## ${title}\n${body.trim()}\n`;
}

function ensureHeading(content: string, heading: string): string {
  return content.trim()
    ? content
    : `${heading}

`;
}

function replaceManagedBlock(content: string, blockId: string, blockBody: string): string {
  const startMarker = `<!-- openclaw:${blockId}:start -->`;
  const endMarker = `<!-- openclaw:${blockId}:end -->`;
  const managed = `${startMarker}
${blockBody.trim()}
${endMarker}`;

  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);
  if (startIndex >= 0 && endIndex > startIndex) {
    const before = content.slice(0, startIndex).trimEnd();
    const after = content.slice(endIndex + endMarker.length).trimStart();
    return `${before}

${managed}${
      after
        ? `

${after}`
        : ""
    }
`;
  }

  const normalized = content.trimEnd();
  return `${normalized}

${managed}
`;
}

export async function syncProjectArtifacts(
  ipcraeRoot: string,
  entry: ProjectSyncEntry,
): Promise<{ indexPath: string; trackingPath: string; memoryPath: string }> {
  const now = new Date();
  const baseDir = join(ipcraeRoot, "Projets", entry.projectSlug);
  await mkdir(baseDir, { recursive: true });

  const indexPath = join(baseDir, "index.md");
  const trackingPath = join(baseDir, "tracking.md");
  const memoryPath = join(baseDir, "memory.md");

  const indexContent = [
    `# Projet ${entry.projectSlug}`,
    "",
    asSection(
      "Pilotage",
      [
        `- project: ${entry.projectSlug}`,
        `- domain: ${entry.domain ?? "unknown"}`,
        `- updated: ${now.toISOString()}`,
      ].join("\n"),
    ),
    asSection("Liens", "- tracking.md\n- memory.md"),
  ].join("\n");

  const trackingBlock = [
    "## OpenClaw Sync",
    `- updated: ${now.toISOString()}`,
    entry.actionText ? `- next_action: ${entry.actionText.trim()}` : "- next_action: (none)",
  ].join("\n");

  const memoryBlock = [
    "## OpenClaw Sync",
    `- updated: ${now.toISOString()}`,
    entry.actionText ? `- latest_signal: ${entry.actionText.trim()}` : "- latest_signal: (none)",
  ].join("\n");

  const currentTracking = await readFile(trackingPath, "utf8").catch(() => "");
  const currentMemory = await readFile(memoryPath, "utf8").catch(() => "");

  const nextTracking = replaceManagedBlock(
    ensureHeading(currentTracking, "# Tracking"),
    "ipcrae-tracking-sync",
    trackingBlock,
  );
  const nextMemory = replaceManagedBlock(
    ensureHeading(currentMemory, "# Memory"),
    "ipcrae-memory-sync",
    memoryBlock,
  );

  await writeFile(indexPath, indexContent, "utf8");
  await writeFile(trackingPath, nextTracking, "utf8");
  await writeFile(memoryPath, nextMemory, "utf8");

  return { indexPath, trackingPath, memoryPath };
}
