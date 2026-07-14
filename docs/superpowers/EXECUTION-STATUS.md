# État d'exécution — Vitrine Foulard Teranga

> Point de reprise du travail. Dernière mise à jour : 2026-07-10.
> Branche de travail : `feature/storefront-foundations`.

## Vue d'ensemble

Le travail est découpé en **deux plans d'implémentation séquentiels** (Plan 1 doit être fini avant le Plan 2, car le Plan 2 s'appuie sur ses interfaces) :

- **Plan 1 — Fondations** : `docs/superpowers/plans/2026-07-09-storefront-foundations.md` (14 tâches) — **TERMINÉ**
- **Plan 2 — UI Vitrine** : `docs/superpowers/plans/2026-07-09-storefront-ui.md` (11 tâches) — **10/11 terminées ; parcours manuel de la Tâche 11 en attente (voir ci-dessous)**
- **Spécification** : `docs/superpowers/specs/2026-07-09-vitrine-storefront-design.md`

Méthode d'exécution : **subagent-driven** (un sous-agent implémente chaque tâche, un sous-agent la relit — conformité au spec + qualité — puis correctifs si besoin).

## Où on en est

**Plan 1 : 14/14 tâches terminées, testées, revues, et la revue finale (branche entière) faite.**

- Suite de tests : **75/75 vertes**, sortie propre.
- `npm run typecheck` : **propre**.
- HEAD de fin de Plan 1 : commit `5ad3b6c`.
- Plan 2 démarre à partir de `5ad3b6c`.

### Tâches terminées (Plan 1)

| # | Tâche | Commits | Résultat |
|---|-------|---------|----------|
| 1 | Outillage Vitest + dépendance Zod | `1717248..8098287` | 5/5, revue OK |
| 2 | Extension des types Product/OrderLine | `8098287..6716bd3` | revue OK |
| 3 | Catalogue enrichi + sélecteurs + orders productId | `6716bd3..9e3ef91` | 20/20, revue OK |
| 4 | Validation KYC (Zod, téléphone international libre) | `9e3ef91..679a77f` | 27/27, revue OK |
| 5 | Registre tenant + résolution par hôte | `aae6e3e..3b1c78b` | 32/32, revue OK |
| 6 | Garde auth placeholder (zones/session) | `3b1c78b..ede30fa` | 35/35, revue OK |
| 7 | Résolution de zones (hôte/chemin) | `ede30fa..fae5c68` | 47/47, revue OK |
| 8 | `proxy.ts` (middleware Next 16) | `fae5c68..f1030ff` | revue OK **après 1 correctif** |
| 9 | Moteur commande/stock partagé (`useShop`) | `f1030ff..8da385c` | 66/66, revue OK **après 1 correctif** |
| 10 | Store vitrine (`useStorefront`) + logique panier pure | `8da385c..a049a2e` | 75/75, revue OK |
| 11 | Bootstrap d'hydratation SSR-safe (`HydrateStores`) | `a049a2e..b29fa55` | revue OK, vérifié en navigateur (aucun warning d'hydratation) |
| 12 | Migration statut/validation commandes → `useShop` | `b29fa55..2166eaf` | revue OK, vérifié en navigateur (Valider/Refuser) |
| 13 | Stock effectif affiché dans l'Inventaire | `4c8fde6..99d68ad..42f7b82` | revue OK **après 1 correctif** (bug de réactivité Zustand, voir ci-dessous) |
| 14 | Placeholder vitrine racine + page admin zone | `42f7b82..adb4eaa` | revue OK, vérifié en navigateur (matrice de zones complète) |

Revue finale de la branche entière (modèle le plus capable) : **prête à merger avec correctifs** — deux points Important trouvés et corrigés (commit `5ad3b6c`, voir ci-dessous). Aucun point Critique.

### Correctifs appliqués pendant les revues

