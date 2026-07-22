# DESIGN.md — Foulard Teranga
> Système de design v1.0 · Plateforme omnicanale · Foulards & accessoires africains

---

## 0. Identité de marque

**Foulard Teranga** est une boutique ivoirienne de foulards et accessoires africains pour la femme moderne.

**Direction artistique : "Teranga Moderne"**
Chaleureux, féminin, artisanal, premium mais accessible. Une seule base de tokens, deux densités :
- **Vitrine** : confortable, aérée, éditoriale — l'expérience boutique
- **Admin / POS** : compacte, dense, efficace — l'outil de gestion

**Principes transverses**
- Mobile-first · zones tactiles ≥ 44 px
- Contraste AA (WCAG 2.1) · focus visibles partout
- Léger & rapide · iconographie ligne (Lucide-style)
- Montants en FCFA · interface en français

---

## 1. Palette de couleurs

Chaque couleur porte un rôle précis. Tous les ratios de contraste texte sont vérifiés AA (WCAG 2.1).

### Couleurs de marque

| Nom | Hex | Rôle | Contraste |
|-----|-----|------|-----------|
| **Ivoire** | `#FAF7F2` | Fond global ; surfaces = `#FFFFFF` | — |
| **Ink** | `#1E1B18` | Texte principal, noir chaud | 15:1 AAA |
| **Muted** | `#6B6259` | Texte secondaire, légendes | 5.1:1 AA |
| **Primary · Indigo** | `#26326B` | Actions principales, liens | 9.4:1 AAA |
| **Accent · Terracotta** | `#D07A34` | CTA vitrine, mises en avant | blanc ≥ 16px/600 |
| **Sable** | `#E7DECF` | Séparateurs, fonds doux | — |
| **Or** | `#C9A227` | Détails fins, badges VIP (parcimonie) | détail / non-texte |

### Couleurs sémantiques

| Nom | Hex | Usage |
|-----|-----|-------|
| **Succès** | `#0E9F6E` | Confirmation, livraison, paiement réussi |
| **Alerte** | `#E0A400` | Avertissement, stock faible |
| **Danger** | `#C4453B` | Erreur, annulation, rupture |

### Couleurs de fond sémantiques (pastilles / toasts)

| Statut | Fond | Texte |
|--------|------|-------|
| Succès | `#E6F4EE` | `#0b6e4d` |
| Alerte | `#FBF1D8` | `#8a6500` |
| Danger | `#F8E5E3` | `#9c352d` |
| Info / Indigo | `#EEF0F7` | `#26326B` |
| Neutre | `#E7DECF` | `#6B6259` |
| VIP / Or | `#1E1B18` + bordure `#C9A227` | `#C9A227` |

### Couleurs dérivées (hover, état désactivé)

| Couleur base | Survol / Actif |
|---|---|
| `#26326B` (Primary) | `#1c2652` (hover) · `#C7C1B6` (disabled) |
| `#D07A34` (Accent) | `#bd6b28` (hover) |
| `#C4453B` (Danger) | `#a83a31` (hover) |

### Fond global

```
body background : #E3DCD0
page max-width  : 1560px
```

---

## 2. Typographie

### Familles

| Rôle | Famille | Usage |
|------|---------|-------|
| **Display · Éditorial** | Playfair Display | Titres vitrine, nom de marque, modales importantes |
| **UI · Corps** | Inter | Navigation, boutons, champs, tableaux, tout le back-office |

