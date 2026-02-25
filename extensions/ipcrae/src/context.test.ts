import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { IPCRAEConfig } from "./config.js";
import { buildIPCRAEContext, readIPCRAEStatusSnapshot } from "./context.js";

async function createFixture(options?: {
  withInstructions?: boolean;
  withState?: boolean;
}): Promise<{ root: string; config: IPCRAEConfig }> {
  const root = await mkdtemp(join(tmpdir(), "ipcrae-context-"));
  await mkdir(join(root, ".ipcrae", "prompts"), { recursive: true });
  await mkdir(join(root, "memory"), { recursive: true });
  await mkdir(join(root, "Phases"), { recursive: true });
  await mkdir(join(root, "Projets", "openclawIPCRAE"), { recursive: true });

  await writeFile(
    join(root, ".ipcrae", "context.md"),
    "Domaine actif: devops\nProjet actif: openclawIPCRAE\n",
  );
  if (options?.withState ?? true) {
    await mkdir(join(root, "Projets", "state-project"), { recursive: true });
    await writeFile(
      join(root, ".ipcrae", "state.json"),
      JSON.stringify({ domain: "strategy", projectSlug: "state-project" }),
    );
    await writeFile(
      join(root, "Projets", "state-project", "tracking.md"),
      "Next action: from-state",
    );
  }

  if (options?.withInstructions ?? true) {
    await writeFile(
      join(root, ".ipcrae", "instructions.md"),
      "Toujours respecter la methode IPCRAE.",
    );
  }
  await writeFile(
    join(root, ".ipcrae", "prompts", "core_ai_pretreatment_gate.md"),
    "Prioriser la coherence du CDE.",
  );
  await writeFile(join(root, "memory", "devops.md"), "Memoire stable");
  await writeFile(join(root, "Phases", "index.md"), "Phase active: Execution");
  await writeFile(join(root, "Projets", "openclawIPCRAE", "tracking.md"), "Next action: valider");

  const config: IPCRAEConfig = {
    ipcraeRoot: root,
    contextMode: "compact",
    autoJournal: true,
    autoCapture: true,
    contextCacheTtlMs: 1_000,
  };

  return { root, config };
}

describe("IPCRAE context", () => {
  it("includes instructions and project state in compact context", async () => {
    const { config } = await createFixture();
    const context = await buildIPCRAEContext(config);

    expect(context).toContain("## Instructions");
    expect(context).toContain("Toujours respecter la methode IPCRAE.");
    expect(context).toContain("## Active Phase");
    expect(context).toContain("## Project Tracking");
  });

  it("reports instructions in status snapshot", async () => {
    const { config } = await createFixture();
    const snapshot = await readIPCRAEStatusSnapshot(config);

    expect(snapshot.instructionsSummary).toContain("methode IPCRAE");
    expect(snapshot.instructionsPath).toContain(join(".ipcrae", "instructions.md"));
  });

  it("falls back to degraded CDE mode when required files are missing", async () => {
    const { config } = await createFixture({ withInstructions: false });
    const snapshot = await readIPCRAEStatusSnapshot(config);

    expect(snapshot.cdeMode).toBe("degraded");
    expect(
      snapshot.missingRequiredPaths.some((path) => path.endsWith(".ipcrae/instructions.md")),
    ).toBe(true);
  });

  it("prefers structured state metadata over regex parsing", async () => {
    const { config } = await createFixture({ withState: true });
    const snapshot = await readIPCRAEStatusSnapshot(config);

    expect(snapshot.domain).toBe("strategy");
    expect(snapshot.projectSlug).toBe("state-project");
  });

  it("falls back to regex parsing when state.json is missing", async () => {
    const { config } = await createFixture({ withState: false });
    const snapshot = await readIPCRAEStatusSnapshot(config);

    expect(snapshot.domain).toBe("devops");
    expect(snapshot.projectSlug).toBe("openclawIPCRAE");
  });
});
