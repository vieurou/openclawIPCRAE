# IPCRAE Skill

Use this skill when working inside an IPCRAE-enabled project (vault + local repo bridge).

## Rules

- Read local project context first (`.ai-instructions.md`, `docs/conception/*`, `.ipcrae-project/*`).
- Use the IPCRAE vault (`.ipcrae-memory/*` or configured `~/IPCRAE`) for reusable knowledge and MOC navigation.
- Prefer MOC-first navigation when a topic is broad (`Zettelkasten/MOC/*`, `Knowledge/MOC/*`).
- Write volatile notes to `.ipcrae-project/local-notes/`.
- Write stable reusable knowledge to `.ipcrae-memory/Knowledge/`.

## OpenClaw Integration Focus

- Prefer OpenClaw plugins/extensions/hooks for IPCRAE integration before changing core behavior.
- Typical hooks: `before_prompt_build`, `session_end`, command registration (`/capture`, `/ipcrae-status`).
- Keep build/test independent from the global brain (degraded mode must still work).
