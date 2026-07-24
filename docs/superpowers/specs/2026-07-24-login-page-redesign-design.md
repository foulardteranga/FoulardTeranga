# Redesign de la Page de Connexion — Design Spec

> **Date** : 2026-07-24  
> **Sujet** : Refonte visuelle et ergonomique de la page de connexion `/admin/connexion` ("Écrin Teranga Moderne")  
> **Statut** : Approuvé

---

## 1. Vue d'ensemble

La page de connexion actuelle (`/admin/connexion`) présente une interface minimale basée sur des styles en ligne simples. La refonte vise à transformer cette page en un **écran de connexion digne d'un SaaS haut de gamme**, parfaitement intégré au système de design **Foulard Teranga** (`DESIGN.md`).

### Objectifs :
- **Identité de Marque** : Implémenter le style "Teranga Moderne" (Indigo `#26326B`, Terracotta `#D07A34`, Ivoire `#FAF7F2`, typographie Playfair Display & Inter).
- **Responsive Design** : Layout Split Screen 50/50 sur desktop (`≥ 900px`) et carte centrée sur mobile.
- **Ergonomie & UX** : Icônes Lucide dans les champs, bascule afficher/masquer le mot de passe, spinner de chargement, retours d'erreurs clairs.
- **Sécurité & Robuste** : Conservation de la validation Server Action (`signIn`), du paramètre `next` de redirection et de la garde anti-open-redirect.

---

## 2. Architecture Visuelle & Layout

### 2.1 Layout Desktop (`≥ 900px`)
- **Conteneur global** : Flex/Grid 2 colonnes (`1fr 1fr`), hauteur `100vh`, fond global `#FAF7F2` (Ivoire).
- **Colonne de Gauche (Panneau d'immersion Teranga)** :
  - Background : Indigo (`#26326B`) avec gradient subtil et éléments d'accentuation Terracotta (`#D07A34`).
  - En-tête : Badge logo avec icône de marque + nom *"Foulard Teranga"*.
  - Titre principal (Playfair Display, 32px, blanc) : *"Plateforme de Gestion Omnicanale"*.
  - Slogan : *"Foulards africains et accessoires élégants pour la femme moderne"*.
  - Liste d'atouts avec icônes :
    1. 🛒 *Caisse physique (POS) & ventes comptoir*
    2. 📦 *Gestion des stocks & suivi des commandes*
    3. ⭐ *Programme de fidélité & réductions clientes*
  - Pied de panneau : Pastille discrète *"Dakar & Abidjan"*.

- **Colonne de Droite (Zone de Formulaire)** :
  - Centrage vertical et horizontal de la carte de connexion.
  - Carte blanche (`#FFFFFF`), rayon `16px`, bordure fine Sable (`1px solid #E7DECF`), ombre portée douce (`0 8px 24px rgba(60,40,20,.08)`).
  - Hauteur et espacements respirants (`padding: 40px`).

### 2.2 Layout Mobile (`< 900px`)
- Disparition du panneau de gauche pour maximiser l'espace de saisie.
- Fond global Ivoire (`#FAF7F2`).
- Carte centrée avec affichage du logo Foulard Teranga au-dessus du formulaire.

---

## 3. Composants du Formulaire (`LoginView.tsx`)

### 3.1 En-tête du Formulaire
- **Titre** : Playfair Display, 26px, poids 600, couleur `#1E1B18` (*"Connexion Back-Office"*).
- **Sous-titre** : Inter, 14px, couleur `#6B6259` (*"Saisissez vos identifiants pour accéder à votre espace de gestion."*).

### 3.2 Champs de Saisie
- **Champ Email** :
  - Label : Inter 13px 600 (`#1E1B18`).
  - Conteneur d'input avec icône `Mail` de `lucide-react` positionnée à gauche (couleur `#6B6259`).
  - Input : padding `12px 14px 12px 40px`, rayon `10px`, bordure `#DAD3C7`.
  - État Focus : bordure `#26326B`, halo `outline: 3px solid rgba(38,50,107,.25)`.
- **Champ Mot de Passe** :
  - Label : Inter 13px 600 (`#1E1B18`).
  - Conteneur d'input avec icône `Lock` à gauche.
  - Bouton interactif à droite (icône `Eye` / `EyeOff`) pour basculer le type du champ entre `password` et `text`.

### 3.3 Erreurs & Notifications
- Message d'erreur sous les champs (`state.errors.email` / `state.errors.password`).
- Bandeau d'alerte global (`state.formError`) : Fond `#FCF3F2`, bordure `#C4453B`, texte `#9c352d`, avec icône `AlertCircle`.

### 3.4 Bouton CTA (`Se connecter`)
- Style : Hauteur `48px`, fond `#26326B`, texte blanc `font: 600 15px Inter`, rayon `10px`.
- Hover : `#1c2652`, ombre légère.
- État `pending` : Opacité 0.8, curseur de chargement, affichage d'un spinner SVG animé + libellé *"Connexion en cours…"*.

---

## 4. Impacts Code & Fichiers

- **Modification** : `components/auth/LoginView.tsx` — Réécriture de l'UI du composant pour implémenter le layout split-screen et les composants interactifs.
- **Ressources** : Utilisation des tokens existants (`@/lib/theme/tokens`), icônes de `lucide-react` (`Mail`, `Lock`, `Eye`, `EyeOff`, `AlertCircle`, `ShoppingBag`, `Box`, `Star`).
- **Compatibilité** : Conserve la Server Action `signIn` de `lib/auth/actions.ts` sans aucun changement d'API.

---

## 5. Plan de Vérification

1. **Tests Visuels & Mobile** :
   - Vérifier le rendu sur Desktop (Split-screen 50/50).
   - Vérifier le rendu sur Mobile (`< 900px`, 1 colonne centrée).
2. **Interactivité** :
   - Tester le bouton afficher/masquer le mot de passe.
   - Tester le spinner lors de la soumission.
3. **Authentification** :
   - Tester la connexion réussie avec un compte valide (`foulardteranga@gmail.com`).
   - Tester l'affichage de l'erreur sur mot de passe invalide.
4. **Vérification automatique** :
   - `npm run typecheck` (doit être propre).
   - `npm run test` (264/264 tests verts).
