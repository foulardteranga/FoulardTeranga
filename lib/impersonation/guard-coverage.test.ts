// lib/impersonation/guard-coverage.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const LIB_ROOT = path.resolve(__dirname, "..");

function listActionFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "generated") continue; // client Prisma généré, pas du code applicatif
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listActionFiles(full));
    } else if (entry === "actions.ts") {
      files.push(full);
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
  "inventory/actions.ts": ["getProductStockMovements"],
  "orders/actions.ts": ["getOrderStatusHistoryAction"],
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
