# [Nom du Concept / Fonctionnalité]

**Dernière mise à jour** : YYYY-MM-DD
**Statut** : 🔴 À définir | 🟡 En cours | 🟢 Validé | 📦 Implémenté

## 1. Problème et Contexte

[Pourquoi avons-nous besoin de cela ? Quel problème résolvons-nous ?]

## 2. Solution et Parcours Utilisateur

- **Étape 1** : ...
- **Étape 2** : ...

> **Note IA** :
> L'agent IA ne doit coder QUE la section `V1 (Requis)`. Les sections `V2+` et `Réflexions` sont pour archivage et prévision.

## 3. Moyens Techniques et Logique Métier

- **Choix technique spécifique** : [Ex: Utilisation de JsonWebToken, validité 24h]
- **Base de données impactée** : [Ex: Table Users (id, email, password_hash)]
- **Algorithme / Logique** :
  1. Le user soumet le form.
  2. L'API vérifie le hash (argon2).
  3. Retourne token dans une res HTTPOnly Cookie.

## 4. Spécifications du Code (Prompt IA)

_Directives directes que l'IA exécutante doit accomplir pour terminer ce concept._

- **Fichiers impactés** :
  - `src/api/auth.js` -> Implémenter POST /login
  - `src/ui/login.html` -> Créer le formulaire
- **Interfaces / Mockups** :
  ```javascript
  // L'interface attendue :
  interface AuthResponse {
     token: string;
     user: { id: number, email: string }
  }
  ```