- **Tâche 8** — boucle de redirection infinie : sur un sous-domaine privé de prod, la racine `/` n'avait pas de repli vers la page d'accueil de la zone → redirection en boucle. Corrigé dans `lib/proxy/zones.ts` (commit `f1030ff`), vérifié en live (`admin.localhost/` → 200, 0 redirection).
- **Tâche 9** — double déduction de stock : `confirmOrder` ne se gardait que sur le statut courant ; un retour à `nouvelle` via `setOrderStatus` puis un nouveau `confirmOrder` déduisait deux fois. Corrigé par une déduction **idempotente par id de commande** (`applyConfirmOnce` + `deductedOrderIds`, commit `8da385c`).
- **Tâche 13** — bug de réactivité Zustand : le code du plan lui-même (`useShop((s) => s.effectiveStock)`) sélectionnait une **action du store** (référence stable, jamais recréée par `set()`), donc l'écran Inventaire ne se re-rendait jamais quand `stockDeductions` changeait réellement — la déduction de stock restait invisible même après validation d'une commande. Détecté par vérification live en navigateur (pas par les tests). Corrigé en sélectionnant l'état brut `stockDeductions` + la fonction pure `computeEffectiveStock` (commit `42f7b82`). **Ce pattern (sélectionner une action liée plutôt qu'un état/valeur dérivée) est à éviter dans le Plan 2** — voir `.superpowers/sdd/progress.md` pour le pattern correct.
- **Revue finale de branche** — deux points Important, corrigés commit `5ad3b6c` avant de démarrer le Plan 2 :
  1. `nextOrderRef` dans `useShop.ts` utilisait un compteur en mémoire qui repart de zéro après un rechargement de page, alors que `orders` est persisté en localStorage → risque de collision d'id de commande. Corrigé : dérivé du tableau `orders` persisté (max existant + 1).
  2. `setOrderStatus` pouvait positionner le statut `"confirmee"` **sans déduire le stock**, contournant l'invariant central (stock déduit uniquement via `confirmOrder`). Corrigé : `setOrderStatus` ignore désormais toute tentative de statut `"confirmee"`.

## Plan 2 : où on en est

**10/11 tâches terminées, testées, revues (toutes Approved).**

| # | Tâche | Commits | Résultat |
|---|-------|---------|----------|
| 1 | Chrome (header/menu/bottom-tab/toast/offline) | `5ad3b6c..a8257a4` | revue OK, vérifié en navigateur |
| 2 | Infra blocs + Hero/CategoryTiles + Home réelle | `a8257a4..534b029` | revue OK, vérifié en navigateur |
| 3 | ProductCard + ProductGridBlock + LoyaltyBanner | `534b029..7cc32da` | revue OK **après correctif proactif** |
| 4 | 5 derniers blocs Home (Featured/Story/Look/News/Contact) | `7cc32da..a59807d` | revue OK **après correctif proactif** |
| 5 | Page Catalogue (recherche/filtres/tri) | `a59807d..d8bb57e` | revue OK **après correctif proactif** |
| 6 | Page Produit (variantes/dispo/associés) | `d8bb57e..509622d` | revue OK **après correctif proactif** |
| 7 | Page Panier | `509622d..5f3d147` | revue OK |
| 8 | Page Commander/KYC (boucle commande) | `5f3d147..77d311c` | revue OK (Opus) **après correctif sécurité/vie privée** |
| 9 | Page Confirmation | `77d311c..78def7e` | revue OK **après correctif symétrique à la Tâche 8** |
| 10 | Page Compte | `78def7e..74f7305` | revue OK, verbatim |
| 11 | Parcours d'acceptation bout-en-bout | — | **partiel — voir ci-dessous** |

### Correctifs appliqués pendant le Plan 2

