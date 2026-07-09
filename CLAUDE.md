# CLAUDE.md — Foulard Teranga · Plateforme Commerce Omnicanal

> Context d'ingénierie pour agents Claude Code. Lire en entier avant toute tâche.
> Langue produit : FR. Code, commits, identifiants : EN.

## 1. Contexte & vision

Application de commerce omnicanal pour **une boutique** : **Foulard Teranga** (Sénégal).
Positionnement : *« Foulards africains et accessoires élégants pour la femme moderne »* — élégant, féminin, artisanal.
Cliente cible : la **propriétaire/gérante**, qui veut suivre les **workflows de commande**, digitaliser toutes les transactions de la boutique physique, suivre inventaires & stock, gérer ses clients et lancer des **promotions pour les clients fidèles**.

Deux faces synchronisées en temps réel :
- **Back-office de pilotage** (propriétaire/staff) : POS, stocks, commandes, finance, marketing.
- **Vitrine e-commerce publique** (clients) : catalogue, panier, demande de commande, fidélité.

**Différenciateur** : modularité & personnalisation **façon WordPress / Weebly**. La propriétaire administre sa vitrine et son identité (logo, couleurs, thème) **elle-même, sans coder**, via des **briques/modules**. On construit ce système en interne : **aucun thème ni page builder tiers**.
Réf. de style : **Weebly** ; maquette générée : https://labs.google.com/pomelli/website/8Zl8JFCv5trbl28cC5b_yW

Rôles (RBAC) : `super_admin` (prestataire/plateforme) → `owner` (propriétaire) → `staff` (employé) → `customer`.
**v1 mono-boutique**, mais l'architecture reste conçue pour un futur **multi-boutique (SaaS)** sans réécriture (config & thème abstraits par boutique).

## 2. Objectifs business

- **Unification omnicanale native** : fusionner et synchroniser en temps réel les ventes physiques au comptoir (POS) et la vitrine e-commerce en ligne.
- **Pilotage opérationnel intelligent** : centraliser stocks **tripartites** (interne / sous-traitance / matériel), suivi logistique des commandes et finance analytique.
- **Modularité « style WordPress »** : interface évolutive où la gérante administre sa vitrine via des **briques/modules sans code**, pour un outil simple et épuré.
- **Accélération & conversion mobile** : achat express résilient — **panier hors-connexion (PWA)**, checkout ≤ 3 clics, adapté aux habitudes locales (**Mobile Money & espèces au comptoir**).

## 3. Périmètre fonctionnel

**Back-office** : POS (saisie rapide + sync immédiate) · inventaire temps réel + alertes stock bas · agenda/suivi commandes journalier · gestion clients + programme points/réductions · analyse des tendances de vente · **config du workflow de validation** · **éditeur de vitrine + thème**.
**Vitrine client** : catalogue interactif + panier · **demande de commande** (voir §5) · historique commandes + solde de points · catalogue consultable hors-ligne.

## 4. Workflow commande en ligne (central)

`choix produits → panier → validation panier → mini-fiche KYC (nom, lieu de livraison, numéro) → envoi de la demande → la gérante contacte le client → validation OU refus → le stock n'est déduit QUE si validé`.

- **Pas de paiement en ligne en v1** : la commande en ligne est une **demande à confirmer**, pas une transaction payée (économie de frais de passerelle).
- Paiement réel : **au comptoir** (espèces / Mobile Money) ou à convenir avec le client. Abstraction paiement dans `/lib/payments` pour plus tard.
- **Le stock n'est jamais déduit tant que la commande en ligne n'est pas validée** par la gérante. Panier & total **recalculés côté serveur**.
- Notifications économiques : **in-app temps réel (Supabase Realtime)** + e-mail ; contact client via **lien click-to-chat WhatsApp** (gratuit). Pas d'API WhatsApp Business ni SMS en v1.

## 5. Stack technique

- **Framework** : Next.js **16.2 LTS** (App Router, Server Components, Server Actions, Turbopack, `proxy.ts`). React **19.2**. Node **≥ 22 LTS**.
- **Langage** : TypeScript strict.
- **Backend/DB** : **Supabase** (Postgres, Auth, Storage, Realtime, Edge Functions).
- **ORM/migrations** : **Prisma** (schéma + migrations + requêtes typées serveur via pooler). RLS Supabase en **défense en profondeur**.
- **UI** : Tailwind CSS + **shadcn/ui** (copiés dans le repo, aucune dépendance thème). Icônes `lucide-react`.
- **État** : Server Components d'abord ; TanStack Query (cache client) ; Zustand seulement si nécessaire (état de l'éditeur).
- **Validation** : Zod (schémas partagés client/serveur, entrées Server Actions & fiche KYC).
- **Édition visuelle** : drag-and-drop maison (`@dnd-kit`) — pas de page builder tiers.
- **PWA/offline** : Service Worker (`Serwist`) + IndexedDB (panier & catalogue), stale-while-revalidate, re-sync à la reconnexion.
- **Déploiement** : Vercel. CI : GitHub Actions (lint + typecheck + tests + migrations).
- **Budget** : priorité open-source / paliers gratuits. Voir `SECTIONS.md` §Plugins.

## 6. Personnalisation & vitrine modulaire (cœur du produit)

