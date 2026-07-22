# Gestion d'équipe & profils employés — design

> Statut : approuvé (brainstorming). Prochaine étape : plan d'implémentation.

## Contexte

La boutique n'a aujourd'hui aucune UI pour créer des comptes employés. Le RBAC
existant (`prisma/schema.prisma`, `lib/auth/index.ts`) repose sur un enum
`Role` figé (`super_admin`, `owner`, `staff`, `customer`) qui ne gère que
l'accès aux **zones** (`dashboard` vs `admin` vs `storefront`), pas de
permissions fines à l'intérieur du dashboard.

La gérante veut pouvoir :
1. Créer des « profils d'accès » (ex. Gérant, Caissier) définissant quels
   modules du back-office sont accessibles.
2. Créer des comptes employés (personne physique) et leur assigner un profil
   d'accès — le tout depuis l'UI, sans toucher au code.

Aucun compte `staff` n'existe encore en base — pas de migration de données
à prévoir pour des comptes existants.

## 1. Modèle de données

Nouveau modèle Prisma :

```prisma
model EmployeeRole {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  permissions String[] // sous-ensemble de MODULE_IDS (voir lib/nav.ts)
  createdAt   DateTime @default(now())

  tenant   Tenant    @relation(fields: [tenantId], references: [id])
  profiles Profile[]

  @@unique([tenantId, name])
  @@index([tenantId])
}
```

`Profile` gagne deux champs :

- `employeeRoleId String?` — FK vers `EmployeeRole`, pertinent uniquement
  quand `role = staff`. `null` pour `owner`/`super_admin`/`customer`.
- `active Boolean @default(true)` — désactivation d'un employé sans supprimer
  son compte Auth ni son historique (`StockMovement`, `OrderStatusEvent`
  référencent `Profile`, pas question de les casser).

Le `Role` enum **ne change pas**. Les profils personnalisés affinent l'accès
*à l'intérieur* de la zone `dashboard`, uniquement pour `role = staff`.
`owner` garde toujours un accès complet, non restreignable — logique
métier : la gérante ne peut pas se retirer l'accès à sa propre boutique.

**Décision de sécurité** : la gestion des profils/employés (écran « Équipe »)
reste **toujours réservée à `owner`**. Ce n'est pas un module qu'on peut
cocher dans un `EmployeeRole` — sinon un·e employé·e à qui ce droit serait
accordé pourrait se créer un accès complet (escalade de privilèges).

Migration Prisma requise, + policy RLS sur `EmployeeRole` (lecture/écriture
réservée à `owner` du même `tenantId` — voir §9 CLAUDE.md).

## 2. Application des permissions

- **Navigation** (`lib/nav.ts` + `Sidebar.tsx` + `MobileNav.tsx`) : la liste
  `NAV` est filtrée selon les modules autorisés du profil de session ; seules
  les sections accessibles sont affichées.
- **Protection de page** : nouveau helper `hasModuleAccess(session, moduleId)`
  et `requireModule(moduleId)` dans `lib/auth/index.ts` (même esprit que
  `requireZone`), appelé en haut de chaque `page.tsx` du dashboard concerné.
  Si le module n'est pas autorisé → redirection vers le premier module
  accessible du profil.
- **Session enrichie** : `resolveSession` charge aussi
  `employeeRole.permissions` et `active`. Si `active = false`, la session est
  traitée comme inexistante (déconnexion effective au prochain appel).
- **Server Actions** : pas de re-vérification systématique dans chaque action
  en v1 — `requireModule` en page + RLS Supabase suffisent pour ce périmètre.
  **Dette technique documentée** : une v2 pourrait ajouter une vérification
  de permission dans les Server Actions sensibles (défense en profondeur),
  si le besoin se confirme.
- **RLS Supabase** : policy `Profile` étendue pour exposer `employeeRoleId`/
  `active` en lecture au propriétaire de la ligne + à `owner` du tenant.

## 3. Écran « Équipe »

Nouvelle route `app/(dashboard)/equipe`, nouvel item de nav visible
uniquement pour `owner`. Deux sections sur une même page :

**Profils d'accès** — liste des `EmployeeRole` (nom + modules cochés).
- Créer / Modifier : formulaire nom + checkboxes des modules existants
  (`pos`, `dash`, `orders`, `inv`, `cust`, `mkt`, `fin`, `theme`, `vitrine`,
  `boutique` — cf. `lib/nav.ts`).
- Supprimer : bloqué si des employés sont encore rattachés au profil
  (message : « Réassignez d'abord les X employé·e·s utilisant ce profil »).

**Employés** — liste des `Profile` où `role = staff` (nom, email, profil
d'accès, statut actif/inactif).
- Ajouter : formulaire nom, email, mot de passe temporaire, sélection du
  profil d'accès (dropdown des `EmployeeRole` existants — s'il n'en existe
  aucun, inviter à en créer un d'abord).
- Changer de profil : réassigner un `EmployeeRole` à un employé existant.
- Activer/Désactiver : bascule `active` (pas de suppression du compte Auth
  ni de son historique).

## 4. Création du compte employé (Server Action)

Nouveau Server Action `createEmployee` :

1. Vérifie `session.role === "owner"` (sinon rejet).
2. Valide les champs (nom, email, mot de passe, `employeeRoleId`) via un
   schéma Zod dans `/lib/validators`.
3. Crée l'utilisateur Supabase Auth via
   `supabase.auth.admin.createUser({ email, password, email_confirm: true })`
   — nécessite le client **service_role**, strictement côté serveur, jamais
   exposé au client (CLAUDE.md §9).
4. Crée la ligne `Profile` (`role: "staff"`, `tenantId`, `employeeRoleId`,
   `name`) avec le même `id` que l'utilisateur Auth créé.
5. Rollback : si l'étape 4 échoue après succès de l'étape 3, supprime
   l'utilisateur Auth créé pour éviter un compte orphelin sans profil.

Pas de changement de mot de passe forcé à la première connexion en v1 (hors
scope) — la gérante communique le mot de passe temporaire de vive voix ou
via WhatsApp.

## 5. Tests

- **Vitest** (`lib/auth/index.test.ts` étendu) :
  - `hasModuleAccess` : owner toujours vrai ; staff selon
    `employeeRole.permissions` ; refusé si `active = false`.
  - Validators Zod : création de profil, création d'employé.
  - RBAC de `createEmployee` : rejet si l'appelant n'est pas `owner`.
- **Playwright** : owner crée un profil « Caissier » (POS + Commandes
  uniquement) → crée l'employée Awa avec ce profil → connexion Awa →
  vérifie que seuls POS/Commandes apparaissent dans la nav et que
  `/admin/finance` redirige.

## Hors scope (v1)

- Vérification de permission dans chaque Server Action (défense en
  profondeur) — documenté comme dette technique, §2.
- Invitation par e-mail / changement de mot de passe forcé à la première
  connexion.
- Suppression définitive d'un compte employé (seule la désactivation est
  supportée, pour préserver l'historique).
