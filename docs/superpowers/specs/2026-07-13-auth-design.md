# Spec — Auth réelle (sous-projet 2/5 de la migration mock → Supabase)

> Date : 2026-07-13 · Portée : remplacer `getSession()` mock par une authentification Supabase Auth réelle pour la gérante/staff (zones `dashboard`/`admin`). Les comptes clients côté vitrine restent hors périmètre (CLAUDE.md §4 : pas de compte client en v1, KYC seul).

## 0. Contexte — la migration en 5 sous-projets

1. **Fondation DB** — ✅ terminé (schéma, migrations, RLS, seed). `docs/superpowers/specs/2026-07-13-supabase-db-foundation-design.md`.
2. **Auth réelle** (ce document) — Supabase Auth pour la gérante/staff, RBAC dans `/lib/auth` et `proxy.ts`.
3. **Catalogue & stock** — `lib/data/catalog.ts` → lectures serveur depuis Postgres.
4. **Commandes & workflow** — `useShop` → Server Actions + Postgres + Realtime.
5. **Clientes & fidélité** — `lib/data/clients.ts` → Postgres.

## 1. Objectif de ce sous-projet

`lib/auth/index.ts` (`getSession()`, `requireZone()`) est aujourd'hui un stub synchrone qui renvoie toujours la même gérante mock. Ce sous-projet le remplace par une vraie authentification Supabase Auth : une page de connexion, une garde de zone réelle dans `proxy.ts` s'appuyant sur la table `Profile` (créée au sous-projet 1, actuellement vide), et une déconnexion. Le compte de démonstration owner est provisionné manuellement (voir §5) — ce sous-projet ne construit **pas** d'interface de création de boutique/compte par un super_admin (reporté à un futur sous-projet, quand le multi-boutique deviendra réel).

## 2. Périmètre — décisions validées

| Sujet | Décision |
|---|---|
| Comptes concernés | `owner`/`staff` (zones `dashboard`/`admin`) uniquement. Pas de compte client vitrine dans ce sous-projet. |
| Provisioning du compte owner | Créé manuellement par l'utilisateur via le dashboard Supabase (Authentication > Users). Ce sous-projet lit ensuite `auth.users` (lecture seule) pour créer la ligne `Profile` correspondante. Aucune manipulation de mot de passe côté agent. |
| Interface super_admin (créer boutique + compte) | **Hors périmètre** — sous-projet futur distinct, quand le multi-boutique sera réellement construit. La table `Profile`/`tenantId` posée au sous-projet 1 est déjà prête pour ça. |
| Vérification du rôle par requête | Requête sur `Profile` via RLS (`profiles_select_self`) dans `proxy.ts`, après `getUser()` vérifié. Pas de Custom Access Token Hook (complexité de configuration Supabase supplémentaire non justifiée pour une mono-boutique à 1-3 utilisateurs ; un hook retarderait aussi la prise en compte immédiate d'un changement de rôle jusqu'au prochain refresh de token). |
| Redirection en cas d'échec d'auth | Page de connexion dédiée `/admin/connexion` (dev) / `admin.<domaine>/connexion` (prod), avec `?next=` pour revenir à la page demandée. Remplace la redirection actuelle vers `/`, et corrige au passage le point de vigilance déjà noté dans `EXECUTION-STATUS.md` (boucle de redirection potentielle sur un sous-domaine privé de prod). |

## 3. Architecture

### 3.1 Clients Supabase

Deux clients serveur distincts, suivant la doc `@supabase/ssr` à jour (vérifiée via Context7 avant cette conception) :

- `lib/supabase/server.ts` — client pour Server Components / Server Actions, cookies via `next/headers`.
- `lib/supabase/middleware.ts` — client pour `proxy.ts` (Edge runtime), cookies request/response (`getAll`/`setAll`).

**Point de sécurité non-négociable** : toute décision d'autorisation utilise `supabase.auth.getUser()` (vérifié côté serveur Auth à chaque appel), jamais `supabase.auth.getSession()` (lu depuis le cookie, non vérifié — un cookie forgé pourrait usurper un `user.id`).

### 3.2 `lib/auth/index.ts` — réécriture

```ts
export async function getSession(): Promise<Session | null> {
  const supabase = createServerClient(); // lib/supabase/server.ts
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("Profile")
    .select("role, tenantId, name")
    .eq("id", user.id)
    .single();
  if (!profile) return null;
  return { userId: user.id, name: profile.name, role: profile.role };
}

export async function requireZone(zone: Zone): Promise<{ allowed: boolean }> {
  if (zone === "storefront") return { allowed: true };
  const session = await getSession();
  if (!session) return { allowed: false };
  return { allowed: ZONE_ROLES[zone].includes(session.role) };
}
```

