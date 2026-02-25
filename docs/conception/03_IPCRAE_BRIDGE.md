# IPCRAE Bridge — Contrat CDE explicite

## Ce que l'IA lit/écrit dans `.ipcrae-memory/`

- Lire: `.ipcrae/context.md`, `.ipcrae/instructions.md`, `memory/<domaine>.md`, `Projets/<projet>/`.
- Écrire: uniquement les apprentissages réutilisables et stables (multi-projets), jamais les brouillons/debug.

## Ce que l'IA écrit dans `.ipcrae-project/local-notes/`

- Notes volatiles: todo techniques, logs de debug, hypothèses temporaires.
- Ce contenu n'est pas une source de vérité durable.

## Ce qui est exporté vers `~/IPCRAE/Projets/<projet>/`

- `index.md`: état global, liens, contexte de pilotage.
- `tracking.md`: next actions et milestones.
- `memory.md`: synthèse projet consolidée.

## Ce qui est transformé en `Knowledge/` (stable)

- How-to/runbook/pattern réutilisable, taggé avec frontmatter YAML.
- Minimum attendu:

```yaml
---
type: knowledge
tags: [devops, exemple]
project: $(basename "$PWD")
domain: devops
status: stable
sources:
  - path: docs/conception/02_ARCHITECTURE.md
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

## Règle d'or

- Build/test ne dépendent jamais du cerveau global.
- IA/conception/doctor CDE: mode normal si cerveau présent, mode dégradé sinon.
