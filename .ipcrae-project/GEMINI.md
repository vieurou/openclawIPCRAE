# ClawRAE (OpenClaw + IPCRAE) — Local AI Instructions

# Généré: 2026-02-25

# Source: /home/eric/IPCRAE/.ipcrae/prompts/provider_gemini.md

## Projet

- **Nom** : ClawRAE (openclawIPCRAE)
- **Type** : Fork OpenClaw avec intégration méthode IPCRAE
- **Hub cerveau** : `/home/eric/IPCRAE/Projets/ClawRAE/`
- **Phase active** : Phase 1 — IPCRAE Memory Backend

## Fichiers à lire avant de travailler sur ce projet

1. `/home/eric/IPCRAE/Projets/ClawRAE/memory.md` — Contraintes et décisions
2. `/home/eric/IPCRAE/Projets/ClawRAE/tracking.md` — État des tâches
3. `/home/eric/IPCRAE/memory/openclaw.md` — Mémoire domaine
4. `/home/eric/IPCRAE/.ipcrae/prompts/core_ai_workflow_ipcra.md` — Workflow obligatoire

## Stack & Points d'entrée

- **Runtime** : Node ≥22, pnpm
- **Dev** : `pnpm dev` (gateway watch: `pnpm gateway:watch`)
- **Tests** : `pnpm test` | `pnpm test:fast`
- **Build** : `pnpm build`
- **Lint** : `pnpm lint`
- **Entry** : `openclaw.mjs` → `src/` (TypeScript)

## Règles IPCRAE obligatoires

- Toute décision importante → `memory.md` ou `/home/eric/IPCRAE/memory/openclaw.md`
- Toute étape franchie → cocher `[x]` dans `tracking.md`
- Ne pas modifier AGENTS.md, SOUL.md, TOOLS.md natifs — intégration via `.ipcrae-project/` ou API plugin
- Commit fréquent : `git add -A && git commit`

## Contexte Architecture

```
/home/eric/DEV/openclawIPCRAE/
├── src/                     ← Code TypeScript OpenClaw
├── .ipcrae-project/         ← Structure IPCRAE locale (ne pas modifier ligne upstream)
│   ├── GEMINI.md            ← Ce fichier
│   ├── context.md           ← Contexte projet pour IA
│   └── memory/              ← Mémoire locale session
```
