# @openclaw/ipcrae

OpenClaw plugin that integrates an IPCRAE vault into the agent workflow.

## Features

- Injects IPCRAE context before prompt build (`before_prompt_build`)
- Writes a session journal entry on `session_end`
- Adds `/capture`, `/capture-local`, `/capture-knowledge`, `/promote-note`, `/ipcrae-sync`, and `/ipcrae-status` commands
- Enforces a write policy gate: stable writes are blocked when CDE mode is degraded
- Enforces strict Knowledge frontmatter quality for stable writes (required `sources`, validated `domain`/`tags`)

## Example config

```yaml
plugins:
  entries:
    ipcrae:
      enabled: true
      config:
        ipcraeRoot: ~/IPCRAE
        contextMode: compact
        autoJournal: true
        autoCapture: true
        projectSlug: openclawIPCRAE
```
