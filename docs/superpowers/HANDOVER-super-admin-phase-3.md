# Passation — Super-admin plateforme, reprise en phase 4

> Point de reprise pour une **nouvelle session**. Rédigé le 2026-07-30, à la clôture de la phase 3.
> Branche de travail : `worktree-super-admin-phase3-impersonation`, fusionnée dans `main`.
> Base de la phase 3 : `c15f56a`. 24 commits.
>
> Ce document remplace `HANDOVER-super-admin-phase-2.md` comme point d'entrée. Le précédent
> reste valable pour tout ce qui concerne les phases 1 et 2 (§2 « À lire avant d'écrire la
> moindre ligne » y est toujours d'actualité **en entier** — migrations, RLS, pièges Next 16).

---

## 1. Où on en est

**Phase 3 (Impersonation) : terminée, revue trois fois, fusionnée dans `main`.**

| Document | Chemin |
|---|---|
| Spécification (les 5 phases) | `docs/superpowers/specs/2026-07-26-super-admin-platform-design.md` |
| Plan phase 1 | `docs/superpowers/plans/2026-07-26-super-admin-phase1-fondations.md` |
| Plan phase 2 | `docs/superpowers/plans/2026-07-28-super-admin-phase2-crud-boutiques.md` |
| Plan phase 3 | `docs/superpowers/plans/2026-07-30-super-admin-phase3-impersonation.md` |
| Passation phase 2 (toujours utile) | `docs/superpowers/HANDOVER-super-admin-phase-2.md` |

**État de la suite** : 419 tests verts (45 fichiers), `npm run typecheck` propre, **aucune migration
Prisma introduite** par cette phase, aucune dépendance npm ajoutée.

### Ce que la phase 3 a livré

| Livrable | Où |
|---|---|
| Cookie d'impersonation signé HMAC, expiration dure 60 min | `lib/impersonation/cookie.ts` |
| `ActorContext` — acteur réel ≠ identité effective | `lib/impersonation/types.ts` |
| `resolveActorContext` / `resolveEffectiveSession` / `getActorContext` / `resolveRequestIdentity` | `lib/impersonation/context.ts` |
| `getSession()` renvoie désormais l'identité **effective** (signature inchangée) | `lib/auth/index.ts` |
| `requireWritableSession()` + `READ_ONLY_ERROR` | `lib/impersonation/guards.ts` |
| Test de couverture des gardes (analyse statique AST) | `lib/impersonation/guard-coverage.test.ts` |
| `startImpersonation` / `unlockImpersonationWrite` / `endImpersonation`, chacune tracée | `lib/impersonation/actions.ts` |
| Bouton « Entrer dans la boutique » | `components/platform/EnterTenantButton.tsx` |
| Bandeau fixe non thémable + minuteur | `components/dashboard/ImpersonationBanner.tsx` |
| Gating de zone conscient de l'impersonation | `proxy.ts` + `proxy.test.ts` (1er test middleware du dépôt) |
| `currentSuperAdmin()` teste l'acteur **réel**, pas l'identité effective | `lib/platform/guard.ts` |

---

## 2. Les trois invariants à ne jamais casser

Ces trois propriétés sont ce qui rend la fonctionnalité sûre. Chacune est protégée par un test
nommé ; si vous touchez au module `lib/impersonation/`, vérifiez qu'ils passent toujours.

### 2.1 Le cookie est ignoré **avant d'être lu** si l'acteur n'est pas `super_admin`

`lib/impersonation/context.ts` — `resolveActorAndSession()` retourne *avant* tout accès au
cookie quand `actor.role !== "super_admin"`. C'est **structurel, pas conditionnel** : forger le
cookie est sans effet pour qui n'est pas déjà prestataire, y compris un cookie qui se désigne
lui-même comme acteur. Test : *« ignore purement et simplement le cookie si l'acteur n'est pas
super_admin »* (`context.test.ts`). Une refonte qui déplacerait cette garde après la lecture du
cookie serait une escalade de privilèges.

### 2.2 L'expiration dure de 60 minutes ne se prolonge jamais

`unlockImpersonationWrite()` re-signe le cookie avec `mode: "write"` **en conservant le
`startedAt` d'origine**. Passer en mode intervention ne rallonge pas la fenêtre. Test :
*« préserve le startedAt d'origine dans le cookie re-signé »* (`actions.test.ts`), qui décode le
vrai cookie signé plutôt que de faire confiance à un mock.

### 2.3 `proxy.ts` garde deux zones sur deux identités différentes

- Zone **dashboard** → gardée sur l'identité **effective** (la cible), y compris `hasModuleAccess`.
- Zone **admin/plateforme** → gardée sur l'acteur **réel**.

Sans cette asymétrie, le prestataire en impersonation est éjecté de sa propre console et
« Quitter » devient inatteignable. C'est le bug qui a rendu la fonctionnalité totalement
non fonctionnelle jusqu'à la revue finale (voir §5). Tests dans `proxy.test.ts`, dont un qui
vérifie qu'un `super_admin` en impersonation reste bloqué sur un module que la boutique cible
n'a pas activé.

**Corollaire** : `proxy.ts` tourne **toujours en runtime Node.js** (convention Next 16 —
l'option `runtime` y est interdite et lève). Prisma et `node:crypto` y sont donc utilisables.
Deux commentaires du dépôt affirmaient le contraire (« Edge ») ; ils ont été corrigés.

---

## 3. Le cycle de vie du cookie, fermé sur six arêtes

Toute conclusion d'une impersonation doit laisser le journal interprétable. Les six chemins :

| Transition | Cookie | `PlatformAuditLog` |
|---|---|---|
| `startImpersonation` | posé, `mode: read` | `impersonation_started` |
| `unlockImpersonationWrite` | re-signé, `mode: write` | `impersonation_write_unlocked` |
| `endImpersonation` (« Quitter ») | supprimé | `impersonation_ended` |
| `signOut()` (dashboard) | supprimé | `impersonation_ended` si active |
| `signOutPlatform()` | supprimé | `impersonation_ended` si active |
| `signIn()` / `signInPlatform()` | supprimé **inconditionnellement** | — (repart d'une ardoise propre) |

**Le seul cas non fermable** : expiration ou révocation de la session Supabase elle-même. Sans
session, il n'y a pas d'acteur à qui attribuer l'entrée de clôture, ni de requête pour l'écrire.
Une entrée `impersonation_started` sans `impersonation_ended` signifie donc **« session perdue ou
expirée »**, jamais « toujours active » — la fenêtre est bornée à 60 minutes par construction.
À noter dans le runbook d'exploitation le jour où il en existe un.

---

## 4. Le garde-fou mécanique : `guard-coverage.test.ts`

`requireWritableSession()` est une protection **par convention** : une future Server Action qui
oublierait de l'appeler serait écrivable en lecture seule. La parade est un test qui parcourt
**tout fichier `"use server"` sous `lib/`** (pas seulement ceux nommés `actions.ts`), énumère
ses fonctions exportées via l'API du compilateur TypeScript — déclarations **et** fonctions
fléchées — et échoue si l'une n'appelle pas le garde.

**Deux points d'attention pour la suite :**

1. **L'appel doit être littéralement présent dans le corps de la fonction exportée.** Le scan est
   textuel par fonction, il ne suit pas les appels dans un helper privé. Nicher le garde dans un
   `requireOwnerSession()` partagé le rend invisible au test — c'est l'erreur commise puis
   corrigée en tâche 6.
2. **La liste `EXEMPT` est le seul endroit où une exception se justifie**, avec un commentaire
   qui dit pourquoi. Les exemptions actuelles : actions d'authentification du compte lui-même,
   lectures pures (`previewPosDiscount`, `previewWebDiscount`, `getProductStockMovements`,
   `getOrderStatusHistoryAction`), actions de la zone plateforme (déjà gardées par
   `currentSuperAdmin`), les trois actions d'impersonation elles-mêmes, et **`submitWebOrder`** —
   le checkout public de la vitrine, appelé par un visiteur non authentifié (`CLAUDE.md` §4),
   qui n'a et ne doit avoir aucune garde de session.

---

## 5. Ce que le processus de revue a coûté et appris

La phase 3 a suivi le même processus que la phase 2 (implémentation TDD par sous-agent, revue
indépendante, correctifs, re-revue). **Les 12 tâches ont toutes été approuvées individuellement.
La revue finale de branche entière a pourtant trouvé que la fonctionnalité ne marchait pas du
tout.**

`proxy.ts` et `lib/platform/guard.ts` n'ont été touchés par **aucune** des 12 tâches — le plan ne
les nommait pas. Résultat : cliquer sur « Entrer dans la boutique » redirigeait le prestataire
vers `/connexion` côté dashboard **et** le verrouillait hors de sa propre console plateforme, pour
60 minutes, sans autre issue que supprimer un cookie `httpOnly` depuis les devtools. Chaque
composant était correct isolément ; le pipeline n'était pas branché.

Il a fallu **trois tours de correctifs**, chacun révélant l'ordre suivant de problèmes :

1. **Tour 1** (7 commits) — le trou structurel : `proxy.ts` conscient de l'impersonation,
   `currentSuperAdmin()` sur l'acteur réel, `signOutPlatform` purge le cookie, périmètre tenant
   dans `requireWritableSession`, durcissement du test de couverture, variable d'env documentée.
2. **Tour 2** (2 commits) — `signOut()` (dashboard) ne purgeait pas le cookie, contrairement à
   `signOutPlatform` : une reconnexion dans la fenêtre de 60 min réactivait silencieusement la
   session d'impersonation, **sans nouvelle entrée d'audit**.
3. **Tour 3** (3 commits) — le bandeau fixe recouvrait la `TopBar` et la `Sidebar` collantes dès
   qu'on faisait défiler la page (le commentaire du code affirmait précisément le contraire) ;
   déconnexion sans `impersonation_ended` ; connexion sans purge du cookie.

**La leçon, à appliquer dès la phase 4** : une revue par tâche ne peut pas voir ce qu'aucune
tâche ne possède. Avant de déclarer une phase terminée, **parcourir le trajet utilisateur complet
en lisant le code de bout en bout**, en vérifiant qu'à chaque flèche l'étape suivante consomme
bien ce que la précédente produit. Les trois bugs structurels auraient été trouvés en quatre-vingt-
dix secondes de clics dans `npm run dev`.

---

## 6. Dette et constats reportés

### Bloquant avant tout déploiement

- **`IMPERSONATION_COOKIE_SECRET` doit être défini dans l'environnement de production Vercel.**
  C'est la seule nouvelle variable d'environnement de la phase. Absente, la signature lève en
  production ; `startImpersonation` l'attrape et renvoie le message générique, donc la
  fonctionnalité paraît cassée sans diagnostic. Documentée dans `.env.example` avec la recette
  `openssl rand -base64 32`.
- **Aucun hôte de production dans `Tenant.domains`** — inchangé depuis la phase 1, confirmé
  encore non arrêté par l'utilisateur le 2026-07-30 (nom pas acheté / hébergement pas choisi).

### À résoudre avant la deuxième boutique, pas avant la fusion

- **Le cookie d'impersonation n'a pas d'attribut `domain`** (`path: "/"` seulement, donc lié à
  l'hôte). En production, les zones sont des sous-domaines (`platform.*`, `admin.*`) : le cookie
  posé sur `platform.<domaine>` ne serait jamais envoyé à `admin.<domaine>`.
- **`EnterTenantButton` et `ImpersonationBanner` codent en dur `/admin` et `/platform`**, la
  convention de routage par chemin du développement. Sur un domaine personnalisé, ces cibles
  résolvent vers la mauvaise zone.

Les deux sont **inertes aujourd'hui** : une seule boutique, aucun domaine personnalisé enregistré,
et le déploiement vise `*.vercel.app`, que `usesPathRouting()` traite en routage par chemin. Mais
en multi-boutique, `platform.<A>` et `admin.<B>` peuvent être des domaines enregistrables
différents, où un cookie inter-sous-domaines est impossible par principe. **C'est une décision de
conception à écrire, pas un correctif à appliquer.**

### Mineurs, pour le backlog

- Aucune mémoïsation `React.cache()` de la résolution d'identité : une Server Action d'écriture
  déclenche aujourd'hui jusqu'à **trois** résolutions indépendantes (`requireZone` → `getSession`,
  plus un `getSession` explicite, plus `requireWritableSession`), chacune avec son
  `supabase.auth.getUser()` et sa requête `Profile`. Le layout dashboard en ajoute deux par rendu,
  **pour tous les utilisateurs**, pas seulement en impersonation. Recommandé par la revue finale
  comme le seul point de performance à remonter, au regard de la cible INP < 200 ms de
  `CLAUDE.md` §10.
- `verifyImpersonationCookie` n'est pas protégée dans `proxy.ts` : un secret absent ou tourné
  transforme un cookie périmé en erreur 500 sur *toutes* les requêtes des zones privées, sans
  moyen de le purger depuis l'interface.
- Le minuteur du bandeau atteint `0:00` et ne fait rien côté client ; la navigation suivante
  éjecte le prestataire vers le `/connexion` **de la boutique**, ce qui se lit comme une session
  morte.
- La console plateforme n'affiche aucun indicateur d'impersonation active : le prestataire qui y
  revient voit une console normale et peut fermer l'onglet en laissant la session ouverte.
- `TopBar` avale silencieusement l'erreur de `markNotificationRead` (interface optimiste) : en
  lecture seule, la notification se marque lue visuellement sans l'être en base — le
  `READ_ONLY_ERROR` n'atteint jamais l'utilisateur, contrairement au principe du spec §11.
- Le test « séquence complète » de `actions.test.ts` re-stube l'état à la main entre chaque
  étape au lieu de laisser le cookie qu'il vient de signer piloter `resolveActorContext` : les
  morceaux sont bien couverts séparément, mais le test censé prouver l'intégration est le plus
  faible du lot.
- `endImpersonation` écrit l'entrée d'audit **avant** de supprimer le cookie ; l'ordre inverse
  échouerait plus sûrement (une trace perdue vaut mieux qu'une session bloquée).
- Les actions d'authentification cliente (`signInCustomer`, `signUpCustomer`, `signOutCustomer`)
  ne purgent pas le cookie, contrairement à leurs équivalents dashboard/plateforme. Sans
  conséquence de sécurité (le cookie est inerte hors `super_admin`, et seules `signIn`/
  `signInPlatform` peuvent reprendre une session — les deux purgent), mais asymétrie d'audit.
- `Prisma` est désormais chargé dans le bundle du proxy. Le pool est paresseux (aucune connexion
  tant qu'aucune impersonation n'est résolue), impact réel quasi nul, mais à savoir en
  dimensionnant les connexions du pooler Supabase.
- Aucun Playwright dans ce dépôt (manque antérieur aux phases 1-3, pas introduit ici). La
  couverture repose sur Vitest, dont `proxy.test.ts`, premier test au niveau middleware.
- `npm run lint` reste cassé à l'échelle du dépôt (`next lint` retiré dans Next 16) — antérieur,
  sans rapport. Filets : `npm run typecheck` et `npx vitest run`.

---

## 7. En suspens côté utilisateur

- **Le parcours navigateur en direct de la phase 2 est en cours** côté utilisateur au 2026-07-30 ;
  il doit encore remonter les bugs trouvés. Rien n'a été vérifié en session authentifiée réelle
  pour la phase 3 non plus — **aucun mot de passe n'est jamais saisi à la place de
  l'utilisateur**, les parcours authentifiés restent à faire par lui.
- **Le domaine de production reste à arrêter** puis à enregistrer via l'onglet Identité.
- **`IMPERSONATION_COOKIE_SECRET` à définir dans Vercel** avant tout déploiement de cette phase.

---

## 8. Comment démarrer la phase 4

**Ne pas refaire de brainstorming.** Le spec couvre la phase 4 en détail : **§9** (cycle de vie
d'une boutique, avec le tableau des transitions autorisées et les deux refus), **§10**
(diagnostic, réinitialisation du mot de passe de la gérante, export JSON), **§2** (application de
la suspension dans les *layouts* serveur, pas dans le proxy), **§11** (gestion d'erreurs) et
**§13** (périmètre).

Périmètre annoncé, d'après §13 :

> Suspension, archivage, suppression définitive, application en layouts, zone de danger, export
> JSON, diagnostic de santé, reset mot de passe, onglet Équipe plateforme.

Risque annoncé : **moyen — la suppression définitive**. `CLAUDE.md` §12 exige une confirmation
explicite avant toute migration destructive ; la suppression définitive et sa migration en font
partie, et le spec §9 le redit. **Demander confirmation avant de l'exécuter, jamais l'inférer.**

Point d'entrée : la skill **`superpowers:writing-plans`**, puis exécution en
**`superpowers:subagent-driven-development`**.

### Ce que le plan de la phase 4 doit nommer explicitement, appris de la phase 3

Les tâches ne touchent que les fichiers qu'elles nomment. Le plan de la phase 4 doit donc lister
**tous** les points d'application de la suspension et de l'archivage, sans supposer qu'un
implémenteur les découvrira :

- `app/(storefront)/layout.tsx` — boutique suspendue → page « temporairement indisponible ».
- `app/(dashboard)/layout.tsx` — accès bloqué avec message.
- La page `/connexion` du dashboard — bloquée aussi (spec §2), sinon la gérante se connecte pour
  atterrir sur un mur.
- `proxy.ts` — à décider explicitement : le spec §2 dit de garder la base **hors du chemin edge**
  et de contrôler la suspension dans les layouts. Maintenant que `proxy.ts` résout déjà le tenant
  pour l'impersonation, revalider ce choix plutôt que de le supposer.
- `lib/platform/queries.ts` — les boutiques archivées sortent du parc « sauf pour le prestataire ».
- L'onglet « Zone de danger » de `TenantDetailScreen`, aujourd'hui visible mais inerte
  (`available: false`), comme les onglets « Vue d'ensemble », « Équipe » et « Journal ».

**Et surtout** : prévoir, comme dernière tâche du plan, un **parcours complet lu de bout en bout
dans le code** (suspendre → vérifier vitrine + dashboard + connexion → réactiver → archiver →
supprimer), avant de déclarer la phase close. C'est exactement ce que les trois revues finales de
la phase 3 ont dû faire après coup.
