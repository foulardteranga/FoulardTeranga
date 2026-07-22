# Spec — Fondation DB Supabase (sous-projet 1/5 de la migration mock → Supabase)

> Date : 2026-07-13 · Portée : schéma Prisma + migrations + RLS + seed sur le projet Supabase déjà connecté (`vqqwviknffequjvxmojo`, actuellement vide : 0 table, 0 migration). Le code applicatif (`app/`, `lib/data/`, `lib/store/`) n'est **pas** modifié dans ce sous-projet — l'UI continue de tourner sur les mocks jusqu'aux sous-projets suivants.

## 0. Contexte — la migration en 5 sous-projets

L'intégralité de l'UI (vitrine + back-office) est construite et fonctionnelle, mais tourne sur des données fictives (`lib/data/*.ts`) via des stores Zustand persistés en `localStorage`, et `getSession()` (`lib/auth/index.ts`) renvoie toujours la même gérante mock. La bascule vers Supabase est découpée en 5 sous-projets indépendants, chacun brainstormé puis planifié séparément :

1. **Fondation DB** (ce document) — schéma, migrations, RLS, seed.
2. **Auth réelle** — Supabase Auth pour la gérante/staff, RBAC dans `/lib/auth` et `proxy.ts`.
3. **Catalogue & stock** — `lib/data/catalog.ts` → lectures serveur depuis Postgres.
4. **Commandes & workflow** — `useShop` (soumission, validation, déduction stock) → Server Actions + Postgres + Realtime.
5. **Clientes & fidélité** — `lib/data/clients.ts` → Postgres.

## 1. Objectif de ce sous-projet

Poser des tables Postgres réelles, avec RLS active, qui reflètent fidèlement les types actuels (`lib/data/types.ts`) et sont prêtes à être consommées par les sous-projets 2 à 5 — sans encore rien brancher côté application.

## 2. Schéma — tables & enums

```prisma
enum Role            { super_admin owner staff customer }
enum ProductCategory { Foulards Turbans Tissus Accessoires }
enum CustomerSegment { VIP Fidele Nouvelle }
enum OrderStatus     { nouvelle confirmee preparation livree refusee }
enum OrderChannel    { Web WhatsApp Boutique }

model Tenant {
  id            String   @id @default(cuid())
  slug          String   @unique
  name          String
  primaryColor  String
  accentColor   String
  logoText      String
  domains       String[]
  createdAt     DateTime @default(now())

  profiles  Profile[]
  products  Product[]
  customers Customer[]
  orders    Order[]
}

model Profile {
  id        String   @id            // = auth.users.id (Supabase Auth)
  tenantId  String
  role      Role
  name      String
  createdAt DateTime @default(now())

  tenant   Tenant     @relation(fields: [tenantId], references: [id])
  customer Customer?  // lien optionnel si ce profil est aussi un client (sous-projet 5+)
}

model Product {
  id          String          @id @default(cuid())
  tenantId    String
  category    ProductCategory
  name        String
  variant     String
  price       Int             // FCFA, entier — jamais de string pré-formatée
  stock       Int             // stock simple v1 ; tripartite (interne/sous-traitance/matériel) = évolution future
  swatch      String
  colors      String[]
  motif       String
  lengths     String[]
  description String
  oldPrice    Int?
  badge       String?
  featured    Boolean         @default(false)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  tenant     Tenant      @relation(fields: [tenantId], references: [id])
  orderLines OrderLine[]
}

model Customer {
  id        String          @id @default(cuid())
  tenantId  String
  profileId String?         @unique
  name      String
  initials  String
  phone     String
  place     String
  points    Int             @default(0)
  vip       Boolean         @default(false)
  segment   CustomerSegment
  createdAt DateTime        @default(now())

  tenant  Tenant    @relation(fields: [tenantId], references: [id])
  profile Profile?  @relation(fields: [profileId], references: [id])
  orders  Order[]
  // orders_count / spent : PAS de colonnes — agrégats calculés par requête sur Order (voir §2.1)
}

model Order {
  id          String       @id @default(cuid())
  tenantId    String
  ref         String       @unique  // "#TER-XXXX", généré par séquence Postgres (voir §2.2)
  customerId  String?
  clientName  String
  place       String
  phone       String
  channel     OrderChannel
  status      OrderStatus  @default(nouvelle)
  vipAtOrder  Boolean      @default(false)  // snapshot du statut VIP au moment de la commande
  total       Int                            // FCFA, entier — recalcul serveur = sous-projet 4
  createdAt   DateTime     @default(now())

  tenant   Tenant      @relation(fields: [tenantId], references: [id])
  customer Customer?   @relation(fields: [customerId], references: [id])
  lines    OrderLine[]
}

model OrderLine {
  id          String @id @default(cuid())
  orderId     String
  productId   String
  nameAtOrder String   // fige le nom produit au moment de la commande
  qty         Int
  unitPrice   Int
  lineTotal   Int

  order   Order   @relation(fields: [orderId], references: [id])
  product Product @relation(fields: [productId], references: [id])
}
```

### 2.1 Décisions notables

- **Argent en `Int`**, jamais de string pré-formatée ("22 000 FCFA"). Le formatage reste à l'affichage via `money()` (déjà dans [lib/format.ts](../../../lib/format.ts)). Les mocks actuels stockent des strings formatées ; c'est un artefact de fixtures, pas un choix à reproduire en DB.
- **`Customer.orders`/`spent`** du mock ne sont **pas** des colonnes — calculables par agrégat SQL sur `Order` (`COUNT`, `SUM(total)`). Évite une donnée dupliquée à tenir à jour manuellement à chaque changement de statut de commande.
- **`OrderLine.nameAtOrder`** fige le nom produit au moment de la commande — un produit renommé plus tard ne doit pas réécrire l'historique des commandes passées.
- **`notifs.ts`** (mock) n'a pas de table dédiée ici — restera dérivé des événements commande/stock, hors périmètre de ce sous-projet.
- **Stock simple** (`Product.stock: Int`) pour ce sous-projet. **Évolution future notée** : passage à un stock tripartite (interne / sous-traitance / matériel, §2 du CLAUDE.md) quand l'UI qui l'exploite sera brainstormée — nécessitera une migration de schéma ultérieure (probablement une table `StockLine` séparée par source).