`getSession()`/`requireZone()` deviennent **async** (rupture d'API mineure). Seuls appelants actuels : `proxy.ts` et `lib/auth/index.test.ts` — migration sans impact ailleurs (confirmé par recherche exhaustive dans `app/`, `components/`, `lib/`).

### 3.3 `proxy.ts` — garde réelle

```
proxy.ts (async désormais) :
  1. Résoudre zone + tenant (inchangé, lib/proxy/zones.ts + lib/tenant/registry.ts).
  2. Si le chemin réécrit est /connexion (dans la zone dashboard) → laisser passer sans garde
     (sinon boucle infinie : redirigé vers une page elle-même protégée).
  3. Si zone !== "storefront" : await requireZone(zone).
     - Si refusé → redirect vers /connexion?next=<chemin d'origine> (au lieu de /).
  4. Reste inchangé (tenant header, rewrite).
```

### 3.4 Page de connexion

`app/(dashboard)/connexion/page.tsx` (Server Component, lit `?next=` depuis `searchParams`) + un composant client pour le formulaire interactif (état d'erreur, spinner de soumission — même pattern que `CheckoutView` du sous-projet vitrine). Formulaire : email + mot de passe.

`app/(dashboard)/connexion/actions.ts` — Server Action `signIn` :

```ts
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function signIn(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Identifiants invalides." };
  const supabase = createServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: "Email ou mot de passe incorrect." };
  return { ok: true };
}
```

Résultat typé `{ ok, ... }` (jamais d'exception non gérée), conforme à CLAUDE.md §8. Succès → redirection côté client vers `next` (ou `/pos` par défaut). Échec → message d'erreur inline, formulaire reste rempli (sauf mot de passe).

### 3.5 Déconnexion

Server Action `signOut` (`app/(dashboard)/connexion/actions.ts`), appelle `supabase.auth.signOut()`, redirige vers `/connexion`. Bouton « Se déconnecter » ajouté à `components/dashboard/Sidebar.tsx` (Client Component déjà existant), via un `<form action={signOut}>` — pattern standard Next.js pour appeler une Server Action depuis un Client Component.

### 3.6 Zone `admin` (super_admin)

Réutilise la même page `/connexion` partagée (pas de page dédiée à `/platform/connexion` dans ce sous-projet — inutile tant qu'aucun compte `super_admin` n'existe). La garde `requireZone("admin")` fonctionne déjà correctement pour refuser tout rôle non-`super_admin` ; ce comportement est inchangé, seule la source du rôle passe de mock à réelle.

## 4. Nouvelles dépendances & configuration

- `@supabase/ssr` + `@supabase/supabase-js` (dépendances applicatives).
- `.env` / `.env.example` — deux nouvelles variables, **non secrètes** (clé publique protégée par RLS, contrairement à `DATABASE_URL`/`DIRECT_URL` qui restent des placeholders) :
  ```bash
  NEXT_PUBLIC_SUPABASE_URL="https://vqqwviknffequjvxmojo.supabase.co"
  NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_umx7FJFPPfmR9D_CPOPyIw_ASGFZG1r"
  ```

## 5. Provisioning du compte owner

1. **L'utilisateur** crée manuellement le compte dans Authentication > Users du dashboard Supabase (email + mot de passe de son choix). Aucune action de l'agent ici.
2. Une fois créé, lecture (via `execute_sql`, en lecture seule) de `auth.users` pour retrouver l'`id` (uuid) correspondant à l'email fourni.
3. Migration/insertion (via `execute_sql`) créant la ligne `Profile` correspondante : `id = <uuid trouvé>`, `tenantId = 'foulard-teranga'`, `role = 'owner'`, `name = <nom fourni par l'utilisateur>`.

Cette étape ne peut être automatisée de bout en bout par l'agent : elle nécessite une action humaine (créer le compte) entre les étapes 1 et 2. Le plan d'implémentation la découpera en une tâche qui s'arrête et demande explicitement à l'utilisateur de créer le compte avant de continuer.

## 6. Tests & vérification

- **Testable en isolation** (Vitest) : validation Zod du formulaire de connexion (email invalide, mot de passe vide) ; logique pure de correspondance rôle/zone (déjà couverte par `lib/auth/index.test.ts`, à adapter à l'async).
- **Non testable en isolation** : le flux de connexion réel bout-en-bout (Supabase Auth, cookies, redirection) nécessite un vrai compte et un navigateur réel. Vérification manuelle explicite requise, avec le compte provisionné en §5 — même approche que la Tâche 11 du sous-projet vitrine (checklist de parcours manuel, exécutée par l'utilisateur ou un futur agent avec outils navigateur fonctionnels).

## 7. Non-goals de ce sous-projet

- Pas d'interface super_admin de création de boutique/compte (sous-projet futur).
- Pas de compte client vitrine / pas de changement au checkout KYC (CLAUDE.md §4 inchangé).
- Pas de Custom Access Token Hook (décision §2, réévaluable si la perf devient un problème réel).
- Pas de récupération de mot de passe / réinitialisation (hors périmètre v1 — un seul compte, à gérer manuellement via le dashboard Supabase si besoin).
- Pas de invite-staff UI (un seul owner en v1 ; ajouter du staff reste une opération manuelle dashboard + insertion `Profile`, comme le owner, jusqu'à ce qu'un futur sous-projet construise l'UI de gestion d'équipe).

## 8. Critères de réussite

- `npm run test` / `npm run typecheck` restent verts.
- Un utilisateur non authentifié visitant `/admin/pos` est redirigé vers `/admin/connexion?next=%2Fpos`, sans boucle.
- Après connexion réussie avec le compte owner provisionné, redirection vers `/pos`, accès à toutes les routes `dashboard`.
- Déconnexion ramène à `/admin/connexion` et un accès direct à `/admin/pos` redemande une connexion.
- La zone `admin` (`/platform/*`) reste refusée pour le compte owner (rôle `owner` ≠ `super_admin`), comme aujourd'hui.
