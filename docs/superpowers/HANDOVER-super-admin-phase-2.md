# Passation — Super-admin plateforme, reprise en phase 2

> Point de reprise pour une **nouvelle session**. Rédigé le 2026-07-26, à la clôture de la phase 1.
> Branche : `main`. HEAD de fin de phase 1 : `1254246`.
>
> **Pourquoi ce document existe** : le journal de progression de la phase 1 vivait dans
> `.superpowers/sdd/progress.md` **à l'intérieur du worktree**, lequel a été supprimé après la
> fusion. `.superpowers/` étant ignoré par git, ce journal n'existe plus nulle part. Tout ce qui
> a été appris pendant la phase 1 — y compris des pièges coûteux à redécouvrir — est consigné ici
> et **uniquement ici**.

---

## 1. Où on en est

**Phase 1 (Fondations) : terminée, revue, fusionnée dans `main`.**

- 9 tâches implémentées en subagent-driven (un sous-agent implémente, un autre relit, correctifs, re-revue).
- Revue finale de branche entière (opus) : verdict « prêt à merger, avec correctifs ».
- 3 correctifs post-revue appliqués et vérifiés.
- Fusion en fast-forward, sans conflit.
- **272/272 tests verts, `npm run typecheck` propre**, vérifiés sur le résultat fusionné.

| Document | Chemin |
|---|---|
| Spécification (les 5 phases) | `docs/superpowers/specs/2026-07-26-super-admin-platform-design.md` |
| Plan d'implémentation phase 1 | `docs/superpowers/plans/2026-07-26-super-admin-phase1-fondations.md` |

### Ce que la phase 1 a livré (fondations disponibles pour la phase 2)

| Livrable | Où |
|---|---|
| `Tenant` : `status`, `plan`, `enabledModules`, `suspendedAt/Reason`, `archivedAt` | `prisma/schema.prisma` |
| Contrainte socle : `dash` toujours dans `enabledModules` | `tenant_min_modules` (CHECK) |
| `Profile.tenantId` nullable + `super_admin ⟺ tenantId IS NULL` | `profile_tenant_role_coherent` (CHECK) |
| Table `PlatformAuditLog` + enum `PlatformAction` (15 valeurs), RLS `super_admin` seul | migration `20260726141851` |
| Faille RLS refermée : `tenants_update_owner` supprimée | migration `20260726142000` |
| Colonnes de cycle de vie retirées à `anon`/`authenticated` (sauf `enabledModules` pour `authenticated`) | migration `20260726155246` |
| Résolution du tenant depuis la base, en cache | `lib/tenant/registry.ts` |
| `hasModuleAccess` = intersection périmètre boutique × droits personne | `lib/auth/session.ts` |
| Écran Équipe filtré sur `enabledModules` | `components/dashboard/screens/EquipeScreen.tsx` |
| Script de création du 1er compte plateforme | `scripts/seed-super-admin.ts` |
| Assertions RLS exécutables (6) | `prisma/tests/rls_phase1.sql` |

---

## 2. À lire avant d'écrire la moindre ligne

Ces points ont coûté du temps en phase 1. Les ignorer les fera recoûter.

### 2.1 Les migrations n'utilisent JAMAIS la CLI Prisma

**`npx prisma migrate dev` est inutilisable dans ce projet. Ne jamais l'invoquer.**

Cette commande rejoue tout l'historique dans une *shadow database* vierge que Prisma crée
elle-même, laquelle n'a pas le schéma `auth` de Supabase — la première migration RLS
(`auth.uid()`) y échoue systématiquement avec `schema "auth" does not exist`.
Confirmation supplémentaire : **la table `_prisma_migrations` n'existe pas** sur le projet réel.
Aucune migration de ce dépôt n'a jamais transité par le moteur de migration Prisma.

**Le vrai flux** :
1. Écrire à la main `prisma/migrations/<AAAAMMJJHHMMSS>_<nom>/migration.sql`.
2. L'appliquer avec l'outil MCP **`mcp__supabase__apply_migration`** (`name`, `query`).
3. Vérifier avec `npx prisma db execute --stdin` (sans danger : SQL direct sur `DIRECT_URL`)
   ou `mcp__supabase__execute_sql` en lecture seule.
4. `npx prisma generate` pour resynchroniser le client typé.

**Corollaire non négociable** : une migration déjà appliquée ne se corrige **jamais** en
réécrivant son fichier. On corrige *en avant*, avec une nouvelle migration. Le dossier
`prisma/migrations/` doit rester le reflet exact de ce que Supabase a réellement exécuté sous
chaque nom (`mcp__supabase__list_migrations` fait foi). La phase 1 contient un exemple assumé de
ce principe : `20260726130000_tenant_lifecycle_modules` conserve volontairement du code mort
(un `UPDATE` qui ne matche rien), et `20260726140000_..._fix_backfill` le corrige.