- **Thème boutique** : logo, favicon, palette, typographie éditables par la gérante, stockés en DB, appliqués via **variables CSS** (`--color-*`, `--font-*`). Assets via Supabase Storage. Aperçu live.
- **Vitrine = modules (flexible content)** : une page = **liste ordonnée de blocs** typés (Hero, ProductGrid, Categories, PromoBanner, Story, Gallery, Testimonials, Newsletter, Contact, RichText…). Config sérialisée en **JSON** ; un **registry** mappe `type` → composant React ; rendu public et éditeur lisent le même schéma. Schémas de champs détaillés dans `SECTIONS.md`.
- **Éditeur « sans code »** : ajouter / supprimer / **réordonner par glisser-déposer** les modules, régler chaque module via **formulaires**, **aperçu live**, brouillon vs publié. Zéro HTML/code libre exécuté.
- **Isolation données** : RLS par **rôle** & **propriété** — un `customer` ne voit que ses commandes/points. Schéma prêt pour un futur `tenant_id`.

## 7. Structure des dossiers

```
/app
  /(dashboard)          # back-office (auth: owner/staff)
  /(storefront)         # vitrine publique
  /(editor)             # éditeur de vitrine (owner)
  /(admin)              # super admin (prestataire)
  /api                  # route handlers (webhooks, notifications)
/components
  /ui                   # shadcn/ui (primitives)
  /blocks               # modules vitrine (registry)
  /editor               # UI éditeur (dnd, panneaux de réglages)
  /dashboard            # widgets pilotage & POS
/lib
  /supabase             # clients server/browser, helpers auth
  /db                   # prisma client, requêtes
  /auth                 # session, RBAC, guards
  /theme                # tokens & personnalisation boutique
  /payments             # abstraction paiement (Mobile Money futur)
  /validators           # schémas Zod partagés
/prisma                 # schema.prisma, migrations
/public /workers        # service worker PWA
/tests                  # unit (Vitest) + e2e (Playwright)
```

Nommage : dossiers `kebab-case`, composants `PascalCase`, hooks `useX`, utilitaires `camelCase`. Un composant par fichier.

## 8. Conventions de code

- TypeScript `strict` ; **jamais** de `any` (préférer `unknown` + narrowing). Types partagés inférés depuis Zod.
- **Server Components par défaut** ; `"use client"` seulement si interactivité. Mutations via **Server Actions** validées par Zod.
- Accès données **côté serveur uniquement** ; jamais de clé service ni requête privilégiée côté client.
- Erreurs : résultats typés (`{ ok, data | error }`), pas d'exception silencieuse. Logs structurés.
- Accessibilité : sémantique HTML, labels, focus visibles, contrastes AA.
- Lint/format : ESLint + Prettier. Conventional Commits. Une PR = une préoccupation.
- Tests : Vitest (logique, validators, RBAC, registry) + Playwright (POS, panier, workflow KYC/validation, offline, responsive, éditeur).

## 9. Sécurité (non négociable)

- **RLS activée et testée** sur chaque table métier ; policy explicite par rôle & propriété.
- Auth via Supabase Auth ; sessions vérifiées côté serveur à chaque requête sensible ; RBAC centralisé dans `/lib/auth`.
- Secrets en variables d'env (jamais commit) ; clé `service_role` **serveur uniquement**.
- Commande en ligne : **stock déduit uniquement à la validation** de la gérante ; **montant/panier recalculés côté serveur** (jamais de confiance au client).
- Fiche KYC = données personnelles → validation Zod, minimisation, jamais en query string, accès restreint (owner/staff).
- Suivre les advisories Next.js/React 2026 (DoS, bypass proxy, SSRF) → rester sur la dernière LTS patchée.

## 10. Performance & mobile

- **Mobile-first**, responsive tous écrans (breakpoints Tailwind). Cibles : LCP < 2,5 s, INP < 200 ms sur mobile 4G.
- Images via `next/image` (formats modernes, tailles adaptatives). Code-splitting, prefetch App Router, streaming/Suspense.
- Cache explicite (Cache Components / `use cache`) pour le catalogue ; Realtime Supabase pour stock & commandes.
- PWA : catalogue + panier hors-ligne ; re-sync à la reconnexion (résolution de conflits serveur).
- Checkout ≤ 3 interactions ; fiche KYC minimaliste.

## 11. Outillage agent — MCP & Skills

**MCP** (set réduit, permissions minimales) : **Context7** (docs à jour, à consulter avant tout code framework) · **Supabase MCP** (`?project_ref=<ref>`, dev uniquement) · **GitHub MCP** (token fine-grained) · **Playwright MCP** (UI réelle, E2E, offline/responsive) · **Vercel MCP** (déploiements/logs) · *(option)* **Sentry MCP**.

**Skills** (dossiers `.md` versionnés) : `supabase-rls` (policies + checklist) · `nextjs-app-router` (Server Components/Actions/caching) · `storefront-blocks` (ajouter un module + schéma JSON) · `site-personalization` (thème & tokens CSS) · `order-workflow` (KYC → validation → stock).

## 12. Garde-fous pour l'agent

- **Toujours** vérifier la doc via Context7 avant d'utiliser une API framework ; ne pas coder de mémoire.
- **Ne jamais** introduire un page builder ou thème tiers ; la modularité passe par le registry de blocs interne.
- **Ne jamais** exposer `service_role` ni contourner la RLS côté client.
- **Ne jamais** déduire le stock d'une commande en ligne avant validation explicite de la gérante.
- L'éditeur de vitrine reste utilisable **sans aucune connaissance en code** (formulaires/UI, jamais de saisie de code).
- Toute nouvelle table → migration Prisma **+** policy RLS **+** test.
- Demander confirmation avant : migration destructive, changement de policy RLS, modif de config paiement.
