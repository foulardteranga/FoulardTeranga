# Product

## Register

product

## Users

Foulard Teranga is a mono-shop omnichannel commerce platform (Côte d'Ivoire), architected for a future
multi-shop SaaS. It has two distinct audiences with two distinct surfaces:

- **The shop owner ("gérante") and her staff**, in the existing back-office dashboard: POS,
  inventory, orders, customers, marketing. Not developers; busy retail operators.
- **The platform operator ("prestataire", role `super_admin`)**, in the platform console this task
  is polishing: a small internal tool for provisioning shops, adjusting their module access, and
  (in later phases) impersonating an owner for support, suspending/archiving shops, and monitoring
  the fleet. Currently a single operator managing a single shop, built to scale to many.

This PRODUCT.md's scope is the **platform console** (`components/platform/**`,
`app/(admin)/(console)/**`) — an internal admin tool, not the customer-facing storefront or the
shop-owner dashboard, each of which has its own visual identity (the storefront is themeable per
shop; the dashboard follows the shop's own branding). The platform console deliberately does NOT
use a shop's theme tokens — it belongs to the operator, not to any one shop.

## Product Purpose

Let the platform operator manage the shop fleet without touching SQL or code: create a shop
(owner account + default data), adjust which feature modules a shop has enabled, edit a shop's
identity/domain settings, and (future phases) suspend/archive shops, impersonate an owner for
support, and monitor the fleet. Success looks like: an operator can fully provision and adjust a
shop through the UI alone, with zero ambiguity about what an action will do before they commit to
it (module changes have real, immediate effect on a live shop's access — the UI must never let
that feel casual).

## Brand Personality

Sober, technical, efficient — a professional tool, not a consumer product. Reference points:
Linear, Stripe Dashboard, Vercel — dense, neutral, no decorative flourish. Thin borders over
shadows (`adminBorder`, already established in `lib/theme/tokens.ts`). Desktop-first by design
(fleet management is a desk activity), with a stacked-card fallback on small screens rather than a
fully responsive redesign.

## Anti-references

Not a generic SaaS dashboard template: no gradients, no uniform hero-metric cards, no stock-icon
decoration, no side-stripe accent borders, no gradient text, no tiny uppercase tracked eyebrows
above every section. If it could be mistaken for an unstyled admin-panel generator, it has failed.

## Design Principles

- **Clarity over decoration.** Every visual choice should earn its place by helping the operator
  read state or act correctly, faster — not by looking finished.
- **The stakes are real, so the UI must never feel casual.** Actions here (module toggles, tenant
  creation) have immediate, real effect on a live shop. Destructive or high-consequence actions
  need unambiguous confirmation; nothing should be a silent one-click surprise.
- **Density is a feature here, not a compromise.** Unlike the customer-facing storefront, this is a
  professional tool used by one operator, at a desk, repeatedly. Favor information density and
  scanability over generous whitespace.
- **The console has its own identity, independent of any shop's theme.** Never reach for a shop's
  `--color-*` theme tokens; this space belongs to the operator, not a shop's customers.
- **Match, don't clash with, the platform's other zones.** The console shares the codebase's
  existing token system (`lib/theme/tokens.ts`) rather than inventing a parallel one.

## Accessibility & Inclusion

WCAG AA minimum: semantic HTML, labels correctly associated with form fields, visible focus
states, AA color contrast for body and interactive text. No motion-dependent affordances (this is
largely a static, form-and-table-driven surface with minimal animation surface area).
