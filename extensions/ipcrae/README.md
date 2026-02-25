# @openclaw/ipcrae

OpenClaw plugin that integrates an IPCRAE vault into the agent workflow.

## Features

- Injects IPCRAE context before prompt build (`before_prompt_build`)
- Writes a session journal entry on `session_end`
- Adds `/capture` and `/ipcrae-status` commands

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
