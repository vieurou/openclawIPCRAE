import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { describe, expect, it } from "vitest";
import ipcraePlugin from "./index.js";

type RegisteredCommand = {
  name: string;
  handler: (ctx: {
    args?: string;
    channel?: string;
    senderId?: string;
  }) => Promise<{ text: string }>;
};

describe("IPCRAE plugin integration flow", () => {
  it("executes capture-local -> promote-note -> ipcrae-sync -> ipcrae-status", async () => {
    const root = await mkdtemp(join(tmpdir(), "ipcrae-flow-"));
    await mkdir(join(root, ".ipcrae", "prompts"), { recursive: true });
    await mkdir(join(root, "Phases"), { recursive: true });
    await mkdir(join(root, "Projets", "state-project"), { recursive: true });
    await mkdir(join(root, "Projets", "openclawIPCRAE"), { recursive: true });

    await writeFile(
      join(root, ".ipcrae", "context.md"),
      "Domaine actif: devops\nProjet actif: openclawIPCRAE\n",
    );
    await writeFile(
      join(root, ".ipcrae", "state.json"),
      JSON.stringify({ domain: "strategy", projectSlug: "state-project" }),
    );
    await writeFile(join(root, ".ipcrae", "instructions.md"), "Respecter le flux IPCRAE.");
    await writeFile(
      join(root, ".ipcrae", "prompts", "core_ai_pretreatment_gate.md"),
      "Toujours valider le contexte avant ecriture.",
    );
    await writeFile(join(root, "Phases", "index.md"), "Phase active: Execution");
    await writeFile(join(root, "Projets", "state-project", "tracking.md"), "Next action: initiale");
    await writeFile(
      join(root, "Projets", "openclawIPCRAE", "tracking.md"),
      "Next action: initiale",
    );

    const commands = new Map<string, RegisteredCommand>();
    const fakeApi = {
      pluginConfig: {
        ipcraeRoot: root,
        contextMode: "compact",
        autoJournal: true,
        autoCapture: true,
      },
      resolvePath: (input: string) => input,
      logger: {
        info: (_message: string) => undefined,
        warn: (_message: string) => undefined,
      },
      on: (_event: string, _handler: unknown) => undefined,
      registerCommand: (command: RegisteredCommand) => {
        commands.set(command.name, command);
      },
    } as unknown as OpenClawPluginApi;

    ipcraePlugin.register(fakeApi);

    const captureLocal = commands.get("capture-local");
    const promoteNote = commands.get("promote-note");
    const sync = commands.get("ipcrae-sync");
    const status = commands.get("ipcrae-status");

    expect(captureLocal).toBeDefined();
    expect(promoteNote).toBeDefined();
    expect(sync).toBeDefined();
    expect(status).toBeDefined();

    const captureResult = await captureLocal!.handler({
      args: "Hypothese volatile a promouvoir",
      channel: "cli",
      senderId: "tester",
    });
    expect(captureResult.text).toContain("Local note saved to ");
    const localPath = captureResult.text.replace("Local note saved to ", "").trim();

    const promoteResult = await promoteNote!.handler({ args: localPath });
    expect(promoteResult.text).toContain("Local note promoted to stable knowledge:");
    const knowledgePath = promoteResult.text
      .split("\n")
      .find((line) => line.startsWith("- knowledge: "))
      ?.replace("- knowledge: ", "")
      .trim();
    expect(knowledgePath).toBeTruthy();

    const syncResult = await sync!.handler({ args: "Action e2e de verification" });
    expect(syncResult.text).toContain("IPCRAE project synced for");

    const statusResult = await status!.handler({});
    expect(statusResult.text).toContain("- cdeMode: normal");
    expect(statusResult.text).toContain("- project: openclawIPCRAE");
    expect(statusResult.text).toContain("- domain: strategy");

    const knowledgeContent = await readFile(knowledgePath!, "utf8");
    expect(knowledgeContent).toContain("type: knowledge");
    expect(knowledgeContent).toContain(`- path: ${localPath}`);

    const trackingContent = await readFile(
      join(root, "Projets", "openclawIPCRAE", "tracking.md"),
      "utf8",
    );
    expect(trackingContent).toContain("next_action: Action e2e de verification");
  });
  it("shows actionable next fixes in status when CDE is degraded", async () => {
    const root = await mkdtemp(join(tmpdir(), "ipcrae-fixes-"));
    await mkdir(join(root, ".ipcrae"), { recursive: true });

    await writeFile(
      join(root, ".ipcrae", "context.md"),
      "Domaine actif: strategy\nProjet actif: demo\n",
    );

    const commands = new Map<string, RegisteredCommand>();
    const fakeApi = {
      pluginConfig: {
        ipcraeRoot: root,
        contextMode: "compact",
        autoJournal: true,
        autoCapture: true,
      },
      resolvePath: (input: string) => input,
      logger: {
        info: (_message: string) => undefined,
        warn: (_message: string) => undefined,
      },
      on: (_event: string, _handler: unknown) => undefined,
      registerCommand: (command: RegisteredCommand) => {
        commands.set(command.name, command);
      },
    } as unknown as OpenClawPluginApi;

    ipcraePlugin.register(fakeApi);

    const status = commands.get("ipcrae-status");
    expect(status).toBeDefined();

    const statusResult = await status!.handler({});
    expect(statusResult.text).toContain("- cdeMode: degraded");
    expect(statusResult.text).toContain("Next fixes:");
    expect(statusResult.text).toContain("Create required instructions file:");
    expect(statusResult.text).toContain("Create required phase index file:");
    expect(statusResult.text).toContain("Run /ipcrae-sync to initialize tracking:");
    expect(statusResult.text).toContain("Re-run /ipcrae-status after applying the fixes above.");
  });
});
