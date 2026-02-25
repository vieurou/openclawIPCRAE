---
type: context
tags: [openclaw, clawrae, ipcrae, context]
project: ClawRAE
domain: devops
created: 2026-02-25
updated: 2026-02-25
---

# Contexte Projet — ClawRAE

## Identité

**ClawRAE** = Fork OpenClaw (`openclawIPCRAE`) + Méthode IPCRAE.
Gateway IA personnel multi-canal, auto-hébergé, avec gouvernance cognitive IPCRAE.

## État Actuel

- **Phase** : Phase 1 — IPCRAE Memory Backend
- **Prochaine action** : P1.1 — Analyser `~/.openclaw/workspace` (structure actuelle)

## Liens Cerveau Global

- **Hub** : `/home/eric/IPCRAE/Projets/ClawRAE/`
- **Tracking** : `/home/eric/IPCRAE/Projets/ClawRAE/tracking.md`
- **Mémoire projet** : `/home/eric/IPCRAE/Projets/ClawRAE/memory.md`
- **Mémoire domaine** : `/home/eric/IPCRAE/memory/openclaw.md`

## Stack Technique

- Node ≥22, pnpm 10.23, TypeScript 5.x
- Pi agent runtime (`@mariozechner/pi-agent-core`)
- Gateway WebSocket (port 18789 par défaut)
- Extensions : Telegram, WhatsApp, Slack, Discord, Signal, Teams, Matrix…
- AI providers : Claude, GPT, Gemini, LLM local

## Fichiers Clés Source

| Fichier                     | Rôle                                                 |
| --------------------------- | ---------------------------------------------------- |
| `openclaw.mjs`              | Entrypoint CLI                                       |
| `src/`                      | Code TypeScript principal                            |
| `extensions/`               | Extensions canaux                                    |
| `skills/`                   | Skills bundlés                                       |
| `~/.openclaw/openclaw.json` | Config runtime (hors repo)                           |
| `~/.openclaw/workspace/`    | Workspace mémoire OpenClaw (à rediriger vers IPCRAE) |
