// lib/impersonation/guard-coverage.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const LIB_ROOT = path.resolve(__dirname, "..");

/**
 * Tout fichier `.ts` sous `lib/` marqué `"use server"` — pas seulement ceux
 * littéralement nommés `actions.ts`. Le scan par nom manquait des fichiers
 * comme `lib/discounts/webActions.ts`, également des Server Actions.
 */
function listActionFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "generated") continue; // client Prisma généré, pas du code applicatif
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listActionFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      const content = readFileSync(full, "utf8");
      if (content.trimStart().startsWith('"use server"')) files.push(full);
    }
  }
  return files;
}

function exportedFunctions(filePath: string): { name: string; bodyText: string }[] {
  const sourceText = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const results: { name: string; bodyText: string }[] = [];
  sourceFile.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      const isExported = (node.modifiers ?? []).some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword);
      if (isExported) results.push({ name: node.name.text, bodyText: node.body.getText(sourceFile) });
      return;
    }
    // `export const foo = async () => { ... }` — non détecté par
    // ts.isFunctionDeclaration ci-dessus, mais tout aussi capable d'être une
    // Server Action non gardée.
    if (ts.isVariableStatement(node)) {
      const isExported = (node.modifiers ?? []).some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword);
      if (!isExported) return;
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
        const initializer = decl.initializer;
        if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
          if (initializer.body) {
            results.push({ name: decl.name.text, bodyText: initializer.body.getText(sourceFile) });
          }
        }
      }
    }
  });
  return results;
}

/**
 * Exemptions, chacune justifiée : authentification du compte lui-même (pas
 * une mutation de données de boutique), lecture pure malgré le nom du fichier,
 * ou déjà gardée par `currentSuperAdmin`/`requireSuperAdmin` — l'impersonation
 * ne s'applique jamais aux actions du prestataire dans SA PROPRE zone
 * plateforme, seulement à ce qu'il fait une fois entré dans une boutique.
 */
const EXEMPT: Record<string, string[]> = {
  "customers/actions.ts": ["signInCustomer", "signUpCustomer", "signOutCustomer"],
  "auth/actions.ts": ["signIn", "signOut", "signInPlatform", "signOutPlatform"],
  "platform/actions.ts": ["createTenant", "updateTenantIdentity", "updateTenantModules"],
  // Actions de la zone plateforme, déjà gardées par `currentSuperAdmin` :
  // l'impersonation ne s'applique jamais à ce que le prestataire fait dans SA
  // PROPRE zone, seulement à ce qu'il fait une fois entré dans une boutique.
  "platform/lifecycle.ts": ["suspendTenant", "reactivateTenant", "archiveTenant"],
  "platform/team.ts": ["resetOwnerPassword", "createTenantOwner"],
  "inventory/actions.ts": ["getProductStockMovements"],
  // submitWebOrder est l'action de checkout de la vitrine publique, appelée
  // par un visiteur non authentifié (fiche KYC uniquement, cf. CLAUDE.md §4) —
  // elle n'a et ne doit avoir aucune garde de session/rôle, donc jamais une
  // cible du verrou d'écriture de l'impersonation (jamais appelée depuis le
  // back-office owner/staff).
  "orders/actions.ts": ["getOrderStatusHistoryAction", "submitWebOrder"],
  // previewPosDiscount ne fait que des lectures (prisma.customer.findFirst,
  // findPromoByCode) — aucun create/update/delete, c'est un calcul d'aperçu
  // pur (aucun débit ni compteur, voir le commentaire sur la fonction).
  "discounts/actions.ts": ["previewPosDiscount"],
  // lecture pure côté vitrine, aucune écriture (cf. discounts/actions.ts:previewPosDiscount, même nature)
  "discounts/webActions.ts": ["previewWebDiscount"],
  "impersonation/actions.ts": ["startImpersonation", "unlockImpersonationWrite", "endImpersonation"],
};

describe("couverture des gardes d'écriture — lib/**/actions.ts (spec §12, test le plus important du lot)", () => {
  const files = listActionFiles(LIB_ROOT);
  expect(files.length).toBeGreaterThan(0);

  for (const file of files) {
    const relative = path.relative(LIB_ROOT, file).split(path.sep).join("/");
    for (const fn of exportedFunctions(file)) {
      if ((EXEMPT[relative] ?? []).includes(fn.name)) continue;

      it(`${relative} :: ${fn.name} appelle requireWritableSession()`, () => {
        expect(fn.bodyText.includes("requireWritableSession(")).toBe(true);
      });
    }
  }
});
