# Design — Édition & persistance du contenu des blocs de la vitrine

> Sous-projet A (« fondation ») de l'éditeur de vitrine « flexible content » décrit dans `SECTIONS.md` §1 / §4.1.
> Date : 2026-07-15. Statut : validé en brainstorming, en attente de relecture avant plan d'implémentation.

## 1. Problème & objectif

Aujourd'hui les 9 blocs de la vitrine (`hero`, `cats`, `grid`, `loyalty`, `featured`, `story`, `look`, `news`, `contact`) s'affichent mais leur **contenu est codé en dur** dans les composants `.tsx`. L'ordre, le masquage et le renommage des blocs vivent **uniquement en `localStorage`** (`useStorefront`, zustand persist) — rien n'est persisté côté serveur, rien n'est partagé, et l'habillage d'édition repose sur un drapeau client (`blocksMode`) potentiellement visible par une cliente sur un navigateur partagé.

**Objectif :** la gérante édite le **contenu des blocs sans code**, ces modifications sont **persistées par tenant en base**, avec un modèle **brouillon / publié**, et l'édition est **inaccessible aux clientes** de façon étanche.

**Hors périmètre de ce sous-projet (reportés) :** palette d'ajout/suppression de blocs, drag-and-drop `@dnd-kit`, upload d'images (Supabase Storage), richtext Tiptap, `repeater` / `productRef` / `collectionRef`.

## 2. Décisions de cadrage (issues du brainstorming)

1. **Périmètre :** fondation d'abord — contenu éditable + persistance brouillon/publié sur les 9 blocs existants ; palette, dnd-kit, images, Tiptap reportés.
2. **Surface d'édition :** inline durci (mêmes composants, vrai WYSIWYG), **servie depuis une route de la zone `dashboard`** (`/admin/vitrine`), pas depuis la vitrine publique.
3. **Rythme de sauvegarde :** brouillon **autosave** + **Publier** explicite + **Annuler les modifications** (revert du brouillon au publié).
4. **Persistance :** table dédiée `StorefrontPage` avec deux colonnes JSON `draft` + `published` (approche ① retenue face aux colonnes sur `Tenant` et à une table de révisions).

## 3. Modèle de données

### 3.1 Table Prisma (nouvelle)

```prisma
model StorefrontPage {
  id          String    @id @default(cuid())
  tenantId    String
  slug        String    @default("home")   // v1 : une seule ligne "home" par tenant
  draft       Json                          // page en cours d'édition
  published   Json                          // page visible du public
  publishedAt DateTime?
  updatedAt   DateTime  @updatedAt
  createdAt   DateTime  @default(now())
  tenant      Tenant    @relation(fields: [tenantId], references: [id])
  @@unique([tenantId, slug])
  @@index([tenantId])
}
```

Une relation inverse `storefrontPages StorefrontPage[]` est ajoutée sur `Tenant`.

### 3.2 Forme du contenu de page (JSON validé Zod)

```ts
type StorefrontPageContent = {
  blocks: Array<{
    type: BlockId          // un des 9 types du registry
    name: string           // nom d'affichage (remplace blockNames)
    visible: boolean       // remplace blockHidden (inversé)
    settings: BlockSettings // réglages typés selon le schéma du bloc
  }>
}
```

- L'**ordre** des blocs = l'ordre du tableau (remplace `blockOrder`).
- Ce modèle **absorbe** les 3 états aujourd'hui en `localStorage` (`blockOrder`, `blockHidden`, `blockNames`) et les fait passer côté serveur.

### 3.3 RLS

Table activée. Policies alignées sur les patrons existants du projet :
- **Lecture du `published`** pour le public (patron des tables publiques `Product` / `Tenant`).
- **Écriture (insert/update)** réservée aux `owner` / `staff` du tenant (patron `rls_tenant_owner_notifications_customer_self`).
- Accès **cross-tenant refusé**.

## 4. Registry & schémas de blocs

