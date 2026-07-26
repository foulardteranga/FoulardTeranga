# Interface super-admin plateforme (multi-boutique) — design

> Statut : approuvé (brainstorming). Prochaine étape : plan d'implémentation.

## Contexte

Le schéma est déjà multi-tenant : `Tenant` existe et toutes les tables métier
portent un `tenantId` (`prisma/schema.prisma`). La zone `admin` est déclarée
dans `lib/proxy/zones.ts` (`ADMIN_PATHS = ["/boutiques"]`, hôte `platform.*`
en production, préfixe `/platform` en développement) et `app/(admin)/boutiques/page.tsx`
est un écran d'attente qui annonce explicitement grandir « au passage multi-boutique ».
`proxy.ts` documente en commentaire que cette zone est dormante : aucun compte
`super_admin` n'existe en base et la zone n'a pas de page de connexion.

Le prestataire (rôle `super_admin`) a besoin d'un espace pour administrer le
parc de boutiques : créer une boutique et sa gérante, borner le périmètre
fonctionnel de chaque boutique, dépanner une cliente en entrant dans son
back-office, et piloter son activité de prestataire.

Deux obstacles dans le code actuel, tous deux traités ici :

1. **`lib/tenant/registry.ts` contient un tableau `TENANTS` codé en dur** et
   `getCurrentTenant()` y cherche le tenant par id. Créer une boutique en base
   ne la ferait donc pas exister à l'exécution.
2. **`resolveSession()` et `getCurrentTenant()` supposent « un utilisateur, un
   rôle, un tenant déduit de l'hôte »**. Le super-admin agit *à travers* les
   boutiques, et l'impersonation signifie « agis comme l'utilisateur X dans la
   boutique Y ».

## Décisions structurantes

