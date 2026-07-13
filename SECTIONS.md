# SECTIONS.md — Foulard Teranga · Découpage fonctionnel & « flexible content »

> Compagnon du `CLAUDE.md`. Décrit les sections du back-office, de la vitrine et de l'espace super admin,
> les schémas de champs des blocs modulaires, le workflow de commande et les librairies retenues (budget serré).
> Vocabulaire : « flexible content » = pile de **blocs typés** empilables/réordonnables (esprit WordPress/Weebly, construit maison).
> « Plugins » = librairies/services qui se branchent sur la stack Next.js/Supabase.

---

## 1. Modèle « flexible content »

- Une **page vitrine** = `blocks: Block[]` (liste ordonnée), sérialisée en **JSON** en DB, versionnée `draft` / `published`.
- Chaque `Block` = `{ id, type, order, visible, settings }` où `settings` suit le **schéma du type** (défini ci-dessous).
- Un **registry** mappe `type` → composant React de rendu **+** schéma de réglages (formulaire auto-généré via Zod).
- L'**éditeur** : palette de blocs → glisser-déposer pour ordonner → panneau de réglages (formulaires) → **aperçu live** → publier.
- Règle d'or : la gérante ne saisit **jamais de code** ; chaque réglage est un champ de formulaire (texte, image, sélecteur, toggle, liste).

Types de champs utilisés ci-dessous : `text`, `textarea`, `richtext`, `image`, `imageList`, `url`, `color`, `select`, `toggle`, `number`, `date`, `productRef`, `collectionRef`, `repeater`.

---

## 2. Workflow de commande en ligne

```
[Client] choix produits → panier → "Valider le panier"
        → mini-fiche KYC (nom · lieu de livraison · numéro)
        → "Envoyer ma demande"           (AUCUN paiement en ligne)
[Système] crée commande statut = PENDING · notifie la gérante (in-app + email)
[Gérante] "Contacter le client" (WhatsApp click-to-chat / appel) → échange
        → VALIDER  → statut CONFIRMED → **déduction du stock** → préparation → livrée
        → REFUSER  → statut REJECTED → stock inchangé
```

États commande : `PENDING → CONFIRMED → PREPARING → DELIVERED` · branche `REJECTED` · `CANCELLED`.
Invariants : le **stock ne bouge qu'au passage en CONFIRMED** ; total **recalculé serveur** ; KYC = accès owner/staff uniquement.

---

## 3. Back-office / Gestion (POS au cœur) — owner & staff

1. **Écran de caisse (POS)** — recherche produit rapide (nom, code, **scan code-barres caméra**), grille par catégorie, panier de vente (quantité, remise ligne), rattachement client (points), mode d'encaissement (espèces / Mobile Money / mixte), ticket imprimable/partageable, **déduction stock immédiate + synchro vitrine**, **mode hors-ligne** (file d'attente + resync).
2. **Tableau de bord** — CA du jour, nb ventes, panier moyen, top produits, **alertes stock bas + commandes à valider**, tendances 7/30 j, comparaison physique vs en ligne.
3. **Inventaire & Stock tripartite** — produits + variantes (couleur, motif, longueur), 3 stocks (**interne / sous-traitance / matériel**), niveau temps réel + seuil d'alerte, mouvements (entrée/sortie/ajustement/perte), réappro fournisseurs, import/export CSV.
4. **Commandes en ligne (validation)** — file par statut, fiche commande avec **KYC + panier + total**, bouton **« Contacter le client »** (WhatsApp/appel), actions **Valider** (déduit stock) / **Refuser** / **Modifier**, réglage **auto vs manuel**.
5. **Clients & Fidélité (mini-CRM)** — fiche client (coordonnées, historique, **solde points**, segment fidèle/VIP), règles du programme à points, promotions ciblées, historique des échanges.
6. **Marketing & Analyse** — produits stars vs dormants, taux de rachat, **codes promo** (remise, période, cible), suivi campagnes.
7. **Éditeur de vitrine (flexible content)** — voir §4/§5 : blocs en drag-and-drop, réglages par formulaires, aperçu live, brouillon/publié.
8. **Personnalisation / Thème** — logo, favicon, **couleurs** (primaire/secondaire/accent), typographie, coordonnées + réseaux + horaires, nom de domaine.
9. **Finance analytique (léger)** — journal transactions (physique + en ligne), encaissements par mode, marges, export comptable.
10. **Paramètres & utilisateurs** — comptes staff + permissions, devise **FCFA**, zones/frais de livraison, sauvegardes.

---

## 4. Vitrine e-commerce publique — client

### 4.1 Blocs « flexible content » (éditables par la gérante)

**Hero** — bannière d'accroche.
`title:text · subtitle:textarea · backgroundImage:image · alignment:select(left|center|right) · ctaLabel:text · ctaLink:url · overlayOpacity:number`

**ProductGrid** — grille de produits/collections.
`title:text · source:select(manual|collection|newest|bestsellers|promo) · collection:collectionRef · products:repeater<productRef> · columns:select(2|3|4) · limit:number · showPrice:toggle · showAddToCart:toggle`

**CategoryTiles** — vignettes de catégories.
`title:text · items:repeater{label:text · image:image · link:url} · columns:select(2|3|4)`

**PromoBanner** — bandeau promo/fidélité.
`text:text · image:image · backgroundColor:color · ctaLabel:text · ctaLink:url · startDate:date · endDate:date`