```html
<!-- Import Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Échelle typographique

| Taille | Poids | Usage | Famille |
|--------|-------|-------|---------|
| `40px` | 600 | Display hero | Playfair Display |
| `32px` | 600 | H1 — titre de page | Playfair Display |
| `24px` | 400 italic | Sous-titre éditorial | Playfair Display |
| `24px` | 600 | H2 — titre de section | Inter |
| `20px` | 600 | H3 — sous-titre / carte | Inter |
| `16px` | 400–500 | Corps de texte | Inter |
| `15px` | 400 | Corps secondaire | Inter |
| `14px` | 400–600 | Texte dense, métadonnées | Inter |
| `13px` | 500–600 | Labels admin, tableaux | Inter |
| `12px` | 500–600 | Légendes, badges, labels uppercase | Inter |
| `11px` | 600 | Micro-labels, timestamps | Inter |

### Règles typographiques

- `letter-spacing: -0.01em` sur les titres Playfair Display
- `line-height: 1.08` sur display 40px, `1.5–1.6` sur le corps
- Texte uppercase toujours en `font-size: 11–13px` + `letter-spacing: 0.06–0.10em`
- Jamais de texte sous le contraste AA

---

## 3. Espacement · Rayons · Ombres

### Grille de base : 4 px

Valeurs utilisées : `4 / 8 / 12 / 16 / 24 / 32 / 48 px`

Padding sections desktop : `56–72px` vertical, `72px` horizontal.

### Rayons (border-radius)

| Élément | Valeur |
|---------|--------|
| Cartes | `14px` |
| Boutons | `10px` |
| Champs de formulaire | `10px` |
| Chips / pastilles / pills | `999px` |
| Variantes de taille (selector) | `8px` |
| Sidebar logo | `8–12px` |
| Avatars, swatches couleur | `999px` |

### Ombres chaudes

| Nom | Valeur CSS | Usage |
|-----|-----------|-------|
| **Bordure (admin)** | `1px solid rgba(30,27,24,.08)` | Cartes back-office, préféré aux ombres en mode admin |
| **sm — cartes vitrine** | `box-shadow: 0 1px 3px rgba(60,40,20,.10)` | Cartes produit, cartes KPI |
| **lg — overlays** | `box-shadow: 0 8px 24px rgba(60,40,20,.12)` | Modales, drawers, panneaux flottants |
| **Extra — écrans mockup** | `box-shadow: 0 12px 40px rgba(60,40,20,.14)` | Illustrations de devices |

> **Règle admin** : privilégier la bordure `1px` plutôt que les ombres pour l'interface de gestion. Les ombres sont réservées à la vitrine et aux overlays.

---

## 4. Iconographie

**Style** : ligne (façon Lucide), trait `stroke-width: 1.75`, extrémités arrondies (`stroke-linecap: round`, `stroke-linejoin: round`), grille 24×24.

Léger et lisible sur Android d'entrée de gamme.

### Icônes du système (taille 18–24px)

| Icône | Usage |
|-------|-------|
| Loupe (circle + path) | Recherche |
| Sac shopping | Panier / commandes |
| Map pin | Livraison |
| Bâtiment | Boutique |
| Profil | Compte client |
| Étoile | Favori / points fidélité |
| Hamburger | Menu mobile |
| Grid 2×2 | Tableau de bord |
| Line chart | Stats / finances |
| Carte bancaire | Paiement |
| Boîte 3D | Stock / produits |
| Engrenage | Réglages |
| Personnes | Clientes |
| WiFi barré | Hors-ligne |
| Croix (X) | Fermer |
| Chevron bas | Select / accordéon |
| Flèche NE | Tendance haussière |

---

## 5. Boutons

**Règle** : hauteur ≥ 44px (zone tactile), rayon `10px`, `font: 600 15px Inter`.

### Variantes

#### Primaire · Indigo
```css
background: #26326B;
color: #fff;
border: none;
height: 44px;
padding: 0 20px;
border-radius: 10px;
font: 600 15px Inter;
```
- **Survol** : `background: #1c2652` + `box-shadow: 0 2px 8px rgba(38,50,107,.30)`
- **Focus** : `outline: 3px solid rgba(38,50,107,.35); outline-offset: 2px`
- **Désactivé** : `background: #C7C1B6; cursor: not-allowed`
- **Chargement** : spinner `border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; animation: ft-spin .7s linear infinite`

#### Secondaire · Contour
```css
background: #fff;
color: #26326B;
border: 1.5px solid #26326B;
height: 44px;
border-radius: 10px;
font: 600 15px Inter;
```
- **Survol** : `background: #EEF0F7`
- **Désactivé** : `border-color: #DAD3C7; color: #B6AEA1`

