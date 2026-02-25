# Règles de l'IA pour ce Projet

## 1. Stack Technique & Conventions

- **Langages** : [Ex: TypeScript]
- **Frameworks** : [Ex: React, SvelteKit]
- **Tests** : [Ex: Vitest, Playwright]
- **Style** : [Ex: Pas de semicolon, 2 espaces]

## 2. Librairies Interdites / Autorisées

- **Interdit** : [Ex: axios (utiliser fetch), lodash (utiliser méthodes ES6 native)]
- **Autorisé** : [Ex: zod pour la validation]

## 3. Workflow de Validation et Git

Tout code produit doit être validé via `npm test` avant d'être considéré comme terminé ou suggéré.
**OBLIGATION ABSOLUE** : À la fin de chaque tâche ou modification significative, l'agent IA DOIT impérativement commiter ses changements sur le dépôt git local (`git add .` puis `git commit -m "..."`). Ne jamais terminer sans un commit si des fichiers ont été modifiés.