**FeaturedProduct** — mise en avant produit.
`product:productRef · layout:select(imageLeft|imageRight) · showDescription:toggle · ctaLabel:text`

**Story / About** — storytelling artisanat & Teranga.
`heading:text · body:richtext · image:image · layout:select(imageLeft|imageRight|full)`

**Gallery / Lookbook** — inspiration de port du foulard.
`title:text · images:imageList · layout:select(grid|carousel|masonry) · captions:toggle`

**Testimonials** — avis clientes.
`title:text · items:repeater{author:text · text:textarea · rating:number · avatar:image}`

**NewsletterSignup** — capture + incitation fidélité.
`heading:text · text:textarea · buttonLabel:text · pointsIncentive:number`

**ContactLocation** — contact & localisation.
`heading:text · address:text · phone:text · whatsapp:text · hours:textarea · mapLat:number · mapLng:number`

**RichText** — bloc texte/média libre (mise en forme, pas de code).
`content:richtext`

**Spacer / Divider** — respiration visuelle.
`height:number · style:select(blank|line|dots)`

> Chaque bloc partage : `visible:toggle · anchorId:text · paddingTop/paddingBottom:select(sm|md|lg)`.

### 4.2 Pages fonctionnelles fixes (non éditables en blocs)

- **Page produit** — galerie photos, variantes (couleur/motif/longueur), prix FCFA, disponibilité/stock, **ajouter au panier**, produits liés.
- **Panier** — lignes, quantités, sous-total FCFA, **« Valider le panier »**.
- **Checkout / Fiche KYC** — `nom:text · lieuLivraison:text · telephone:text` → **« Envoyer ma demande »** → message « la gérante vous contactera ». Aucun champ paiement.
- **Confirmation / Suivi** — statut de la demande (en attente, confirmée, en préparation, livrée).
- **Espace client** — historique commandes, **solde de points**, coordonnées.
- **Recherche & filtres** — globale (Postgres full-text via Supabase).

---

## 5. Espace Prestataire / Super Admin — vous

En v1 mono-boutique, garder **minimal** ; grossit si passage multi-boutique.

1. **Boutiques** — liste (une aujourd'hui, schéma prêt pour plusieurs), statut, onboarding.
2. **Comptes & rôles globaux** — gérants/staff, permissions, **« se connecter en tant que » (impersonation)** pour le support.
3. **Santé & supervision** — erreurs (Sentry), logs, usage stockage/DB, quotas, sauvegardes/restauration.
4. **Feature flags & modules** — activer/désactiver blocs ou fonctionnalités, modèles de thèmes de départ.
5. **Contenu & conformité** — CGU, mentions légales, devise FCFA par défaut, langues.
6. *(SaaS futur uniquement)* **Facturation / abonnements** — plans, factures. À ignorer en v1.

---

## 6. Plugins / librairies (priorité gratuit / open-source)

**Gratuit & open-source (aucun coût) :**
- **UI & éditeur** : `shadcn/ui` + Tailwind ; **`@dnd-kit`** (drag-and-drop de l'éditeur).
- **Formulaires** : `React Hook Form` + **`Zod`** (validation partagée, idéale fiche KYC).
- **Données/tableaux** : `TanStack Query` (cache) · `TanStack Table` (stock/commandes) · `papaparse` (CSV).
- **Scan POS** : `html5-qrcode` ou `@zxing/library` (code-barres via caméra du téléphone).
- **Offline / PWA** : `Serwist` (panier & catalogue hors-ligne).
- **Graphiques** : `Recharts` (tableau de bord).
- **Texte riche** : `Tiptap` (bloc RichText / éditeur).
- **Recherche** : **Postgres full-text via Supabase** (éviter Algolia payant).
- **Reçus/tickets** : impression navigateur ou `react-pdf`.
- **i18n** : `next-intl` (utile pour ajouter le Wolof plus tard).

**Paliers gratuits — surveiller les limites/prix (ils évoluent) :**
- **Supabase** — Auth + Postgres + Storage + Realtime ; palier gratuit généreux (attention : projet inactif mis en pause).
- **Sentry** — suivi d'erreurs, palier gratuit.
- **Notifications gérante** — **in-app temps réel (Supabase Realtime, gratuit)** + **e-mail** (`Resend`, palier gratuit).
- **Contact client** — **lien click-to-chat WhatsApp (gratuit)**, pas l'API WhatsApp Business (payante).
- **Hébergement** — Vercel + Supabase gratuits pour démarrer (vérifier que l'offre Vercel gratuite couvre l'usage marchand ; sinon plan payant ou auto-hébergement).

**À éviter en v1 (budget) :** passerelles de paiement en ligne (inutiles avec la validation manuelle), API WhatsApp Business, SMS transactionnels (Twilio…), recherche managée type Algolia.

---

## 7. Priorisation suggérée (MVP → V1)

1. **Socle** : auth + rôles + RLS, modèle produits/stock, POS de base.
2. **Commande en ligne** : catalogue public + panier + KYC + workflow validation (cœur métier).
3. **Fidélité** : clients + points + promos.
4. **Éditeur vitrine** : registry de blocs + drag-and-drop + thème (personnalisation).
5. **Analyse & finance** : tableau de bord, journal, exports.
6. **PWA/offline** : panier & catalogue hors-ligne.