### 2.2 Prisma contourne la RLS — la RLS n'est PAS la garde principale

`public.current_role()` est défini par `select role from "Profile" where id = auth.uid()`, donc
dépend du JWT Supabase. Or Prisma se connecte via `DATABASE_URL`/`DIRECT_URL` **sans JWT**, en
propriétaire de table, et aucune migration ne pose `FORCE ROW LEVEL SECURITY`.

Conséquence : **toutes les écritures applicatives (Server Actions → Prisma) contournent la RLS.**
La RLS est de la défense en profondeur (`CLAUDE.md` §9) ; la garde réelle est le contrôle de rôle
en tête de chaque Server Action. Ne jamais compter sur une policy pour bloquer une écriture
applicative.

### 2.3 Un seul point du code lit `Tenant` via PostgREST

`lib/auth/session.ts` fait `select("...tenant:Tenant(enabledModules)")` sous le JWT de
l'utilisateur (rôle `authenticated`) — c'est le mécanisme même de `hasModuleAccess`.
**C'est le seul embed PostgREST de `Tenant` de tout le dépôt** ; tout le reste passe par Prisma.

C'est pour cela que la migration `20260726155246` est asymétrique : `anon` perd l'accès aux six
colonnes de cycle de vie, `authenticated` aussi **sauf `enabledModules`**. Si la phase 2 ajoute un
lecteur PostgREST de `Tenant` (client navigateur), il faudra rouvrir explicitement les colonnes
concernées — sinon lecture vide et silencieuse.

### 2.4 API Next.js 16.2 — pièges vérifiés

- **`unstable_cache`, pas `use cache`** : `cacheTag()` lève une erreur sans
  `cacheComponents: true` dans `next.config.ts`, drapeau que ce projet n'active pas (l'activer
  changerait la sémantique de cache de toute l'application).
- **`revalidateTag` exige 2 arguments** dans cette version. Depuis une Server Action qui doit
  invalider immédiatement (lecture de sa propre écriture), utiliser **`updateTag(tag)`** — c'est
  l'API documentée pour ce cas précis.
- **Le fichier de proxy s'appelle `proxy.ts`** (convention Next 16), jamais `middleware.ts`.
- **`generateStaticParams()` s'exécute au build**, hors requête HTTP : `headers()` — et donc
  `getCurrentTenant()` — y est indisponible et lèverait. `getCatalog()` accepte un `tenantId`
  explicite exactement pour ce cas.

### 2.5 Tester la RLS

