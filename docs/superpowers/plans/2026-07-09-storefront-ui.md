# Storefront UI Implementation Plan (Plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the actual Vitrine storefront — chrome (header/menu/bottom-tab), the 9 flexible-content blocks on the Home page (with the block-editor preview toggle), and the 6 functional pages (Catalogue, Produit, Panier, Commander/KYC, Confirmation, Compte) — on top of the foundations locked in Plan 1 (`docs/superpowers/plans/2026-07-09-storefront-foundations.md`).

**Architecture:** Server Components by default; a component only gets `"use client"` when it reads a Zustand store, holds local interactive state, or attaches an event handler (CLAUDE.md §8). Responsive layout (860px breakpoint, matching the back-office) is handled entirely through CSS classes added to `app/globals.css` — never through a JS `isMobile` boolean — so server-rendered markup never mismatches the client on hydration. Blocks are registered in `components/storefront/blocks/registry.ts` (`BlockId → Component`); the Home page renders whatever is registered, in the order/visibility kept in `useStorefront`, so each task that adds a block immediately makes it live without touching the Home page again.

**Tech Stack:** Next.js 16.2 (App Router, Server + Client Components), React 19.2, TypeScript strict. Consumes `lib/data/catalog.ts`, `lib/validators/kyc.ts`, `lib/store/useShop.ts`, `lib/store/useStorefront.ts`, `lib/tenant`, and `proxy.ts` from Plan 1 — all already implemented and tested there.

## Global Constraints

- Stock is deducted **only** when an order transitions to `confirmee` via `useShop.confirmOrder` — this plan's checkout must never deduct stock itself. (CLAUDE.md §4, §9)
- Order totals are **always recomputed** by `useShop.submitWebOrder` — the checkout view sends line items, never a client-computed total. (CLAUDE.md §9)
- The shop is based in **Abidjan, Côte d'Ivoire (+225)**, but the KYC phone field accepts free international input — no hardcoded country prefix in any input UI (a real bug in the source design mockup, already corrected in Plan 1's validator; don't reintroduce it here).
- TypeScript `strict`; **never** use `any`.
- Product-facing copy in French; code identifiers in English.
- **Server Components by default** — add `"use client"` only when the component uses a hook (`useStorefront`, `useShop`, `useState`, `useSearchParams`, `useRouter`) or an event handler.
- Responsive behavior (860px breakpoint) is CSS-only (`.ft-desktop-only` / `.ft-mobile-only` and the new `.ft-store-*` classes) — no `window.innerWidth` state, to keep server and client render identical on first paint.
- Reuse existing shared primitives: `colors`/`fonts` from `lib/theme/tokens.ts`, `Icon`/`ICONS` from `components/ui/Icon.tsx`, `fmt`/`money`/`initials` from `lib/format.ts`. Add to these registries rather than duplicating them.
- The source design mockup's "aperçu états" (state-preview) buttons on the Catalogue screen are a **design-tool debugging affordance**, not a customer-facing feature — they are intentionally not reimplemented. A real empty-results state and a brief loading transition are implemented instead, since both are reachable in normal use.
- Reference spec: `docs/superpowers/specs/2026-07-09-vitrine-storefront-design.md`. Reference plan: `docs/superpowers/plans/2026-07-09-storefront-foundations.md` (defines every store/data interface this plan consumes).

---

## File Structure Overview

```
app/globals.css                              MODIFY — add .ft-store-* responsive utility classes
components/ui/Icon.tsx                       MODIFY — add `fill` prop, `menu` + `heart` icons (across Tasks 1 & 6)

components/storefront/StoreHeader.tsx        CREATE
components/storefront/MobileMenu.tsx         CREATE
components/storefront/BottomTab.tsx          CREATE
components/storefront/StoreOfflineBanner.tsx CREATE
components/storefront/StoreToast.tsx         CREATE
app/(storefront)/layout.tsx                  CREATE
app/page.tsx                                 DELETE (superseded by app/(storefront)/page.tsx)
app/(storefront)/page.tsx                    CREATE (smoke version in Task 1, replaced in Task 2)

lib/theme/storefront.ts                      CREATE — stripe(hex), badgeBackground(badge)
components/storefront/blocks/BlockFrame.tsx  CREATE
components/storefront/blocks/registry.ts     CREATE, then MODIFY in Tasks 3 & 4
components/storefront/blocks/HeroBlock.tsx           CREATE (Task 2)
components/storefront/blocks/CategoryTilesBlock.tsx  CREATE (Task 2)
components/storefront/blocks/ProductGridBlock.tsx    CREATE (Task 3)
components/storefront/blocks/LoyaltyBannerBlock.tsx  CREATE (Task 3)
components/storefront/blocks/FeaturedProductBlock.tsx CREATE (Task 4)
components/storefront/blocks/StoryBlock.tsx           CREATE (Task 4)
components/storefront/blocks/LookbookBlock.tsx        CREATE (Task 4)
components/storefront/blocks/NewsletterBlock.tsx      CREATE (Task 4)
components/storefront/blocks/ContactBlock.tsx         CREATE (Task 4)
components/storefront/ProductCard.tsx        CREATE (Task 3)

components/storefront/Breadcrumb.tsx          CREATE (Task 5)
components/storefront/views/CatalogView.tsx   CREATE (Task 5)
app/(storefront)/catalogue/page.tsx           CREATE (Task 5)

components/storefront/AvailabilityChip.tsx    CREATE (Task 6)
components/storefront/views/ProductView.tsx   CREATE (Task 6)
app/(storefront)/produit/[id]/page.tsx        CREATE (Task 6)

components/storefront/views/CartView.tsx      CREATE (Task 7)
app/(storefront)/panier/page.tsx              CREATE (Task 7)

components/storefront/LoyaltyBadge.tsx        CREATE (Task 8)
components/storefront/views/CheckoutView.tsx  CREATE (Task 8)
app/(storefront)/commander/page.tsx           CREATE (Task 8)

components/storefront/views/ConfirmView.tsx   CREATE (Task 9)
app/(storefront)/confirmation/page.tsx        CREATE (Task 9)

components/storefront/views/AccountView.tsx   CREATE (Task 10)
app/(storefront)/compte/page.tsx              CREATE (Task 10)
```

---

### Task 1: Storefront CSS system + chrome shell

**Files:**
- Modify: `app/globals.css`
- Modify: `components/ui/Icon.tsx`
- Create: `components/storefront/StoreHeader.tsx`
- Create: `components/storefront/MobileMenu.tsx`
- Create: `components/storefront/BottomTab.tsx`
- Create: `components/storefront/StoreOfflineBanner.tsx`
- Create: `components/storefront/StoreToast.tsx`
- Create: `app/(storefront)/layout.tsx`
- Delete: `app/page.tsx`
- Create: `app/(storefront)/page.tsx` (smoke version — replaced whole in Task 2)

**Interfaces:**
- Consumes: `useStorefront` (`cart`, `offline`, `toggleOffline`, `menuOpen`, `openMenu`, `closeMenu`, `toast`) from Plan 1; `cartCount` from `lib/store/cartLogic.ts`; `Icon`/`ICONS`/`colors`/`fonts` (existing).
- Produces: every `.ft-store-*` CSS class used by every later task's components (full list below) and the mounted chrome (`app/(storefront)/layout.tsx`) that every storefront page renders inside.

- [ ] **Step 1: Add the `menu` icon**

In `components/ui/Icon.tsx`, add one entry to the `ICONS` object (anywhere in the object, e.g. right after `more`):

```ts
  menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
```

- [ ] **Step 2: Append the storefront CSS system**

Append to the end of `app/globals.css`:

```css

/* ============================================================
   Vitrine (storefront) — densité confortable (DESIGN.md §14)
   Breakpoint partagé avec le back-office : 860px.
   ============================================================ */

.ft-store-header-pad {
  padding: 14px 20px;
}
.ft-store-logo {
  font-size: 23px;
}
.ft-store-section {
  padding: 40px 20px;
}
.ft-store-section-tight {
  padding: 12px 20px;
}
.ft-store-page {
  padding: 32px 20px 48px;
}
.ft-store-h1 {
  font-size: 36px;
}
.ft-store-h2 {
  font-size: 30px;
}
.ft-store-hero {
  border-radius: 22px;
  min-height: 520px;
}
.ft-store-hero-text {
  padding: 44px 48px 48px;
}
.ft-store-hero-title {
  font-size: 52px;
}
.ft-store-hero-sub {
  font-size: 16px;
}
.ft-store-cats {
  grid-template-columns: repeat(3, 1fr);
}
.ft-store-home-grid {
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
}
.ft-store-catalog-grid {
  grid-template-columns: repeat(3, 1fr);
}
.ft-store-promo {
  padding: 32px 40px;
}
.ft-store-promo-title {
  font-size: 25px;
}
.ft-store-feat {
  grid-template-columns: 1fr 1fr;
}
.ft-store-feat-img {
  min-height: 420px;
}
.ft-store-feat-pad {
  padding: 44px 48px;
}
.ft-store-feat-title {
  font-size: 34px;
}
.ft-store-story {
  grid-template-columns: 1fr 1fr;
  gap: 48px;
}
.ft-store-story-img {
  min-height: 400px;
}
.ft-store-look-grid {
  grid-template-columns: repeat(4, 1fr);
}
.ft-store-contact {
  grid-template-columns: 1fr 1.2fr;
}
.ft-store-catalog-layout {
  grid-template-columns: 260px 1fr;
}
.ft-store-detail {
  grid-template-columns: 1fr 1fr;
  gap: 48px;
}
.ft-store-cart-layout {
  grid-template-columns: 1fr 320px;
}
.ft-store-checkout-layout {
  grid-template-columns: 1.4fr 1fr;
}
.ft-store-account-grid {
  grid-template-columns: 1fr 1fr;
}
.ft-store-conf-pad {
  padding: 44px 40px;
}
.ft-store-toast {
  bottom: 28px;
}

@media (max-width: 859.98px) {
  .ft-store-header-pad {
    padding: 10px 16px;
  }
  .ft-store-logo {
    font-size: 20px;
  }
  .ft-store-section {
    padding: 20px 16px;
  }
  .ft-store-section-tight {
    padding: 8px 16px;
  }
  .ft-store-page {
    padding: 18px 16px 32px;
  }
  .ft-store-h1 {
    font-size: 28px;
  }
  .ft-store-h2 {
    font-size: 24px;
  }
  .ft-store-hero {
    border-radius: 18px;
    min-height: 440px;
  }
  .ft-store-hero-text {
    padding: 22px 20px 26px;
  }
  .ft-store-hero-title {
    font-size: 36px;
  }
  .ft-store-hero-sub {
    font-size: 14px;
  }
  .ft-store-cats {
    grid-template-columns: 1fr;
  }
  .ft-store-home-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  .ft-store-catalog-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .ft-store-promo {
    padding: 24px 20px;
  }
  .ft-store-promo-title {
    font-size: 21px;
  }
  .ft-store-feat {
    grid-template-columns: 1fr;
  }
  .ft-store-feat-img {
    min-height: 300px;
  }
  .ft-store-feat-pad {
    padding: 26px 22px;
  }
  .ft-store-feat-title {
    font-size: 26px;
  }
  .ft-store-story {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .ft-store-story-img {
    min-height: 260px;
  }
  .ft-store-look-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .ft-store-contact {
    grid-template-columns: 1fr;
  }
  .ft-store-catalog-layout {
    grid-template-columns: 1fr;
  }
  .ft-store-detail {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .ft-store-cart-layout {
    grid-template-columns: 1fr;
  }
  .ft-store-checkout-layout {
    grid-template-columns: 1fr;
  }
  .ft-store-account-grid {
    grid-template-columns: 1fr;
  }
  .ft-store-conf-pad {
    padding: 32px 22px;
  }
  .ft-store-toast {
    bottom: 80px;
  }
}
```

- [ ] **Step 3: Create `StoreHeader`**

Create `components/storefront/StoreHeader.tsx`:

```tsx
"use client";

import Link from "next/link";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { useStorefront } from "@/lib/store/useStorefront";
import { cartCount } from "@/lib/store/cartLogic";

const NAV_LINKS = [
  { label: "Nouveautés", href: "/catalogue?cat=Nouveautés" },
  { label: "Foulards", href: "/catalogue?cat=Foulards" },
  { label: "Turbans", href: "/catalogue?cat=Turbans" },
  { label: "Accessoires", href: "/catalogue?cat=Accessoires" },
  { label: "Notre histoire", href: "/#ft-story" },
];

export function StoreHeader() {
  const cart = useStorefront((s) => s.cart);
  const offline = useStorefront((s) => s.offline);
  const toggleOffline = useStorefront((s) => s.toggleOffline);
  const openMenu = useStorefront((s) => s.openMenu);
  const count = cartCount(cart);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(250,247,242,.94)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(30,27,24,.08)",
      }}
    >
      <div className="ft-store-header-pad" style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 14 }}>
        <button
          onClick={openMenu}
          className="ft-mobile-only"
          aria-label="Ouvrir le menu"
          style={{ width: 44, height: 44, border: "none", background: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginLeft: -8 }}
        >
          <Icon path={ICONS.menu} size={24} stroke={colors.ink} strokeWidth={1.75} />
        </button>

        <Link href="/" className="ft-store-logo" style={{ fontFamily: fonts.display, fontWeight: 600, letterSpacing: "-.01em", lineHeight: 1, color: colors.ink }}>
          Foulard <span style={{ color: colors.accent }}>Teranga</span>
        </Link>

        <nav className="ft-desktop-only" style={{ display: "flex", gap: 26, marginLeft: 32, font: `500 15px ${fonts.ui}` }}>
          {NAV_LINKS.map((link) => (
            <Link key={link.label} href={link.href} style={{ color: colors.ink }}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <Link href="/catalogue" title="Rechercher" style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon path={ICONS.search} size={22} stroke={colors.ink} strokeWidth={1.75} />
          </Link>
          <button
            onClick={toggleOffline}
            title="Simuler hors-ligne"
            aria-label="Basculer le mode hors-ligne (démo)"
            style={{ width: 44, height: 44, border: "none", background: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <span style={{ width: 9, height: 9, borderRadius: 999, background: offline ? colors.warning : colors.success }} />
          </button>
          <Link href="/compte" title="Mon compte" className="ft-desktop-only" style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon path={ICONS.user} size={22} stroke={colors.ink} strokeWidth={1.75} />
          </Link>
          <Link href="/panier" title="Panier" style={{ position: "relative", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon path={ICONS.cart} size={22} stroke={colors.ink} strokeWidth={1.75} />
            {count > 0 && (
              <span
                style={{
                  position: "absolute", top: 4, right: 2,
                  font: `700 10px ${fonts.ui}`, background: colors.accent, color: "#fff",
                  minWidth: 17, height: 17, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
                }}
              >
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create `MobileMenu`**

Create `components/storefront/MobileMenu.tsx`:

```tsx
"use client";