#### Ghost
```css
background: transparent;
color: #26326B;
border: none;
```
- **Survol** : `background: rgba(38,50,107,.08)`

#### CTA vitrine · Accent Terracotta
```css
background: #D07A34;
color: #fff;
border: none;
font: 700 15px Inter;
```
- **Survol** : `background: #bd6b28` + `box-shadow: 0 2px 8px rgba(208,122,52,.35)`

#### Danger
```css
background: #C4453B;
color: #fff;
border: none;
```
- **Contour danger** : `border: 1.5px solid #C4453B; background: #fff; color: #C4453B`
- **Survol** : `background: #a83a31`

#### POS · Encaisser (succès)
```css
background: #0E9F6E;
color: #fff;
font: 700 16px Inter;
height: 52px;
border-radius: 10px;
```

---

## 6. Champs de formulaire

**Règle** : hauteur `44px`, rayon `10px`, label au-dessus (`font: 600 13px Inter`), aide et erreur explicites. Focus indigo visible partout.

### États

| État | Border | Background |
|------|--------|------------|
| Default | `1.5px solid #DAD3C7` | `#fff` |
| Focus | `1.5px solid #26326B` + `outline: 3px solid rgba(38,50,107,.25)` | `#fff` |
| Erreur | `1.5px solid #C4453B` | `#FCF3F2` |
| Désactivé | `1.5px solid #EAE4D9; cursor: not-allowed` | `#F4F0E9` |

### Composants de formulaire

**Input texte**
```css
width: 100%;
height: 44px;
padding: 0 14px;
border: 1.5px solid #DAD3C7;
border-radius: 10px;
font: 400 15px Inter;
color: #1E1B18;
```

**Input téléphone** : préfixe `+221` en `color: #6B6259` à gauche + input borderless flex

**Select** : `appearance: none` + icône chevron SVG superposée (`right: 14px`)

**Stepper quantité**
```css
height: 44px;
border: 1.5px solid #DAD3C7;
border-radius: 10px;
/* boutons : width 44px, background #FAF7F2, color #26326B */
/* valeur  : width 52px, text-align center, font: 600 15px Inter */
```

**Recherche** : icône loupe `color: #6B6259` + input borderless, hauteur `44px`

**Toggle switch**
```css
/* Piste : width 44px, height 26px, border-radius 999px */
/* ON  : background #0E9F6E, pouce left: 21px */
/* OFF : background #DAD3C7, pouce left: 3px */
/* Pouce : width 20px, height 20px, background #fff, border-radius 999px */
```

**Aide / hint** : `font: 400 12.5px Inter; color: #6B6259; margin-top: 7px`

**Message d'erreur** : `font: 500 12.5px Inter; color: #9c352d` + icône danger inline

---

## 7. Badges & étiquettes de statut

Rayon `999px`, `font: 600 12px Inter`, padding `5px 11px`.

### Badges de statut générique

| Nom | Background | Couleur texte | Point |
|-----|-----------|---------------|-------|
| Succès | `#E6F4EE` | `#0b6e4d` | `#0E9F6E` |
| Alerte | `#FBF1D8` | `#8a6500` | `#E0A400` |
| Danger | `#F8E5E3` | `#9c352d` | `#C4453B` |
| Info | `#EEF0F7` | `#26326B` | `#26326B` |
| VIP | `#1E1B18` + border `#C9A227` | `#C9A227` | ★ |
| Neutre | `#E7DECF` | `#6B6259` | — |

### Étiquettes produit (rectangulaires, rayon `6px`)

| Nom | Background | Couleur |
|-----|-----------|---------|
| -X% (promo) | `#D07A34` | `#fff` |
| Nouveau | `#26326B` | `#fff` |
| Épuisé | `#1E1B18` | `#fff` |

### Chips de statut de commande

| Statut | Background | Couleur |
|--------|-----------|---------|
| En attente | `#FBF1D8` | `#8a6500` |
| Confirmée | `#EEF0F7` | `#26326B` |
| En préparation | `#F4EDE1` | `#8a6a3a` (point `#D07A34`) |
| Livrée | `#E6F4EE` | `#0b6e4d` |
| Refusée | `#F8E5E3` | `#9c352d` |

