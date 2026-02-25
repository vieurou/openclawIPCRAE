import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { resolveIPCRAEConfig, type IPCRAEConfig } from "./src/config.js";
import { buildIPCRAEContext, readIPCRAEStatusSnapshot } from "./src/context.js";
import { evaluateIPCRAEWritePolicy } from "./src/policy.js";
import {
  captureInbox,
  writeJournalEntry,
  promoteLocalNoteToKnowledge,
  writeKnowledgeNote,
  writeLocalNote,
  syncProjectArtifacts,
} from "./src/vault.js";

const ipcraeConfigSchema = {
  parse(value: unknown): IPCRAEConfig {
    return resolveIPCRAEConfig(value);
  },
  uiHints: {
    ipcraeRoot: { label: "IPCRAE Root", help: "Vault root path (for example ~/IPCRAE)." },
    contextMode: { label: "Context Mode", help: "minimal, compact, or full." },
    autoJournal: { label: "Auto Journal" },
    autoCapture: { label: "Auto Capture" },
    domain: { label: "Default Domain", advanced: true },
    projectSlug: { label: "Project Slug", advanced: true },
    contextCacheTtlMs: { label: "Context Cache TTL (ms)", advanced: true },
  },
};

async function safeBuildContext(api: OpenClawPluginApi, config: IPCRAEConfig): Promise<string> {
  try {
    return await buildIPCRAEContext(config);
  } catch (error) {
    api.logger.warn(
      `[ipcrae] failed to build context: ${error instanceof Error ? error.message : String(error)}`,
    );
    return "";
  }
}

function buildNextFixes(status: Awaited<ReturnType<typeof readIPCRAEStatusSnapshot>>): string[] {
  const fixes: string[] = [];

  if (status.missingRequiredPaths.includes(status.contextPath)) {
    fixes.push(`Create required context file: ${status.contextPath}`);
  }
  if (status.missingRequiredPaths.includes(status.instructionsPath)) {
    fixes.push(`Create required instructions file: ${status.instructionsPath}`);
  }
  if (status.missingRequiredPaths.includes(status.phaseIndexPath)) {
    fixes.push(`Create required phase index file: ${status.phaseIndexPath}`);
  }

  if (!status.projectSlug) {
    fixes.push(
      "Set active project in .ipcrae/state.json (projectSlug) or .ipcrae/context.md (Projet actif).",
    );
  }

  if (status.projectTrackingPath && !status.projectTrackingSummary) {
    fixes.push(`Run /ipcrae-sync to initialize tracking: ${status.projectTrackingPath}`);
  }

  if (status.cdeMode === "degraded") {
    fixes.push("Re-run /ipcrae-status after applying the fixes above.");
  }

  return fixes;
}