- **Tâches 3, 4, 5, 6 — même bug de réactivité Zustand que la Tâche 13 du Plan 1**, présent 4 fois dans le code du plan lui-même (`ProductGridBlock`, `FeaturedProductBlock`, `CatalogView`, `ProductView` sélectionnaient tous `useShop((s) => s.effectiveStock)`, une référence d'action stable). Corrigé **avant dispatch**, à chaque fois, en sélectionnant l'état brut `stockDeductions` + `computeEffectiveStock(id, deductions)`.
- **Tâche 8 — fuite de donnée personnelle dans l'URL** : le code du plan mettait le nom du client dans `/confirmation?ref=...&name=...`. Violation directe de CLAUDE.md §9 (« jamais en query string » pour les données KYC). Corrigé : seul `ref` (id opaque de commande) passe par l'URL.
- **Tâche 9 — correctif symétrique** : `ConfirmView` relit le nom du client via `useShop.orders.find(o => o.id === ref)` au lieu d'un paramètre `name`. Le reviewer a vérifié que le format d'id concorde réellement de bout en bout (pas d'échec silencieux).

### Tâche 11 — état d'avancement

**Partie automatisée : faite et verte.**
```bash
npm run test                # 75/75
npm run typecheck           # propre
npx next build --webpack    # réussit, liste toutes les routes vitrine + back-office
```

**Partie manuelle (le parcours de bout en bout réel — panier → commande → validation gérante → déduction stock) : non exécutée.** Les outils navigateur (mode sandboxé et extension Claude in Chrome) sont restés indisponibles après une dizaine de tentatives sur toute la session. L'utilisateur a choisi de faire ce test lui-même plus tard, avec la liste d'étapes déjà rédigée à la section « Task 11 » de `docs/superpowers/plans/2026-07-09-storefront-ui.md` (Step 2) comme guide.

**⚠️ Important pour la reprise** : ce parcours n'a jamais été cliqué réellement par personne (agent ou humain) à ce stade. Le Plan 2 est fonctionnellement complet et chaque tâche a été doublement revue, mais l'intégration réelle storefront ↔ back-office (la boucle centrale du produit selon CLAUDE.md §4) reste à valider en conditions réelles avant de considérer le projet prêt.

## Problèmes connus & notes de reprise

1. **Build Turbopack cassé par le nom du dossier** — `npm run build` (Turbopack par défaut) **panique** car le dossier parent « Vibe codé » contient un « é » décomposé (NFD, U+0301) que le code Rust de Turbopack découpe à une frontière non-caractère (`ident.rs:354`). C'est **indépendant de notre code**. Confirmé pendant le Plan 1 que ça touche aussi `npm run dev` (Turbopack) dès qu'un fichier vient d'être modifié et doit être ré-écrit par Turbopack (pas seulement `next build`).
   - **Contournement** : `next dev --webpack` / `next build --webpack` fonctionnent ; `npm run typecheck` et `npm run test` fonctionnent tous les deux normalement (n'utilisent pas Turbopack). `.claude/launch.json` du projet est déjà configuré sur `npx next dev --webpack` pour la prévisualisation navigateur.
   - **Correction définitive recommandée** : renommer le dossier du projet avec un « é » précomposé (NFC), ou déplacer le projet vers un chemin sans accent combinant, pour rétablir le build/déploiement Turbopack par défaut.

2. **Bruit de mode de fichier pré-existant dans git** — l'ensemble du dépôt porte des changements de mode (644→755) sur les fichiers suivis, sans changement de contenu (0 insertion/deletion partout, vérifié). Cause probablement un `chmod` ou un outil de checkout, indépendant de ce travail. Pour merger une branche de sous-agent proprement : `git stash` (sans `-u`, laisse les fichiers non suivis intacts) avant `git merge --ff-only`, puis `git stash pop` après. Ne **pas** faire `git config core.fileMode false`.

3. **Suivi (auth réelle future)** — dans `proxy.ts`, la redirection en cas de refus d'auth cible `/` sur le **même** hôte ; sur un sous-domaine privé de prod, un utilisateur refusé re-rentre dans la même zone refusée → boucle. **Dormant en v1** (le stub owner est autorisé sur la zone dashboard ; seule la zone admin refuse, et le build/déploiement prod est de toute façon bloqué). À traiter quand l'auth réelle + une page de login/redirection vers l'hôte public existeront.

4. **Nettoyage de code mort à faire (non bloquant)** — `effStatus` (`lib/data/orderStatus.ts`) et l'action `effectiveStock` du store (`lib/store/useShop.ts`) n'ont plus aucun appelant après les migrations des Tâches 12/13. À supprimer, ou à garder `effectiveStock` uniquement si le Plan 2 compte l'utiliser via le pattern sûr (`useShop((s) => s.effectiveStock(productId))`, appelé *à l'intérieur* du sélecteur).

## Comment reprendre

```bash
npm install          # dépendances (Node ≥ 22 ; testé sur Node 25)
npm run test         # doit afficher 75/75 vertes
npm run typecheck    # doit être propre
npm run dev          # serveur de dev Turbopack (cassé, voir note 1) — préférer npx next dev --webpack
```

Plan 1 et 10/11 du Plan 2 sont terminés. HEAD actuel : `74f7305`. Il ne reste que le parcours manuel de la Tâche 11 (voir section dédiée ci-dessus) à exécuter — par l'utilisateur ou par un futur agent avec des outils navigateur fonctionnels — puis, si des correctifs sont nécessaires, les appliquer et committer per l'étape 3 de la Tâche 11.

Le journal de progression détaillé vit dans `.superpowers/sdd/progress.md` (non versionné — scratch), mais ce document en reprend l'essentiel.

## Migration mock → Supabase : sous-projet 1/5 (Fondation DB)

**Terminé** (voir `docs/superpowers/plans/2026-07-13-supabase-db-foundation.md` et le spec associé `docs/superpowers/specs/2026-07-13-supabase-db-foundation-design.md`).

- 6 tables (`Tenant`, `Profile`, `Product`, `Customer`, `Order`, `OrderLine`) + 5 enums + RLS active sur les 6, appliquées au projet Supabase `vqqwviknffequjvxmojo` via le MCP.
- Seed complet : 1 tenant, 12 produits, 6 clientes, 7 commandes + 10 lignes — copie fidèle des mocks actuels (`lib/data/*.ts`), y compris deux incohérences total/lignes déjà présentes dans le mock (commandes `#TER-0491` et `#TER-0489`), volontairement non corrigées ici.
- Trois findings résiduels acceptés par l'utilisateur (non corrigés) : (1) 4 advisories `get_advisors` sécurité sur `current_role()`/`current_tenant_id()` exposées en RPC PostgREST — non exploitables (données auto-scopées via `auth.uid()` non falsifiable), correctif réel = déplacer les fonctions hors du schéma `public`, à faire comme tâche dédiée si besoin. (2) Pas de test RLS automatisé — vérification faite via `get_advisors`/`pg_policies` en direct, ce que le plan approuvé définissait comme méthode de test pour ce sous-projet ; des tests role-switching automatisés nécessiteront `DATABASE_URL` + Prisma Client applicatif (sous-projets suivants). (3) La policy RLS `order_lines_insert_public` (`with check (true)`) est plus permissive que ce que décrivait le spec initial (`même commande que la ligne insérée`) — un appelant anonyme connaissant/devinant l'id (cuid, non devinable en pratique) d'une commande existante pourrait lui ajouter des lignes. Même profil de risque que les advisories ci-dessus (aucune lecture anonyme possible). Contrainte à respecter par la Server Action du sous-projet 4 : insérer commande + lignes ensemble, côté serveur, dans une même requête validée — ne pas compter sur la RLS seule pour cette invariante.
- Code applicatif (`app/`, `lib/data/`, `lib/store/`) **non touché** — l'UI tourne toujours sur les mocks. `npm run test` (75/75) et `npm run typecheck` inchangés.
- Prochain sous-projet : **Auth réelle** (Supabase Auth pour la gérante/staff, RBAC dans `/lib/auth` et `proxy.ts`) — nécessite de créer les comptes Supabase Auth correspondants aux lignes `Profile` (aucune ligne `Profile` n'existe encore, la table est prête mais vide).
- Le mot de passe Postgres réel (pour `DATABASE_URL`/`DIRECT_URL` dans `.env`) reste à récupérer sur le dashboard Supabase — nécessaire dès que du code applicatif instancie `PrismaClient` (sous-projet 3 ou 4).

## Migration mock → Supabase : sous-projet 2/5 (Auth réelle)

**Terminé** (voir `docs/superpowers/plans/2026-07-13-real-auth.md` et le spec associé `docs/superpowers/specs/2026-07-13-auth-design.md`).

- `lib/auth/index.ts` réécrit : `getSession()`/`requireZone()` réels (async), basés sur `supabase.auth.getUser()` (vérifié serveur, jamais `getSession()`) + lecture `Profile` via RLS. Logique factorée en `isRoleAllowedForZone()` (pure) et `resolveSession(supabase)` (injectable), réutilisées à la fois par `lib/supabase/server.ts` (Server Components/Actions) et `lib/supabase/middleware.ts` (`proxy.ts`, Edge — ne peut pas utiliser `next/headers`).
- `proxy.ts` : garde de zone réelle, redirection `/admin/connexion?next=...` (dashboard) en cas d'échec, `/` inchangé pour la zone admin (dormante, pas de compte super_admin).
- Page de connexion (`app/(auth)/connexion`, route group séparé de `(dashboard)` — n'hérite pas du Sidebar/TopBar) + Server Actions `signIn`/`signOut` (`lib/auth/actions.ts`) + déconnexion câblée dans le Sidebar, qui affiche désormais le vrai nom/rôle de la session (remplace le "Aya Koffi" en dur qui traînait depuis le début du projet).
- Compte owner provisionné : ligne `Profile` créée pour le compte Supabase Auth créé manuellement par l'utilisateur (voir `prisma/migrations/20260713210000_seed_owner_profile/`).
- **88/88 tests, typecheck propre.**
- **Correctifs trouvés en revue et corrigés avant merge :**
  1. Open-redirect sur le paramètre `next` de `signIn` (acceptait n'importe quelle URL absolue, protocole-relative, ou avec backslash de contournement) — corrigé, seuls les chemins relatifs de même origine sont acceptés (`/^\/(?!\/|\\)/`).
  2. Bug fonctionnel trouvé en pilotant réellement le flux dans un navigateur pendant la Tâche 8 (aucun test ni revue de code ne l'avait détecté, puisqu'il ne se manifeste qu'en suivant la chaîne de redirection réelle) : `proxy.ts` redirigeait vers `/connexion` nu, qui retombe en zone storefront en dev (résolution par préfixe de chemin) où c'est un chemin interdit → nouvelle redirection silencieuse vers `/`, neutralisant toute la garde d'auth en environnement de dev. Corrigé via `dashboardPath(hostname, path)` dans `lib/proxy/zones.ts`.
  3. Même classe de bug, deuxième occurrence, trouvée par le reviewer final (pas par l'agent — le flux authentifié n'était pas testable en direct, voir ci-dessous) : `signIn` (redirection post-connexion, défaut `/pos`) et `signOut` (`/connexion`) redirigeaient aussi vers des chemins nus, atterrissant sur la vitrine publique au lieu du dashboard en dev. Corrigé en généralisant `dashboardPath` et en l'utilisant aussi dans `lib/auth/actions.ts` (via `next/headers`, ces Server Actions n'ayant pas d'objet `NextRequest`).
- **Vérifié en direct dans un navigateur réel + via `curl` pendant cette session** (contrairement aux sous-projets précédents, les outils navigateur étaient disponibles cette fois) : `/admin/pos` non authentifié → redirige bien vers `/admin/connexion?next=%2Fpos`, sans boucle ; la page de connexion s'affiche correctement (email/mot de passe/bouton) avec `next` correctement propagé dans le formulaire ; `/platform/boutiques` reste refusé (`/`) ; les routes vitrine (`/`, `/catalogue`) ne sont pas affectées. **Non vérifiable par l'agent** (implique d'entrer un vrai mot de passe, interdit par les garde-fous de sécurité) : connexion réussie avec le compte owner (y compris la redirection post-connexion vers `/pos`, corrigée au point 3 ci-dessus mais seulement testée par lecture de code + tests unitaires, pas en direct), affichage du nom réel dans le Sidebar, déconnexion, persistance de session après rechargement, message d'erreur sur mauvais mot de passe.
- **Point de vigilance pour la suite** : un serveur de dev Next.js orphelin (lancé par les outils de preview mais résolu dans le mauvais répertoire — le checkout principal au lieu du worktree) a d'abord fait croire à un bypass d'auth complet ; le vrai bug (point 2 ci-dessus) n'a été trouvé qu'après avoir relancé le serveur manuellement avec le bon `cwd` et vérifié via `curl` en plus du navigateur. Si un futur test live semble montrer un comportement incohérent avec le code lu, vérifier `lsof -i :3000` et le `cwd` du processus avant de conclure à un bug applicatif.

**Reste pour l'utilisateur** (parcours manuel, ne peut pas être fait par l'agent) :
1. Se connecter sur `/admin/connexion` avec le compte owner provisionné → doit rediriger vers `/pos`, Sidebar affiche le vrai nom + « Gérante ».
2. Naviguer dans les autres écrans dashboard → pas de redemande de connexion.
3. Recharger la page → session toujours active.
4. Cliquer « Se déconnecter » → retour à `/admin/connexion` ; un accès direct à `/admin/pos` redemande une connexion.
5. Mauvais mot de passe → message d'erreur inline, pas de crash.

## Migration mock → Supabase : sous-projet 3/5 (Catalogue & stock)

**Terminé** (voir `docs/superpowers/plans/2026-07-13-catalog-stock.md` et le spec associé `docs/superpowers/specs/2026-07-13-catalog-stock-design.md`).

- `lib/data/catalog.ts` ne contient plus de tableau mock statique — scindé en deux fichiers : `lib/data/catalog.ts` (fonctions pures/constantes client-safe : `categories`, `storefrontCategories`, `newestProducts`, `featuredProduct`, `relatedTo`, `filterCatalog`, `CatalogFilters`) et `lib/data/catalog.server.ts` (lectures Prisma serveur : `getCatalog()`, `getProductById()`, `toProduct()`). Cette scission (non prévue au plan initial) a été nécessaire suite à un bug trouvé en vérification de build : le fichier unique mélangeait code serveur (`next/headers` via `getCurrentTenant()`) et exports consommés par des Client Components, ce qui cassait `next build`.
- `lib/db/client.ts` : singleton Prisma (`@prisma/adapter-pg`, requis par le générateur `prisma-client` de Prisma 7) avec pattern anti-HMR standard.
- Toute la vitrine (Accueil, Catalogue, fiche Produit) et tout le back-office (Inventaire, Tableau de bord, Marketing, Personnalisation, POS) lisent désormais les 12 produits réels depuis Postgres — chaque page est un Server Component qui fetch une fois et transmet en props aux composants clients existants (interactivité panier/filtres inchangée).
- `computeEffectiveStock` (`lib/store/shopLogic.ts`) ne dépend plus de `lib/data/catalog` — signature changée pour recevoir le stock de base en argument explicite plutôt que de le chercher dans un tableau statique. Action `effectiveStock` (dead code, zéro appelant) supprimée de `useShop.ts`.
- **Correctif inclus** : l'alerte « stock bas » de `DashboardScreen` utilisait le stock de base au lieu du stock effectif (incohérent avec `InventoryScreen` depuis le Plan 1 Tâche 13) — corrigé au passage.
- **Sous-projet strictement lecture seule** : aucune écriture Postgres (création/édition produit, ajustement stock) — décision validée en brainstorming.
- Deux bugs réels trouvés et corrigés pendant la vérification de branche (Tâche 10), aucun des deux détecté par `npm run test` ni `npm run typecheck` — seul `next build --webpack` les révèle :
  1. Fuite `next/headers` dans le bundle client (voir scission `catalog.ts`/`catalog.server.ts` ci-dessus).
  2. `generateStaticParams` (fiche produit) s'exécute au build, hors requête HTTP — `getCurrentTenant()` (qui lit les headers de requête) y est indisponible. Corrigé en donnant à `getCatalog()` un paramètre `tenantId` optionnel, `generateStaticParams` passant `DEFAULT_TENANT.id` explicitement (v1 mono-boutique) ; tous les autres appelants gardent la résolution réelle par requête.
- **Point trouvé en revue finale (opus), corrigé côté données** : `getCatalog()` trie par `ORDER BY createdAt ASC`, mais les 12 produits seedés au sous-projet 1 partageaient tous le même timestamp (seed en un seul batch) — tri non déterministe en théorie, qui « fonctionnait » par chance sur l'ordre physique des lignes. `MarketingScreen`/`ThemeScreen` dépendent d'un ordre `p1..p12` stable (indexation positionnelle). Corrigé par un `UPDATE` direct sur Supabase (confirmé par l'utilisateur avant exécution, pas de migration de schéma) décalant chaque `createdAt` d'1 seconde dans l'ordre p1→p12 — tri désormais garanti déterministe. À surveiller si de nouveaux produits sont insérés en batch à l'avenir.
- 87/87 tests (nouveaux/adaptés dans `lib/data/catalog.test.ts` et `lib/store/shopLogic.test.ts`), `npm run typecheck` propre sur tout le projet, `npx next build --webpack` réussit (30 pages statiques).
- **Non vérifié par l'agent** (nécessite le compte owner réel, pas de manipulation de mot de passe par l'agent) : parcours live des écrans back-office authentifiés (Inventaire, Tableau de bord, Marketing, Personnalisation, POS) avec le compte owner — la garde d'auth a été vérifiée (redirection correcte vers `/admin/connexion` pour un visiteur non authentifié, zéro crash), mais l'affichage réel des données une fois connecté reste à confirmer par l'utilisateur, même limitation que le parcours manuel du sous-projet 2.
- Prochain sous-projet : **Commandes & workflow** (`useShop` → Server Actions + Postgres + Realtime).

## Migration mock → Supabase : reste à faire

- Sous-projet 4/5 : **Commandes & workflow** (`useShop` → Server Actions + Postgres + Realtime, déduction stock réelle à la validation).
- Sous-projet 5/5 : **Clientes & fidélité** (`lib/data/clients.ts` → Postgres).