### Pastilles de stock (tripartites)

| Type | Background | Couleur |
|------|-----------|---------|
| Interne (en stock) | `#E6F4EE` | `#0b6e4d` |
| Sous-traitance (5–7j) | `#EEF0F7` | `#26326B` |
| Matériel (à commander) | `#FBF1D8` | `#8a6500` |
| Rupture | `#F8E5E3` | `#9c352d` |

---

## 8. Cartes

### Carte produit (vitrine)

```
border-radius: 14px
overflow: hidden
box-shadow: 0 1px 3px rgba(60,40,20,.10)
border: 1px solid rgba(30,27,24,.08)
```

- **Image** : aspect-ratio `4:5`, position relative pour badges absolus
- **Badge** : position `absolute; top: 10px; left: 10px`
- **Favori** : bouton `34px` rond, `background: rgba(255,255,255,.9)`, position `top: 8px; right: 8px`
- **Nom** : `font-family: Playfair Display; font-weight: 600; font-size: 18px`
- **Sous-titre** : `font-size: 13px; color: #6B6259`
- **Prix** : `font-size: 17px; font-weight: 700; color: #26326B`
- **Prix barré** : `font-size: 13px; color: #9a8f7d; text-decoration: line-through`
- **Épuisé** : overlay `rgba(250,247,242,.55)` + pill "Épuisé" `#1E1B18`

### Carte produit avec variantes

- **Swatches couleur** : cercles `30px`, `border-radius: 999px` ; sélectionné = `outline: 2px solid #26326B; outline-offset: 2px`
- **Chips de taille** : `height: 38px; padding: 0 16px; border-radius: 8px`
  - Sélectionné : `background: #26326B; color: #fff; border: 1.5px solid #26326B`
  - Disponible : `border: 1.5px solid #DAD3C7`
  - Indisponible : `border: 1.5px solid #EAE4D9; color: #B6AEA1; text-decoration: line-through`

### Carte KPI (admin)

```
padding: 20px 22px
border-radius: 14px
border: 1px solid rgba(30,27,24,.08)
```

- **Label** : `font-size: 13px; font-weight: 600; color: #6B6259`
- **Icône** : `32px × 32px; border-radius: 8px; background: #EEF0F7`
- **Valeur principale** : `font-size: 30px; font-weight: 700; letter-spacing: -0.01em`
- **Delta** : pill success/danger `font: 600 12.5px Inter`

### Carte de commande (admin)

```
padding: 18px 20px
border-radius: 14px
border: 1px solid rgba(30,27,24,.08)
```

Contient : référence #TER-XXXX, nom + ville, badge statut, séparateur, nb articles + horodatage + montant.

### Ligne de panier

```
display: flex; gap: 14px; align-items: center
```

- **Thumbnail** : `72px × 88px; border-radius: 10px`
- **Titre** : Playfair Display 600 16px
- **Sous-titre** : `12.5px; color: #6B6259`
- **Stepper** : `height: 36px; border-radius: 8px`
- **Prix** : `font: 700 16px Inter; color: #26326B`
- **Retirer** : `color: #C4453B; font: 500 12px Inter`

---

## 9. Tableaux

### Tableau data-dense (admin)

```css
/* Table */
width: 100%;
border-collapse: collapse;
font-size: 13.5px;

/* Header */
background: #FAF7F2;
color: #6B6259;
font-weight: 600;
font-size: 12px;
text-transform: uppercase;
letter-spacing: 0.04em;
padding: 10px 18px;

/* Ligne */
border-top: 1px solid #EFEAE0;
padding: 11px 18px;

/* Ligne alternée */
background: #FDFCFA;

/* Colonne active (tri) */
color: #26326B ▲
```

**Pagination** : boutons `34px; border-radius: 8px`, page active `background: #26326B; color: #fff; border: 1px solid #26326B`

---

## 10. Navigation

### Sidebar admin (desktop — fond sombre)

```css
background: #1E1B18;
border-radius: 14px;
padding: 18px 14px;
color: #fff;
```