Chaque entrée du registry gagne, à côté de son composant de rendu :
- `settingsSchema` : schéma **Zod** — source de vérité de la validation des réglages.
- `defaultSettings` : valeurs par défaut, **extraites verbatim du contenu actuellement codé en dur** (ex. titre par défaut du hero = « L'élégance tissée main ») pour zéro régression.
- `fields` : liste de **descripteurs de champs** `{ key, label, kind }` qui pilote le rendu du formulaire (`kind` ∈ `text | textarea | select | toggle | number | url`).

Le composant de rendu reçoit désormais une prop `settings` typée, en plus de `products` / `whatsappPhone`.

> Doublon assumé `settingsSchema` (validation) + `fields` (UI) : plus lisible et testable qu'une réflexion sur les internes Zod, cohérent avec le budget du projet.

### 4.1 Champs éditables en v1

Types de champs supportés : `text`, `textarea`, `select`, `toggle`, `number`, `url`.
Reportés : `image` / `imageList`, `richtext`, `repeater`, `productRef` / `collectionRef`.

**Règle de report :** les parties image, listes répétées et sélection de produits d'un bloc restent inchangées en v1 (placeholder décoratif ou contenu dynamique du catalogue) ; seuls leurs champs texte scalaires deviennent éditables. Aucune régression visuelle.

| Bloc | Éditable en v1 (texte) | Reporté |
|---|---|---|
| **hero** | pré-titre, titre, sous-titre, libellé+lien des 2 boutons | image de fond |
| **story** | pré-titre, titre, 2 paragraphes, les 3 stats (valeur+libellé) | image atelier |
| **loyalty** | texte du bandeau, libellé bouton, nb de points | — |
| **news** | titre, texte, libellé bouton, nb de points | — |
| **contact** | titre, adresse, téléphone, WhatsApp, horaires | carte lat/lng |
| **cats** | titre de section | vignettes (image+lien) |
| **grid** | titre de section | source produits (reste le catalogue) |
| **featured** | intitulé, libellé bouton | choix du produit |
| **look** | titre de section | galerie d'images |

La v1 rend **pleinement éditables** hero, story, loyalty, news, contact et **partiellement** cats, grid, featured, look.

## 5. Rendu, édition & sécurité

### 5.1 Deux surfaces séparées

**① Vitrine publique** — `app/(storefront)/page.tsx` charge le `published` (via `getPublishedPage`) et mappe les blocs → composants du registry avec leurs `settings`. **Aucun code d'édition importé.** Une gérante en navigation normale voit ce que voient les clientes.

**② Route d'édition** — `app/(dashboard)/vitrine/page.tsx`, dans la **zone `dashboard`**. `proxy.ts` redirige côté serveur toute personne non `owner`/`staff` avant le rendu → une cliente ne peut pas charger l'URL. Charge le `draft`, rend les **mêmes composants de blocs** (WYSIWYG) enveloppés du cadre d'édition + panneau de réglages. Entrée par un item « Vitrine » dans la sidebar /admin.

La route hérite du gabarit dashboard (sidebar + topbar). L'aperçu s'insère dans un **canevas** qui rend les composants de blocs réels à la **largeur vitrine** (mêmes styles `ft-store-*`), de sorte que l'aperçu reste fidèle malgré le shell back-office. Le panneau de réglages du bloc sélectionné se place en aside du canevas (ou en tiroir sur mobile).

### 5.2 Nettoyage du store public

On **retire** de `useStorefront` tout l'état d'édition (`blocksMode`, `blockOrder`, `blockHidden`, `blockNames` + actions associées + leur `partialize`/`localStorage`). Le store public n'a **plus aucune notion d'édition** → le risque résiduel (chrome d'édition visible via drapeau client persistant) disparaît à la racine. L'éditeur gère sa propre copie de travail locale, initialisée par le `draft` serveur.

### 5.3 Server Actions

`lib/storefront/actions.ts` (`"use server"`, chacune vérifie `requireZone("dashboard")`) :
- `saveDraft(content)` — valide en Zod, upsert `StorefrontPage.draft`. Appelée en **autosave débouncé**.
- `publish()` — copie `draft → published`, pose `publishedAt`, `revalidatePath("/")` + `revalidatePath("/admin/vitrine")`.
- `revertDraft()` — copie `published → draft`.

### 5.4 Flux de données

1. La gérante ouvre `/admin/vitrine` → serveur charge le `draft` (amorce le défaut si absent) → rend blocs + panneau.
2. Elle modifie un champ → copie de travail locale → **aperçu live instantané** → autosave débouncé → `saveDraft`.
3. « Publier » → `publish()` → `revalidatePath("/")` → vitrine publique à jour.
4. « Annuler » → `revertDraft()` → l'éditeur recharge le contenu publié.

### 5.5 Sécurité — 3 niveaux

- **Routage** : la route d'édition est en zone `dashboard`, `proxy.ts` garde le rôle côté serveur.
- **Code** : l'habillage d'édition n'est jamais importé par la vitrine publique.
- **Écriture** : les Server Actions re-vérifient le rôle. Le public ne fait que **lire le `published`**.

## 6. Gestion d'erreurs

- Server Actions → résultats typés `{ ok, error }`. `saveDraft` / `publish` valident en Zod ; contenu invalide → rejet **sans écriture**.
- Rôle non autorisé → erreur générique (comme les actions existantes).
- Pas de ligne `StorefrontPage` → amorçage du **défaut** à la lecture ; upsert à la première sauvegarde.
- **Autosave en échec** (réseau/hors-ligne) → toast « Modifications non enregistrées, nouvelle tentative… » ; copie de travail locale **conservée** ; « Publier » désactivé tant qu'une sauvegarde est en attente.
- **JSON corrompu / type de bloc inconnu** → filtrage sur le registry au rendu (comme l'actuel `renderableOrder`), repli sur le défaut plutôt que casser la vitrine ; log serveur.

## 7. Tests

Vitest (logique pure + RLS), patron projet :
- Schémas Zod par bloc : réglages valides/invalides, les défauts parsent.
- `defaultPage()` produit un contenu valide ; round-trip (dé)sérialisation.
- Réducteurs **purs** `publish` (draft→published) et `revert` (published→draft) testés hors DB.
- Gardes des Server Actions : rôle non autorisé → erreur, **aucune écriture** (prisma/session mockés).
- **Test RLS** `StorefrontPage` : owner/staff écrit son tenant · public lit le `published` · cross-tenant refusé.
- Rendu : les blocs `published` mappent vers les composants ; types inconnus filtrés.
- *(Stretch)* E2E Playwright happy-path : éditer → autosave → publier → la vitrine publique reflète.

## 8. Organisation des fichiers

- `lib/storefront/pageContent.ts` — types + schéma Zod de page + `defaultPage()` + réducteurs purs `publish`/`revert`.
- `lib/data/storefrontPage.server.ts` — `getPublishedPage()` / `getDraftPage()` (amorce le défaut si absent).
- `lib/storefront/actions.ts` — `saveDraft` / `publish` / `revertDraft`.
- `components/storefront/blocks/*` — registry + `settingsSchema` / `defaultSettings` / `fields` co-localisés ; composants reçoivent `settings`.
- `components/editor/` — UI d'édition (liste de blocs, panneau de réglages, rendu de champ, barre Publier/Annuler).
- `app/(dashboard)/vitrine/page.tsx` — charge le `draft`, rend l'éditeur ; item « Vitrine » dans la sidebar.
- `prisma/schema.prisma` + migration + policy RLS.

## 9. Invariants & garde-fous respectés (CLAUDE.md)

- Nouvelle table → migration Prisma **+** policy RLS **+** test.
- Accès données côté serveur uniquement ; jamais de `service_role` côté client.
- L'éditeur reste utilisable **sans aucune connaissance en code** (formulaires uniquement).
- Modularité par le **registry interne** ; aucun page builder / thème tiers.
- Validation Zod partagée pour les entrées des Server Actions.

## 10. Suites (hors de ce sous-projet)

Chantiers ultérieurs qui s'appuieront sur cette fondation : upload d'images (Supabase Storage), richtext Tiptap, palette d'ajout/suppression de blocs + drag-and-drop `@dnd-kit`, champs `repeater` / `productRef`, multi-page.