| Sujet | Décision |
|---|---|
| Création de boutique | Une opération crée le `Tenant`, le compte de la gérante, et provisionne les données par défaut (profils d'accès, page vitrine, thème) — la boutique est utilisable immédiatement |
| Impersonation | **Lecture seule par défaut**, écriture déblocable par une action explicite tracée dans l'audit |
| Mécanisme d'impersonation | Contexte d'acteur explicite (acteur réel ≠ identité effective), jamais une bascule de session Supabase |
| Permissions | Gating par boutique (`Tenant.enabledModules`) **et** édition support des profils d'accès d'une boutique |
| Cycle de vie | `active` / `suspended` / `archived`, plus une suppression définitive réservée aux boutiques archivées |
| Journal d'audit | Non négociable, conséquence directe de l'impersonation en écriture |

### Pourquoi pas une bascule de session Supabase

Générer une vraie session Auth pour le compte cible ne demanderait aucune
modification du code applicatif et laisserait la RLS s'appliquer exactement
comme pour la vraie utilisatrice. Écarté malgré cela : Postgres ne verrait que
le JWT de la gérante, donc **une écriture du prestataire serait indiscernable
d'une écriture de la cliente** — l'audit perdrait tout sens, et le mode lecture
seule deviendrait inapplicable. S'y ajoute le fait de fabriquer de vraies
informations d'identification sur le compte d'une cliente.

### Pourquoi pas une zone miroir en lecture seule

Reconstruire dans `/platform` des écrans affichant les données d'une boutique
sous l'identité propre du super-admin serait sans risque, mais imposerait de
redévelopper une dizaine d'écrans du dashboard qui **dériveraient** ensuite de
ce que la gérante voit réellement — ce qui ruine l'intérêt du support. Écarté
aussi parce qu'incompatible avec l'écriture déblocable retenue.

## 1. Modèle de données

### `Tenant` gagne son cycle de vie et son périmètre

```prisma
enum TenantStatus { active  suspended  archived }
enum TenantPlan   { essentiel  pro }

model Tenant {
  // … champs existants inchangés (slug, name, theme, domains, whatsappPhone…)
  status          TenantStatus @default(active)
  plan            TenantPlan   @default(essentiel)
  enabledModules  String[]     @default(["pos", "dash", "orders", "inv", "cust", "theme", "vitrine", "boutique"])
  suspendedAt     DateTime?
  suspendedReason String?
  archivedAt      DateTime?
}
```

Le défaut correspond au palier `essentiel`, cohérent avec `plan @default(essentiel)`.
Un défaut vide serait incompatible avec la contrainte `tenant_min_modules` (§4) :
toute insertion omettant le champ échouerait.

`enabledModules` porte des ids de `MODULE_IDS` (`lib/nav.ts`).

**`plan` n'est qu'un pré-remplissage, pas une règle contraignante.** Choisir un
palier remplit `enabledModules` avec l'ensemble correspondant, puis les cases
restent librement ajustables. La source de vérité de l'accès est
`enabledModules` seul. Cela évite d'inventer un palier à chaque exception
commerciale.

Correspondance des paliers :

- `essentiel` → `["pos", "dash", "orders", "inv", "cust", "theme", "vitrine", "boutique"]`
- `pro` → tous les ids de `MODULE_IDS` (ajoute `mkt`, `fin`)

### `Profile.tenantId` devient nullable

Un compte plateforme n'appartient à aucune boutique. `tenantId String?`, avec
une contrainte en base pour rendre l'incohérence impossible :

```sql
alter table "Profile" add constraint profile_tenant_role_coherent
  check ((role = 'super_admin' and "tenantId" is null)
      or (role <> 'super_admin' and "tenantId" is not null));
```

### Nouvelle table `PlatformAuditLog`

```prisma
enum PlatformAction {
  tenant_created
  tenant_updated
  tenant_suspended
  tenant_reactivated
  tenant_archived
  tenant_deleted
  modules_changed
  owner_created
  owner_password_reset
  employee_role_edited
  impersonation_started
  impersonation_write_unlocked
  impersonation_ended
  data_exported
  announcement_sent
}

model PlatformAuditLog {
  id        String         @id @default(cuid())
  actorId   String         @db.Uuid   // le vrai super_admin, jamais la cible
  action    PlatformAction
  tenantId  String?                   // null pour les actions globales
  targetId  String?                   // profil ou entité visée
  metadata  Json           @default("{}")
  createdAt DateTime       @default(now())

  @@index([tenantId, createdAt])
  @@index([actorId, createdAt])
}
```

**Aucune clé étrangère vers `Tenant` ni `Profile`, délibérément.** Le journal
doit survivre à la suppression définitive d'une boutique — c'est précisément la
trace qu'on veut conserver. Une FK la ferait disparaître en cascade et viderait
l'audit de son sens. `tenantId` et `actorId` sont donc des références faibles ;
l'affichage du journal résout les noms quand la ligne existe encore et retombe
sur l'identifiant brut sinon (le `metadata` conserve le nom de la boutique au
moment de l'action).

### Annonces — pas de nouvelle table

L'enum `NotificationType` gagne une valeur `annonce_plateforme`. Envoyer une
annonce insère une `Notification` par boutique ciblée. La cloche de
notifications du dashboard existe déjà : aucune UI cliente à construire, aucune
table à créer.

### Domaines — rien à ajouter

`Tenant.domains` est déjà un `String[]`. Il suffit de l'exposer avec une
validation d'unicité inter-boutiques (§11).

### Premier compte plateforme

Une migration de seed crée le compte du prestataire : utilisateur Supabase Auth
+ `Profile` à `role = super_admin` et `tenantId = null`. Mot de passe initial
fourni par variable d'environnement au moment de la migration, à changer à la
première connexion.

## 2. Résolution du tenant : statique → DB

`proxy.ts` résout aujourd'hui le tenant à chaque requête, **y compris sur la
vitrine publique**. Brancher cette résolution sur la base ajouterait un
aller-retour SQL sur le chemin public, celui où `CLAUDE.md` §10 vise un LCP
sous 2,5 s. On sépare donc les responsabilités :

- **`proxy.ts` cesse de résoudre le tenant.** Il transmet le hostname dans
  l'en-tête `x-tenant-host` au lieu de `x-tenant-id`.
- **`getCurrentTenant()` devient async** et résout hôte → `Tenant` par une
  lecture DB **mise en cache et étiquetée**. Chaque mutation d'une boutique par
  le super-admin invalide l'étiquette. La base est touchée une fois par hôte et
  par invalidation, jamais une fois par visiteur.

L'ordre de résolution de `resolveTenantFromHost` est conservé (sous-domaine
`<slug>.plateforme.app`, puis correspondance dans `domains`), mais **le repli
disparaît**. Aujourd'hui un hôte inconnu retombe sur `DEFAULT_TENANT` ; en
multi-boutique ce comportement afficherait la boutique d'une cliente sur un
domaine qui ne lui appartient pas. La fonction renvoie donc `null` pour un hôte
non reconnu, et le layout vitrine rend une page « boutique inconnue » (HTTP 404).

