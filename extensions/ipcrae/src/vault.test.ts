import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  promoteLocalNoteToKnowledge,
  syncProjectArtifacts,
  writeKnowledgeNote,
  writeLocalNote,
} from "./vault.js";

describe("IPCRAE vault writers", () => {
  it("writes local notes under .ipcrae-project/local-notes", async () => {
    const root = await mkdtemp(join(tmpdir(), "ipcrae-vault-"));
    const filePath = await writeLocalNote(root, {
      text: "Hypothese temporaire sur le routing",
      projectSlug: "openclawIPCRAE",
      channel: "cli",
    });

    expect(filePath).toContain(join(".ipcrae-project", "local-notes"));
    const content = await readFile(filePath, "utf8");
    expect(content).toContain("Hypothese temporaire");
    expect(content).toContain("project: openclawIPCRAE");
  });

  it("writes stable knowledge notes with YAML frontmatter", async () => {
    const root = await mkdtemp(join(tmpdir(), "ipcrae-knowledge-"));
    const filePath = await writeKnowledgeNote(root, {
      text: "Toujours separer les notes volatiles de la connaissance stable.",
      title: "Separation local notes et knowledge",
      projectSlug: "openclawIPCRAE",
      domain: "devops",
      tags: ["devops", "ipcrae"],
      sources: ["docs/conception/03_IPCRAE_BRIDGE.md"],
    });

    expect(filePath).toContain(join("Knowledge", ""));
    const content = await readFile(filePath, "utf8");
    expect(content).toContain("type: knowledge");
    expect(content).toContain("project: openclawIPCRAE");
    expect(content).toContain("domain: devops");
    expect(content).toContain("- path: docs/conception/03_IPCRAE_BRIDGE.md");
  });

  it("rejects strict knowledge writes without sources", async () => {
    const root = await mkdtemp(join(tmpdir(), "ipcrae-knowledge-strict-"));
    await expect(
      writeKnowledgeNote(root, {
        text: "Note stable sans source",
        projectSlug: "openclawIPCRAE",
        domain: "devops",
        tags: ["devops"],
      }),
    ).rejects.toThrow(/source path is required in strict mode/i);
  });

  it("rejects invalid knowledge domain and tags", async () => {
    const root = await mkdtemp(join(tmpdir(), "ipcrae-knowledge-invalid-"));
    await expect(
      writeKnowledgeNote(root, {
        text: "Note stable",
        projectSlug: "openclawIPCRAE",
        domain: "   ",
        tags: ["devops"],
        sources: ["docs/conception/03_IPCRAE_BRIDGE.md"],
      }),
    ).rejects.toThrow(/invalid knowledge domain/i);

    await expect(
      writeKnowledgeNote(root, {
        text: "Note stable",
        projectSlug: "openclawIPCRAE",
        domain: "devops",
        tags: ["!!!"],
        sources: ["docs/conception/03_IPCRAE_BRIDGE.md"],
      }),
    ).rejects.toThrow(/invalid knowledge tags/i);
  });

  it("syncs project artifacts without appending noisy duplicate blocks", async () => {
    const root = await mkdtemp(join(tmpdir(), "ipcrae-sync-"));
    const first = await syncProjectArtifacts(root, {
      projectSlug: "openclawIPCRAE",
      domain: "devops",
      actionText: "Valider les hypotheses de phase",
    });

    await syncProjectArtifacts(root, {
      projectSlug: "openclawIPCRAE",
      domain: "devops",
      actionText: "Confirmer les hypotheses de phase",
    });

    const indexContent = await readFile(first.indexPath, "utf8");
    const trackingContent = await readFile(first.trackingPath, "utf8");
    const memoryContent = await readFile(first.memoryPath, "utf8");

    expect(indexContent).toContain("# Projet openclawIPCRAE");
    expect(trackingContent).toContain("next_action: Confirmer les hypotheses de phase");
    expect(memoryContent).toContain("latest_signal: Confirmer les hypotheses de phase");
    expect((trackingContent.match(/openclaw:ipcrae-tracking-sync:start/g) ?? []).length).toBe(1);
    expect((memoryContent.match(/openclaw:ipcrae-memory-sync:start/g) ?? []).length).toBe(1);
  });

  it("promotes a local note into stable knowledge explicitly", async () => {
    const root = await mkdtemp(join(tmpdir(), "ipcrae-promote-"));
    const localPath = await writeLocalNote(root, {
      text: "Hypothese temporaire a formaliser",
      projectSlug: "openclawIPCRAE",
      channel: "cli",
    });

    const result = await promoteLocalNoteToKnowledge(root, {
      localNotePath: localPath,
      projectSlug: "openclawIPCRAE",
      domain: "devops",
    });

    expect(result.sourcePath).toBe(localPath);
    const knowledgeContent = await readFile(result.knowledgePath, "utf8");
    expect(knowledgeContent).toContain("type: knowledge");
    expect(knowledgeContent).toContain("project: openclawIPCRAE");
    expect(knowledgeContent).toContain(`- path: ${localPath}`);
  });
});