async function safeStatus(api: OpenClawPluginApi, config: IPCRAEConfig): Promise<string> {
  try {
    const status = await readIPCRAEStatusSnapshot(config);
    const nextFixes = buildNextFixes(status);

    return [
      "IPCRAE status:",
      `- root: ${config.ipcraeRoot}`,
      `- contextMode: ${config.contextMode}`,
      `- domain: ${status.domain ?? config.domain ?? "(unknown)"}`,
      `- project: ${status.projectSlug ?? config.projectSlug ?? "(unknown)"}`,
      `- cdeMode: ${status.cdeMode}`,
      `- instructions: ${status.instructionsSummary ? "loaded" : `missing (${status.instructionsPath})`}`,
      `- phases: ${status.phaseSummary ? "loaded" : `missing (${status.phaseIndexPath})`}`,
      `- tracking: ${status.projectTrackingSummary ? "loaded" : status.projectTrackingPath ? `missing (${status.projectTrackingPath})` : "n/a"}`,
      status.missingRequiredPaths.length
        ? `- missingRequired: ${status.missingRequiredPaths.join(", ")}`
        : "",
      nextFixes.length ? `\nNext fixes:\n${nextFixes.map((fix) => `- ${fix}`).join("\n")}` : "",
      status.instructionsSummary ? `\nInstructions:\n${status.instructionsSummary}` : "",
      status.phaseSummary ? `\nPhase summary:\n${status.phaseSummary}` : "",
      status.projectTrackingSummary ? `\nProject tracking:\n${status.projectTrackingSummary}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } catch (error) {
    return `IPCRAE status error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

const ipcraePlugin = {
  id: "ipcrae",
  name: "IPCRAE",
  description: "IPCRAE vault context injection, journaling, and capture commands",
  configSchema: ipcraeConfigSchema,
  register(api: OpenClawPluginApi) {
    const config = resolveIPCRAEConfig(api.pluginConfig, api.resolvePath);

    api.logger.info(
      `[ipcrae] enabled root=${config.ipcraeRoot} mode=${config.contextMode} autoJournal=${config.autoJournal} autoCapture=${config.autoCapture}`,
    );

    api.on("before_prompt_build", async () => {
      const prependContext = await safeBuildContext(api, config);
      if (!prependContext) {
        return;
      }
      return { prependContext };
    });

    api.on("session_end", async (event, ctx) => {
      if (!config.autoJournal) {
        return;
      }
      try {
        const filePath = await writeJournalEntry(config.ipcraeRoot, new Date(), {
          sessionId: event.sessionId,
          messageCount: event.messageCount,
          durationMs: event.durationMs,
          agentId: ctx.agentId,
        });
        api.logger.info(`[ipcrae] session journal appended: ${filePath}`);
      } catch (error) {
        api.logger.warn(
          `[ipcrae] failed session journal write: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    api.registerCommand({
      name: "capture",
      description: "Capture text into IPCRAE Inbox/idees.",
      acceptsArgs: true,
      handler: async (ctx) => {
        const text = ctx.args?.trim() ?? "";
        if (!config.autoCapture) {
          return { text: "IPCRAE capture is disabled by plugin config (autoCapture=false)." };
        }
        if (!text) {
          return { text: "Usage: /capture <texte>" };
        }
        try {
          const status = await readIPCRAEStatusSnapshot(config);
          const policy = evaluateIPCRAEWritePolicy(status, "volatile");
          if (!policy.allowed) {
            return { text: policy.reason ?? "IPCRAE write policy blocked." };
          }
          const filePath = await captureInbox(config.ipcraeRoot, {
            text,
            channel: ctx.channel,
            senderId: ctx.senderId,
            projectSlug: config.projectSlug,
          });
          return { text: `Captured to ${filePath}` };
        } catch (error) {
          return {
            text: `Capture failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    });

    api.registerCommand({
      name: "capture-local",
      description: "Capture volatile implementation notes into .ipcrae-project/local-notes.",
      acceptsArgs: true,
      handler: async (ctx) => {
        const text = ctx.args?.trim() ?? "";
        if (!text) {
          return { text: "Usage: /capture-local <note>" };
        }
        try {
          const status = await readIPCRAEStatusSnapshot(config);
          const policy = evaluateIPCRAEWritePolicy(status, "volatile");
          if (!policy.allowed) {
            return { text: policy.reason ?? "IPCRAE write policy blocked." };
          }
          const filePath = await writeLocalNote(config.ipcraeRoot, {
            text,
            channel: ctx.channel,
            senderId: ctx.senderId,
            projectSlug: config.projectSlug,
          });
          return { text: `Local note saved to ${filePath}` };
        } catch (error) {
          return {
            text: `Local note failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    });

    api.registerCommand({
      name: "capture-knowledge",
      description:
        "Capture a stable knowledge note into Knowledge/ (prefer /promote-note from local notes).",
      acceptsArgs: true,
      handler: async (ctx) => {
        const text = ctx.args?.trim() ?? "";
        if (!text) {
          return { text: "Usage: /capture-knowledge <note>" };
        }
        try {
          const status = await readIPCRAEStatusSnapshot(config);
          const policy = evaluateIPCRAEWritePolicy(status, "stable");
          if (!policy.allowed) {
            return { text: policy.reason ?? "IPCRAE write policy blocked." };
          }
          const domain = status.domain ?? config.domain ?? "general";
          const filePath = await writeKnowledgeNote(config.ipcraeRoot, {
            text,
            projectSlug: config.projectSlug,
            domain,
            tags: [domain],
            sources: ["extensions/ipcrae/index.ts"],
          });
          return { text: `Knowledge note saved to ${filePath}` };
        } catch (error) {
          return {
            text: `Knowledge capture failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    });

    api.registerCommand({
      name: "promote-note",
      description:
        "Promote a volatile local note into Knowledge/ (explicit volatile -> stable transition).",
      acceptsArgs: true,
      handler: async (ctx) => {
        const localNotePath = ctx.args?.trim() ?? "";
        if (!localNotePath) {
          return { text: "Usage: /promote-note <local-note-path>" };
        }
        try {
          const status = await readIPCRAEStatusSnapshot(config);
          const policy = evaluateIPCRAEWritePolicy(status, "stable");
          if (!policy.allowed) {
            return { text: policy.reason ?? "IPCRAE write policy blocked." };
          }
          const domain = status.domain ?? config.domain ?? "general";
          const result = await promoteLocalNoteToKnowledge(config.ipcraeRoot, {
            localNotePath,
            projectSlug: config.projectSlug,
            domain,
            tags: [domain],
          });
          return {
            text: [
              "Local note promoted to stable knowledge:",
              `- source: ${result.sourcePath}`,
              `- knowledge: ${result.knowledgePath}`,
            ].join("\n"),
          };
        } catch (error) {
          return {
            text: `Promote failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    });

    api.registerCommand({
      name: "ipcrae-sync",
      description: "Sync project index/tracking/memory artifacts in Projets/<slug>.",
      acceptsArgs: true,
      handler: async (ctx) => {
        const actionText = ctx.args?.trim();
        const projectSlug = config.projectSlug ?? "openclawIPCRAE";
        try {
          const status = await readIPCRAEStatusSnapshot(config);
          const policy = evaluateIPCRAEWritePolicy(status, "stable");
          if (!policy.allowed) {
            return { text: policy.reason ?? "IPCRAE write policy blocked." };
          }
          const paths = await syncProjectArtifacts(config.ipcraeRoot, {
            projectSlug,
            domain: config.domain,
            actionText: actionText || undefined,
          });
          return {
            text: [
              `IPCRAE project synced for ${projectSlug}:`,
              `- index: ${paths.indexPath}`,
              `- tracking: ${paths.trackingPath}`,
              `- memory: ${paths.memoryPath}`,
            ].join("\n"),
          };
        } catch (error) {
          return {
            text: `IPCRAE sync failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    });

    api.registerCommand({
      name: "ipcrae-status",
      description: "Show IPCRAE vault integration status (phase/project/context).",
      acceptsArgs: false,
      handler: async () => ({ text: await safeStatus(api, config) }),
    });
  },
};

export default ipcraePlugin;