La simulation d'identité fonctionne et est vérifiée :

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"<uuid du profil>"}';
```

**Piège évité en phase 1, à ne pas réintroduire** : une assertion « ce rôle ne voit rien » est
*vacuously vraie* sur une table vide. Toujours insérer une ligne réelle (par le rôle de connexion,
qui contourne la RLS) **avant** de basculer d'identité et d'affirmer une non-visibilité.

Lancer : `npx prisma db execute --file prisma/tests/rls_phase1.sql` → aucune sortie = les
6 assertions passent.

### 2.6 `npm run lint` est cassé — et ne l'est pas de notre fait

`next lint` échoue avec `Invalid project directory provided, no such directory: .../lint`.
**Reproduit à l'identique sur `main` avant tout ce travail** : problème d'outillage préexistant
lié à Next 16.2, sans rapport avec le projet super-admin. Utiliser `npm run typecheck` et
`npx vitest run` comme filets. Ne pas compter ce lint cassé contre son propre travail.

---

## 3. État réel de la base (vérifié le 2026-07-26)

**Une seule boutique**, `foulard-teranga` :
- `plan = pro`, les 10 modules activés, `status = active`
- `domains = ['localhost', 'foulard-teranga.localhost']`

**Trois comptes Auth**. Les adresses ne sont volontairement pas listées ici : ce dépôt est public,
et associer publiquement une adresse au compte le plus privilégié du système n'apporte rien à une
session de reprise. Pour les retrouver :

```sql
select id, role, name, email from "Profile" order by role;
```

| Rôle | Note |
|---|---|
| `super_admin` (prestataire) | créé par `scripts/seed-super-admin.ts`, `tenantId = null` |
| `owner` (gérante) | rattaché à `foulard-teranga` |
| — | un compte tiers préexistant, sans `Profile` associé |

`PlatformAuditLog` est **vide** : la table et ses policies existent, aucun appelant ne l'alimente
encore (c'est le travail de la phase 2).

---

## 4. Ce que la phase 2 doit construire

Périmètre, d'après le spec §13 :

> `/connexion` plateforme, layout de zone, liste du parc, création complète (§8), onglets Identité
> et Modules, `lib/platform/queries.ts`, alimentation de l'audit.

Sections du spec à relire en priorité : **§6** (écrans & navigation), **§8** (création d'une
boutique), **§7** (requêtes inter-boutiques), **§11** (gestion d'erreurs).

### Pièges spécifiques à la phase 2, anticipés

1. **La zone `admin` n'a pas de page de connexion.** `ADMIN_PATHS = ["/boutiques"]`
   (`lib/proxy/zones.ts`) et `proxy.ts` redirige un accès refusé vers `/` — le commentaire à
   `proxy.ts:30` le documente explicitement. Il faut ajouter `/connexion` à `ADMIN_PATHS` **et**
   adapter cette redirection, sinon le prestataire ne peut littéralement pas se connecter.
   Les zones étant des espaces de chemins distincts, un `/connexion` plateforme et un
   `/connexion` dashboard coexistent sans conflit.

2. **Créer une boutique = deux systèmes sans transaction commune.** Ordre imposé par le spec §8 :
   compte Auth **d'abord** (l'échec le plus fréquent, « email déjà utilisé », coûte alors zéro
   écriture en base), puis une seule transaction Prisma, puis suppression au mieux du compte Auth
   si la transaction échoue. Précédents à copier : `createEmployee` (`lib/team/actions.ts`) et
   `scripts/seed-super-admin.ts`.

3. **Les deux contraintes CHECK mordent à la création.** `enabledModules` doit contenir `dash`
   (`tenant_min_modules`), et un `Profile` non-`super_admin` doit avoir un `tenantId`
   (`profile_tenant_role_coherent`). Une insertion qui les ignore échoue en base.

4. **Toute mutation de boutique doit invalider le cache.** `updateTag(TENANTS_CACHE_TAG)` depuis
   la Server Action — sinon la résolution d'hôte sert des données périmées jusqu'à 5 minutes
   (plancher `revalidate: 300` posé en phase 1).

5. **`lib/platform/queries.ts` est le seul module autorisé à requêter sans filtre `tenantId`.**
   Partout ailleurs dans ce dépôt, l'absence de ce filtre est une fuite de données. Concentrer
   ces requêtes là, avec un garde `super_admin` en tête de chaque fonction, rend le « sans
   filtre » relisable au lieu de dispersé.

6. **L'écran Modules doit refuser de décocher `dash`** côté Zod, en miroir de la contrainte base
   (spec §12). Modèle à suivre : `z.enum(MODULE_IDS)` dans `lib/validators/team.ts`.

7. **Impeccable** intervient en phase 2 pour la finition UI, une fois la logique des écrans en
   place (demande initiale de l'utilisateur, confirmée au brainstorming).

---

## 5. Dette et constats reportés de la phase 1

### Bloquant avant tout déploiement — toujours ouvert au 2026-07-28

**Aucun hôte de production n'est enregistré dans `Tenant.domains`.** La phase 2 construit le
mécanisme prévu pour ceci — l'onglet Identité de la fiche boutique (`TenantIdentityForm`,
`updateTenantIdentity`), qui accepte un champ Domaines et invalide le cache tenant à
l'enregistrement — mais **l'enregistrement lui-même n'a pas eu lieu** : interrogé pendant la
phase 2, l'utilisateur a confirmé que le domaine de production n'est pas encore arrêté (nom pas
acheté, hébergement pas choisi, ou décision simplement pas prise). Rien n'a donc été inventé à sa
place. Sur un domaine autre que `localhost`, la vitrine renvoie toujours 404 et le back-office
lève toujours une erreur contrôlée (voir ci-dessous) tant que cette entrée n'existe pas. Une seule
entrée de domaine nu suffira (retrait des préfixes `admin.`/`platform.` implémenté en phase 1) : à
saisir via l'onglet Identité dès que le domaine est connu.

### Points Importants, dictés par le plan — corrigés en phase 2 (tâche 14)

Les deux constats suivants, reportés à la clôture de la phase 1, sont désormais traités :

- `app/(storefront)/produit/[id]/page.tsx` (`ProductPage`) : ajout d'un garde explicite
  `getCurrentTenantOrNull()` + `notFound()` avant tout appel dépendant du tenant. Un hôte inconnu
  ne produit plus d'exception non capturée dans les logs, seulement le 404 du layout.
- `app/(dashboard)/layout.tsx` : même garde, posé **avant** le `Promise.all` plutôt qu'à
  l'intérieur — `getCurrentTenant()` (la variante qui lève) en est retiré. La résolution du tenant
  passe désormais avant `getSession`/`getPendingOrdersCount`/`getNotifications`, délibérément :
  ces deux derniers résolvent eux-mêmes le tenant et auraient reproduit le même bruit en parallèle.
- **Troisième instance découverte pendant la vérification live de la tâche 14, hors périmètre
  initial du plan** : `app/(storefront)/page.tsx` (`StorefrontHomePage`) portait le même défaut
  (`getCatalog() → getCurrentTenant()` non gardé). Corrigé avec le même garde, dans un commit
  séparé, et revérifié en direct (grep des logs sur `error|exception|unhandled|throw` : aucune
  correspondance sur un hôte inconnu). Rappel pour une future session : le périmètre écrit d'une
  tâche n'est pas forcément exhaustif — la vérification live de la tâche 14 elle-même a trouvé ce
  troisième cas, ni le plan ni la revue ne l'avaient anticipé.

Vérifié sans régression : suite complète (335/335), assertions RLS de la phase 1 rejouées
(`prisma/tests/rls_phase1.sql`, aucune sortie), aucune migration introduite par cette phase.

### Mineurs, pour le backlog

- `useStorefront.ts` garde une clé `localStorage` littérale
  (`ft-storefront-store-foulard-teranga`). Sans conséquence en mono-boutique ; **dès la seconde
  boutique, deux vitrines partagent le même panier navigateur**. À traiter en phase 2 en faisant
  descendre le slug du tenant jusqu'au store client.
- `lib/validators/team.ts` valide contre `MODULE_IDS` statique, pas contre `enabledModules` : un
  appel forgé peut stocker une permission pour un module désactivé. Inerte (l'intersection la
  neutralise), mais la garde est côté client seulement.
- `EquipeScreen` liste encore les modules désactivés dans le récapitulatif d'un profil, et
  resoumet leurs permissions à l'édition (données conservées volontairement, mais l'UI et les
  données divergent visuellement).
- Un `staff` dont tous les modules sont désactivés atterrit authentifié sur `/connexion`, sans
  explication. Pas une boucle, mais une impasse.
- `20260726130000_..._tenant_lifecycle_modules/migration.sql` est en SQL majuscules, contrairement
  au reste du dépôt — préservé tel quel car historiquement fidèle à ce qui fut appliqué.
- `20260726140000_..._fix_backfill/migration.sql` contient deux `SET DEFAULT` sans effet et un
  commentaire qui prétend le contraire.
- `registry.test.ts` mocke `revalidateTag`, que `registry.ts` n'importe plus.
- `profile_tenant_role_coherent` posée sans `NOT VALID` (verrou de scan, indolore à cette taille).
- Aucun test automatisé sur la frontière hôte inconnu → 404 (vérifié manuellement seulement).
- `npm audit` : 8 vulnérabilités préexistantes (4 moderate, 4 high), sans rapport avec ce travail.

---

## 6. Comment démarrer la phase 2

**Ne pas refaire de brainstorming.** Le spec couvre déjà la phase 2 en détail (§6, §7, §8, §10,
§11). Le point d'entrée est directement la skill **`superpowers:writing-plans`**, en lui donnant
le spec et le périmètre §13 de la phase 2.

Ensuite, exécution en **`superpowers:subagent-driven-development`**, méthode qui a bien fonctionné
en phase 1 : elle a attrapé trois vrais bugs (un backfill mort, un test RLS vacuously vrai, un
repli cassé renvoyant un owner vers l'écran de connexion) que ni l'implémentation ni l'auto-revue
n'avaient vus.

### Conseils de pilotage tirés de la phase 1

- **Vérifier soi-même les affirmations des sous-agents contre la vraie base**, systématiquement.
  Le bug le plus grave de la phase 1 (la boutique perdant Finance et Marketing) a été trouvé
  ainsi, pas par un réviseur — l'implémenteur avait rapporté « DONE » de bonne foi.
- **Travailler dans un worktree isolé**, mais **copier `.env`** dedans (il est git-ignoré, donc
  absent, et `prisma generate` échoue sans lui au `npm install`).
- **Ne jamais utiliser `pkill -f "next dev"`** pour arrêter un serveur de développement. En
  phase 1, cela a tué le serveur d'une autre session Claude Code travaillant en parallèle sur ce
  dépôt. Capturer le PID (`lsof -ti:PORT`) et ne tuer que celui-là ; si le port 3000 est occupé,
  en prendre un autre plutôt que de le libérer.
- **Le journal de progression doit survivre au worktree.** En phase 1 il a été perdu à la
  suppression du worktree. Soit l'écrire dans le dépôt principal, soit le recopier avant nettoyage.

---

## 7. En suspens côté utilisateur

- **`main` est en avance de 27 commits sur `origin/main`** — à pousser quand souhaité.
- **Enregistrer le domaine de production** dans `Tenant.domains` avant tout déploiement (§5).
- Les emails de connexion des comptes gérante et prestataire ont été échangés le 2026-07-26 ;
  **les mots de passe, eux, n'ont pas changé**. Voir la requête en §3 pour retrouver quelle
  adresse correspond à quel rôle.
