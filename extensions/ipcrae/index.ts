import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { resolveIPCRAEConfig, type IPCRAEConfig } from "./src/config.js";
import { buildIPCRAEContext, readIPCRAEStatusSnapshot } from "./src/context.js";
import { captureInbox, writeJournalEntry } from "./src/vault.js";

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

async function safeStatus(api: OpenClawPluginApi, config: IPCRAEConfig): Promise<string> {
  try {
    const status = await readIPCRAEStatusSnapshot(config);
    return [
      "IPCRAE status:",
      `- root: ${config.ipcraeRoot}`,
      `- contextMode: ${config.contextMode}`,
      `- domain: ${status.domain ?? config.domain ?? "(unknown)"}`,
      `- project: ${status.projectSlug ?? config.projectSlug ?? "(unknown)"}`,
      `- phases: ${status.phaseSummary ? "loaded" : `missing (${status.phaseIndexPath})`}`,
      `- tracking: ${status.projectTrackingSummary ? "loaded" : status.projectTrackingPath ? `missing (${status.projectTrackingPath})` : "n/a"}`,
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
      name: "ipcrae-status",
      description: "Show IPCRAE vault integration status (phase/project/context).",
      acceptsArgs: false,
      handler: async () => ({ text: await safeStatus(api, config) }),
    });
  },
};

export default ipcraePlugin;
