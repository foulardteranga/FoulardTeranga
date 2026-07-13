# Fondation DB Supabase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a real Postgres schema (Prisma-defined, migrated and RLS-protected) on the already-connected Supabase project, seeded with the current mock data — without touching any application code.

**Architecture:** `prisma/schema.prisma` is the source of truth for the data model (Prisma 7, no `url` in the schema — connection config lives in `prisma.config.ts`, per Prisma 7's breaking change). SQL migrations are hand-written to match the schema exactly and applied directly to the live Supabase project via the `mcp__supabase__apply_migration` MCP tool (chosen over `prisma migrate dev` because this sandbox kills `supabase`/`docker` CLI invocations — exit 137 — so no local shadow database is reachable). Each applied migration's SQL is also saved under `prisma/migrations/` so the on-disk history matches the live database. RLS policies are a second migration. Seed data is inserted via `mcp__supabase__execute_sql`.

**Tech Stack:** Prisma 7.8.0 (`prisma` CLI + `@prisma/client`), PostgreSQL (Supabase project `vqqwviknffequjvxmojo`), Supabase MCP tools (`apply_migration`, `execute_sql`, `list_tables`, `list_migrations`, `get_advisors`).

## Global Constraints

- TypeScript strict, jamais de `any` (CLAUDE.md §8) — applies to `prisma.config.ts`, the only `.ts` file this plan creates.
- RLS activée et testée sur chaque table métier ; policy explicite par rôle & propriété (CLAUDE.md §9).
- Toute nouvelle table → migration Prisma **+** policy RLS **+** vérification (CLAUDE.md §12).
- Ne jamais exposer `service_role` ni contourner la RLS côté client (CLAUDE.md §9) — not at risk here since all DDL runs through the MCP tool, not app code.
- Secrets en variables d'env, jamais commit (CLAUDE.md §9) — `.env` stays gitignored (already covered by the repo's `.gitignore`).
- Node ≥ 22 LTS.
- This plan does not modify `app/`, `lib/data/`, `lib/store/`, or any existing test — `npm run test` (75/75) and `npm run typecheck` must stay green throughout, unchanged.
- Stock modeling stays simple (`Product.stock: Int`) — tripartite stock (interne/sous-traitance/matériel) is an explicitly deferred future evolution, not part of this plan.

---

### Task 1: Prisma tooling & config scaffolding

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `.env`
- Create: `.env.example`
- Create: `prisma.config.ts`
- Create: `prisma/schema.prisma`

**Interfaces:**
- Produces: `prisma/schema.prisma` (skeleton — `generator`/`datasource` blocks only, models added in Task 2), `prisma.config.ts` (`defineConfig` pointing the CLI at `DIRECT_URL`), a working `npx prisma generate` command later tasks can re-run after schema edits.

- [ ] **Step 1: Install `@prisma/client`**

Run: `npm install @prisma/client`
Expected: `package.json`'s `dependencies` gains `"@prisma/client": "^7.8.0"` (or the exact version npm resolves — 7.8.0 is the latest at time of writing), `added N packages` in the output, exit code 0.

- [ ] **Step 2: Install the `prisma` CLI as a dev dependency**

Run: `npm install --save-dev prisma`
Expected: `package.json`'s `devDependencies` gains `"prisma": "^7.8.0"`, exit code 0.

- [ ] **Step 3: Create `.env` with placeholder connection strings**

