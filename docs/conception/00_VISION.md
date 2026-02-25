# Vision et Objectifs du Projet

**Dernière mise à jour** : 2026-02-24
**Statut global** : 🔵 En Developpement

## 1. Pitch du Projet

OpenClawIPCRAE est un fork personnalisé d'OpenClaw — un gateway IA personnel auto-hébergé, multi-canal et multi-modèle. Il tourne sur les propres appareils de l'utilisateur, répond sur les messageries existantes (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Teams, Matrix…) et peut exécuter des tâches réelles (computer-use, navigation web, SMS, voix). Cœur de l'écosystème IPCRAE côté IA conversationnelle.

## 2. Objectifs Business / Métier

- **Objectif 1** : Disposer d'un assistant IA personnel toujours disponible, accessible depuis n'importe quelle messagerie, sans dépendance à un service cloud tiers
- **Objectif 2** : Intégrer OpenClaw dans l'écosystème IPCRAE (vault, workflows, automatisations) via ses hooks, skills et plugins
- **Objectif 3** : Centraliser les interactions IA (texte, voix, canvas, computer-use) dans un seul daemon auto-hébergé

## 3. Personas / Utilisateurs cibles

- **Eric (usage solo)** : utilisateur unique, besoin d'un assistant IA privé, puissant, extensible, accessible depuis WhatsApp/Telegram/CLI, capable d'agir sur ses machines

## 4. Ce que le projet N'EST PAS (Anti-objectifs)

- Ce n'est pas un SaaS multi-tenant — usage strictement solo/local
- Ce n'est pas un remplacement de Claude Code — complémentaire, orienté messagerie et automatisation
- Ce n'est pas un développement from-scratch — c'est un fork d'OpenClaw upstream maintenu activement