import Link from "next/link";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { useStorefront } from "@/lib/store/useStorefront";

const LINKS = [
  { label: "Nouveautés", href: "/catalogue?cat=Nouveautés" },
  { label: "Foulards", href: "/catalogue?cat=Foulards" },
  { label: "Turbans", href: "/catalogue?cat=Turbans" },
  { label: "Accessoires", href: "/catalogue?cat=Accessoires" },
  { label: "Notre histoire", href: "/#ft-story" },
  { label: "Mon compte", href: "/compte" },
];

export function MobileMenu() {
  const menuOpen = useStorefront((s) => s.menuOpen);
  const closeMenu = useStorefront((s) => s.closeMenu);

  if (!menuOpen) return null;

  return (
    <div onClick={closeMenu} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(30,27,24,.4)" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", top: 0, left: 0, bottom: 0, width: 284, maxWidth: "82vw",
          background: colors.ivory, boxShadow: "8px 0 24px rgba(60,40,20,.18)", padding: "22px 20px",
          animation: "ft-fade .18s ease", display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <span style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 20 }}>
            Foulard <span style={{ color: colors.accent }}>Teranga</span>
          </span>
          <button
            onClick={closeMenu}
            aria-label="Fermer le menu"
            style={{ width: 36, height: 36, border: "1px solid rgba(30,27,24,.08)", borderRadius: 8, background: "#fff", cursor: "pointer" }}
          >
            <Icon path={ICONS.close} size={18} stroke={colors.ink} strokeWidth={2} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {LINKS.map((link, i) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={closeMenu}
              style={{
                padding: "14px 4px", font: `600 17px ${fonts.ui}`, color: colors.ink,
                borderBottom: i < LINKS.length - 1 ? "1px solid #EAE4D9" : "none",
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 24, padding: 16, background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14 }}>
          <div style={{ font: `600 13px ${fonts.ui}`, marginBottom: 6 }}>Une question ?</div>
          <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: 8, font: `600 14px ${fonts.ui}`, color: colors.success }}>
            <Icon path={ICONS.whatsapp} size={18} stroke={colors.success} strokeWidth={1.75} />
            Écrire sur WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `BottomTab`**

Create `components/storefront/BottomTab.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { useStorefront } from "@/lib/store/useStorefront";
import { cartCount } from "@/lib/store/cartLogic";

const TABS = [
  { id: "home", label: "Accueil", href: "/", icon: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>' },
  { id: "catalog", label: "Boutique", href: "/catalogue", icon: ICONS.search },
  { id: "cart", label: "Panier", href: "/panier", icon: ICONS.cart },
  { id: "account", label: "Compte", href: "/compte", icon: ICONS.user },
];

export function BottomTab() {
  const pathname = usePathname();
  const cart = useStorefront((s) => s.cart);
  const count = cartCount(cart);

  return (
    <nav
      className="ft-mobile-only"
      style={{
        position: "sticky", bottom: 0, zIndex: 50,
        background: "rgba(255,255,255,.96)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        borderTop: "1px solid #EAE4D9", display: "flex", justifyContent: "space-around", padding: "6px 4px 8px",
      }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        const color = active ? colors.primary : "#8a8177";
        return (
          <Link
            key={tab.id}
            href={tab.href}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 56, height: 52, justifyContent: "center", color, position: "relative" }}
          >
            <span style={{ position: "relative", display: "flex" }}>
              <Icon path={tab.icon} size={23} stroke={color} strokeWidth={1.85} />
              {tab.id === "cart" && count > 0 && (
                <span
                  style={{
                    position: "absolute", top: -5, right: -7,
                    font: `700 9px ${fonts.ui}`, background: colors.accent, color: "#fff",
                    minWidth: 15, height: 15, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
                  }}
                >
                  {count}
                </span>
              )}
            </span>
            <span style={{ font: `600 10.5px ${fonts.ui}` }}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 6: Create `StoreOfflineBanner` and `StoreToast`**

Create `components/storefront/StoreOfflineBanner.tsx`:

```tsx
"use client";

import { colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { useStorefront } from "@/lib/store/useStorefront";

export function StoreOfflineBanner() {
  const offline = useStorefront((s) => s.offline);
  if (!offline) return null;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "9px 16px",
        background: colors.ink, color: "#fff", fontSize: 13, fontWeight: 500,
        position: "sticky", top: 0, zIndex: 60,
      }}
    >
      <Icon path={ICONS.wifiOff} size={18} stroke={colors.gold} strokeWidth={1.8} />
      <span style={{ flex: 1 }}>
        Hors-ligne — catalogue &amp; panier consultables. Votre demande partira au retour du réseau.
      </span>
    </div>
  );
}
```

Create `components/storefront/StoreToast.tsx`:

```tsx
"use client";

import { fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { useStorefront, type ToastType } from "@/lib/store/useStorefront";

const META: Record<ToastType, { color: string; icon: string }> = {
  success: { color: "#0E9F6E", icon: ICONS.check },
  warning: { color: "#E0A400", icon: ICONS.alertTriangle },
  error: { color: "#C4453B", icon: ICONS.close },
};

export function StoreToast() {
  const toast = useStorefront((s) => s.toast);
  if (!toast) return null;
  const meta = META[toast.type];

  return (
    <div
      role="status"
      className="ft-store-toast"
      style={{
        position: "fixed", left: "50%", transform: "translateX(-50%)", zIndex: 90,
        display: "flex", alignItems: "center", gap: 12,
        background: "#fff", border: "1px solid #EAE4D9", borderLeft: `4px solid ${meta.color}`, borderRadius: 12,
        padding: "14px 16px", boxShadow: "0 8px 24px rgba(60,40,20,.16)", maxWidth: "90vw",
        animation: "ft-fade .18s ease",
      }}
    >
      <Icon path={meta.icon} size={20} stroke={meta.color} strokeWidth={2} />
      <div style={{ font: `600 14px ${fonts.ui}` }}>{toast.msg}</div>
    </div>
  );
}
```

- [ ] **Step 7: Wire the storefront layout, delete the old root page, add a smoke Home page**

Create `app/(storefront)/layout.tsx`:

```tsx
import { StoreHeader } from "@/components/storefront/StoreHeader";
import { MobileMenu } from "@/components/storefront/MobileMenu";
import { BottomTab } from "@/components/storefront/BottomTab";
import { StoreOfflineBanner } from "@/components/storefront/StoreOfflineBanner";
import { StoreToast } from "@/components/storefront/StoreToast";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#FAF7F2", color: "#1E1B18", display: "flex", flexDirection: "column" }}>
      <StoreOfflineBanner />
      <StoreHeader />
      <MobileMenu />
      <main style={{ flex: 1 }}>{children}</main>
      <BottomTab />
      <StoreToast />
    </div>
  );
}
```

Delete `app/page.tsx` (its placeholder content from Plan 1 Task 14 is superseded — the route group below now owns `/`).

Create `app/(storefront)/page.tsx` (smoke version — verifies the chrome; Task 2 replaces the body with the real Home):

```tsx
export default function StorefrontHomePage() {
  return (
    <div className="ft-store-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <p>Accueil de la vitrine — en construction.</p>
    </div>
  );
}
```

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 9: Manually verify the chrome**

Run: `npm run dev`, open `http://localhost:3000/` in a browser.

Desktop (≥860px): logo + desktop nav + search/offline-dot/account/cart icons visible in the header; no bottom tab bar.
Resize to mobile (<860px): hamburger button replaces the desktop nav; clicking it opens the slide-in menu (close button and backdrop both dismiss it); a bottom tab bar (Accueil/Boutique/Panier/Compte) appears, sticky at the bottom.
Click the small offline dot in the header: it turns amber and the dark "Hors-ligne" banner appears at the top; click again to restore it green and dismiss the banner.
Navigate to `/catalogue`, `/panier` — placeholder 404s are expected for now (no page exists there yet); only `/` is wired in this task.

Stop the dev server once confirmed.

- [ ] **Step 10: Commit**

```bash
git add app/globals.css components/ui/Icon.tsx components/storefront/StoreHeader.tsx components/storefront/MobileMenu.tsx components/storefront/BottomTab.tsx components/storefront/StoreOfflineBanner.tsx components/storefront/StoreToast.tsx "app/(storefront)/layout.tsx" "app/(storefront)/page.tsx"
git rm app/page.tsx
git commit -m "feat: add storefront CSS system and chrome shell"
```

---

### Task 2: Blocks infrastructure + Hero/CategoryTiles + real Home page

**Files:**
- Create: `lib/theme/storefront.ts`
- Create: `components/storefront/blocks/BlockFrame.tsx`
- Create: `components/storefront/blocks/registry.ts`
- Create: `components/storefront/blocks/HeroBlock.tsx`
- Create: `components/storefront/blocks/CategoryTilesBlock.tsx`
- Modify: `app/(storefront)/page.tsx` (replaces the Task 1 smoke body)

**Interfaces:**
- Consumes: `useStorefront` (`blocksMode`, `blockOrder`, `blockNames`, `blockHidden`, `renameBlock`, `moveBlock`, `toggleHideBlock`, `toggleBlocksMode`) and `BlockId` type from Plan 1; `catalog`, `storefrontCategories` from `lib/data/catalog.ts`.
- Produces: `stripe(hex)`, `badgeBackground(badge)` helpers (reused by every later block/view); `BlockFrame` (reused by every block); `blockRegistry: Partial<Record<BlockId, ComponentType>>` — **modified again in Tasks 3 and 4** to register the remaining 7 blocks. The Home page filters `blockOrder` down to `id in blockRegistry`, so partially-populated registries never crash — each later task's registry addition makes more of the Home page live without touching the page again.

- [ ] **Step 1: Add the shared storefront presentation helpers**

Create `lib/theme/storefront.ts`:

```ts
/** Dégradé de vignette produit à partir d'une couleur de marque (mock, sans image). */
export function stripe(hex: string): string {
  return `repeating-linear-gradient(45deg, ${hex}22, ${hex}22 11px, #efe8dc 11px, #efe8dc 22px)`;
}

/** Fond de badge produit : noir pour les distinctions "★", terracotta sinon. */
export function badgeBackground(badge: string): string {
  return badge.includes("★") ? "#1E1B18" : "#D07A34";
}
```

- [ ] **Step 2: Create `BlockFrame`**

Create `components/storefront/blocks/BlockFrame.tsx`:

```tsx
"use client";

import { fonts } from "@/lib/theme/tokens";
import { Icon } from "@/components/ui/Icon";
import { useStorefront, type BlockId } from "@/lib/store/useStorefront";

const CHEVRON_UP = '<path d="m18 15-6-6-6 6"/>';
const CHEVRON_DOWN = '<path d="m6 9 6 6 6-6"/>';
const EYE = '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>';
const EYE_OFF =
  '<path d="M2 2 22 22"/><path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3 3.5M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>';

/** Enveloppe commune de chaque bloc de la Home : cadre "mode éditeur" (renommer,
 * réordonner, masquer) — préfigure le futur éditeur de vitrine (SECTIONS.md §1). */
export function BlockFrame({ id, children }: { id: BlockId; children: React.ReactNode }) {
  const blocksMode = useStorefront((s) => s.blocksMode);
  const name = useStorefront((s) => s.blockNames[id]);
  const hidden = useStorefront((s) => !!s.blockHidden[id]);
  const renameBlock = useStorefront((s) => s.renameBlock);
  const moveBlock = useStorefront((s) => s.moveBlock);
  const toggleHideBlock = useStorefront((s) => s.toggleHideBlock);

  if (hidden && !blocksMode) return null;

  return (
    <div
      style={{
        position: "relative",
        opacity: hidden ? 0.4 : 1,
        outline: blocksMode ? "2px dashed rgba(208,122,52,.95)" : "none",
        outlineOffset: -4,
        borderRadius: 6,
        transition: "opacity .15s",
      }}
    >
      {blocksMode && (
        <div
          style={{
            position: "absolute", top: 8, left: 14, zIndex: 25,
            display: "flex", alignItems: "center", gap: 1,
            background: "#1E1B18", borderRadius: 9, padding: 4, boxShadow: "0 6px 18px rgba(30,27,24,.3)",
          }}
        >
          <input
            value={name}
            onChange={(e) => renameBlock(id, e.target.value)}
            style={{ width: 150, border: "none", background: "#2c2822", color: "#fff", font: `600 12.5px ${fonts.ui}`, borderRadius: 6, padding: "6px 9px", outline: "none" }}
          />
          <ToolbarButton label="Monter" onClick={() => moveBlock(id, -1)} path={CHEVRON_UP} />
          <ToolbarButton label="Descendre" onClick={() => moveBlock(id, 1)} path={CHEVRON_DOWN} />
          <ToolbarButton label="Masquer / afficher" onClick={() => toggleHideBlock(id)} path={hidden ? EYE_OFF : EYE} />
        </div>
      )}
      {children}
    </div>
  );
}