- **Logo** : carré `30px; border-radius: 8px; background: #D07A34` + nom Playfair 17px
- **Item actif** : `background: #26326B; border-radius: 10px; font: 600 14px Inter; color: #fff`
- **Item inactif** : `color: #C9BEB0; font: 500 14px Inter`
- **Badge compteur** : `background: #D07A34; color: #fff; font: 700 11px Inter; border-radius: 999px`
- **Items** : Tableau de bord / Commandes / Produits & stock / Clientes / Point de vente

### Top bar vitrine (desktop)

```css
background: #fff;
border-bottom: 1px solid #EFEAE0;
padding: 16px 20px;
```

- **Logo** : `font-family: Playfair Display; font-weight: 600; font-size: 22px`
- **Liens nav** : `font: 500 14.5px Inter; color: #26326B` (actif) / `#1E1B18` (inactif)
- **Hover lien** : `color: #D07A34`
- **Icônes** : Recherche, Compte, Panier · taille 21px · `stroke: #1E1B18`
- **Badge panier** : `background: #D07A34; color: #fff; font: 700 10px Inter; min-width: 16px; height: 16px; border-radius: 999px`

### Bottom tab mobile

```css
background: #fff;
border: 1px solid #EAE4D9;
border-radius: 16px;
padding: 6px;
box-shadow: 0 4px 16px rgba(60,40,20,.08);
```

- Onglets : Accueil / Chercher / Panier / Compte · icône 22px + label `font: 500 10.5px Inter`
- **Actif** : `color: #26326B; font-weight: 600`
- **Inactif** : `color: #8a8177`
- Zone tactile min : `56px × 52px`

### Fil d'ariane

```
font-size: 14px; color: #6B6259
séparateur : "/" color: #C7BFB2
page active : color: #1E1B18; font-weight: 600
liens : color: #26326B
```

---

## 11. Overlays

### Modal de confirmation

```css
/* Fond */
background: rgba(30,27,24,.35);

/* Panneau */
width: 340px;
background: #fff;
border-radius: 14px;
box-shadow: 0 8px 24px rgba(60,40,20,.18);
padding: 24px 26px;
```

- **Icône** : cercle `44px; border-radius: 999px; background: #F8E5E3`
- **Titre** : Playfair Display 600 21px
- **Corps** : 14px Inter, `color: #6B6259; line-height: 1.5`
- **Actions** : bouton Retour (contour) + bouton Confirmer (danger ou primary), `justify-content: flex-end`

### Drawer latéral (réglages)

```css
/* Fond */
background: rgba(30,27,24,.25);

/* Panneau */
position: absolute;
right: 0; top: 0; bottom: 0;
width: 260px;
background: #fff;
box-shadow: -8px 0 24px rgba(60,40,20,.15);
padding: 22px;
```

### Toasts / Notifications

```css
background: #fff;
border: 1px solid #EAE4D9;
border-left: 4px solid [couleur sémantique];
border-radius: 12px;
padding: 14px 16px;
box-shadow: 0 4px 16px rgba(60,40,20,.08);
```

- **Succès** : border-left `#0E9F6E`
- **Erreur** : border-left `#C4453B`
- Titre `font: 600 14px Inter` + sous-titre `12.5px; color: #6B6259` + bouton fermer

### Tooltip

```css
background: #1E1B18;
color: #fff;
font: 500 12px Inter;
padding: 7px 11px;
border-radius: 8px;
box-shadow: 0 4px 12px rgba(0,0,0,.20);
/* Queue : border-top-color: #1E1B18 */
```

---

## 12. États transverses

À prévoir systématiquement sur toutes les vues : chargement, page vide, erreur, hors-ligne, succès.

### Squelette (skeleton loader)

```css
background: #EDE7DC;
border-radius: [correspondant à l'élément];
animation: ft-pulse 1.4s ease-in-out infinite;

@keyframes ft-pulse {
  0%, 100% { opacity: 1 }
  50% { opacity: .45 }
}
```

### Page vide

- Icône dans cercle `56px; background: #F4F0E9; color: #B6AEA1`
- Titre `font: 600 15px Inter`
- Corps `font-size: 13px; color: #6B6259; line-height: 1.45`
- Bouton Primary invitant à l'action

