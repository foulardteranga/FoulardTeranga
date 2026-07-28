import { defaultPage, type StorefrontPageContent } from "@/lib/storefront/pageContent";

export interface DefaultEmployeeRole {
  name: string;
  permissions: string[];
}

const VENDEUSE_MODULES = ["pos", "orders", "inv"];
const ADJOINT_EXCLUDED = new Set(["theme", "vitrine"]);

/**
 * Profils d'accès provisionnés à la création (spec §8), bornés aux modules
 * réellement activés : une permission pour un module désactivé serait inerte
 * mais ferait diverger l'UI et les données.
 */
export function defaultEmployeeRoles(enabledModules: string[]): DefaultEmployeeRole[] {
  const enabled = new Set(enabledModules);
  const roles: DefaultEmployeeRole[] = [];

  const vendeuse = VENDEUSE_MODULES.filter((id) => enabled.has(id));
  if (vendeuse.length > 0) roles.push({ name: "Vendeuse", permissions: vendeuse });

  const adjoint = enabledModules.filter((id) => !ADJOINT_EXCLUDED.has(id));
  if (adjoint.length > 0) roles.push({ name: "Gérant adjoint", permissions: adjoint });

  return roles;
}

/**
 * Page d'accueil provisionnée : blocs par défaut, avec hero / grille / contact
 * renseignés au nom de la boutique pour qu'elle ne s'ouvre pas sur le contenu
 * d'exemple d'une autre boutique.
 */
export function initialStorefrontPage(shopName: string): StorefrontPageContent {
  const page = defaultPage();
  return {
    blocks: page.blocks.map((block) => {
      if (block.type === "hero") {
        return {
          ...block,
          settings: {
            ...block.settings,
            eyebrow: "BIENVENUE",
            title: shopName,
            subtitle: `Découvrez les créations de ${shopName}.`,
          },
        };
      }
      if (block.type === "grid") {
        return { ...block, settings: { ...block.settings, title: `Les nouveautés de ${shopName}` } };
      }
      if (block.type === "contact") {
        return { ...block, settings: { ...block.settings, locationTitle: shopName } };
      }
      return block;
    }),
  };
}