Le développement local n'est pas affecté : `prisma/seed.sql` liste déjà
`localhost` et `foulard-teranga.localhost` dans les `domains` de la boutique
existante.

**Contrainte d'implémentation** : l'API de cache exacte de Next.js 16
(`use cache` + `cacheTag` / `revalidateTag`) doit être vérifiée via Context7
avant d'écrire ce code, conformément à `CLAUDE.md` §12. Le mécanisme décrit ici
ne dépend pas de l'API retenue.

`DEFAULT_TENANT` et le tableau `TENANTS` de `lib/tenant/registry.ts` sont
supprimés. Le seed existant (`prisma/seed.sql`) crée déjà la boutique
« Foulard Teranga » avec `id = 'foulard-teranga'`, qui correspond à l'id codé
en dur actuel : aucune migration de données n'est nécessaire.

**Application de la suspension** : contrôlée dans les *layouts* serveur, pas
dans le proxy, afin de garder la base hors du chemin edge de la vitrine.

- Layout vitrine : `status !== "active"` → page « boutique temporairement indisponible ».
- Layout dashboard et `/connexion` dashboard : accès bloqué avec message.

Une gérante déjà connectée au moment de la suspension est bloquée à sa requête
suivante ; aucune invalidation active de session n'est nécessaire.

## 3. Contexte d'acteur & impersonation

### La structure

```ts
export interface ActorContext {
  actor:     { userId: string; name: string; role: Role };   // toujours le vrai compte
  effective: { tenantId: string | null; role: Role; permissions: string[] };
  impersonation: null | {
    targetProfileId: string;
    tenantId: string;
    mode: "read" | "write";
    startedAt: string;
  };
}
```

### Ordre de résolution

1. Charger le profil de l'utilisateur authentifié → `actor`.
2. **Si `actor.role !== "super_admin"`, le cookie d'impersonation est ignoré
   purement et simplement.** C'est ce qui garantit que ce cookie n'est jamais un
   vecteur d'escalade de privilèges : le forger est sans effet pour qui n'est
   pas déjà super-admin.
3. Sinon, si le cookie signé est présent et valide, charger le profil cible →
   `effective` prend son `tenantId`, son `role` et ses `permissions`.

### Le cookie

`httpOnly`, `sameSite=lax`, `secure` en production, **signé en HMAC** avec un
secret serveur. Sa charge utile contient :

- `targetProfileId` et `tenantId` — la cible ;
- `mode` — `"read"` à l'entrée, `"write"` après déblocage explicite ;
- `actorUserId` — pour qu'un cookie volé ne puisse pas être rejoué sur un autre
  compte ;
- `startedAt` — expiration dure à **60 minutes**, pour qu'une impersonation
  oubliée se referme d'elle-même.

Un cookie expiré, mal signé, dont l'`actorUserId` ne correspond pas à l'acteur
courant, ou dont la cible est devenue inactive, est abandonné : la requête
suivante ramène le super-admin dans la zone plateforme avec un message, sans
erreur technique.

### Ce qui rend le changement peu coûteux

**`getSession()` garde sa signature et continue de renvoyer l'identité
effective.** Tout le code dashboard existant fonctionne sans modification. On
ajoute `getActorContext()` pour les deux seuls besoins qui exigent le vrai
acteur : le journal d'audit et le bandeau d'impersonation.

### L'écriture en impersonation

Toutes les Server Actions passent déjà par un garde du type
`requireOwnerSession()` (`lib/team/actions.ts`). On introduit
`requireWritableSession()`, qui refuse quand `impersonation.mode === "read"`, et
les gardes existants l'appellent.

**Faiblesse assumée et sa parade** : c'est une protection par convention — une
future Server Action qui oublierait le garde serait écrivable en mode lecture.
La parade est un test qui énumère les fichiers `lib/**/actions.ts`, liste leurs
fonctions exportées et échoue si l'une d'elles n'appelle aucun garde d'écriture
(§12). La protection devient mécanique et ne repose plus sur la vigilance.

## 4. Application des permissions : une intersection

`resolveSession()` interroge déjà `Profile` ; il joint désormais `Tenant` dans
**la même requête** pour rapporter `enabledModules`. `Session` grandit :

```ts
export interface Session {
  userId: string;
  name: string;
  role: Role;
  tenantId: string | null;
  permissions: string[];      // EmployeeRole.permissions, pertinent pour staff
  enabledModules: string[];   // Tenant.enabledModules
}
```