### Erreur

- Icône dans cercle `56px; background: #F8E5E3; color: #C4453B`
- Bouton Secondaire (contour) "Réessayer"

### Bannière hors-ligne

```css
background: #1E1B18;
color: #fff;
border-radius: 10px;
padding: 12px 14px;
```

- Icône WiFi barré `color: #C9A227`
- Texte `font: 600 13.5px Inter` + sous-texte `12px; color: #C9BEB0`
- Message : *"Ventes enregistrées, synchro au retour du réseau."*

### Succès

- Icône check dans cercle `52px; background: #E6F4EE; color: #0E9F6E`
- Titre `font: 600 15px Inter`

---

## 13. Composants métier spécifiques

### Fidélité · Points Teranga

**Badge de gain**
```css
display: inline-flex;
background: #1E1B18;
color: #C9A227;
border: 1px solid #C9A227;
border-radius: 999px;
padding: 6px 12px;
font: 600 12.5px Inter;
/* icône étoile fill: #C9A227 */
```

**Carte client fidélité**
```css
background: #FAF7F2;
border: 1px solid #EAE4D9;
border-radius: 12px;
padding: 12px 14px;
/* Avatar : 38px, background #1E1B18, étoile or */
/* Points : font: 700 18px Inter */
/* Palier  : 11.5px; color: #6B6259 */
```

Affichage en table/ticket POS : `color: #0b6e4d; font-weight: 600` pour les points gagnés.

### Référence de commande

Format : `#TER-XXXX` · `font-weight: 600`

Canaux : `Boutique` / `Web` / `WhatsApp` · `color: #6B6259`

---

## 14. Deux densités d'interface

### Vitrine (confortable)

| Propriété | Valeur |
|-----------|--------|
| Padding section | 56–72px |
| Carte produit padding | 14–16px |
| Police corps | 16px |
| Taille image produit | Aspect 4:5 |
| Espacement grille produits | 20px+ |

### Admin / POS (compact)

| Propriété | Valeur |
|-----------|--------|
| Padding section | 14–20px |
| Carte info padding | 18–22px |
| Police corps dense | 13–14px |
| Hauteur ligne tableau | 11px 18px padding |
| Espacement grille POS | 8–12px |

---

## 15. Écrans clés — spécifications

Chaque écran est décliné en **mobile 390px** et **desktop 1440px**, à partir des mêmes tokens.

### 15.1 Vitrine · Accueil (Storefront)

**Mobile 390**
- Top bar : hamburger + logo Playfair 20px + icône panier avec badge
- Hero : aspect-ratio `3:4`, `border-radius: 16px`, gradient overlay `rgba(30,27,24,.55)` from bottom
  - Titre : Playfair 28px blanc, CTA Terracotta `44px`
- Chips catégories : scroll horizontal, `height: 36px; border-radius: 999px`
  - Actif : `background: #26326B; color: #fff`
  - Inactif : `background: #fff; border: 1px solid #EAE4D9`
- Grille produits : 2 colonnes, `gap: 12px`, padding `14px`

**Desktop 1440**
- Top bar full : logo + nav horizontale + icônes
- Hero : aspect large + grille produits 4–5 colonnes
- Bottom nav remplacée par la top bar

### 15.2 Admin · Tableau de bord

**Mobile**
- Header : `background: #26326B; color: #fff`, titre Playfair, avatar + rôle
- Onglets défilants : Aperçu / Commandes / Stock · `border-radius: 999px`
  - Actif : `background: rgba(255,255,255,.2)`
- KPI cards 2 colonnes : valeur large + delta pill + icône
- Commandes récentes : liste de cartes

**Desktop**
- Sidebar `#1E1B18` fixe à gauche
- Zone principale : header + KPI row + tableau commandes

### 15.3 POS · Point de vente

**Mobile 390**
- Header : `background: #26326B; color: #fff`, titre + icône réglages
- Search bar : `height: 42px; border: 1.5px solid #DAD3C7; border-radius: 10px`
- Grille produits : 3 colonnes, aspect-ratio `1:1`
  - Nom : `font: 600 10.5px Inter`
  - Prix : `font: 700 11px Inter; color: #26326B`