function ToolbarButton({ label, onClick, path }: { label: string; onClick: () => void; path: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{ width: 28, height: 28, border: "none", borderRadius: 6, background: "none", color: "#C9BEB0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <Icon path={path} size={15} stroke="currentColor" strokeWidth={2} />
    </button>
  );
}
```

- [ ] **Step 3: Create `HeroBlock` and `CategoryTilesBlock`**

Create `components/storefront/blocks/HeroBlock.tsx` (a Server Component — only renders `<Link>`, no hooks or handlers):

```tsx
import Link from "next/link";
import { fonts } from "@/lib/theme/tokens";
import { BlockFrame } from "./BlockFrame";

export function HeroBlock() {
  return (
    <BlockFrame id="hero">
      <section className="ft-store-section">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div
            className="ft-store-hero"
            style={{
              position: "relative", overflow: "hidden", display: "flex", alignItems: "flex-end",
              background: "repeating-linear-gradient(45deg,#d8ccb8,#d8ccb8 12px,#e2d7c4 12px,#e2d7c4 24px)",
            }}
          >
            <span style={{ position: "absolute", top: 14, left: 16, fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#9a8f7d" }}>
              visuel hero · 16:9
            </span>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(30,27,24,.6), rgba(30,27,24,.05) 60%)" }} />
            <div className="ft-store-hero-text" style={{ position: "relative", color: "#fff", maxWidth: 560 }}>
              <div
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px",
                  border: "1px solid rgba(255,255,255,.5)", borderRadius: 999,
                  font: `600 12px ${fonts.ui}`, letterSpacing: ".06em", marginBottom: 16,
                }}
              >
                NOUVELLE COLLECTION 2026
              </div>
              <h1 className="ft-store-hero-title" style={{ fontFamily: fonts.display, fontWeight: 600, lineHeight: 1.04, margin: "0 0 12px" }}>
                L&apos;élégance
                <br />
                tissée main
              </h1>
              <p className="ft-store-hero-sub" style={{ opacity: 0.92, lineHeight: 1.5, margin: "0 0 22px", maxWidth: 420 }}>
                Foulards, turbans &amp; accessoires africains pour la femme moderne. Fabriqués en Côte d&apos;Ivoire, dans l&apos;esprit Teranga.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link
                  href="/catalogue"
                  style={{ height: 48, padding: "0 26px", borderRadius: 10, background: "#D07A34", color: "#fff", font: `700 15px ${fonts.ui}`, display: "flex", alignItems: "center" }}
                >
                  Découvrir la boutique
                </Link>
                <Link
                  href="/#ft-story"
                  style={{ height: 48, padding: "0 22px", border: "1.5px solid rgba(255,255,255,.7)", borderRadius: 10, background: "rgba(255,255,255,.08)", color: "#fff", font: `600 15px ${fonts.ui}`, display: "flex", alignItems: "center" }}
                >
                  Notre histoire
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
```

Create `components/storefront/blocks/CategoryTilesBlock.tsx` (also a Server Component):

```tsx
import Link from "next/link";
import { fonts } from "@/lib/theme/tokens";
import { stripe } from "@/lib/theme/storefront";
import { catalog, storefrontCategories } from "@/lib/data/catalog";
import { BlockFrame } from "./BlockFrame";

const TILE_COLOR: Record<string, string> = {
  Foulards: "#26326B",
  Turbans: "#D07A34",
  Accessoires: "#C9A227",
};

export function CategoryTilesBlock() {
  return (
    <BlockFrame id="cats">
      <section className="ft-store-section-tight">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="ft-store-cats" style={{ display: "grid", gap: 14 }}>
            {storefrontCategories.map((cat) => {
              const count = catalog.filter((p) => p.cat === cat).length;
              return (
                <Link
                  key={cat}
                  href={`/catalogue?cat=${encodeURIComponent(cat)}`}
                  style={{
                    position: "relative", borderRadius: 14, overflow: "hidden", aspectRatio: "4 / 3",
                    background: stripe(TILE_COLOR[cat]), display: "block",
                  }}
                >
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(30,27,24,.5), transparent 65%)" }} />
                  <div style={{ position: "absolute", left: 16, bottom: 14, color: "#fff" }}>
                    <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 22 }}>{cat}</div>
                    <div style={{ fontSize: 12.5, opacity: 0.9 }}>{count} modèles →</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
```

- [ ] **Step 4: Create the registry with these two blocks**

Create `components/storefront/blocks/registry.ts`:

```ts
import type { ComponentType } from "react";
import type { BlockId } from "@/lib/store/useStorefront";
import { HeroBlock } from "./HeroBlock";
import { CategoryTilesBlock } from "./CategoryTilesBlock";

/**
 * type → composant de rendu. Chaque bloc ajouté ici devient immédiatement
 * disponible sur la Home, réordonnable/masquable en mode éditeur — préfigure
 * le futur éditeur de vitrine complet (SECTIONS.md §1).
 */
export const blockRegistry: Partial<Record<BlockId, ComponentType>> = {
  hero: HeroBlock,
  cats: CategoryTilesBlock,
};
```

- [ ] **Step 5: Replace the Home page with the real block-driven version**

Replace `app/(storefront)/page.tsx` in full:

```tsx
"use client";

import Link from "next/link";
import { fonts } from "@/lib/theme/tokens";
import { Icon } from "@/components/ui/Icon";
import { useStorefront } from "@/lib/store/useStorefront";
import { blockRegistry } from "@/components/storefront/blocks/registry";

export default function StorefrontHomePage() {
  const blockOrder = useStorefront((s) => s.blockOrder);
  const blocksMode = useStorefront((s) => s.blocksMode);
  const toggleBlocksMode = useStorefront((s) => s.toggleBlocksMode);

  const renderableOrder = blockOrder.filter((id) => id in blockRegistry);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {blocksMode && (
        <div
          style={{
            position: "sticky", top: 0, zIndex: 40, display: "flex", alignItems: "center", gap: 10,
            maxWidth: 1200, margin: "12px auto 0", width: "calc(100% - 32px)",
            background: "#FBF1D8", border: "1px solid #EBD9A6", borderRadius: 12, padding: "11px 14px",
          }}
        >
          <span style={{ fontSize: 13, color: "#7a5a00", lineHeight: 1.4 }}>
            Mode éditeur — renommez un bloc, réordonnez-le (↑↓) ou masquez-le (œil). Chaque bloc est empilable et éditable sans code.
          </span>
        </div>
      )}

      {renderableOrder.map((id) => {
        const Block = blockRegistry[id]!;
        return <Block key={id} />;
      })}

      <footer style={{ background: "#1E1B18", color: "#C9BEB0", marginTop: 20 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 20px 100px", display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 22, color: "#fff", marginBottom: 8 }}>Foulard Teranga</div>
            <div style={{ fontSize: 13, maxWidth: 280, lineHeight: 1.6 }}>
              Foulards &amp; accessoires africains élégants, depuis Abidjan.
            </div>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 2 }}>
            <div style={{ color: "#fff", fontWeight: 600, marginBottom: 6 }}>Boutique</div>
            <Link href="/catalogue?cat=Foulards" style={{ color: "#C9BEB0", display: "block" }}>Foulards</Link>
            <Link href="/catalogue?cat=Turbans" style={{ color: "#C9BEB0", display: "block" }}>Turbans</Link>
            <Link href="/catalogue?cat=Accessoires" style={{ color: "#C9BEB0", display: "block" }}>Accessoires</Link>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 2 }}>
            <div style={{ color: "#fff", fontWeight: 600, marginBottom: 6 }}>Aide</div>
            <div>WhatsApp</div>
            <div>Livraison</div>
            <div>Points de fidélité</div>
          </div>
        </div>
      </footer>

      <button
        onClick={toggleBlocksMode}
        style={{
          position: "fixed", right: 20, bottom: 28, zIndex: 55, height: 46, padding: "0 18px",
          border: "none", borderRadius: 999, background: blocksMode ? "#D07A34" : "#1E1B18", color: "#fff",
          font: `600 14px ${fonts.ui}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 9,
          boxShadow: "0 8px 24px rgba(30,27,24,.28)",
        }}
      >
        <Icon path='<rect x="3" y="3" width="18" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="7" rx="1.5"/>' size={18} stroke="#fff" strokeWidth={1.85} />
        {blocksMode ? "Quitter l'aperçu" : "Aperçu des blocs"}
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Manually verify Hero + CategoryTiles + the editor toggle**

Run: `npm run dev`, open `http://localhost:3000/`.
Expected: hero banner with "Découvrir la boutique" / "Notre histoire" buttons, then 3 category tiles (Foulards/Turbans/Accessoires with model counts), then the dark footer, then the floating "Aperçu des blocs" button bottom-right.

Click "Aperçu des blocs": both blocks get a dashed outline and a small dark toolbar (rename input, ↑, ↓, eye). Click the hero's ↓ (move down) — it swaps position with the category tiles. Click the tiles' eye icon — it dims to 40% opacity (still visible in editor mode). Click "Quitter l'aperçu" — the toolbars disappear and the hidden block vanishes from view (since `blocksMode` is now false).

Reload the page: the reordering and the hidden state persist (backed by `useStorefront`'s persisted `blockOrder`/`blockHidden`).

Stop the dev server once confirmed.

- [ ] **Step 8: Commit**

```bash
git add lib/theme/storefront.ts components/storefront/blocks "app/(storefront)/page.tsx"
git commit -m "feat: add blocks infrastructure and wire Hero/CategoryTiles into the real Home page"
```

---

### Task 3: ProductCard + ProductGridBlock + LoyaltyBannerBlock

**Files:**
- Create: `components/storefront/ProductCard.tsx`
- Create: `components/storefront/blocks/ProductGridBlock.tsx`
- Create: `components/storefront/blocks/LoyaltyBannerBlock.tsx`
- Modify: `components/storefront/blocks/registry.ts`

**Interfaces:**
- Consumes: `stripe`, `badgeBackground` (Task 2); `newestProducts` from `lib/data/catalog.ts`; `useShop.effectiveStock`; `useStorefront.addToCart`/`showToast`; `money`/`fmt` from `lib/format.ts`.
- Produces: `ProductCard` — **reused by Tasks 5 and 6** (Catalogue grid and Product page's "related products"). `blockRegistry` now has 4 entries.

- [ ] **Step 1: Create `ProductCard`**

Create `components/storefront/ProductCard.tsx`:

```tsx
"use client";

import Link from "next/link";
import { colors, fonts } from "@/lib/theme/tokens";
import { stripe, badgeBackground } from "@/lib/theme/storefront";
import { money, fmt } from "@/lib/format";
import type { Product } from "@/lib/data/types";

export function ProductCard({
  product,
  stock,
  onAdd,
}: {
  product: Product;
  /** Stock effectif (post-déduction) — calculé par l'appelant via useShop.effectiveStock. */
  stock: number;
  onAdd: () => void;
}) {
  const soldOut = stock <= 0;

  return (
    <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(60,40,20,.08)" }}>
      <Link href={`/produit/${product.id}`} style={{ display: "block", position: "relative", aspectRatio: "4 / 5", background: stripe(product.colors[0]) }}>
        {product.badge && (
          <span
            style={{
              position: "absolute", top: 10, left: 10,
              font: `700 11px ${fonts.ui}`, padding: "4px 8px", borderRadius: 6,
              background: badgeBackground(product.badge), color: "#fff",
            }}
          >
            {product.badge}
          </span>
        )}
        {soldOut && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(250,247,242,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ font: `600 12px ${fonts.ui}`, padding: "6px 12px", borderRadius: 999, background: colors.ink, color: "#fff" }}>
              Épuisé
            </span>
          </div>
        )}
      </Link>
      <div style={{ padding: "14px 16px 16px" }}>
        <Link href={`/produit/${product.id}`} style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 17, lineHeight: 1.2, marginBottom: 4, display: "block", color: colors.ink }}>
          {product.name}
        </Link>
        <div style={{ fontSize: 12.5, color: colors.muted, marginBottom: 12 }}>
          {product.motif !== "Uni" ? `${product.motif} · ${product.lengths[0]}` : product.lengths[0]}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: colors.primary }}>{money(product.price)}</span>
            {product.oldPrice && <span style={{ fontSize: 12.5, color: "#9a8f7d", textDecoration: "line-through" }}>{fmt(product.oldPrice)}</span>}
          </div>
          <button
            onClick={onAdd}
            disabled={soldOut}
            title="Ajouter"
            style={{
              width: 38, height: 38, flex: "none", borderRadius: 10,
              border: `1.5px solid ${soldOut ? "#EAE4D9" : colors.primary}`,
              background: soldOut ? "#F4F0E9" : "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: soldOut ? "not-allowed" : "pointer",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={soldOut ? "#C7BFB2" : colors.primary} strokeWidth={1.9} strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `ProductGridBlock`**

Create `components/storefront/blocks/ProductGridBlock.tsx`:

```tsx
"use client";

import Link from "next/link";
import { fonts, colors } from "@/lib/theme/tokens";
import { newestProducts } from "@/lib/data/catalog";
import { useShop } from "@/lib/store/useShop";
import { useStorefront } from "@/lib/store/useStorefront";
import { ProductCard } from "@/components/storefront/ProductCard";
import { BlockFrame } from "./BlockFrame";

export function ProductGridBlock() {
  const effectiveStock = useShop((s) => s.effectiveStock);
  const addToCart = useStorefront((s) => s.addToCart);
  const showToast = useStorefront((s) => s.showToast);
  const products = newestProducts(4);

  return (
    <BlockFrame id="grid">
      <section className="ft-store-section">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, gap: 16 }}>
            <div>
              <div style={{ font: `600 12px ${fonts.ui}`, letterSpacing: ".1em", color: colors.gold, textTransform: "uppercase", marginBottom: 6 }}>
                À la une
              </div>
              <h2 className="ft-store-h2" style={{ fontFamily: fonts.display, fontWeight: 600, margin: 0, letterSpacing: "-.01em" }}>
                Nouveautés &amp; best-sellers
              </h2>
            </div>
            <Link href="/catalogue" style={{ font: `600 14px ${fonts.ui}`, color: colors.primary, whiteSpace: "nowrap" }}>
              Tout voir →
            </Link>
          </div>
          <div className="ft-store-home-grid" style={{ display: "grid" }}>
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                stock={effectiveStock(p.id)}
                onAdd={() => {
                  addToCart({ productId: p.id, name: p.name, variant: p.lengths[0], colorHex: p.colors[0], price: p.price });
                  showToast("Ajouté au panier", "success");
                }}
              />
            ))}
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
```

- [ ] **Step 3: Create `LoyaltyBannerBlock`**

Create `components/storefront/blocks/LoyaltyBannerBlock.tsx` (a Server Component — only a `<Link>`, no hooks):

```tsx
import Link from "next/link";
import { fonts } from "@/lib/theme/tokens";
import { BlockFrame } from "./BlockFrame";

export function LoyaltyBannerBlock() {
  return (
    <BlockFrame id="loyalty">
      <section className="ft-store-section-tight">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div
            className="ft-store-promo"
            style={{ background: "#26326B", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap", color: "#fff" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 18, minWidth: 260 }}>
              <div style={{ width: 52, height: 52, flex: "none", borderRadius: 999, background: "#1E1B18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#C9A227" stroke="none"><path d="M12 2 15 9l7 .5-5.5 4.5L18.5 21 12 17l-6.5 4 2-7L2 9.5 9 9Z" /></svg>
              </div>
              <div>
                <div className="ft-store-promo-title" style={{ fontFamily: fonts.display, fontWeight: 600, lineHeight: 1.1 }}>
                  Programme fidélité Teranga
                </div>
                <div style={{ fontSize: 14, opacity: 0.85, marginTop: 4 }}>
                  Cumulez des points à chaque commande — 5% offerts dès 300 points.
                </div>
              </div>
            </div>
            <Link
              href="/compte"
              style={{ height: 46, padding: "0 24px", borderRadius: 10, background: "#D07A34", color: "#fff", font: `700 15px ${fonts.ui}`, whiteSpace: "nowrap", display: "flex", alignItems: "center" }}
            >
              Rejoindre le programme
            </Link>
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
```

- [ ] **Step 4: Register the two new blocks**

Replace `components/storefront/blocks/registry.ts` in full:

```ts
import type { ComponentType } from "react";
import type { BlockId } from "@/lib/store/useStorefront";
import { HeroBlock } from "./HeroBlock";
import { CategoryTilesBlock } from "./CategoryTilesBlock";
import { ProductGridBlock } from "./ProductGridBlock";
import { LoyaltyBannerBlock } from "./LoyaltyBannerBlock";

export const blockRegistry: Partial<Record<BlockId, ComponentType>> = {
  hero: HeroBlock,
  cats: CategoryTilesBlock,
  grid: ProductGridBlock,
  loyalty: LoyaltyBannerBlock,
};
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Manually verify the product grid and add-to-cart**

Run: `npm run dev`, open `http://localhost:3000/`.
Expected: a "Nouveautés & best-sellers" section now appears (after category tiles) showing 4 products (Foulard Wax Abidjan, Foulard soie Kente, Kente bande, Boucles perles — the four badged products from Plan 1's catalogue). Below it, the indigo "Programme fidélité Teranga" banner with a "Rejoindre le programme" button linking to `/compte` (404 for now — that page comes in Task 10).

Click the **+** button on a product card: a "Ajouté au panier" toast appears, and the cart badge in the header (and bottom-tab on mobile) increments.

Stop the dev server once confirmed.

- [ ] **Step 7: Commit**

```bash
git add components/storefront/ProductCard.tsx components/storefront/blocks/ProductGridBlock.tsx components/storefront/blocks/LoyaltyBannerBlock.tsx components/storefront/blocks/registry.ts
git commit -m "feat: add product grid and loyalty banner blocks with working add-to-cart"
```

---

### Task 4: Remaining 5 Home blocks — Featured, Story, Lookbook, Newsletter, Contact

**Files:**
- Create: `components/storefront/blocks/FeaturedProductBlock.tsx`
- Create: `components/storefront/blocks/StoryBlock.tsx`
- Create: `components/storefront/blocks/LookbookBlock.tsx`
- Create: `components/storefront/blocks/NewsletterBlock.tsx`
- Create: `components/storefront/blocks/ContactBlock.tsx`
- Modify: `components/storefront/blocks/registry.ts`

**Interfaces:**
- Consumes: `featuredProduct` from `lib/data/catalog.ts`; `useShop.effectiveStock`; `useStorefront.addToCart`/`showToast`; `stripe`, `badgeBackground` (Task 2); `ICONS.mapPin`/`ICONS.clock`/`ICONS.whatsapp` (existing).
- Produces: `blockRegistry` now has all 9 entries — the Home page renders its full default order (`hero, cats, grid, loyalty, featured, story, look, news, contact`), matching the source design exactly.

- [ ] **Step 1: Create `FeaturedProductBlock`**

Create `components/storefront/blocks/FeaturedProductBlock.tsx`:

```tsx
"use client";

import Link from "next/link";
import { fonts, colors } from "@/lib/theme/tokens";
import { stripe } from "@/lib/theme/storefront";
import { featuredProduct } from "@/lib/data/catalog";
import { useShop } from "@/lib/store/useShop";
import { useStorefront } from "@/lib/store/useStorefront";
import { money } from "@/lib/format";
import { BlockFrame } from "./BlockFrame";

export function FeaturedProductBlock() {
  const product = featuredProduct();
  const effectiveStock = useShop((s) => s.effectiveStock);
  const addToCart = useStorefront((s) => s.addToCart);
  const showToast = useStorefront((s) => s.showToast);
  const stock = effectiveStock(product.id);

  return (
    <BlockFrame id="featured">
      <section className="ft-store-section">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="ft-store-feat" style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, overflow: "hidden", display: "grid" }}>
            <div className="ft-store-feat-img" style={{ position: "relative", background: stripe(product.colors[0]), display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ position: "absolute", top: 14, left: 14, font: `700 11px ${fonts.ui}`, padding: "5px 10px", borderRadius: 999, background: "#1E1B18", color: colors.gold, border: `1px solid ${colors.gold}` }}>
                ★ Coup de cœur
              </span>
            </div>
            <div className="ft-store-feat-pad" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ font: `600 12px ${fonts.ui}`, letterSpacing: ".1em", color: colors.gold, textTransform: "uppercase", marginBottom: 10 }}>
                Édition limitée
              </div>
              <h3 className="ft-store-feat-title" style={{ fontFamily: fonts.display, fontWeight: 600, lineHeight: 1.1, margin: "0 0 10px" }}>
                {product.name}
              </h3>
              <p style={{ fontSize: 15, color: colors.muted, lineHeight: 1.55, margin: "0 0 18px" }}>{product.description}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 22 }}>
                <span style={{ fontSize: 26, fontWeight: 700, color: colors.primary }}>{money(product.price)}</span>
                <span style={{ fontSize: 14, color: colors.muted }}>· {product.lengths[0]}</span>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link
                  href={`/produit/${product.id}`}
                  style={{ height: 48, padding: "0 26px", borderRadius: 10, background: colors.primary, color: "#fff", font: `600 15px ${fonts.ui}`, display: "flex", alignItems: "center" }}
                >
                  Voir le produit
                </Link>
                <button
                  onClick={() => {
                    if (stock <= 0) { showToast("Article épuisé", "error"); return; }
                    addToCart({ productId: product.id, name: product.name, variant: product.lengths[0], colorHex: product.colors[0], price: product.price });
                    showToast("Ajouté au panier", "success");
                  }}
                  style={{ height: 48, padding: "0 22px", border: `1.5px solid ${colors.primary}`, borderRadius: 10, background: "#fff", color: colors.primary, font: `600 15px ${fonts.ui}`, cursor: "pointer" }}
                >
                  Ajouter au panier
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
```

- [ ] **Step 2: Create `StoryBlock`**

Create `components/storefront/blocks/StoryBlock.tsx` (a Server Component — static content only). Its `id="ft-story"` anchor is what the header's "Notre histoire" nav link (Task 1) and the hero's secondary button (Task 2) point to:

```tsx
import { fonts, colors } from "@/lib/theme/tokens";
import { BlockFrame } from "./BlockFrame";

export function StoryBlock() {
  return (
    <BlockFrame id="story">
      <section id="ft-story" style={{ background: "#F4EFE7", borderTop: "1px solid rgba(30,27,24,.06)", borderBottom: "1px solid rgba(30,27,24,.06)" }}>
        <div className="ft-store-section ft-store-story" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", alignItems: "center" }}>
          <div>
            <div style={{ font: `600 12px ${fonts.ui}`, letterSpacing: ".1em", color: colors.gold, textTransform: "uppercase", marginBottom: 12 }}>
              Notre histoire
            </div>
            <h2 className="ft-store-h2" style={{ fontFamily: fonts.display, fontWeight: 600, lineHeight: 1.12, margin: "0 0 16px", letterSpacing: "-.01em" }}>
              L&apos;esprit Teranga, tissé dans chaque pièce
            </h2>
            <p style={{ fontSize: 16, color: colors.muted, lineHeight: 1.65, margin: "0 0 14px" }}>
              « Teranga », c&apos;est l&apos;hospitalité sénégalaise. Depuis Abidjan, chaque foulard est choisi
              auprès d&apos;artisanes partenaires, teint à la main selon des savoir-faire transmis de mère en fille.
            </p>
            <p style={{ fontSize: 16, color: colors.muted, lineHeight: 1.65, margin: "0 0 20px" }}>
              Des matières nobles, des motifs qui racontent, une élégance qui vous ressemble.
            </p>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              <StatItem value="100%" label="tissé main" />
              <StatItem value="24" label="artisanes partenaires" />
              <StatItem value="3" label="pays livrés" />
            </div>
          </div>
          <div
            className="ft-store-story-img"
            style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "repeating-linear-gradient(45deg,#e0d4c0,#e0d4c0 11px,#ebe1d1 11px,#ebe1d1 22px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#9a8f7d" }}>atelier · artisanat</span>
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 30, color: colors.primary }}>{value}</div>
      <div style={{ fontSize: 13, color: colors.muted }}>{label}</div>
    </div>
  );
}
```

- [ ] **Step 3: Create `LookbookBlock`**

Create `components/storefront/blocks/LookbookBlock.tsx` (a Server Component):

```tsx
import { fonts, colors } from "@/lib/theme/tokens";
import { stripe } from "@/lib/theme/storefront";
import { BlockFrame } from "./BlockFrame";

const LOOKS = [
  { label: "look 01 · 3:4", hex: "#26326B" },
  { label: "look 02 · 3:4", hex: "#D07A34" },
  { label: "look 03 · 3:4", hex: "#C9A227" },
  { label: "look 04 · 3:4", hex: "#0E9F6E" },
];

export function LookbookBlock() {
  return (
    <BlockFrame id="look">
      <section className="ft-store-section">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div style={{ font: `600 12px ${fonts.ui}`, letterSpacing: ".1em", color: colors.gold, textTransform: "uppercase", marginBottom: 6 }}>
              Lookbook
            </div>
            <h2 className="ft-store-h2" style={{ fontFamily: fonts.display, fontWeight: 600, margin: 0, letterSpacing: "-.01em" }}>
              Portées avec style
            </h2>
          </div>
          <div className="ft-store-look-grid" style={{ display: "grid", gap: 12 }}>
            {LOOKS.map((look) => (
              <div
                key={look.label}
                style={{ borderRadius: 14, overflow: "hidden", aspectRatio: "3 / 4", background: stripe(look.hex), display: "flex", alignItems: "flex-end", padding: 12 }}
              >
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10.5, color: "#9a8f7d" }}>{look.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
```

- [ ] **Step 4: Create `NewsletterBlock`**

Create `components/storefront/blocks/NewsletterBlock.tsx`:

```tsx
"use client";

import { fonts } from "@/lib/theme/tokens";
import { useStorefront } from "@/lib/store/useStorefront";
import { BlockFrame } from "./BlockFrame";

export function NewsletterBlock() {
  const showToast = useStorefront((s) => s.showToast);

  return (
    <BlockFrame id="news">
      <section className="ft-store-section-tight">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="ft-store-promo" style={{ background: "#1E1B18", borderRadius: 16, textAlign: "center", color: "#fff" }}>
            <h2 className="ft-store-h2" style={{ fontFamily: fonts.display, fontWeight: 600, margin: "0 0 10px" }}>
              Restez dans la boucle
            </h2>
            <p style={{ fontSize: 15, color: "#C9BEB0", margin: "0 auto 22px", maxWidth: 440, lineHeight: 1.55 }}>
              Nouveautés, ventes privées et 25 points de bienvenue à l&apos;inscription.
            </p>
            <div style={{ display: "flex", gap: 10, maxWidth: 440, margin: "0 auto", flexWrap: "wrap" }}>
              <input
                placeholder="Votre numéro ou e-mail"
                style={{ flex: 1, minWidth: 180, height: 48, padding: "0 16px", border: "none", borderRadius: 10, background: "#2c2822", color: "#fff", font: `400 15px ${fonts.ui}`, outline: "none" }}
              />
              <button
                onClick={() => showToast("Inscription enregistrée · +25 points", "success")}
                style={{ height: 48, padding: "0 24px", border: "none", borderRadius: 10, background: "#D07A34", color: "#fff", font: `700 15px ${fonts.ui}`, cursor: "pointer" }}
              >
                S&apos;inscrire
              </button>
            </div>
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
```

- [ ] **Step 5: Create `ContactBlock`**

Create `components/storefront/blocks/ContactBlock.tsx` (a Server Component):

```tsx
import { fonts, colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { BlockFrame } from "./BlockFrame";

export function ContactBlock() {
  return (
    <BlockFrame id="contact">
      <section id="ft-contact" className="ft-store-section">
        <div className="ft-store-contact" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
          <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: "26px 28px" }}>
            <h3 style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 24, margin: "0 0 18px" }}>Nous trouver</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <ContactRow icon={ICONS.mapPin} title="Boutique Plateau" body="Rue du Commerce, Plateau, Abidjan · Côte d'Ivoire" />
              <ContactRow icon={ICONS.clock} title="Horaires" body="Lun – Sam · 9h – 19h" />
              <a
                href="#"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, height: 48, borderRadius: 10, background: colors.success, color: "#fff", font: `700 15px ${fonts.ui}`, marginTop: 4 }}
              >
                <Icon path={ICONS.whatsapp} size={20} stroke="#fff" strokeWidth={1.75} />
                Commander sur WhatsApp
              </a>
            </div>
          </div>
          <div
            style={{ position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 220, background: "repeating-linear-gradient(45deg,#dfe1e8,#dfe1e8 11px,#e9eaef 11px,#e9eaef 22px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#8a8d99" }}>carte · localisation</span>
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}

function ContactRow({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <Icon path={icon} size={20} stroke={colors.primary} strokeWidth={1.75} style={{ flex: "none", marginTop: 2 }} />
      <div>
        <div style={{ font: `600 15px ${fonts.ui}` }}>{title}</div>
        <div style={{ fontSize: 14, color: colors.muted }}>{body}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Register all 9 blocks**

Replace `components/storefront/blocks/registry.ts` in full:

```ts
import type { ComponentType } from "react";
import type { BlockId } from "@/lib/store/useStorefront";
import { HeroBlock } from "./HeroBlock";
import { CategoryTilesBlock } from "./CategoryTilesBlock";
import { ProductGridBlock } from "./ProductGridBlock";
import { LoyaltyBannerBlock } from "./LoyaltyBannerBlock";
import { FeaturedProductBlock } from "./FeaturedProductBlock";
import { StoryBlock } from "./StoryBlock";
import { LookbookBlock } from "./LookbookBlock";
import { NewsletterBlock } from "./NewsletterBlock";
import { ContactBlock } from "./ContactBlock";

export const blockRegistry: Partial<Record<BlockId, ComponentType>> = {
  hero: HeroBlock,
  cats: CategoryTilesBlock,
  grid: ProductGridBlock,
  loyalty: LoyaltyBannerBlock,
  featured: FeaturedProductBlock,
  story: StoryBlock,
  look: LookbookBlock,
  news: NewsletterBlock,
  contact: ContactBlock,
};
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Manually verify the complete Home page**

Run: `npm run dev`, open `http://localhost:3000/`.
Expected, top to bottom: Hero → Category tiles → Nouveautés & best-sellers grid → Loyalty banner → Featured product ("Foulard soie Kente") → Story ("L'esprit Teranga…") → Lookbook (4 tiles) → Newsletter (dark banner, "S'inscrire" shows a toast) → Contact ("Nous trouver" + WhatsApp button) → footer.

Click the header's "Notre histoire" link (desktop) or the mobile menu's "Notre histoire" — the page jumps to the Story section (`#ft-story` anchor). Toggle "Aperçu des blocs" and confirm all 9 blocks now show the editor toolbar.

Stop the dev server once confirmed.

- [ ] **Step 9: Commit**

```bash
git add components/storefront/blocks
git commit -m "feat: complete the Home page with the remaining 5 flexible-content blocks"
```

---

### Task 5: Catalogue — search, filters, sort, and empty/loading states

**Files:**
- Create: `components/storefront/Breadcrumb.tsx`
- Create: `components/storefront/views/CatalogView.tsx`
- Create: `app/(storefront)/catalogue/page.tsx`

**Interfaces:**
- Consumes: `filterCatalog`, `categories`, `CatalogFilters` from `lib/data/catalog.ts` (Plan 1); `useShop.effectiveStock`; `useStorefront.addToCart`/`showToast`; `ProductCard` (Task 3).
- Produces: `Breadcrumb` — **reused by Tasks 6 and 8** (Product page and Checkout).

A note on scope: the source design mockup has "aperçu états" (state-preview) buttons that manually force the catalogue into ready/loading/error views — that's a design-tool debugging affordance aimed at whoever was building the mockup, not a real customer-facing control, so it is intentionally not reimplemented (Global Constraints). What *is* real and implemented here: a genuine empty-results state (when filters produce zero matches) and a brief loading transition (a 250ms skeleton whenever filters change, seeding the pattern a future real data fetch will need).

- [ ] **Step 1: Create `Breadcrumb`**

Create `components/storefront/Breadcrumb.tsx`:

```tsx
import Link from "next/link";
import { colors } from "@/lib/theme/tokens";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: colors.muted, marginBottom: 14, flexWrap: "wrap" }}>
      {items.map((item, i) => (
        <span key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {i > 0 && <span style={{ color: "#C7BFB2" }}>/</span>}
          {item.href ? (
            <Link href={item.href} style={{ color: colors.primary }}>{item.label}</Link>
          ) : (
            <span style={{ color: colors.ink, fontWeight: 600 }}>{item.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `CatalogView`**

Create `components/storefront/views/CatalogView.tsx`:

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { fonts, colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { filterCatalog, categories, type CatalogFilters } from "@/lib/data/catalog";
import { useShop } from "@/lib/store/useShop";
import { useStorefront } from "@/lib/store/useStorefront";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { money } from "@/lib/format";

const COLOR_SWATCHES = [
  { hex: "#26326B", label: "Indigo" },
  { hex: "#D07A34", label: "Terracotta" },
  { hex: "#C9A227", label: "Or" },
  { hex: "#0E9F6E", label: "Vert" },
  { hex: "#1E1B18", label: "Noir" },
];
const MOTIFS = ["Wax", "Bazin", "Uni", "Kente", "Tie & dye"];

export function CatalogView() {
  const searchParams = useSearchParams();
  const initialCat = (searchParams.get("cat") as CatalogFilters["cat"]) || "Tous";

  const [filters, setFilters] = useState<CatalogFilters>({
    cat: initialCat,
    color: "",
    motif: "",
    priceMax: 40000,
    query: "",
    sort: "new",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 250);
    return () => clearTimeout(timer);
  }, [filters.cat, filters.color, filters.motif, filters.priceMax, filters.query, filters.sort]);

  const effectiveStock = useShop((s) => s.effectiveStock);
  const addToCart = useStorefront((s) => s.addToCart);
  const showToast = useStorefront((s) => s.showToast);

  const products = useMemo(() => filterCatalog(filters), [filters]);

  const setFilter = <K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const clearFilters = () => setFilters({ cat: "Tous", color: "", motif: "", priceMax: 40000, query: "", sort: "new" });

  return (
    <div className="ft-store-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: filters.cat === "Tous" ? "Toute la boutique" : filters.cat }]} />
      <h1 className="ft-store-h1" style={{ fontFamily: fonts.display, fontWeight: 600, margin: "0 0 4px", letterSpacing: "-.01em" }}>
        {filters.cat === "Tous" ? "Toute la boutique" : filters.cat}
      </h1>
      <p style={{ fontSize: 14, color: colors.muted, margin: "0 0 20px" }}>
        {products.length} produit{products.length > 1 ? "s" : ""}
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", height: 46, padding: "0 14px", border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", gap: 10 }}>
          <Icon path={ICONS.search} size={18} stroke={colors.muted} strokeWidth={1.75} />
          <input
            value={filters.query}
            onChange={(e) => setFilter("query", e.target.value)}
            placeholder="Rechercher un foulard, un motif…"
            style={{ flex: 1, border: "none", outline: "none", font: `400 15px ${fonts.ui}`, color: colors.ink, background: "transparent" }}
          />
        </div>
        <select
          value={filters.sort}
          onChange={(e) => setFilter("sort", e.target.value as CatalogFilters["sort"])}
          style={{ height: 46, padding: "0 14px", border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", font: `500 14px ${fonts.ui}`, color: colors.ink, cursor: "pointer" }}
        >
          <option value="new">Nouveautés</option>
          <option value="asc">Prix croissant</option>
          <option value="desc">Prix décroissant</option>
        </select>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className="ft-mobile-only"
          style={{ height: 46, padding: "0 16px", border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", font: `600 14px ${fonts.ui}`, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
        >
          <Icon path='<path d="M4 6h16M7 12h10M10 18h4"/>' size={18} stroke={colors.ink} strokeWidth={1.75} />
          Filtres
        </button>
      </div>

      <div className="ft-store-catalog-layout" style={{ display: "grid", gap: 24, alignItems: "start" }}>
        <aside
          className={filtersOpen ? undefined : "ft-desktop-only"}
          style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: "20px 22px" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ font: `600 15px ${fonts.ui}` }}>Filtres</span>
            <span onClick={clearFilters} style={{ font: `500 13px ${fonts.ui}`, color: colors.primary, cursor: "pointer" }}>
              Réinitialiser
            </span>
          </div>

          <FilterLabel>Catégorie</FilterLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 20 }}>
            {categories.map((c) => (
              <span
                key={c}
                onClick={() => setFilter("cat", c)}
                style={{
                  padding: "8px 10px", borderRadius: 8, font: `500 14px ${fonts.ui}`, cursor: "pointer",
                  background: filters.cat === c ? colors.bgInfo : "transparent",
                  color: filters.cat === c ? colors.primary : colors.ink,
                }}
              >
                {c}
              </span>
            ))}
          </div>

          <FilterLabel>Couleur</FilterLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
            {COLOR_SWATCHES.map((c) => (
              <span
                key={c.hex}
                onClick={() => setFilter("color", filters.color === c.hex ? "" : c.hex)}
                title={c.label}
                style={{ width: 32, height: 32, borderRadius: 999, background: c.hex, cursor: "pointer", outline: filters.color === c.hex ? `2px solid ${colors.ink}` : "2px solid transparent", outlineOffset: 2 }}
              />
            ))}
          </div>

          <FilterLabel>Motif</FilterLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {MOTIFS.map((m) => {
              const active = filters.motif === m;
              return (
                <span
                  key={m}
                  onClick={() => setFilter("motif", active ? "" : m)}
                  style={{
                    height: 34, padding: "0 13px", display: "inline-flex", alignItems: "center", borderRadius: 999,
                    font: `600 13px ${fonts.ui}`, cursor: "pointer",
                    border: `1.5px solid ${active ? colors.primary : colors.borderField}`,
                    background: active ? colors.primary : "#fff",
                    color: active ? "#fff" : colors.muted,
                  }}
                >
                  {m}
                </span>
              );
            })}
          </div>

          <FilterLabel>Prix max · {money(filters.priceMax)}</FilterLabel>
          <input
            type="range"
            min={4000}
            max={40000}
            step={500}
            value={filters.priceMax}
            onChange={(e) => setFilter("priceMax", parseInt(e.target.value, 10))}
            style={{ width: "100%", accentColor: colors.primary, cursor: "pointer" }}
          />
        </aside>

        <div>
          {loading ? (
            <div className="ft-store-catalog-grid" style={{ display: "grid", gap: 18 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, overflow: "hidden" }}>
                  <div className="ft-skeleton" style={{ aspectRatio: "4 / 5" }} />
                  <div style={{ padding: "14px 16px" }}>
                    <div className="ft-skeleton" style={{ height: 14, width: "70%", marginBottom: 9 }} />
                    <div className="ft-skeleton" style={{ height: 12, width: "45%" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: "56px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 60, height: 60, borderRadius: 999, background: "#F4F0E9", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Icon path={ICONS.search} size={28} stroke="#B6AEA1" strokeWidth={1.6} />
              </div>
              <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 20, marginBottom: 6 }}>Aucun résultat</div>
              <p style={{ fontSize: 14, color: colors.muted, margin: "0 0 20px", maxWidth: 320 }}>
                Aucun produit ne correspond à ces filtres. Essayez d&apos;élargir votre recherche.
              </p>
              <button
                onClick={clearFilters}
                style={{ height: 46, padding: "0 24px", border: "none", borderRadius: 10, background: colors.primary, color: "#fff", font: `600 15px ${fonts.ui}`, cursor: "pointer" }}
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <div className="ft-store-catalog-grid" style={{ display: "grid", gap: 18 }}>
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  stock={effectiveStock(p.id)}
                  onAdd={() => {
                    addToCart({ productId: p.id, name: p.name, variant: p.lengths[0], colorHex: p.colors[0], price: p.price });
                    showToast("Ajouté au panier", "success");
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ font: `600 12px ${fonts.ui}`, textTransform: "uppercase", letterSpacing: ".06em", color: colors.muted, marginBottom: 10 }}>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create the Catalogue page**

Create `app/(storefront)/catalogue/page.tsx` (`useSearchParams` requires a `Suspense` boundary around the Client Component that calls it):

```tsx
import { Suspense } from "react";
import { CatalogView } from "@/components/storefront/views/CatalogView";

export default function CataloguePage() {
  return (
    <Suspense fallback={<div className="ft-store-page" style={{ maxWidth: 1200, margin: "0 auto" }} />}>
      <CatalogView />
    </Suspense>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Manually verify search, filters, sort, and the empty state**

Run: `npm run dev`, open `http://localhost:3000/catalogue`.
Expected: breadcrumb "Accueil / Toute la boutique", 12 products (all of Plan 1's enriched catalogue), a brief skeleton flash on load.

Click "Turbans" in the sidebar — only "Turban Bazin Or" (`p3`) shows. Click the gold color swatch — products without gold in their palette disappear. Type "kente" in the search box — only the two Kente products remain. Drag the price slider down to ~5000 — most products disappear. Combine filters until zero products match — the "Aucun résultat" empty state appears with a working "Réinitialiser les filtres" button. Click it — all 12 products return.

Navigate to `http://localhost:3000/catalogue?cat=Foulards` directly (as the header's "Foulards" nav link does) — confirm the page opens pre-filtered to Foulards.

On a mobile-width viewport, confirm the sidebar is hidden by default and the "Filtres" button toggles it inline.

Stop the dev server once confirmed.

- [ ] **Step 6: Commit**

```bash
git add components/storefront/Breadcrumb.tsx components/storefront/views/CatalogView.tsx "app/(storefront)/catalogue/page.tsx"
git commit -m "feat: add the Catalogue page with search, filters, sort, and a real empty state"
```

---

### Task 6: Product detail page

**Files:**
- Modify: `components/ui/Icon.tsx`
- Create: `components/storefront/AvailabilityChip.tsx`
- Create: `components/storefront/views/ProductView.tsx`
- Create: `app/(storefront)/produit/[id]/page.tsx`

**Interfaces:**
- Consumes: `catalog`, `relatedTo` from `lib/data/catalog.ts`; `useShop.effectiveStock`; `useStorefront.addToCart`/`showToast`; `Breadcrumb` (Task 5); `ProductCard` (Task 3); `stripe` (Task 2).
- Produces: `Icon`'s new `fill` prop (backward-compatible — every existing call site keeps its default `"none"` behavior) and `ICONS.heart`, both reused wherever a filled icon is needed later.

- [ ] **Step 1: Add a `fill` prop and the `heart` icon to `Icon`**

In `components/ui/Icon.tsx`, replace the function signature and body:

```tsx
export function Icon({
  path,
  size = 18,
  stroke = "currentColor",
  strokeWidth = 1.75,
  fill = "none",
  style,
}: {
  path: string;
  size?: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: path }}
    />
  );
}
```

Add one entry to `ICONS` (e.g. after `cart`):

```ts
  heart: '<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 5.5 5.5 5.5 0 0 1 21.5 12c-2.5 4.5-9.5 9-9.5 9Z"/>',
```

- [ ] **Step 2: Create `AvailabilityChip`**

Create `components/storefront/AvailabilityChip.tsx`:

```tsx
import { fonts } from "@/lib/theme/tokens";

export function AvailabilityChip({ stock }: { stock: number }) {
  if (stock <= 0) {
    return <Chip bg="#F8E5E3" fg="#9c352d" dot="#C4453B" label="Épuisé — bientôt de retour" />;
  }
  if (stock <= 5) {
    return <Chip bg="#FBF1D8" fg="#8a6500" dot="#E0A400" label={`Plus que ${stock} en stock`} />;
  }
  return <Chip bg="#E6F4EE" fg="#0b6e4d" dot="#0E9F6E" label="En stock · expédié sous 48h" />;
}

function Chip({ bg, fg, dot, label }: { bg: string; fg: string; dot: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, font: `600 12.5px ${fonts.ui}`, padding: "6px 12px", borderRadius: 999, background: bg, color: fg }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: dot }} />
      {label}
    </span>
  );
}
```

- [ ] **Step 3: Create `ProductView`**

Create `components/storefront/views/ProductView.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fonts, colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { stripe } from "@/lib/theme/storefront";
import { relatedTo } from "@/lib/data/catalog";
import { useShop } from "@/lib/store/useShop";
import { useStorefront } from "@/lib/store/useStorefront";
import { money, fmt } from "@/lib/format";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { AvailabilityChip } from "@/components/storefront/AvailabilityChip";
import { ProductCard } from "@/components/storefront/ProductCard";
import type { Product } from "@/lib/data/types";

const COLOR_NAMES: Record<string, string> = {
  "#26326B": "Indigo",
  "#D07A34": "Terracotta",
  "#C9A227": "Or",
  "#0E9F6E": "Vert",
  "#1E1B18": "Noir",
};

export function ProductView({ product }: { product: Product }) {
  const router = useRouter();
  const [colorIdx, setColorIdx] = useState(0);
  const [lenIdx, setLenIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [fav, setFav] = useState(false);

  const effectiveStock = useShop((s) => s.effectiveStock);
  const addToCart = useStorefront((s) => s.addToCart);
  const showToast = useStorefront((s) => s.showToast);

  const stock = effectiveStock(product.id);
  const soldOut = stock <= 0;
  const variant = product.lengths[lenIdx];
  const related = relatedTo(product.id);

  const doAdd = () => {
    if (soldOut) { showToast("Article épuisé", "error"); return; }
    addToCart({ productId: product.id, name: product.name, variant, colorHex: product.colors[colorIdx], price: product.price, qty });
    showToast("Ajouté au panier", "success");
  };

  const buyNow = () => {
    if (soldOut) { showToast("Article épuisé", "error"); return; }
    addToCart({ productId: product.id, name: product.name, variant, colorHex: product.colors[colorIdx], price: product.price, qty });
    router.push("/commander");
  };

  return (
    <div className="ft-store-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: product.cat, href: `/catalogue?cat=${encodeURIComponent(product.cat)}` },
          { label: product.name },
        ]}
      />

      <div className="ft-store-detail" style={{ display: "grid", alignItems: "start" }}>
        <div>
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", aspectRatio: "4 / 5", background: stripe(product.colors[colorIdx]), display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#9a8f7d" }}>photo produit 4:5</span>
            <button
              onClick={() => setFav((v) => !v)}
              aria-label="Ajouter aux favoris"
              style={{ position: "absolute", top: 14, right: 14, width: 42, height: 42, border: "none", borderRadius: 999, background: "rgba(255,255,255,.92)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <Icon path={ICONS.heart} size={20} fill={fav ? colors.accent : "none"} stroke={colors.ink} strokeWidth={1.75} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {product.colors.slice(0, 4).map((hex, i) => (
              <div key={hex} style={{ aspectRatio: "1", borderRadius: 10, background: stripe(hex), border: i === colorIdx ? `2px solid ${colors.primary}` : "1px solid rgba(30,27,24,.1)" }} />
            ))}
          </div>
        </div>

        <div>
          {product.badge && (
            <span style={{ display: "inline-block", font: `700 11px ${fonts.ui}`, padding: "4px 9px", borderRadius: 6, background: product.badge.includes("★") ? "#1E1B18" : colors.accent, color: "#fff", marginBottom: 12 }}>
              {product.badge}
            </span>
          )}
          <h1 className="ft-store-h1" style={{ fontFamily: fonts.display, fontWeight: 600, lineHeight: 1.08, margin: "0 0 8px", letterSpacing: "-.01em" }}>
            {product.name}
          </h1>
          <div style={{ fontSize: 14, color: colors.muted, marginBottom: 16 }}>{product.variant}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: colors.primary }}>{money(product.price)}</span>
            {product.oldPrice && <span style={{ fontSize: 15, color: "#9a8f7d", textDecoration: "line-through" }}>{fmt(product.oldPrice)}</span>}
          </div>
          <div style={{ marginBottom: 20 }}>
            <AvailabilityChip stock={stock} />
          </div>
          <p style={{ fontSize: 15, color: colors.muted, lineHeight: 1.6, margin: "0 0 24px" }}>{product.description}</p>

          <div style={{ font: `600 13px ${fonts.ui}`, marginBottom: 10 }}>
            Couleur — <span style={{ color: colors.muted, fontWeight: 500 }}>{COLOR_NAMES[product.colors[colorIdx]] ?? product.colors[colorIdx]}</span>
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
            {product.colors.map((hex, i) => (
              <span
                key={hex}
                onClick={() => setColorIdx(i)}
                title={COLOR_NAMES[hex] ?? hex}
                style={{ width: 34, height: 34, borderRadius: 999, background: hex, cursor: "pointer", outline: i === colorIdx ? `2px solid ${colors.ink}` : "2px solid transparent", outlineOffset: 2 }}
              />
            ))}
          </div>

          <div style={{ font: `600 13px ${fonts.ui}`, marginBottom: 10 }}>Longueur</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
            {product.lengths.map((len, i) => {
              const active = i === lenIdx;
              return (
                <span
                  key={len}
                  onClick={() => setLenIdx(i)}
                  style={{ height: 40, padding: "0 18px", display: "inline-flex", alignItems: "center", borderRadius: 8, font: `600 13.5px ${fonts.ui}`, cursor: "pointer", border: `1.5px solid ${active ? colors.primary : colors.borderField}`, background: active ? colors.primary : "#fff", color: active ? "#fff" : colors.ink }}
                >
                  {len}
                </span>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", height: 50, border: `1.5px solid ${colors.borderField}`, borderRadius: 10, overflow: "hidden" }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 46, height: "100%", border: "none", background: colors.ivory, fontSize: 20, color: colors.primary, cursor: "pointer" }}>−</button>
              <span style={{ width: 48, textAlign: "center", font: `600 16px ${fonts.ui}` }}>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} style={{ width: 46, height: "100%", border: "none", background: colors.ivory, fontSize: 20, color: colors.primary, cursor: "pointer" }}>+</button>
            </div>
            <button
              onClick={doAdd}
              disabled={soldOut}
              style={{ flex: 1, minWidth: 180, height: 50, padding: "0 24px", border: "none", borderRadius: 10, background: soldOut ? "#C7C1B6" : colors.primary, color: "#fff", font: `700 15px ${fonts.ui}`, cursor: soldOut ? "not-allowed" : "pointer" }}
            >
              {soldOut ? "Indisponible" : "Ajouter au panier"}
            </button>
          </div>
          <button
            onClick={buyNow}
            style={{ width: "100%", height: 50, marginTop: 12, border: `1.5px solid ${colors.primary}`, borderRadius: 10, background: "#fff", color: colors.primary, font: `600 15px ${fonts.ui}`, cursor: "pointer" }}
          >
            Commander maintenant — en 3 clics
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13, color: colors.muted }}>
            <Icon path={ICONS.check} size={16} stroke={colors.success} strokeWidth={1.9} />
            Commande = demande à confirmer, sans paiement en ligne. La gérante vous recontacte.
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section style={{ marginTop: 48 }}>
          <h2 className="ft-store-h2" style={{ fontFamily: fonts.display, fontWeight: 600, margin: "0 0 18px", letterSpacing: "-.01em" }}>
            Vous aimerez aussi
          </h2>
          <div className="ft-store-home-grid" style={{ display: "grid" }}>
            {related.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                stock={effectiveStock(p.id)}
                onAdd={() => {
                  addToCart({ productId: p.id, name: p.name, variant: p.lengths[0], colorHex: p.colors[0], price: p.price });
                  showToast("Ajouté au panier", "success");
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create the Product page**

Create `app/(storefront)/produit/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { catalog } from "@/lib/data/catalog";
import { ProductView } from "@/components/storefront/views/ProductView";

export function generateStaticParams() {
  return catalog.map((p) => ({ id: p.id }));
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = catalog.find((p) => p.id === id);
  if (!product) notFound();
  return <ProductView product={product} />;
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Manually verify the product page**

Run: `npm run dev`, open `http://localhost:3000/produit/p2` (Foulard soie Kente — the featured product, stock 6, above the low-stock threshold).
Expected: gallery with a favorite heart button (click it — it fills terracotta, click again — it empties), breadcrumb, badge "★ Coup de cœur", price, a green "En stock · expédié sous 48h" chip, color swatches (clicking one changes the gallery background and the "Couleur — X" label), length chips, quantity stepper, "Ajouter au panier" and "Commander maintenant" buttons, and a "Vous aimerez aussi" grid of same-category products.

Visit `http://localhost:3000/produit/p10` (Boucles perles, stock 3) — confirm the amber "Plus que 3 en stock" chip appears.

Visit `http://localhost:3000/produit/does-not-exist` — confirm Next's 404 page renders (via `notFound()`).

Click "Commander maintenant" on any in-stock product — confirm it adds to cart and navigates to `/commander` (a 404 for now — built in Task 8).

Stop the dev server once confirmed.

- [ ] **Step 7: Commit**

```bash
git add components/ui/Icon.tsx components/storefront/AvailabilityChip.tsx components/storefront/views/ProductView.tsx "app/(storefront)/produit/[id]/page.tsx"
git commit -m "feat: add the Product detail page with variants, availability, and related products"
```

---

### Task 7: Cart page

**Files:**
- Create: `components/storefront/views/CartView.tsx`
- Create: `app/(storefront)/panier/page.tsx`

**Interfaces:**
- Consumes: `useStorefront` (`cart`, `incLine`, `rmLine`, `offline`, `showToast`); `cartSubtotal`, `cartCount` from `lib/store/cartLogic.ts`; `stripe` (Task 2); `money`/`fmt` (existing).
- Produces: nothing new consumed elsewhere — this is a leaf view. Its "Valider le panier" button is the entry point Task 8's Checkout page expects a non-empty cart from.

- [ ] **Step 1: Create `CartView`**

Create `components/storefront/views/CartView.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { fonts, colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { stripe } from "@/lib/theme/storefront";
import { useStorefront } from "@/lib/store/useStorefront";
import { cartSubtotal, cartCount } from "@/lib/store/cartLogic";
import { money, fmt } from "@/lib/format";

export function CartView() {
  const router = useRouter();
  const cart = useStorefront((s) => s.cart);
  const incLine = useStorefront((s) => s.incLine);
  const rmLine = useStorefront((s) => s.rmLine);
  const offline = useStorefront((s) => s.offline);
  const showToast = useStorefront((s) => s.showToast);

  const subtotal = cartSubtotal(cart);
  const count = cartCount(cart);

  const goCheckout = () => {
    if (cart.length === 0) { showToast("Panier vide", "warning"); return; }
    router.push("/commander");
  };

  return (
    <div className="ft-store-page" style={{ maxWidth: 920, margin: "0 auto" }}>
      <h1 className="ft-store-h1" style={{ fontFamily: fonts.display, fontWeight: 600, margin: "0 0 20px", letterSpacing: "-.01em" }}>
        Mon panier
      </h1>

      {cart.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: "64px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: "#F4F0E9", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Icon path={ICONS.cart} size={30} stroke="#B6AEA1" strokeWidth={1.6} />
          </div>
          <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 22, marginBottom: 6 }}>Votre panier est vide</div>
          <p style={{ fontSize: 14, color: colors.muted, margin: "0 0 22px", maxWidth: 320 }}>
            Découvrez nos nouveautés et ajoutez vos coups de cœur.
          </p>
          <Link href="/catalogue" style={{ height: 48, padding: "0 26px", borderRadius: 10, background: colors.primary, color: "#fff", font: `600 15px ${fonts.ui}`, display: "inline-flex", alignItems: "center" }}>
            Voir la boutique
          </Link>
        </div>
      ) : (
        <>
          {offline && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 14px", background: "#F4EFE7", border: "1px solid #E7DECF", borderRadius: 10, fontSize: 13, color: colors.muted, marginBottom: 16 }}>
              <Icon path={ICONS.wifiOff} size={16} stroke="#8a6a3a" strokeWidth={1.8} />
              Panier enregistré hors-ligne. Vous pourrez l&apos;envoyer au retour du réseau.
            </div>
          )}
          <div className="ft-store-cart-layout" style={{ display: "grid", gap: 20, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {cart.map((line) => (
                <div key={line.key} style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: 16, display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ width: 74, height: 90, flex: "none", borderRadius: 10, background: stripe(line.colorHex) }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 16 }}>{line.name}</div>
                    <div style={{ fontSize: 12.5, color: colors.muted, margin: "3px 0 10px" }}>{line.variant}</div>
                    <div style={{ display: "inline-flex", alignItems: "center", height: 38, border: `1.5px solid ${colors.borderField}`, borderRadius: 8, overflow: "hidden" }}>
                      <button onClick={() => incLine(line.key, -1)} style={{ width: 38, height: "100%", border: "none", background: colors.ivory, fontSize: 17, color: colors.primary, cursor: "pointer" }}>−</button>
                      <span style={{ width: 42, textAlign: "center", font: `600 14px ${fonts.ui}` }}>{line.qty}</span>
                      <button onClick={() => incLine(line.key, 1)} style={{ width: 38, height: "100%", border: "none", background: colors.ivory, fontSize: 17, color: colors.primary, cursor: "pointer" }}>+</button>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ font: `700 16px ${fonts.ui}`, color: colors.primary }}>{fmt(line.price * line.qty)}</div>
                    <div style={{ fontSize: 11, color: "#9a8f7d" }}>FCFA</div>
                    <button onClick={() => rmLine(line.key)} style={{ border: "none", background: "none", color: colors.danger, font: `500 12px ${fonts.ui}`, cursor: "pointer", marginTop: 8 }}>
                      Retirer
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: 22 }}>
              <div style={{ font: `600 16px ${fonts.ui}`, marginBottom: 16 }}>Récapitulatif</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: colors.muted, marginBottom: 10 }}>
                <span>Sous-total ({count} art.)</span>
                <span style={{ color: colors.ink, fontWeight: 600 }}>{money(subtotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: colors.muted, marginBottom: 16 }}>
                <span>Livraison</span>
                <span>À convenir</span>
              </div>
              <div style={{ height: 1, background: "#EAE4D9", marginBottom: 16 }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
                <span style={{ font: `600 15px ${fonts.ui}` }}>Total estimé</span>
                <span style={{ font: `700 22px ${fonts.ui}`, color: colors.primary }}>{money(subtotal)}</span>
              </div>
              <button onClick={goCheckout} style={{ width: "100%", height: 50, border: "none", borderRadius: 10, background: colors.accent, color: "#fff", font: `700 15px ${fonts.ui}`, cursor: "pointer" }}>
                Valider le panier
              </button>
              <Link href="/catalogue" style={{ width: "100%", height: 46, marginTop: 10, border: `1.5px solid ${colors.primary}`, borderRadius: 10, background: "#fff", color: colors.primary, font: `600 14px ${fonts.ui}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                Continuer mes achats
              </Link>
              <p style={{ fontSize: 12.5, color: colors.muted, margin: "14px 0 0", lineHeight: 1.5, textAlign: "center" }}>
                Sans paiement en ligne. La gérante vous recontacte pour confirmer.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the Cart page**

Create `app/(storefront)/panier/page.tsx`:

```tsx
import { CartView } from "@/components/storefront/views/CartView";

export default function CartPage() {
  return <CartView />;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manually verify the cart**

Run: `npm run dev`. With an empty cart, open `http://localhost:3000/panier` — confirm the empty state with a "Voir la boutique" link to `/catalogue`.

Add 2 different products to the cart (from Home or Catalogue), then revisit `/panier`. Expected: both lines listed with thumbnail/name/variant, quantity steppers that update the line total live, a "Retirer" link that removes a line, and a summary panel (subtotal, "Livraison — À convenir", total) with "Valider le panier" (routes to `/commander` — 404 for now, built in Task 8) and "Continuer mes achats" (routes to `/catalogue`).

Decrement a line to 0 via the stepper — confirm the line disappears from the cart (and the header/bottom-tab badge count updates accordingly).

Stop the dev server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add components/storefront/views/CartView.tsx "app/(storefront)/panier/page.tsx"
git commit -m "feat: add the Cart page"
```

---

### Task 8: Checkout / KYC — the order-loop entry point

**Files:**
- Create: `components/storefront/LoyaltyBadge.tsx`
- Create: `components/storefront/views/CheckoutView.tsx`
- Create: `app/(storefront)/commander/page.tsx`

**Interfaces:**
- Consumes: `useStorefront` (`cart`, `kyc`, `setKycField`, `sending`, `setSending`, `clearCart`, `resetKyc`); `useShop.submitWebOrder`, `WebCartLine` type; `validateKyc`, `KycFieldErrors` from `lib/validators/kyc.ts`; `Breadcrumb` (Task 5); `stripe` (Task 2); `cartSubtotal` (Plan 1).
- Produces: this is the task that closes the loop — a submitted order here becomes visible in the back-office's `/admin/commandes` (wired in Plan 1 Task 12) and, once validated there, deducts stock (visible back on the storefront via `effectiveStock`).

- [ ] **Step 1: Create `LoyaltyBadge`**

Create `components/storefront/LoyaltyBadge.tsx`:

```tsx
export function LoyaltyBadge({ points }: { points: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#0b6e4d", background: "#E6F4EE", padding: "8px 12px", borderRadius: 999, marginTop: 14 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#C9A227" stroke="none"><path d="M12 2 15 9l7 .5-5.5 4.5L18.5 21 12 17l-6.5 4 2-7L2 9.5 9 9Z" /></svg>
      +{points} points de fidélité
    </div>
  );
}
```

- [ ] **Step 2: Create `CheckoutView`**

Create `components/storefront/views/CheckoutView.tsx`. This is where `submitWebOrder` is called — note the total is derived entirely inside `useShop` from the line items sent, never from a client-computed number, and stock is untouched until the back-office validates the order (Plan 1 Task 12):

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fonts, colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { LoyaltyBadge } from "@/components/storefront/LoyaltyBadge";
import { stripe } from "@/lib/theme/storefront";
import { useStorefront } from "@/lib/store/useStorefront";
import { useShop, type WebCartLine } from "@/lib/store/useShop";
import { validateKyc, type KycFieldErrors } from "@/lib/validators/kyc";
import { cartSubtotal } from "@/lib/store/cartLogic";
import { money, fmt } from "@/lib/format";

export function CheckoutView() {
  const router = useRouter();
  const cart = useStorefront((s) => s.cart);
  const kyc = useStorefront((s) => s.kyc);
  const setKycField = useStorefront((s) => s.setKycField);
  const sending = useStorefront((s) => s.sending);
  const setSending = useStorefront((s) => s.setSending);
  const clearCart = useStorefront((s) => s.clearCart);
  const resetKyc = useStorefront((s) => s.resetKyc);
  const submitWebOrder = useShop((s) => s.submitWebOrder);

  const [errors, setErrors] = useState<KycFieldErrors>({});
  const subtotal = cartSubtotal(cart);

  if (cart.length === 0) {
    return (
      <div className="ft-store-page" style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
        <p style={{ color: colors.muted, marginBottom: 12 }}>Votre panier est vide.</p>
        <Link href="/catalogue" style={{ color: colors.primary, fontWeight: 600 }}>Découvrir la boutique →</Link>
      </div>
    );
  }

  const handleSubmit = () => {
    const result = validateKyc(kyc);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSending(true);

    const lines: WebCartLine[] = cart.map((l) => ({
      productId: l.productId,
      name: l.name,
      variant: l.variant,
      price: l.price,
      qty: l.qty,
    }));

    setTimeout(() => {
      const order = submitWebOrder(result.data, lines);
      setSending(false);
      clearCart();
      resetKyc();
      router.push(`/confirmation?ref=${encodeURIComponent(order.id)}&name=${encodeURIComponent(order.client)}`);
    }, 600);
  };

  return (
    <div className="ft-store-page" style={{ maxWidth: 860, margin: "0 auto" }}>
      <Breadcrumb items={[{ label: "Panier", href: "/panier" }, { label: "Ma demande" }]} />
      <h1 className="ft-store-h1" style={{ fontFamily: fonts.display, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-.01em" }}>
        Envoyer ma demande
      </h1>
      <p style={{ fontSize: 14, color: colors.muted, margin: "0 0 22px" }}>
        Quelques informations et c&apos;est parti — aucun paiement maintenant.
      </p>

      <div className="ft-store-checkout-layout" style={{ display: "grid", gap: 20, alignItems: "start" }}>
        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: "26px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: colors.bgInfo, borderRadius: 12, padding: "14px 16px", marginBottom: 24 }}>
            <Icon path={ICONS.info} size={20} stroke={colors.primary} strokeWidth={1.75} style={{ flex: "none" }} />
            <span style={{ fontSize: 13.5, color: colors.primary, fontWeight: 500, lineHeight: 1.45 }}>
              La gérante vous contactera pour confirmer votre commande, le mode de livraison et le paiement.
            </span>
          </div>

          <Field label="Nom complet *" error={errors.name}>
            <input value={kyc.name} onChange={(e) => setKycField("name", e.target.value)} placeholder="Ex. Aya Koffi" style={inputStyle(!!errors.name)} />
          </Field>
          <Field label="Lieu de livraison *" error={errors.place}>
            <input value={kyc.place} onChange={(e) => setKycField("place", e.target.value)} placeholder="Ex. Plateau, Abidjan — quartier / repère" style={inputStyle(!!errors.place)} />
          </Field>
          <Field label="Numéro de contact *" error={errors.phone}>
            <input value={kyc.phone} onChange={(e) => setKycField("phone", e.target.value)} placeholder="Ex. +225 07 12 45 67 89" style={inputStyle(!!errors.phone)} />
          </Field>
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: "block", font: `600 13px ${fonts.ui}`, marginBottom: 7 }}>Note (optionnel)</label>
            <textarea
              value={kyc.note}
              onChange={(e) => setKycField("note", e.target.value)}
              placeholder="Une précision sur votre commande…"
              style={{ width: "100%", height: 80, padding: "12px 14px", border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", font: `400 15px ${fonts.ui}`, color: colors.ink, outline: "none", resize: "none" }}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 22 }}>
            <span
              onClick={() => setKycField("wa", !kyc.wa)}
              style={{ width: 44, height: 26, borderRadius: 999, background: kyc.wa ? colors.success : colors.borderField, position: "relative", flex: "none" }}
            >
              <span style={{ position: "absolute", top: 3, left: kyc.wa ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.2)", transition: "left .15s" }} />
            </span>
            <span style={{ fontSize: 14 }}>Être recontactée par WhatsApp</span>
          </label>

          <button
            onClick={handleSubmit}
            disabled={sending}
            style={{ width: "100%", height: 52, border: "none", borderRadius: 10, background: colors.accent, color: "#fff", font: `700 16px ${fonts.ui}`, cursor: sending ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          >
            {sending && <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: 999, display: "inline-block", animation: "ft-spin .7s linear infinite" }} />}
            {sending ? "Envoi…" : "Envoyer ma demande"}
          </button>
        </div>

        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: 22 }}>
          <div style={{ font: `600 15px ${fonts.ui}`, marginBottom: 16 }}>Votre demande</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            {cart.map((line) => (
              <div key={line.key} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 44, height: 54, flex: "none", borderRadius: 8, background: stripe(line.colorHex) }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: `600 13.5px ${fonts.ui}`, lineHeight: 1.2 }}>{line.name}</div>
                  <div style={{ fontSize: 11.5, color: colors.muted }}>× {line.qty} · {line.variant}</div>
                </div>
                <div style={{ font: `700 13.5px ${fonts.ui}`, color: colors.primary }}>{fmt(line.price * line.qty)}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: "#EAE4D9", marginBottom: 14 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ font: `600 14px ${fonts.ui}` }}>Total estimé</span>
            <span style={{ font: `700 20px ${fonts.ui}`, color: colors.primary }}>{money(subtotal)}</span>
          </div>
          <LoyaltyBadge points={Math.round(subtotal / 500)} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", font: `600 13px ${fonts.ui}`, marginBottom: 7 }}>{label}</label>
      {children}
      {error && <p style={{ font: `500 12.5px ${fonts.ui}`, color: "#9c352d", margin: "7px 0 0" }}>{error}</p>}
    </div>
  );
}

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: "100%", height: 48, padding: "0 14px",
    border: `1.5px solid ${hasError ? colors.danger : colors.borderField}`,
    borderRadius: 10, background: "#fff", font: `400 15px ${fonts.ui}`, color: colors.ink, outline: "none",
  };
}
```

- [ ] **Step 3: Create the Checkout page**

Create `app/(storefront)/commander/page.tsx`:

```tsx
import { CheckoutView } from "@/components/storefront/views/CheckoutView";

export default function CheckoutPage() {
  return <CheckoutView />;
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Manually verify KYC validation, including the international phone requirement**

Run: `npm run dev`. With items in the cart, open `http://localhost:3000/commander`.

Click "Envoyer ma demande" with all fields empty — three inline errors appear ("Merci d'indiquer votre nom.", "Indiquez où livrer.", "Un numéro pour vous joindre.") and nothing is submitted.

Fill in name "Aya Koffi", place "Cocody, Abidjan", phone "+225 07 12 45 67 89" — submit succeeds: the button shows a spinner briefly, then the page navigates to `/confirmation?ref=...&name=Aya+Koffi` (a 404 for now — built in Task 9). The cart is now empty (check `/panier`).

Repeat with a **non-Ivorian** phone number, e.g. place "Paris, France", phone "+33 6 12 34 56 78" — confirm this **also succeeds** (this is the sub-region/international requirement from the spec — the field must not reject a foreign country code).

Empty the cart with no active order and visit `/commander` directly — confirm the "Votre panier est vide" guard shows instead of a broken form.

Stop the dev server once confirmed (full loop back into the back-office is verified in Task 11).

- [ ] **Step 6: Commit**

```bash
git add components/storefront/LoyaltyBadge.tsx components/storefront/views/CheckoutView.tsx "app/(storefront)/commander/page.tsx"
git commit -m "feat: add the Checkout/KYC page, closing the storefront-to-back-office order loop"
```

---

### Task 9: Confirmation page

**Files:**
- Create: `components/storefront/views/ConfirmView.tsx`
- Create: `app/(storefront)/confirmation/page.tsx`

**Interfaces:**
- Consumes: `ref`/`name` query params set by Task 8's `router.push(`/confirmation?ref=...&name=...`)`. No store reads — purely a landing page.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Create `ConfirmView`**

Create `components/storefront/views/ConfirmView.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fonts, colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";

const STEPS = [
  { title: "En attente de confirmation", desc: "Nous avons bien reçu votre demande." },
  { title: "Confirmée", desc: "La gérante valide la disponibilité et le prix." },
  { title: "En préparation", desc: "Vos articles sont emballés avec soin." },
  { title: "Livrée", desc: "Remise en main propre ou par livreur." },
];

export function ConfirmView() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref") ?? "#TER-0000";
  const name = searchParams.get("name") ?? "";

  return (
    <div className="ft-store-page" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="ft-store-conf-pad" style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 999, background: "#E6F4EE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
          <Icon path={ICONS.check} size={32} stroke={colors.success} strokeWidth={2} />
        </div>
        <h1 className="ft-store-h1" style={{ fontFamily: fonts.display, fontWeight: 600, margin: "0 0 8px", letterSpacing: "-.01em" }}>
          Demande envoyée !
        </h1>
        <p style={{ fontSize: 15, color: colors.muted, margin: "0 auto 6px", maxWidth: 420, lineHeight: 1.55 }}>
          Merci {name}. La gérante vous contactera très vite pour confirmer votre commande.
        </p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, font: `600 13px ${fonts.ui}`, color: colors.primary, background: colors.bgInfo, padding: "6px 14px", borderRadius: 999, marginTop: 8 }}>
          Commande {ref}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: "26px 28px", marginTop: 16 }}>
        <div style={{ font: `600 15px ${fonts.ui}`, marginBottom: 22 }}>Suivi de la demande</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {STEPS.map((step, i) => {
            const active = i === 0;
            const last = i === STEPS.length - 1;
            return (
              <div key={step.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
                  <span style={{ width: 30, height: 30, borderRadius: 999, background: active ? colors.success : "#F1ECE2", display: "flex", alignItems: "center", justifyContent: "center", color: active ? "#fff" : "#9a8f7d", font: `700 13px ${fonts.ui}` }}>
                    {active ? "●" : i + 1}
                  </span>
                  {!last && <span style={{ width: 2, height: 26, background: "#EAE4D9" }} />}
                </div>
                <div style={{ paddingBottom: last ? 0 : 18 }}>
                  <div style={{ font: `600 14.5px ${fonts.ui}`, color: active ? colors.ink : "#9a8f7d" }}>{step.title}</div>
                  <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>{step.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        <a href="#" style={{ flex: 1, minWidth: 180, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, height: 50, borderRadius: 10, background: colors.success, color: "#fff", font: `700 15px ${fonts.ui}` }}>
          <Icon path={ICONS.whatsapp} size={20} stroke="#fff" strokeWidth={1.75} />
          Suivre sur WhatsApp
        </a>
        <Link href="/compte" style={{ flex: 1, minWidth: 180, height: 50, border: `1.5px solid ${colors.primary}`, borderRadius: 10, background: "#fff", color: colors.primary, font: `600 15px ${fonts.ui}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          Voir mes commandes
        </Link>
      </div>
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <Link href="/catalogue" style={{ font: `600 14px ${fonts.ui}`, color: colors.primary }}>
          Continuer mes achats →
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the Confirmation page**

Create `app/(storefront)/confirmation/page.tsx` (again wrapped in `Suspense` for `useSearchParams`):

```tsx
import { Suspense } from "react";
import { ConfirmView } from "@/components/storefront/views/ConfirmView";

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div className="ft-store-page" style={{ maxWidth: 720, margin: "0 auto" }} />}>
      <ConfirmView />
    </Suspense>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manually verify the confirmation page**

Run: `npm run dev`. Complete a checkout (Task 8's flow) and confirm the redirect lands on `/confirmation` showing "Demande envoyée !", "Merci {name}.", the generated order reference in a pill, and a 4-step tracker with only the first step ("En attente de confirmation") highlighted.

Visit `http://localhost:3000/confirmation` directly (no query params) — confirm it falls back to the default `#TER-0000` / empty name rather than crashing.

Stop the dev server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add components/storefront/views/ConfirmView.tsx "app/(storefront)/confirmation/page.tsx"
git commit -m "feat: add the order Confirmation page"
```

---

### Task 10: Account page

**Files:**
- Create: `components/storefront/views/AccountView.tsx`
- Create: `app/(storefront)/compte/page.tsx`

**Interfaces:**
- Consumes: `clients`, `customerHistory` from `lib/data/clients.ts` (existing, unmodified); `initials` from `lib/format.ts`.
- Produces: nothing consumed elsewhere.

This reuses the back-office's existing customer `c1` ("Aya Koffi", 186 points, VIP) as the mock "logged-in" account, instead of inventing a disconnected new persona — the same person the gérante already sees in `/admin/clientes` is the one shopping on the storefront, which is a more honest reflection of "one shared customer base" than a made-up name would be.

- [ ] **Step 1: Create `AccountView`**

Create `components/storefront/views/AccountView.tsx`:

```tsx
import { fonts, colors } from "@/lib/theme/tokens";
import { clients, customerHistory } from "@/lib/data/clients";
import { initials } from "@/lib/format";

const account = clients[0];

export function AccountView() {
  return (
    <div className="ft-store-page" style={{ maxWidth: 920, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
        <span style={{ width: 60, height: 60, flex: "none", borderRadius: 999, background: colors.primary, display: "flex", alignItems: "center", justifyContent: "center", font: `600 22px ${fonts.ui}`, color: "#fff" }}>
          {initials(account.name)}
        </span>
        <div>
          <h1 className="ft-store-h1" style={{ fontFamily: fonts.display, fontWeight: 600, margin: 0, letterSpacing: "-.01em" }}>
            Bonjour, {account.name.split(" ")[0]}
          </h1>
          <div style={{ fontSize: 14, color: colors.muted }}>{account.phone}</div>
        </div>
      </div>

      <div className="ft-store-account-grid" style={{ display: "grid", gap: 16, marginBottom: 16 }}>
        <div style={{ background: "#1E1B18", borderRadius: 16, padding: "22px 24px", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ width: 36, height: 36, borderRadius: 999, background: "#2c2822", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={colors.gold} stroke="none"><path d="M12 2 15 9l7 .5-5.5 4.5L18.5 21 12 17l-6.5 4 2-7L2 9.5 9 9Z" /></svg>
            </span>
            <span style={{ font: `600 13px ${fonts.ui}`, color: "#C9BEB0" }}>Points Teranga</span>
            {account.vip && (
              <span style={{ marginLeft: "auto", font: `700 11px ${fonts.ui}`, padding: "3px 9px", borderRadius: 999, background: "#2c2822", color: colors.gold, border: `1px solid ${colors.gold}` }}>
                Palier Or
              </span>
            )}
          </div>
          <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 38, lineHeight: 1 }}>
            {account.points} <span style={{ fontSize: 16, color: "#C9BEB0" }}>pts</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "#2c2822", margin: "14px 0 8px", overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${Math.min(100, (account.points / 300) * 100)}%`, background: colors.gold }} />
          </div>
          <div style={{ fontSize: 12.5, color: "#C9BEB0" }}>
            {account.points >= 300 ? "Bon de 5% disponible !" : `Plus que ${300 - account.points} points avant votre bon de 5%.`}
          </div>
        </div>
        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: "22px 24px" }}>
          <div style={{ font: `600 14px ${fonts.ui}`, marginBottom: 16 }}>Mes coordonnées</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 14 }}>
            <Row label="Téléphone" value={account.phone} />
            <Row label="Livraison" value={account.place} />
            <Row label="Segment" value={account.seg} valueColor={colors.success} />
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: "22px 24px" }}>
        <div style={{ font: `600 15px ${fonts.ui}`, marginBottom: 16 }}>Historique des commandes</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {customerHistory.map((o, i) => (
            <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderTop: i === 0 ? "none" : "1px solid #EFEAE0" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: `600 14px ${fonts.ui}` }}>{o.id}</div>
                <div style={{ fontSize: 12.5, color: colors.muted }}>{o.date}</div>
              </div>
              <div style={{ font: `700 15px ${fonts.ui}`, color: colors.primary }}>{o.total}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: colors.muted }}>{label}</span>
      <span style={{ fontWeight: 600, color: valueColor }}>{value}</span>
    </div>
  );
}
```

- [ ] **Step 2: Create the Account page**

Create `app/(storefront)/compte/page.tsx`:

```tsx
import { AccountView } from "@/components/storefront/views/AccountView";

export default function AccountPage() {
  return <AccountView />;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manually verify the account page**

Run: `npm run dev`, open `http://localhost:3000/compte`.
Expected: "Bonjour, Aya" with her phone number, a dark points card showing 186 pts with a "Palier Or" badge (since `c1` is VIP), a progress bar, "Mes coordonnées" (phone/place/segment), and an order history list (`#TER-0489`, `#TER-0475`, `#TER-0461` from `customerHistory`).

Stop the dev server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add components/storefront/views/AccountView.tsx "app/(storefront)/compte/page.tsx"
git commit -m "feat: add the Account page, reusing the shared customer record"
```

---

### Task 11: Full-loop acceptance walkthrough

**Files:** none (verification only).

**Interfaces:** none — this task exercises everything built across both plans end-to-end.

- [ ] **Step 1: Full automated verification**

Run: `npm run test`
Expected: every suite from Plan 1 still passes (this plan added no new automated tests — it's UI verified manually, per project convention).

Run: `npm run typecheck && npm run build`
Expected: both succeed with no errors. The build output should list every storefront route (`/`, `/catalogue`, `/produit/[id]`, `/panier`, `/commander`, `/confirmation`, `/compte`) alongside the existing dashboard routes.

- [ ] **Step 2: Full manual order-loop walkthrough**

Run: `npm run dev`, then in a browser:

1. Open `http://localhost:3000/`. Confirm all 9 blocks render in order and the floating "Aperçu des blocs" button works.
2. From the "Nouveautés & best-sellers" grid, add **Foulard soie Kente** (`p2`, stock 6) to the cart via its **+** button. Confirm the toast and the header cart badge (now showing 1).
3. Go to `/produit/p2`, change the color swatch, set quantity to 2, click **Ajouter au panier**. Confirm the cart badge is now 3.
4. Go to `/panier`. Confirm two lines (one qty 1 from the grid add, one qty 2 from the detail page — or one merged line of qty 3, depending on whether the variant strings matched; either is correct behavior per `addLine`'s merge-by-`productId`+`variant` rule). Click **Valider le panier**.
5. On `/commander`, submit the KYC form with name "Fatou Bamba", place "Yopougon, Abidjan", phone "+225 05 33 21 09 44". Confirm the spinner, then the redirect to `/confirmation` with a generated `#TER-27xx` reference and "Merci Fatou Bamba."
6. Open `http://localhost:3000/admin/commandes`. Confirm the new order appears at the top of "À valider", with the correct client name, place, phone, and line items (Foulard soie Kente × 3), and that the sidebar/mobile-nav badge count increased by one.
7. Select the new order and click **Valider**. Confirm the success toast ("Commande validée — stock déduit") and that it moves to "Confirmées".
8. Open `http://localhost:3000/admin/inventaire`. Confirm **Foulard soie Kente**'s "Interne" stock dropped from 6 to 3 (post-deduction of the 3 units ordered).
9. Back on the storefront, open `http://localhost:3000/produit/p2`. Confirm the availability chip now reads "Plus que 3 en stock" (amber, since 3 ≤ 5).
10. Repeat steps 2–7 with an order large enough to fully deplete a low-stock item (e.g. order 3 more of `p2` to bring it to 0), validate it, then confirm `/produit/p2` and `/catalogue` both show the "Épuisé" badge/overlay and a disabled add-to-cart button.
11. On `/commander`, submit an order with a **non-Ivorian** phone/place (e.g. "+221 77 123 45 67", "Dakar, Sénégal") — confirm it's accepted and completes the same loop, proving the sub-region/international requirement holds end-to-end, not just at the unit-test level.
12. Reload the browser at any point in the flow — confirm the cart, order statuses, and stock deductions all persist (localStorage-backed via `useShop`/`useStorefront`).
13. Resize to a mobile viewport (or use device emulation) and repeat a short version of the flow (Home → add to cart via bottom-tab "Boutique" → Panier → Commander) — confirm the hamburger menu, bottom-tab bar, and single-column layouts all work.

Stop the dev server once every step is confirmed.

- [ ] **Step 3: Final commit (if any fixes were needed during the walkthrough)**

If Step 2 surfaced any issue requiring a code change, fix it, re-run the affected verification step, then commit:

```bash
git add -A
git commit -m "fix: address issues found during full storefront-to-back-office walkthrough"
```

If no fixes were needed, this task requires no commit — the walkthrough itself is the deliverable.

---

## Plan-wide Summary

This plan, together with Plan 1, delivers the full spec: a public Vitrine (Home with 9 flexible-content blocks + editor preview, Catalogue, Produit, Panier, Commander/KYC, Confirmation, Compte) genuinely branché to the existing back-office through a shared order/stock engine, behind a host/path-based public/private zone split that's ready for multi-tenant growth without a rewrite. Remaining out-of-scope items (per the spec's §11): Supabase/Prisma, real auth, PWA/offline persistence beyond localStorage, the full drag-and-drop `/(editor)`, and payment — all deliberately deferred, not accidentally missing.