Create `.env` (already covered by the repo's `.gitignore` `.env` line — do not add a second entry):

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/postgres"
```

These are placeholders only. This task never connects to a real database — `prisma generate` does not require a reachable connection, only a syntactically valid schema. The real Supabase pooled/direct connection strings become necessary starting whichever future sub-project first instantiates `PrismaClient` in application code (sub-project 3 or 4) — at that point, the DB password must be fetched from the Supabase dashboard (not obtainable via the MCP tools, which don't expose raw credentials) and both variables replaced with the real pooler (`DATABASE_URL`, port 6543, `?pgbouncer=true`) and direct (`DIRECT_URL`, port 5432) Supabase connection strings.

- [ ] **Step 4: Create `.env.example` documenting the real shape**

Create `.env.example`:

```bash
# Pooled connection — used by PrismaClient at application runtime (sub-project 3+).
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection — used by the Prisma CLI (migrate, db pull, studio) via prisma.config.ts, bypasses the pooler.
DIRECT_URL="postgresql://postgres.<project-ref>:<password>@aws-<region>.pooler.supabase.com:5432/postgres"
```

- [ ] **Step 5: Create `prisma.config.ts`**

Create `prisma.config.ts` at the repo root:

```typescript
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
```

- [ ] **Step 6: Create the `prisma/schema.prisma` skeleton**

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../lib/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

Note for later sub-projects: Prisma 7 requires a driver adapter (`@prisma/adapter-pg` for Postgres) to instantiate `PrismaClient` at runtime — `new PrismaClient()` without an `adapter` throws. Installing that adapter is out of scope here (no application code touches the database in this plan) and belongs to whichever sub-project first writes a `lib/db/client.ts`.

- [ ] **Step 7: Ignore the generated Prisma client output**

In `.gitignore`, add a new section after the existing `# vercel` block:

```
# prisma
/lib/generated/prisma
```

- [ ] **Step 8: Add a `postinstall` script**

In `package.json`, add to `"scripts"`:

```json
"postinstall": "prisma generate"
```

- [ ] **Step 9: Generate the (empty) client to confirm the toolchain works**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client (7.8.0) to ./lib/generated/prisma` (or the resolved version), exit code 0, no connection attempted (schema has zero models yet — this only proves the CLI, config file, and env loading are wired correctly).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example prisma.config.ts prisma/schema.prisma
git commit -m "chore: scaffold Prisma 7 tooling and config (no models yet)"
```

(`.env` is gitignored and must NOT be committed.)

---

### Task 2: Full data model

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: the skeleton `generator`/`datasource` blocks from Task 1.
- Produces: 5 enums (`Role`, `ProductCategory`, `CustomerSegment`, `OrderStatus`, `OrderChannel`) and 6 models (`Tenant`, `Profile`, `Product`, `Customer`, `Order`, `OrderLine`) with exact field names/types that Task 3's hand-written SQL and Task 5's seed data must match verbatim.

- [ ] **Step 1: Replace `prisma/schema.prisma` with the full data model**

Replace the entire file content with:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../lib/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum Role {
  super_admin
  owner
  staff
  customer
}

enum ProductCategory {
  Foulards
  Turbans
  Tissus
  Accessoires
}

enum CustomerSegment {
  VIP
  Fidele
  Nouvelle
}

enum OrderStatus {
  nouvelle
  confirmee
  preparation
  livree
  refusee
}

enum OrderChannel {
  Web
  WhatsApp
  Boutique
}

model Tenant {
  id           String   @id @default(cuid())
  slug         String   @unique
  name         String
  primaryColor String
  accentColor  String
  logoText     String
  domains      String[]
  createdAt    DateTime @default(now())

  profiles  Profile[]
  products  Product[]
  customers Customer[]
  orders    Order[]
}

model Profile {
  id        String   @id
  tenantId  String
  role      Role
  name      String
  createdAt DateTime @default(now())

  tenant   Tenant    @relation(fields: [tenantId], references: [id])
  customer Customer?

  @@index([tenantId])
}

model Product {
  id          String          @id @default(cuid())
  tenantId    String
  category    ProductCategory
  name        String
  variant     String
  price       Int
  stock       Int
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

  @@index([tenantId])
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

  tenant  Tenant   @relation(fields: [tenantId], references: [id])
  profile Profile? @relation(fields: [profileId], references: [id])
  orders  Order[]

  @@index([tenantId])
}

model Order {
  id         String       @id @default(cuid())
  tenantId   String
  ref        String       @unique @default(dbgenerated("('#TER-' || nextval('orders_ref_seq'))"))
  customerId String?
  clientName String
  place      String
  phone      String
  channel    OrderChannel
  status     OrderStatus  @default(nouvelle)
  vipAtOrder Boolean      @default(false)
  total      Int
  createdAt  DateTime     @default(now())

  tenant   Tenant      @relation(fields: [tenantId], references: [id])
  customer Customer?   @relation(fields: [customerId], references: [id])
  lines    OrderLine[]

  @@index([tenantId])
}

model OrderLine {
  id          String @id @default(cuid())
  orderId     String
  productId   String
  nameAtOrder String
  qty         Int
  unitPrice   Int
  lineTotal   Int

  order   Order   @relation(fields: [orderId], references: [id])
  product Product @relation(fields: [productId], references: [id])

  @@index([orderId])
  @@index([productId])
}
```

Field-naming note: no model uses `@@map`/`@map`, so Prisma's default naming applies — table names match model names exactly (`"Tenant"`, `"Product"`, …) and column names match field names exactly (`"tenantId"`, `"oldPrice"`, …), both case-sensitive and requiring double-quoting in raw SQL. Task 3's hand-written migration must use these exact quoted identifiers.

- [ ] **Step 2: Format and validate**

Run: `npx prisma format`
Expected: rewrites the file with canonical spacing/alignment, exit code 0, no output beyond the reformat.

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 3: Regenerate the client to confirm the full model compiles**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client (7.8.0) to ./lib/generated/prisma`, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: define the full Prisma data model (tenants, profiles, catalog, customers, orders)"
```

---

### Task 3: Initial schema migration (tables, enums, sequence, indexes)

**Files:**
- Create: `prisma/migrations/20260713120000_init/migration.sql`

**Interfaces:**
- Consumes: the exact table/column/enum names from Task 2's `schema.prisma`.
- Produces: 6 live Postgres tables + 5 enum types + the `orders_ref_seq` sequence on the connected Supabase project (`vqqwviknffequjvxmojo`), which Task 4's RLS policies and Task 5's seed inserts both target by these exact names.

- [ ] **Step 1: Write the migration SQL to disk**

Create the directory and file `prisma/migrations/20260713120000_init/migration.sql`:

```sql
-- Enums
create type "Role" as enum ('super_admin', 'owner', 'staff', 'customer');
create type "ProductCategory" as enum ('Foulards', 'Turbans', 'Tissus', 'Accessoires');
create type "CustomerSegment" as enum ('VIP', 'Fidele', 'Nouvelle');
create type "OrderStatus" as enum ('nouvelle', 'confirmee', 'preparation', 'livree', 'refusee');
create type "OrderChannel" as enum ('Web', 'WhatsApp', 'Boutique');

-- Sequence for human-readable order references (#TER-XXXX), floor matches the
-- app's existing in-memory convention (lib/store/useShop.ts's nextOrderRef).
create sequence orders_ref_seq start 2701;

-- Tenant
create table "Tenant" (
  id text primary key,
  slug text not null unique,
  name text not null,
  "primaryColor" text not null,
  "accentColor" text not null,
  "logoText" text not null,
  domains text[] not null default '{}',
  "createdAt" timestamptz not null default now()
);

-- Profile (mirrors auth.users; rows created by a trigger in the Auth sub-project)
create table "Profile" (
  id uuid primary key,
  "tenantId" text not null references "Tenant"(id),
  role "Role" not null,
  name text not null,
  "createdAt" timestamptz not null default now()
);
create index "Profile_tenantId_idx" on "Profile" ("tenantId");

-- Product
create table "Product" (
  id text primary key,
  "tenantId" text not null references "Tenant"(id),
  category "ProductCategory" not null,
  name text not null,
  variant text not null,
  price integer not null,
  stock integer not null,
  swatch text not null,
  colors text[] not null default '{}',
  motif text not null,
  lengths text[] not null default '{}',
  description text not null,
  "oldPrice" integer,
  badge text,
  featured boolean not null default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index "Product_tenantId_idx" on "Product" ("tenantId");

-- Customer
create table "Customer" (
  id text primary key,
  "tenantId" text not null references "Tenant"(id),
  "profileId" uuid unique references "Profile"(id),
  name text not null,
  initials text not null,
  phone text not null,
  place text not null,
  points integer not null default 0,
  vip boolean not null default false,
  segment "CustomerSegment" not null,
  "createdAt" timestamptz not null default now()
);
create index "Customer_tenantId_idx" on "Customer" ("tenantId");

-- Order
create table "Order" (
  id text primary key,
  "tenantId" text not null references "Tenant"(id),
  ref text not null unique default ('#TER-' || nextval('orders_ref_seq')),
  "customerId" text references "Customer"(id),
  "clientName" text not null,
  place text not null,
  phone text not null,
  channel "OrderChannel" not null,
  status "OrderStatus" not null default 'nouvelle',
  "vipAtOrder" boolean not null default false,
  total integer not null,
  "createdAt" timestamptz not null default now()
);
create index "Order_tenantId_idx" on "Order" ("tenantId");

-- OrderLine
create table "OrderLine" (
  id text primary key,
  "orderId" text not null references "Order"(id),
  "productId" text not null references "Product"(id),
  "nameAtOrder" text not null,
  qty integer not null,
  "unitPrice" integer not null,
  "lineTotal" integer not null
);
create index "OrderLine_orderId_idx" on "OrderLine" ("orderId");
create index "OrderLine_productId_idx" on "OrderLine" ("productId");
```

- [ ] **Step 2: Apply the migration to the live Supabase project**

Call `mcp__supabase__apply_migration` with:
- `name`: `init`
- `query`: the exact SQL content written in Step 1.

Expected: tool returns success with no error.

- [ ] **Step 3: Verify the tables exist**

Call `mcp__supabase__list_tables` with `schemas: ["public"]`, `verbose: true`.
Expected: 6 tables (`Tenant`, `Profile`, `Product`, `Customer`, `Order`, `OrderLine`) each with the columns defined in Step 1, and foreign keys `Profile.tenantId → Tenant.id`, `Product.tenantId → Tenant.id`, `Customer.tenantId → Tenant.id`, `Customer.profileId → Profile.id`, `Order.tenantId → Tenant.id`, `Order.customerId → Customer.id`, `OrderLine.orderId → Order.id`, `OrderLine.productId → Product.id`.

- [ ] **Step 4: Verify the migration is recorded**

Call `mcp__supabase__list_migrations`.
Expected: one entry named `init` (or matching the timestamp prefix used).

- [ ] **Step 5: Commit**

```bash
git add prisma/migrations/20260713120000_init/migration.sql
git commit -m "feat: apply the initial schema migration to Supabase (tenants, catalog, customers, orders)"
```

---

### Task 4: RLS policies

**Files:**
- Create: `prisma/migrations/20260713120100_rls/migration.sql`

**Interfaces:**
- Consumes: the 6 tables from Task 3.
- Produces: `public.current_tenant_id()` and `public.current_role()` SQL helper functions (usable by any future migration needing role/tenant checks), RLS enabled + policies on all 6 tables.

- [ ] **Step 1: Write the RLS migration SQL to disk**

Create `prisma/migrations/20260713120100_rls/migration.sql`:

```sql
-- Helper functions. SECURITY DEFINER is required so that evaluating these
-- functions from inside a policy on "Profile" itself does not recurse through
-- RLS a second time (which would either deadlock the policy check or always
-- see zero rows).
create or replace function public.current_tenant_id() returns text
language sql stable security definer set search_path = public as $$
  select "tenantId" from "Profile" where id = auth.uid()
$$;

create or replace function public.current_role() returns "Role"
language sql stable security definer set search_path = public as $$
  select role from "Profile" where id = auth.uid()
$$;

-- Tenant: public read (storefront needs the theme), writes reserved to super_admin.
alter table "Tenant" enable row level security;

create policy "tenants_select_public" on "Tenant"
  for select using (true);

create policy "tenants_write_super_admin" on "Tenant"
  for all using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

-- Profile: self access, staff can read their tenant's profiles, super_admin reads all.
alter table "Profile" enable row level security;

create policy "profiles_select_self" on "Profile"
  for select using (id = auth.uid());

create policy "profiles_select_staff" on "Profile"
  for select using (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  );

create policy "profiles_select_super_admin" on "Profile"
  for select using (public.current_role() = 'super_admin');

create policy "profiles_update_self" on "Profile"
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- Product: public read (storefront catalog), writes reserved to owner/staff of the same tenant.
alter table "Product" enable row level security;

create policy "products_select_public" on "Product"
  for select using (true);

create policy "products_insert_staff" on "Product"
  for insert with check (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  );

create policy "products_update_staff" on "Product"
  for update using (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  )
  with check (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  );

create policy "products_delete_staff" on "Product"
  for delete using (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  );

-- Customer: no public/customer read in v1 (no customer login yet) — owner/staff of the same tenant only.
alter table "Customer" enable row level security;

create policy "customers_all_staff" on "Customer"
  for all using (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  )
  with check (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  );

-- Order: anonymous INSERT allowed (v1 checkout has no customer login, CLAUDE.md §4 — a
-- KYC mini-form is enough), but SELECT/UPDATE stay reserved to owner/staff of the tenant.
-- The DB cannot verify the inserted total is honest (no cross-row arithmetic in RLS);
-- server-side total recomputation is the future Server Action's job (sub-project 4 of
-- the overall migration), not this table's RLS.
alter table "Order" enable row level security;

create policy "orders_insert_public" on "Order"
  for insert with check (true);

create policy "orders_select_staff" on "Order"
  for select using (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  );

create policy "orders_update_staff" on "Order"
  for update using (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  )
  with check (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  );

-- OrderLine: same public-insert / staff-read shape as Order, joined through orderId
-- since OrderLine has no tenantId column of its own.
alter table "OrderLine" enable row level security;

create policy "order_lines_insert_public" on "OrderLine"
  for insert with check (true);

create policy "order_lines_select_staff" on "OrderLine"
  for select using (
    exists (
      select 1 from "Order" o
      where o.id = "OrderLine"."orderId"
        and o."tenantId" = public.current_tenant_id()
        and public.current_role() in ('owner', 'staff')
    )
  );

create policy "order_lines_update_staff" on "OrderLine"
  for update using (
    exists (
      select 1 from "Order" o
      where o.id = "OrderLine"."orderId"
        and o."tenantId" = public.current_tenant_id()
        and public.current_role() in ('owner', 'staff')
    )
  );
```

- [ ] **Step 2: Apply the RLS migration**

Call `mcp__supabase__apply_migration` with:
- `name`: `rls`
- `query`: the exact SQL content written in Step 1.

Expected: tool returns success with no error.

- [ ] **Step 3: Verify no RLS advisory warnings remain**

Call `mcp__supabase__get_advisors` with `type: "security"`.
Expected: no advisory about missing RLS or missing policies on `Tenant`, `Profile`, `Product`, `Customer`, `Order`, or `OrderLine`. If any other advisory appears (e.g. about the `SECURITY DEFINER` functions), read its remediation link and fix inline before moving on — do not defer it.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/20260713120100_rls/migration.sql
git commit -m "feat: enable RLS and add tenant/role-scoped policies on all 6 tables"
```

---

### Task 5: Seed data

**Files:**
- Create: `prisma/seed.sql`

**Interfaces:**
- Consumes: the live tables from Task 3, the tenant id `foulard-teranga` (matching `lib/tenant/registry.ts`'s `DEFAULT_TENANT.id`).
- Produces: 1 tenant row, 12 product rows (ids `p1`–`p12`, matching `lib/data/catalog.ts`), 6 customer rows (ids `c1`–`c6`, matching `lib/data/clients.ts`), 7 order rows + their order lines (matching `lib/data/orders.ts`) — all of which sub-project 3/4/5's future app-code migration will read from directly by these same ids.

Two pre-existing inconsistencies in the mock fixture data are preserved verbatim (not "fixed") because this task's job is a faithful copy, and because CLAUDE.md's server-side total recomputation is explicitly out of scope until a later sub-project:
- Order `#TER-0491`'s `total` (31 000) doesn't match its single line's `lineTotal` (35 000).
- Order `#TER-0489`'s `total` (86 000) doesn't match the sum of its two lines' `lineTotal` (80 000 + 8 000 = 88 000).

`Customer.points`/`vip`/`segment` are seeded from the mock; `Customer.orders`/`spent` (the mock's demo "14 commandes / 420 000 FCFA" style fields) are intentionally **not** seeded as columns — per the approved spec, they become a `COUNT`/`SUM` query over `Order` once the app reads real data (sub-project 5). Since the seeded `Order` table only has 7 rows total across all customers, those future computed numbers will be much smaller than the mock's fabricated demo figures — expected, not a bug.

- [ ] **Step 1: Write the seed SQL to disk**

Create `prisma/seed.sql`:

```sql
insert into "Tenant" (id, slug, name, "primaryColor", "accentColor", "logoText", domains) values
  ('foulard-teranga', 'foulard-teranga', 'Foulard Teranga', '#26326B', '#D07A34', 'Foulard Teranga', array['localhost', 'foulard-teranga.localhost']);

insert into "Product" (id, "tenantId", category, name, variant, price, stock, swatch, colors, motif, lengths, description, "oldPrice", badge, featured) values
  ('p1', 'foulard-teranga', 'Foulards', 'Foulard Wax Abidjan', 'Wax · 90×90', 12500, 24, 'repeating-linear-gradient(45deg,#e6d9c4,#e6d9c4 8px,#efe6d6 8px,#efe6d6 16px)', array['#26326B','#D07A34','#C9A227'], 'Wax', array['90 × 90 cm','Sur-mesure'], 'Coton wax authentique, imprimé vibrant inspiré des marchés d''Abidjan. Un incontournable du quotidien.', null, 'Nouveau', false),
  ('p2', 'foulard-teranga', 'Foulards', 'Foulard soie Kente', 'Soie · 70×70', 22000, 6, 'repeating-linear-gradient(45deg,#d8c9e0,#d8c9e0 8px,#e6dcec 8px,#e6dcec 16px)', array['#26326B','#0E9F6E','#C9A227'], 'Kente', array['70 × 70 cm','Sur-mesure'], 'Soie fluide au toucher précieux, tissage Kente aux couleurs chaudes. Notre pièce signature, en édition limitée.', null, '★ Coup de cœur', true),
  ('p3', 'foulard-teranga', 'Turbans', 'Turban Bazin Or', 'Bazin · brodé', 18000, 14, 'repeating-linear-gradient(45deg,#e6dcb4,#e6dcb4 8px,#f0e9cc 8px,#f0e9cc 16px)', array['#C9A227','#1E1B18'], 'Bazin', array['Taille unique'], 'Bazin riche brodé main, éclat doré pour les grandes occasions.', null, null, false),
  ('p4', 'foulard-teranga', 'Foulards', 'Foulard mousseline', 'Mousseline · 55×55', 7000, 31, 'repeating-linear-gradient(45deg,#d5e0dc,#d5e0dc 8px,#e4ece8 8px,#e4ece8 16px)', array['#0E9F6E','#26326B'], 'Uni', array['55 × 55 cm'], 'Mousseline légère et respirante, l''essentiel du quotidien, doux et facile à nouer.', null, null, false),
  ('p5', 'foulard-teranga', 'Tissus', 'Wax Vlisco 6 yards', 'Coton · 6 yd', 35000, 9, 'repeating-linear-gradient(45deg,#e0cfc0,#e0cfc0 8px,#ece0d4 8px,#ece0d4 16px)', array['#D07A34','#26326B'], 'Wax', array['6 yards'], 'Wax Vlisco authentique, motifs vibrants pour vos tenues sur-mesure.', null, null, false),
  ('p6', 'foulard-teranga', 'Tissus', 'Bazin riche', 'Damassé · 5 m', 28000, 4, 'repeating-linear-gradient(45deg,#cfd8e0,#cfd8e0 8px,#dfe6ec 8px,#dfe6ec 16px)', array['#26326B','#1E1B18'], 'Bazin', array['5 mètres'], 'Bazin riche damassé, éclat soutenu, pour vos grandes occasions.', 32000, null, false),
  ('p7', 'foulard-teranga', 'Tissus', 'Kente bande', 'Tissé main · 4 m', 40000, 11, 'repeating-linear-gradient(45deg,#e6c9c0,#e6c9c0 8px,#efdcd4 8px,#efdcd4 16px)', array['#D07A34','#C9A227','#26326B'], 'Kente', array['4 mètres'], 'Tissage Kente authentique, réalisé à la main, un drapé généreux et précieux.', null, '★ VIP', false),
  ('p8', 'foulard-teranga', 'Tissus', 'Pagne Woodin', 'Coton · 6 yd', 24000, 17, 'repeating-linear-gradient(45deg,#d0ddc9,#d0ddc9 8px,#e0ebda 8px,#e0ebda 16px)', array['#0E9F6E','#D07A34'], 'Wax', array['6 yards'], 'Pagne Woodin coloré, coton de qualité pour vos créations sur-mesure.', null, null, false),
  ('p9', 'foulard-teranga', 'Accessoires', 'Broche dorée', 'Laiton · plaqué', 4500, 22, 'repeating-linear-gradient(45deg,#e6dcb4,#e6dcb4 8px,#f0e9cc 8px,#f0e9cc 16px)', array['#C9A227'], 'Uni', array['Taille unique'], 'Broche en laiton plaqué or, l''accent parfait pour relever un foulard ou un turban.', null, null, false),
  ('p10', 'foulard-teranga', 'Accessoires', 'Boucles perles', 'Perles · fait main', 6000, 3, 'repeating-linear-gradient(45deg,#e0cfd6,#e0cfd6 8px,#ece0e6 8px,#ece0e6 16px)', array['#D07A34','#1E1B18'], 'Uni', array['Taille unique'], 'Boucles d''oreilles en perles faites main, légères et élégantes.', null, 'Nouveau', false),
  ('p11', 'foulard-teranga', 'Accessoires', 'Sac raphia', 'Raphia tressé', 15000, 8, 'repeating-linear-gradient(45deg,#e2d6bf,#e2d6bf 8px,#ece3d2 8px,#ece3d2 16px)', array['#C9A227','#26326B'], 'Uni', array['Taille unique'], 'Sac en raphia tressé à la main, la touche artisanale qui complète toute tenue.', null, null, false),
  ('p12', 'foulard-teranga', 'Accessoires', 'Pochette wax', 'Wax · doublée', 8000, 19, 'repeating-linear-gradient(45deg,#d9d2c4,#d9d2c4 8px,#e7e1d6 8px,#e7e1d6 16px)', array['#D07A34','#0E9F6E'], 'Wax', array['Taille unique'], 'Pochette en wax doublée, pratique et colorée pour vos sorties.', null, null, false);

insert into "Customer" (id, "tenantId", name, initials, phone, place, points, vip, segment) values
  ('c1', 'foulard-teranga', 'Aya Koffi', 'AK', '+225 07 12 45 67 89', 'Cocody, Abidjan', 186, true, 'VIP'),
  ('c2', 'foulard-teranga', 'Adjoua N''Guessan', 'AN', '+225 05 33 21 09 44', 'Yopougon, Abidjan', 92, false, 'Fidele'),
  ('c3', 'foulard-teranga', 'Mariam Traoré', 'MT', '+225 01 88 76 54 32', 'Plateau, Abidjan', 154, true, 'VIP'),
  ('c4', 'foulard-teranga', 'Fatou Bamba', 'FB', '+225 07 45 09 87 11', 'Marcory, Abidjan', 47, false, 'Fidele'),
  ('c5', 'foulard-teranga', 'Aminata Koné', 'AK', '+225 05 61 23 45 78', 'Bouaké', 23, false, 'Nouvelle'),
  ('c6', 'foulard-teranga', 'Grace Kouassi', 'GK', '+225 01 19 82 73 64', 'Riviera, Abidjan', 128, false, 'Fidele');

insert into "Order" (id, "tenantId", ref, "customerId", "clientName", place, phone, channel, status, "vipAtOrder", total) values
  ('TER-0492', 'foulard-teranga', '#TER-0492', 'c1', 'Aya Koffi', 'Cocody, Abidjan', '+225 07 12 45 67 89', 'Web', 'nouvelle', true, 54000),
  ('TER-0491', 'foulard-teranga', '#TER-0491', 'c4', 'Fatou Bamba', 'Marcory, Abidjan', '+225 07 45 09 87 11', 'WhatsApp', 'nouvelle', false, 31000),
  ('TER-0490', 'foulard-teranga', '#TER-0490', 'c5', 'Aminata Koné', 'Bouaké', '+225 05 61 23 45 78', 'Web', 'nouvelle', false, 12500),
  ('TER-0489', 'foulard-teranga', '#TER-0489', 'c3', 'Mariam Traoré', 'Plateau, Abidjan', '+225 01 88 76 54 32', 'Web', 'confirmee', true, 86000),
  ('TER-0488', 'foulard-teranga', '#TER-0488', 'c2', 'Adjoua N''Guessan', 'Yopougon, Abidjan', '+225 05 33 21 09 44', 'Boutique', 'preparation', false, 27500),
  ('TER-0487', 'foulard-teranga', '#TER-0487', 'c6', 'Grace Kouassi', 'Riviera, Abidjan', '+225 01 19 82 73 64', 'Web', 'livree', false, 42000),
  ('TER-0486', 'foulard-teranga', '#TER-0486', 'c4', 'Fatou Bamba', 'Marcory, Abidjan', '+225 07 45 09 87 11', 'Web', 'refusee', false, 7000);

insert into "OrderLine" (id, "orderId", "productId", "nameAtOrder", qty, "unitPrice", "lineTotal") values
  ('TER-0492-1', 'TER-0492', 'p2', 'Foulard soie Kente', 1, 22000, 22000),
  ('TER-0492-2', 'TER-0492', 'p3', 'Turban Bazin Or', 1, 18000, 18000),
  ('TER-0492-3', 'TER-0492', 'p9', 'Broche dorée', 2, 4500, 9000),
  ('TER-0491-1', 'TER-0491', 'p5', 'Wax Vlisco 6 yards', 1, 35000, 35000),
  ('TER-0490-1', 'TER-0490', 'p1', 'Foulard Wax Abidjan', 1, 12500, 12500),
  ('TER-0489-1', 'TER-0489', 'p7', 'Kente bande', 2, 40000, 80000),
  ('TER-0489-2', 'TER-0489', 'p12', 'Pochette wax', 1, 8000, 8000),
  ('TER-0488-1', 'TER-0488', 'p8', 'Pagne Woodin', 1, 24000, 24000),
  ('TER-0487-1', 'TER-0487', 'p6', 'Bazin riche', 1, 28000, 28000),
  ('TER-0486-1', 'TER-0486', 'p4', 'Foulard mousseline', 1, 7000, 7000);
```

- [ ] **Step 2: Execute the seed**

Call `mcp__supabase__execute_sql` with `query` set to the exact SQL content written in Step 1.
Expected: tool returns success, no error (all foreign keys resolve since products/customers are inserted before orders/order lines, which is the order the statements appear in above).

- [ ] **Step 3: Verify row counts**

Call `mcp__supabase__execute_sql` with:

```sql
select
  (select count(*) from "Tenant") as tenants,
  (select count(*) from "Product") as products,
  (select count(*) from "Customer") as customers,
  (select count(*) from "Order") as orders,
  (select count(*) from "OrderLine") as order_lines;
```

Expected: `tenants=1, products=12, customers=6, orders=7, order_lines=10`.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.sql
git commit -m "feat: seed the Supabase tables with the current mock catalog/customers/orders"
```

---

### Task 6: Final verification & handoff docs

**Files:**
- Modify: `docs/superpowers/EXECUTION-STATUS.md`

**Interfaces:**
- Consumes: nothing new — this task only verifies Tasks 1–5 and records the result.

- [ ] **Step 1: Confirm the application is untouched and still green**

Run: `npm run test`
Expected: `Test Files 8 passed (8)` / `Tests 75 passed (75)` — identical to the pre-plan baseline, since no file under `app/`, `lib/data/`, or `lib/store/` was touched.

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 2: Run a full performance/security advisor sweep**

Call `mcp__supabase__get_advisors` with `type: "security"`.
Expected: clean, or only pre-existing/unrelated advisories (none about the 6 new tables).

Call `mcp__supabase__get_advisors` with `type: "performance"`.
Expected: read the results; if any new table is flagged (e.g. an unindexed foreign key not already covered by Task 3's `@@index` columns), note it — do not silently fix things outside this plan's task list, just record them for the next sub-project's brainstorming.

- [ ] **Step 3: Record completion in `EXECUTION-STATUS.md`**

Add a new section at the end of `docs/superpowers/EXECUTION-STATUS.md` (after the existing "Comment reprendre" section):

```markdown
## Migration mock → Supabase : sous-projet 1/5 (Fondation DB)

**Terminé** (voir `docs/superpowers/plans/2026-07-13-supabase-db-foundation.md` et le spec associé `docs/superpowers/specs/2026-07-13-supabase-db-foundation-design.md`).

- 6 tables (`Tenant`, `Profile`, `Product`, `Customer`, `Order`, `OrderLine`) + 5 enums + RLS active sur les 6, appliquées au projet Supabase `vqqwviknffequjvxmojo` via le MCP.
- Seed complet : 1 tenant, 12 produits, 6 clientes, 7 commandes + 10 lignes — copie fidèle des mocks actuels (`lib/data/*.ts`), y compris deux incohérences total/lignes déjà présentes dans le mock (commandes `#TER-0491` et `#TER-0489`), volontairement non corrigées ici.
- Code applicatif (`app/`, `lib/data/`, `lib/store/`) **non touché** — l'UI tourne toujours sur les mocks. `npm run test` (75/75) et `npm run typecheck` inchangés.
- Prochain sous-projet : **Auth réelle** (Supabase Auth pour la gérante/staff, RBAC dans `/lib/auth` et `proxy.ts`) — nécessite de créer les comptes Supabase Auth correspondants aux lignes `Profile` (aucune ligne `Profile` n'existe encore, la table est prête mais vide).
- Le mot de passe Postgres réel (pour `DATABASE_URL`/`DIRECT_URL` dans `.env`) reste à récupérer sur le dashboard Supabase — nécessaire dès que du code applicatif instancie `PrismaClient` (sous-projet 3 ou 4).
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/EXECUTION-STATUS.md
git commit -m "docs: record DB foundation sub-project completion in EXECUTION-STATUS.md"
```

---

## Self-Review Notes

- **Spec coverage:** §2 (tables/enums) → Task 2; §2.1 decisions (Int money, computed aggregates, `nameAtOrder` snapshot, no `notifs` table, simple stock) → Task 2 + Task 5 notes; §2.2 (`ref` sequence) → Task 3; §3 (RLS) → Task 4; §4 (migration workflow, MCP-driven) → Tasks 1/3/4; §5 (seed) → Task 5; §6 (non-goals) → enforced by Task 6 Step 1; §7 (success criteria) → Task 3 Steps 3–4, Task 4 Step 3, Task 5 Step 3, Task 6 Steps 1–2.
- **Placeholder scan:** no TBD/TODO; every SQL/Prisma/JSON step has complete, literal content.
- **Type consistency:** column names (`tenantId`, `customerId`, `orderId`, `productId`, `nameAtOrder`, `lineTotal`, `unitPrice`, `vipAtOrder`) are identical across the Prisma schema (Task 2), the hand-written SQL (Task 3), the RLS policies (Task 4), and the seed inserts (Task 5).