```ts
export function hasModuleAccess(session: Session | null, moduleId: string): boolean {
  if (!session) return false;
  if (!session.enabledModules.includes(moduleId)) return false;  // gating boutique d'abord
  if (session.role === "owner") return true;                     // …mais borné par la boutique
  if (session.role !== "staff") return false;
  return session.permissions.includes(moduleId);
}
```

Aucun point d'appel à réécrire (`proxy.ts`, filtrage de `NAV`), aucune requête
supplémentaire.

Cas du compte plateforme : `tenantId` étant `null`, il n'y a pas de `Tenant` à
joindre et `enabledModules` vaut `[]`, donc `hasModuleAccess` renvoie `false`
pour tout module. C'est correct et sans effet : un `super_admin` n'accède pas
aux modules du dashboard, il travaille dans la zone `admin` (dont l'accès est
contrôlé par `isRoleAllowedForZone`). En impersonation, la session effective est
celle de la cible et `enabledModules` provient donc de la boutique visitée.

**Ceci amende une décision du design du 2026-07-22** (`2026-07-22-team-employee-profiles-design.md`
§1), qui posait que « `owner` garde toujours un accès complet, non
restreignable ». La distinction à retenir : une gérante ne peut pas *se*
retirer l'accès à sa propre boutique — cela reste vrai, l'écran Équipe ne le
permet pas. Mais le prestataire borne le périmètre fonctionnel qu'il lui
fournit, ce qui est une décision commerciale et non un réglage interne à la
boutique.

`/equipe` conserve sa garde propre (`session.role === "owner"`) et ne devient
pas un module cochable, pour la raison d'escalade de privilèges déjà documentée
dans le design du 2026-07-22.

### Deux garde-fous rendus nécessaires par ce changement

**1. Un socle minimal non désactivable.** Rien n'empêcherait sinon de décocher
tous les modules d'une boutique. La gérante se connecterait alors sans aucun
écran accessible : `proxy.ts` se replie sur `session.permissions[0]`, vide pour
un `owner`, donc sur `/connexion` — elle atterrirait, authentifiée, sur sa
propre page de connexion, sans issue ni explication.

`enabledModules` doit donc toujours contenir **`dash`** (tableau de bord).
Contrainte imposée à deux niveaux : le validateur Zod de l'écran Modules refuse
de le décocher, et une contrainte en base garantit l'invariant même si une
écriture passe à côté du validateur :

```sql
alter table "Tenant" add constraint tenant_min_modules
  check ('dash' = any("enabledModules"));
```

**2. L'écran Équipe de la gérante est filtré sur `enabledModules`.** Sans cela,
elle coche `fin` dans un profil d'accès, l'employé ne voit toujours pas la
Finance, et rien n'explique pourquoi — l'intersection le refuse en amont. La
liste des modules proposés à la création d'un `EmployeeRole`
(`app/(dashboard)/equipe`) ne présente donc que les modules activés pour la
boutique. Un module désactivé au niveau boutique n'apparaît nulle part chez la
gérante, ni en navigation ni en configuration : il n'existe pas pour elle,
plutôt que d'exister sous forme d'onglet grisé et frustrant.

