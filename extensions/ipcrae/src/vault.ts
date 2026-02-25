import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

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