- Ticket bas : `background: #fff; border: 1px solid #EAE4D9; border-radius: 14px; padding: 14px`
  - Lignes article + total `font-size: 18px; font-weight: 700; color: #26326B`
  - Bouton Encaisser `background: #0E9F6E; height: 52px`

**Desktop 1440**
- Layout 2 colonnes : catalogue (flex: 1) + ticket fixe (width: 320px)
- Catalogue :
  - Header : titre + barre de recherche `300px`
  - Filtres chips : Tous / Foulards / Turbans / Accessoires
  - Grille : 4 colonnes, `gap: 12px`
- Ticket (colonne droite, `border-left: 1px solid #EFEAE0`) :
  - Header : "Ticket" + chip client (avatar + nom)
  - Lignes produit : thumbnail `40px × 40px` + stepper compact `28px`
  - Footer : sous-total + points + total + boutons Espèces / Encaisser

---

## 16. Animations

```css
@keyframes ft-spin {
  to { transform: rotate(360deg) }
}

@keyframes ft-pulse {
  0%, 100% { opacity: 1 }
  50% { opacity: .45 }
}
```

- `ft-spin` : spinner bouton chargement (`.7s linear infinite`)
- `ft-pulse` : skeleton loader (`1.4s ease-in-out infinite`)

---

## 17. Variables CSS recommandées (Tailwind custom tokens)

```css
:root {
  /* Palette */
  --color-ivory:      #FAF7F2;
  --color-sand:       #E7DECF;
  --color-border:     rgba(30,27,24,.08);
  --color-ink:        #1E1B18;
  --color-muted:      #6B6259;
  --color-primary:    #26326B;
  --color-accent:     #D07A34;
  --color-gold:       #C9A227;
  --color-success:    #0E9F6E;
  --color-warning:    #E0A400;
  --color-danger:     #C4453B;

  /* Shadows */
  --shadow-sm:  0 1px 3px rgba(60,40,20,.10);
  --shadow-lg:  0 8px 24px rgba(60,40,20,.12);

  /* Radius */
  --radius-card:   14px;
  --radius-btn:    10px;
  --radius-field:  10px;
  --radius-pill:   999px;
  --radius-badge:  6px;
}
```

---

## 18. Accessibilité

| Règle | Valeur |
|-------|--------|
| Zone tactile minimale | ≥ 44px × 44px |
| Contraste texte primaire | 15:1 (AAA) |
| Contraste texte muted | 5.1:1 (AA) |
| Focus visible | `outline: 3px solid rgba(38,50,107,.35); outline-offset: 2px` |
| Lien focus | `outline: 3px solid rgba(38,50,107,.35); border-radius: 3px` |
| Couleur Or | Détail / non-texte uniquement, jamais seule pour de l'information |
| Texte sur Terracotta | ≥ 16px / weight 600 minimum |
| `-webkit-font-smoothing` | `antialiased` |

---

## 19. Tailwind config — extrait recommandé

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        ivory:   '#FAF7F2',
        sand:    '#E7DECF',
        ink:     '#1E1B18',
        muted:   '#6B6259',
        primary: { DEFAULT: '#26326B', hover: '#1c2652' },
        accent:  { DEFAULT: '#D07A34', hover: '#bd6b28' },
        gold:    '#C9A227',
        success: '#0E9F6E',
        warning: '#E0A400',
        danger:  { DEFAULT: '#C4453B', hover: '#a83a31' },
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card:  '14px',
        btn:   '10px',
        field: '10px',
      },
      boxShadow: {
        sm:  '0 1px 3px rgba(60,40,20,.10)',
        lg:  '0 8px 24px rgba(60,40,20,.12)',
        xl:  '0 12px 40px rgba(60,40,20,.14)',
      },
    },
  },
}
```

---

*DESIGN.md — généré depuis le Design System Foulard Teranga v1.0*
*Source : `Foulard_Teranga_-_Design_System_dc.html`*