Conséquence à traiter à l'implémentation : retirer un module à une boutique dont
un `EmployeeRole` le référence déjà laisse une permission orpheline dans
`permissions`. Elle est **sans effet** (l'intersection la neutralise) et doit
être conservée telle quelle, non purgée — réactiver le module plus tard doit
restaurer l'accès des employés sans reconfiguration.

## 5. Sécurité & RLS

### Trou existant à refermer : la policy `tenants_update_owner`

La migration `20260715093000_rls_tenant_owner_notifications_customer_self` a
créé cette policy :

```sql
create policy "tenants_update_owner" on "Tenant"
  for update using (id = public.current_tenant_id() and public.current_role() = 'owner')
  with check  (id = public.current_tenant_id() and public.current_role() = 'owner');
```

Elle autorise un `owner` à modifier **toutes les colonnes** de sa propre ligne
`Tenant` — y compris `slug` et `domains` aujourd'hui, et demain `status`,
`plan` et `enabledModules`.

**Portée réelle de l'exposition.** Le chemin applicatif est sain :
`updateTenantTheme` (`lib/tenant/actions.ts`) est une Server Action qui n'écrit
que six colonnes de thème, jamais `slug` ni `domains`. Mais la policy ouvre un
**second chemin d'écriture par PostgREST**, atteignable avec la clé anonyme
(publique par nature) et le JWT d'une gérante authentifiée. Une requête `PATCH`
directe sur `/rest/v1/Tenant` permet donc d'écrire n'importe quelle colonne.

Le risque concret : `domains` est un tableau libre, et `resolveTenantFromHost`
résout un hôte par correspondance dans ce tableau. **Une gérante peut y inscrire
le domaine personnalisé d'une autre boutique et détourner son trafic vitrine.**
Aujourd'hui l'impact est théorique (une seule boutique existe) ; il devient réel
au moment précis où ce projet introduit la seconde.

**Correction retenue : supprimer la policy, plutôt que d'ajouter un trigger.**

Le commentaire de la migration affirme que la policy est « nécessaire pour que
l'écran Personnalisation persiste ». C'est **inexact**. `current_role()` est
défini par `select role from "Profile" where id = auth.uid()`, donc dépend du
JWT Supabase ; or Prisma se connecte en direct via `DATABASE_URL` avec
l'adaptateur `PrismaPg`, sans JWT, et aucune migration ne pose
`FORCE ROW LEVEL SECURITY`. Si Prisma était soumis à la RLS, `auth.uid()`
vaudrait `NULL`, `current_role()` aussi, et **toutes les écritures de
l'application échoueraient**. L'application fonctionne : Prisma contourne donc
la RLS en tant que propriétaire de table, et la policy ne sert aucun besoin
applicatif.

```sql
drop policy "tenants_update_owner" on "Tenant";
```

La supprimer referme la classe entière de problème d'un coup, sans trigger de
protection par colonne à écrire ni à maintenir. Une gérante conserve toutes ses
capacités réelles, qui transitent par Server Actions ; elle perd seulement un
chemin d'écriture direct dont l'application ne se sert pas.

**Vérification préalable obligatoire** avant d'appliquer cette suppression :
confirmer qu'aucun client Supabase navigateur n'écrit sur `Tenant`. L'audit
mené à la rédaction de ce spec n'a trouvé qu'un seul écrivain,
`lib/tenant/actions.ts`, marqué `"use server"`. Conformément à `CLAUDE.md` §12,
ce changement de policy RLS demande une confirmation explicite avant exécution.

### Policies nouvelles

- `PlatformAuditLog` : `select` et `insert` réservés à `super_admin`. Ni
  `owner`, ni `staff`, ni `customer` n'y accèdent.
- Les policies existantes `tenants_write_super_admin` et
  `profiles_select_super_admin` couvrent déjà les besoins de lecture/écriture
  du prestataire sur `Tenant` et `Profile`.

### Rappel sur le rôle de la RLS ici

Les écritures applicatives passent par Prisma côté serveur. La RLS est une
défense en profondeur (`CLAUDE.md` §5) ; **le garde primaire du mode lecture
seule est `requireWritableSession()`**, pas une policy. Il ne faut pas compter
sur la RLS pour bloquer une écriture en impersonation, puisque le JWT présenté
reste celui du super-admin.

### Clé service_role

La création de comptes Auth (gérante, employés) utilise `createAdminClient()`
(`lib/supabase/admin.ts`), déjà en place et strictement serveur.

## 6. Écrans & navigation

`ADMIN_PATHS` passe de `["/boutiques"]` à :

```
/tableau-de-bord      métriques agrégées du parc (accueil de la zone)
/boutiques            liste du parc
/boutiques/nouvelle   création
/boutiques/[slug]     fiche boutique (onglets)
/journal              journal d'audit global
/annonces             annonces plateforme
/connexion            connexion plateforme
```

`/connexion` est à ajouter : `proxy.ts` documente qu'aucune page de connexion
n'existe pour cette zone et qu'un accès refusé renvoie vers la vitrine. Les
zones étant des espaces de chemins distincts, un `/connexion` plateforme et un
`/connexion` dashboard coexistent sans conflit — `isPathAllowedForZone` s'en
charge déjà. Le composant de connexion refondu récemment est réutilisé plutôt
qu'un second écran.

`resolveZone` fait déjà entrer la racine `/platform` sur `/boutiques` ; le point
d'entrée par défaut devient `/tableau-de-bord`.

### Fiche boutique — six onglets

1. **Vue d'ensemble** — indicateurs de santé et état courant avec ses actions.
2. **Modules** — cases à cocher de `MODULE_IDS`, sélecteur de palier qui les pré-remplit.
3. **Équipe** — profils d'accès et employés de la boutique, création de la gérante, réinitialisation de son mot de passe.
4. **Identité** — nom, slug, domaines, thème, WhatsApp.
5. **Journal** — entrées d'audit filtrées sur cette boutique.
6. **Zone de danger** — suspendre, archiver, exporter, supprimer.

Le bouton « entrer dans la boutique » (impersonation) est dans l'en-tête de la
fiche, pas dans un onglet : c'est l'action la plus fréquente.

### Bandeau d'impersonation

Seul élément empêchant de croire qu'on est chez soi, donc :

- **Fixé en haut de la fenêtre**, au-dessus de tout, non escamotable par
  défilement, et il décale le contenu pour ne jamais recouvrir l'en-tête de la
  boutique.
- **Il n'utilise pas les variables CSS du thème** (`--color-*`). Une gérante
  choisit ses couleurs librement : hériter de sa palette permettrait de rendre
  le bandeau invisible. Palette fixe, non thémable.
- Lecture seule : nom de la boutique, identité empruntée, mention « Lecture
  seule », minuteur du temps restant, boutons « Activer le mode intervention »
  et « Quitter ».
- Mode intervention : couleur renforcée et libellé explicite sur le fait que
  les actions modifient de vraies données.

### Le dashboard existant n'a rien à changer

Les gardes en place fonctionnent par construction : `/equipe` teste
`session.role === "owner"` et la session effective *est* celle de la gérante ;
les modules sont filtrés sur la session effective. Le prestataire voit
exactement son écran, ni plus ni moins.

### Responsive

Rien ne casse sur petit écran, mais ces écrans sont pensés pour le bureau :
gérer un parc est une activité de poste fixe. Les tableaux du parc et du
journal sont optimisés grand écran avec repli en cartes empilées sur mobile.
C'est une exception assumée au mobile-first de `CLAUDE.md` §10, qui reste la
règle pour la vitrine et le dashboard.

## 7. Requêtes inter-boutiques

Le tableau de bord plateforme agrège les données de toutes les boutiques, donc
des requêtes Prisma **volontairement sans filtre `tenantId`** — alors que
partout ailleurs, l'absence de ce filtre est une fuite de données.

Toutes ces requêtes sont isolées dans **`lib/platform/queries.ts`**, seul module
autorisé à requêter sans filtre tenant, chaque fonction commençant par un garde
`super_admin`. Le « sans filtre » devient un choix délibéré concentré dans un
fichier relisable, au lieu d'une exception dispersée qu'une revue laisserait
passer.

## 8. Création d'une boutique

L'opération écrit dans deux systèmes sans transaction commune : Postgres via
Prisma, et Supabase Auth. Ordre retenu :

1. **Créer le compte Auth de la gérante.** C'est là que se produit l'échec le
   plus fréquent (« email déjà utilisé ») et le découvrir avant toute écriture
   en base ne coûte rien.
2. **Une seule transaction Prisma** : `Tenant` (avec `enabledModules` dérivé du
   palier) + profils d'accès par défaut + page vitrine d'accueil + `Profile` de
   la gérante (`role = owner`).
3. **Si la transaction échoue**, supprimer le compte Auth au mieux — même forme
   de rattrapage que celle déjà en place dans `createEmployee`
   (`lib/team/actions.ts`).
4. Écrire l'entrée d'audit `tenant_created`, puis invalider l'étiquette de cache
   des tenants (§2).

Données par défaut provisionnées :

- Profils d'accès : « Vendeuse » (`pos`, `orders`, `inv`) et « Gérant adjoint »
  (tous les modules activés de la boutique sauf `theme` et `vitrine`).
- Page vitrine d'accueil publiée, avec les blocs Hero, ProductGrid et Contact
  renseignés depuis le nom et le thème de la boutique.
- Thème initial saisi au formulaire (couleurs, logo texte).

Entrées Zod validées : slug (minuscules, tirets, unique), nom, email de la
gérante, mot de passe initial, couleurs (hex), palier, domaines optionnels.

## 9. Cycle de vie d'une boutique

| Transition | Autorisée | Effet |
|---|---|---|
| `active` → `suspended` | oui | Vitrine indisponible, back-office bloqué, données intactes |
| `suspended` → `active` | oui | Retour à la normale |
| `active`/`suspended` → `archived` | oui | Sortie du parc, invisible partout sauf pour le prestataire |
| `archived` → `active` | oui | Réactivation |
| `archived` → suppression définitive | oui | Destructive, cf. ci-dessous |
| `active`/`suspended` → suppression définitive | **non** | Il faut archiver d'abord |

**Suppression définitive.** Réservée aux boutiques archivées, elle exige de
retaper le slug de la boutique pour confirmer. Elle supprime, dans une
transaction : toutes les lignes métier du tenant (produits, clientes,
commandes, mouvements de stock, événements de statut, codes promo, pages
vitrine, notifications, profils d'accès, profils), puis la ligne `Tenant` ; et
au mieux, hors transaction, les comptes Supabase Auth correspondants.

L'entrée d'audit `tenant_deleted` **survit** à l'opération, avec le nom et le
slug de la boutique conservés dans `metadata` (§1.3).

Conformément à `CLAUDE.md` §12, la migration introduisant cette capacité et
l'action elle-même demandent une confirmation explicite avant exécution.

## 10. Fonctions prestataire additionnelles

**Diagnostic & dépannage.** Sur la vue d'ensemble d'une boutique : dernière
connexion de la gérante, nombre de produits, commandes sur 30 jours, vitrine
publiée ou non, produits en rupture. Plus la réinitialisation du mot de passe
de la gérante (via `createAdminClient()`), tracée en `owner_password_reset`.

**Tableau de bord plateforme.** Boutiques par état, chiffre d'affaires total,
commandes du jour toutes boutiques confondues, et liste « à relancer » :
boutiques sans commande depuis 14 jours ou dont la gérante ne s'est pas
connectée depuis 30 jours.

**Offres & domaines.** Sélecteur de palier pré-remplissant `enabledModules`
(§1.1) et gestion des domaines personnalisés de `Tenant.domains`, avec contrôle
d'unicité inter-boutiques.

**Conformité & communication.** Export JSON complet d'une boutique (produits,
clientes, commandes, pages vitrine, codes promo, mouvements de stock), généré
côté serveur et servi en téléchargement, tracé en `data_exported` — filet de
sécurité avant une suppression. Et annonces poussées vers une boutique ou tout
le parc via `Notification` (§1.4), tracées en `announcement_sent`.

## 11. Gestion d'erreurs

Résultats typés `{ ok: true } | { ok: false; error: string }`, messages en
français, repli générique `« Une erreur est survenue, réessayez. »` — pattern
de `lib/team/actions.ts` conservé.

Cas traités explicitement :

- **Slug déjà pris** → « Ce slug est déjà utilisé. » (contrainte `@unique`
  existante, vérifiée avant écriture pour un message propre).
- **Domaine déjà rattaché** → message nommant la boutique en conflit
  (`domains` est un tableau : unicité vérifiée par requête, plus un index
  d'unicité applicatif au niveau de l'action).
- **Création partiellement échouée** → rattrapage décrit en §8.
- **Suppression d'une boutique non archivée** → refusée avec explication.
- **Slug de confirmation incorrect** → refusée sans effet de bord.
- **Impersonation invalide** (expirée, cible désactivée, signature ou acteur
  incohérents) → abandon silencieux, retour en zone plateforme avec message.
- **Écriture tentée en lecture seule** → refus explicite invitant à activer le
  mode intervention, jamais un échec muet.

## 12. Tests

### Vitest

- `hasModuleAccess` sur la nouvelle intersection, dont le cas déterminant :
  module désactivé pour la boutique + rôle `owner` → refusé.
- `resolveActorContext` :
  - **cookie ignoré si l'acteur n'est pas `super_admin`** (test anti-escalade,
    le plus important du lot) ;
  - cookie valide → `effective` = cible, `actor` préservé ;
  - cookie expiré → impersonation abandonnée ;
  - `actorUserId` non concordant → rejeté ;
  - signature invalide / cookie forgé → rejeté ;
  - cible inactive → rejeté.
- `requireWritableSession` : refus en `read`, passage en `write`, passage hors
  impersonation.
- **Test de couverture des gardes** : énumère les exports de
  `lib/**/actions.ts` et échoue si une action d'écriture n'appelle aucun garde.
- Validateurs Zod : format de slug et de domaine, ids de modules
  obligatoirement dans `MODULE_IDS`, correspondance palier → modules, refus de
  décocher `dash` (socle minimal, §4).
- Filtrage de l'écran Équipe : les modules proposés pour un `EmployeeRole` se
  limitent aux `enabledModules` de la boutique ; une permission orpheline
  laissée par la désactivation d'un module reste stockée, sans effet, et
  redevient active si le module est réactivé.
- Transitions d'état de §9, y compris les deux refus.
- `resolveTenantFromHost` en version DB : correspondance par slug, par domaine,
  hôte inconnu.

### Playwright

- Créer une boutique de bout en bout, puis vérifier que la gérante se connecte
  et que sa vitrine répond.
- Impersonation complète : entrer, bandeau présent, écriture refusée en lecture
  seule, activation du mode intervention, écriture acceptée, sortie et retour à
  l'identité prestataire.
- Décocher `fin` pour une boutique → l'onglet disparaît chez la gérante et
  l'accès direct à l'URL redirige.
- Boutique suspendue : vitrine indisponible, connexion back-office bloquée.
- Un `owner` et un `staff` ne peuvent pas atteindre la zone plateforme.

### RLS

Conformément à `CLAUDE.md` §12 (toute nouvelle table → migration + policy + test) :

- `PlatformAuditLog` illisible pour `owner`, `staff` et `customer` ; lisible
  pour `super_admin`.
- **Suppression de `tenants_update_owner`** : avec un JWT de gérante, un
  `PATCH` PostgREST sur sa propre ligne `Tenant` est refusé (`domains` et
  `status` en particulier), tandis que l'écran Personnalisation continue de
  persister ses six colonnes de thème via la Server Action — c'est ce second
  volet qui prouve que la policy n'était pas le chemin d'écriture applicatif.
- Contrainte `tenant_min_modules` : une écriture retirant `dash` de
  `enabledModules` est rejetée par la base.

## 13. Découpage en phases

| Phase | Contenu | Risque |
|---|---|---|
| **1 · Fondations** | Migrations (statut, palier, modules, socle `tenant_min_modules`, `Profile.tenantId` nullable + CHECK, `PlatformAuditLog`, suppression de `tenants_update_owner`, policies, seed du premier super-admin) · `lib/tenant` en DB + cache · `proxy.ts` au header hostname · `Session` et `hasModuleAccess` en intersection · filtrage de l'écran Équipe · tests unitaires et RLS | **Élevé** — modifie l'auth, le proxy et le tenant en service |
| **2 · CRUD boutiques** | `/connexion` plateforme, layout de zone, liste du parc, création complète (§8), onglets Identité et Modules, `lib/platform/queries.ts`, alimentation de l'audit | Faible, additif |
| **3 · Impersonation** | Contexte d'acteur, cookie signé, `requireWritableSession`, test de couverture des gardes, bandeau, mode intervention | Moyen |
| **4 · Cycle de vie & support** | Suspension, archivage, suppression définitive, application en layouts, zone de danger, export JSON, diagnostic de santé, reset mot de passe, onglet Équipe plateforme | Moyen (la suppression) |
| **5 · Pilotage** | Tableau de bord agrégé, `/journal`, annonces, liste « à relancer » | Faible |

La phase 1 est la seule à modifier du code en service. Les quatre suivantes
ajoutent sans déplacer. La finition UI (Impeccable) intervient en phases 2 et 3,
sur les écrans une fois leur logique en place.

## Hors scope (v1)

- **Facturation et paiement des abonnements.** `plan` existe pour borner le
  périmètre fonctionnel, pas pour prélever. Aucune passerelle, aucune
  échéance, aucune relance automatique.
- **Suspension automatique pour impayé.** La suspension reste une action
  manuelle du prestataire.
- **Plusieurs comptes `super_admin`.** Le modèle les supporte (le seed en crée
  un, rien n'empêche d'en insérer d'autres), mais aucun écran de gestion des
  comptes prestataire n'est construit.
- **Provisionnement DNS des domaines personnalisés.** On enregistre le domaine
  dans `Tenant.domains` ; sa configuration DNS et son certificat restent une
  opération manuelle côté hébergeur.
- **Impersonation d'un compte `customer`.** Réservée à `owner` et `staff`, les
  seuls profils dont le back-office justifie un dépannage.
- **Journal d'audit des actions des gérantes.** `PlatformAuditLog` trace les
  actions *du prestataire*. L'historique métier des boutiques est déjà couvert
  par `OrderStatusEvent` et `StockMovement`.