### 2.2 Génération de `Order.ref`

Remplace le calcul fragile actuel côté client (`nextOrderRef` = max des ids persistés + 1, qui repart de zéro si le store n'est jamais hydraté). Une séquence Postgres par tenant garantit l'absence de collision, y compris en cas d'écritures concurrentes :

```sql
create sequence orders_ref_seq start 2701;
-- default de Order.ref : '#TER-' || nextval('orders_ref_seq')
```

## 3. RLS — policies par rôle & tenant

| Table | SELECT | INSERT | UPDATE |
|---|---|---|---|
| `tenants` | public | — | `super_admin` |
| `products` | public (catalogue vitrine) | `owner`/`staff` du tenant | `owner`/`staff` du tenant |
| `customers` | `owner`/`staff` du tenant | `owner`/`staff` du tenant | `owner`/`staff` du tenant |
| `profiles` | soi-même ; `owner`/`staff` (même tenant) ; `super_admin` (tout) | — (créé par le trigger Auth, sous-projet 2) | soi-même ; `super_admin` |
| `orders` | `owner`/`staff` du tenant | **`anon` + `authenticated`, filtré par `tenant_id`** | `owner`/`staff` du tenant |
| `order_lines` | `owner`/`staff` du tenant (via join `orders.tenant_id`) | **`anon` + `authenticated`** (même commande que la ligne `orders` insérée) | `owner`/`staff` du tenant |

**Point important** : `orders`/`order_lines` acceptent un `INSERT` anonyme, car le checkout v1 ne requiert pas de compte client (mini-fiche KYC seulement, cf. CLAUDE.md §4). En contrepartie, `SELECT`/`UPDATE` restent strictement réservés à `owner`/`staff` — un visiteur ne peut ni lire ni modifier une commande après création. La RLS ne peut pas à elle seule garantir que le `total` inséré est honnête (pas de contrainte arithmétique cross-table simple en RLS) ; le recalcul serveur du total (CLAUDE.md §4/§9 : "jamais de confiance au client") sera appliqué dans une Server Action au sous-projet 4, pas dans ce sous-projet-ci.

Vérification post-migration via `mcp__supabase__get_advisors` (catégorie sécurité) après chaque migration touchant RLS.

## 4. Workflow migrations

**Contrainte d'environnement observée** : le CLI `supabase` et `docker` sont installés localement mais leurs invocations sont tuées (exit 137) dans le bac à sable de cette session — pas d'accès fiable à un shadow DB local pour `prisma migrate dev`.

**Approche retenue** : `prisma/schema.prisma` écrit à la main (contenu ci-dessus, traduit en syntaxe Prisma). Chaque évolution devient une migration SQL, appliquée en direct sur le projet Supabase connecté via `mcp__supabase__apply_migration`, et la même SQL est sauvegardée dans `prisma/migrations/<timestamp>_<nom>/migration.sql` pour que l'historique Prisma reflète fidèlement la base réelle, sans dépendre d'un shadow DB local. Aucune credential DB (`DATABASE_URL`) n'est nécessaire pour ce sous-projet — `prisma generate` ne se connecte pas à la base, seule `prisma migrate dev`/`db pull` en auraient besoin. Le mot de passe Postgres ne deviendra nécessaire qu'au sous-projet où le code applicatif interroge réellement la base via Prisma Client (sous-projet 3 ou 4).

## 5. Seed

Un script (`prisma/seed.ts`, exécuté via `execute_sql` du MCP ou un client Prisma une fois `DATABASE_URL` disponible) recopie l'intégralité des données mock actuelles sous le tenant `foulard-teranga` (déjà défini dans [lib/tenant/registry.ts](../../../lib/tenant/registry.ts)) :

- `lib/data/catalog.ts` → `products`
- `lib/data/clients.ts` → `customers`
- `lib/data/orders.ts` → `orders` + `order_lines`

Aucun compte `profiles` réel n'est créé (pas encore d'utilisateurs Supabase Auth — sous-projet 2).

## 6. Non-goals de ce sous-projet

- Pas de changement dans `app/`, `lib/data/`, `lib/store/` — l'UI continue de tourner sur les mocks.
- Pas de login réel (sous-projet 2).
- Pas de stock tripartite (évolution future notée en §2.1).
- Pas de recalcul serveur du total ni de déduction de stock réelle (sous-projet 4).
- `npm run test` / `npm run typecheck` restent verts sans aucune modification, puisque le code applicatif n'est pas touché.

## 7. Critères de réussite

- `mcp__supabase__list_tables` retourne les 6 tables ci-dessus avec les bonnes colonnes/types.
- `mcp__supabase__list_migrations` retourne l'historique complet, et `prisma/migrations/` contient la même liste en local.
- `mcp__supabase__get_advisors` (sécurité) ne remonte aucune alerte RLS non résolue sur les 6 tables.
- Les tables `products`/`customers`/`orders`/`order_lines` contiennent les données seedées, vérifiables via `execute_sql` (comptage = 12 produits, 6 clientes, 7 commandes avec leurs lignes).
- `npm run test` et `npm run typecheck` toujours verts (aucune régression, code applicatif intact).
