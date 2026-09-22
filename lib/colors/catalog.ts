/**
 * Référentiel de couleurs locales pour l'univers des foulards, textiles et accessoires.
 * 100% autonome, sans appel réseau.
 */

export interface ColorEntry {
  name: string;
  hex: string;
  family: string;
  aliases: string[];
}

export const COLOR_CATALOG: ColorEntry[] = [
  // --- Rouges & Vins ---
  { name: "Bordeaux", hex: "#6B1D2F", family: "Rouges & Vins", aliases: ["Burgundy", "Rouge bordeaux", "Lie-de-vin", "Wine"] },
  { name: "Lie-de-vin", hex: "#5E1928", family: "Rouges & Vins", aliases: ["Vin", "Vin rouge", "Bordeaux foncé"] },
  { name: "Grenat", hex: "#6E0F2B", family: "Rouges & Vins", aliases: ["Garnet", "Rouge sombre"] },
  { name: "Carmin", hex: "#960018", family: "Rouges & Vins", aliases: ["Carmine", "Rouge profond"] },
  { name: "Rouge rubis", hex: "#8E001C", family: "Rouges & Vins", aliases: ["Rubis", "Ruby"] },
  { name: "Pourpre", hex: "#7E1E38", family: "Rouges & Vins", aliases: ["Purple", "Pourpre impérial"] },
  { name: "Rouge cerise", hex: "#B0002A", family: "Rouges & Vins", aliases: ["Cerise", "Cherry"] },
  { name: "Rouge vif", hex: "#DC2626", family: "Rouges & Vins", aliases: ["Red", "Rouge feu", "Vermillon"] },
  { name: "Rouge brique", hex: "#A53625", family: "Rouges & Vins", aliases: ["Brique", "Terre rouge"] },

  // --- Terres, Ocres & Bruns ---
  { name: "Terracotta", hex: "#C86442", family: "Terres & Ocres", aliases: ["Terre cuite", "Brique claire", "Rouille douce"] },
  { name: "Rouille", hex: "#B7410E", family: "Terres & Ocres", aliases: ["Rust", "Oxyde"] },
  { name: "Ocre jaune", hex: "#C68B29", family: "Terres & Ocres", aliases: ["Ocre", "Terre d'ocre", "Ochre"] },
  { name: "Ocre rouge", hex: "#9E3821", family: "Terres & Ocres", aliases: ["Terre battue"] },
  { name: "Camel", hex: "#B87842", family: "Bruns & Fauves", aliases: ["Chameau", "Caramel", "Fauve"] },
  { name: "Cannelle", hex: "#8E4B28", family: "Bruns & Fauves", aliases: ["Cinnamon", "Épice"] },
  { name: "Cognac", hex: "#9A4621", family: "Bruns & Fauves", aliases: ["Ambré", "Cuir chaud"] },
  { name: "Chocolat", hex: "#3D2314", family: "Bruns & Fauves", aliases: ["Chocolat noir", "Dark brown"] },
  { name: "Café au lait", hex: "#8D735C", family: "Bruns & Fauves", aliases: ["Latte", "Moka clair"] },
  { name: "Havane", hex: "#704214", family: "Bruns & Fauves", aliases: ["Tabac", "Cigare"] },
  { name: "Marron glacé", hex: "#5B3A29", family: "Bruns & Fauves", aliases: ["Châtaigne", "Brun doux"] },
  { name: "Beige sable", hex: "#D8C4A9", family: "Neutres & Sables", aliases: ["Sable", "Dune", "Beige clair"] },
  { name: "Sable chaud", hex: "#CBB696", family: "Neutres & Sables", aliases: ["Sahara", "Désert"] },
  { name: "Taupe", hex: "#7A6B5D", family: "Neutres & Sables", aliases: ["Gris taupe", "Gris chaud"] },

  // --- Bleus & Indigos ---
  { name: "Indigo", hex: "#26326B", family: "Bleus & Indigos", aliases: ["Indigo africain", "Bleu profond", "Bleu Teranga"] },
  { name: "Bleu nuit", hex: "#1A244D", family: "Bleus & Indigos", aliases: ["Midnight blue", "Marine foncé", "Bleu sombre"] },
  { name: "Bleu marine", hex: "#12203F", family: "Bleus & Indigos", aliases: ["Navy", "Bleu océan"] },
  { name: "Bleu roi", hex: "#1D4ED8", family: "Bleus & Indigos", aliases: ["Royal blue", "Bleu franc"] },
  { name: "Bleu pétrole", hex: "#1C4E5E", family: "Bleus & Indigos", aliases: ["Pétrole", "Canard foncé"] },
  { name: "Bleu canard", hex: "#0E6B7A", family: "Bleus & Indigos", aliases: ["Teal", "Paon"] },
  { name: "Turquoise", hex: "#14B8A6", family: "Bleus & Indigos", aliases: ["Turquoise éclatant", "Bleu lagon"] },
  { name: "Bleu ciel", hex: "#7DD3FC", family: "Bleus & Indigos", aliases: ["Sky blue", "Bleu pastel", "Azur clair"] },
  { name: "Bleu cobalt", hex: "#0047AB", family: "Bleus & Indigos", aliases: ["Cobalt", "Majorelle"] },
  { name: "Bleu denim", hex: "#43658B", family: "Bleus & Indigos", aliases: ["Jean", "Bleu délavé"] },
  { name: "Bleu azur", hex: "#0284C7", family: "Bleus & Indigos", aliases: ["Azur", "Cyan sombre"] },

  // --- Verts & Végétaux ---
  { name: "Vert olive", hex: "#636B46", family: "Verts & Végétaux", aliases: ["Olive", "Kaki clair", "Vert militaire"] },
  { name: "Vert émeraude", hex: "#0E8A5E", family: "Verts & Végétaux", aliases: ["Emerald", "Vert joyau"] },
  { name: "Vert sauge", hex: "#8FA382", family: "Verts & Végétaux", aliases: ["Sage", "Sauge", "Vert grisé"] },
  { name: "Vert bouteille", hex: "#1C422F", family: "Verts & Végétaux", aliases: ["Forest green", "Vert sombre"] },
  { name: "Vert sapin", hex: "#163626", family: "Verts & Végétaux", aliases: ["Sapin", "Vert foncé"] },
  { name: "Kaki", hex: "#555A38", family: "Verts & Végétaux", aliases: ["Khaki", "Kaki militaire"] },
  { name: "Vert menthe", hex: "#6EE7B7", family: "Verts & Végétaux", aliases: ["Mint", "Menthe à l'eau"] },
  { name: "Pistache", hex: "#A3C478", family: "Verts & Végétaux", aliases: ["Pistachio", "Vert tendre"] },
  { name: "Jade", hex: "#00A86B", family: "Verts & Végétaux", aliases: ["Vert jade", "Imperial jade"] },
  { name: "Vert d'eau", hex: "#A7F3D0", family: "Verts & Végétaux", aliases: ["Seafoam", "Pastel vert"] },
  { name: "Vert anis", hex: "#99CC32", family: "Verts & Végétaux", aliases: ["Anis", "Chartreuse"] },

  // --- Jaunes, Or & Épices ---
  { name: "Or", hex: "#C9A227", family: "Jaunes & Épices", aliases: ["Gold", "Doré", "Jaune or"] },
  { name: "Moutarde", hex: "#D99B26", family: "Jaunes & Épices", aliases: ["Mustard", "Jaune moutarde"] },
  { name: "Safran", hex: "#E89B17", family: "Jaunes & Épices", aliases: ["Saffron", "Jaune épice"] },
  { name: "Jaune soleil", hex: "#FACC15", family: "Jaunes & Épices", aliases: ["Yellow", "Jaune vif"] },
  { name: "Miel", hex: "#C68723", family: "Jaunes & Épices", aliases: ["Honey", "Ambré doré"] },
  { name: "Paille", hex: "#E7D393", family: "Jaunes & Épices", aliases: ["Straw", "Jaune pâle"] },
  { name: "Curcuma", hex: "#D67D1E", family: "Jaunes & Épices", aliases: ["Turmeric", "Jaune chaud"] },

  // --- Oranges & Corail ---
  { name: "Corail", hex: "#E05A47", family: "Oranges & Corail", aliases: ["Coral", "Corail vif"] },
  { name: "Pêche", hex: "#FDBA74", family: "Oranges & Corail", aliases: ["Peach", "Pêche douce"] },
  { name: "Saumon", hex: "#F87171", family: "Oranges & Corail", aliases: ["Salmon", "Rose saumon"] },
  { name: "Mandarine", hex: "#EA580C", family: "Oranges & Corail", aliases: ["Orange vif", "Tangerine"] },
  { name: "Abricot", hex: "#FB923C", family: "Oranges & Corail", aliases: ["Apricot", "Orange doux"] },
  { name: "Cuivre", hex: "#B85D36", family: "Oranges & Corail", aliases: ["Copper", "Métal cuivré"] },

  // --- Roses, Violets & Prunes ---
  { name: "Rose poudré", hex: "#DDA7A5", family: "Roses & Pastels", aliases: ["Powder pink", "Rose pâle", "Blush"] },
  { name: "Vieux rose", hex: "#C07D84", family: "Roses & Pastels", aliases: ["Dusty rose", "Rose vintage"] },
  { name: "Fuchsia", hex: "#C026D3", family: "Roses & Pastels", aliases: ["Rose fuchsia", "Magenta vif"] },
  { name: "Framboise", hex: "#BE185D", family: "Roses & Pastels", aliases: ["Raspberry", "Rose baie"] },
  { name: "Prune", hex: "#5C1D48", family: "Violets & Prunes", aliases: ["Plum", "Violet foncé"] },
  { name: "Aubergine", hex: "#431238", family: "Violets & Prunes", aliases: ["Eggplant", "Violet très sombre"] },
  { name: "Mauve", hex: "#A855F7", family: "Violets & Prunes", aliases: ["Purple", "Violet moyen"] },
  { name: "Lilas", hex: "#C4B5FD", family: "Violets & Prunes", aliases: ["Lilac", "Violet pastel"] },
  { name: "Lavande", hex: "#A78BFA", family: "Violets & Prunes", aliases: ["Lavender", "Bleu lavande"] },

  // --- Neutres, Noirs & Blancs ---
  { name: "Ivoire", hex: "#FAF7F2", family: "Neutres & Blancs", aliases: ["Ivory", "Fond Teranga", "Blanc doux"] },
  { name: "Écru", hex: "#F3EDE2", family: "Neutres & Blancs", aliases: ["Ecru", "Lin naturel"] },
  { name: "Crème", hex: "#FDF8EE", family: "Neutres & Blancs", aliases: ["Cream", "Blanc chaud"] },
  { name: "Blanc cassé", hex: "#F5F5F0", family: "Neutres & Blancs", aliases: ["Off-white", "Blanc soie"] },
  { name: "Blanc pur", hex: "#FFFFFF", family: "Neutres & Blancs", aliases: ["White", "Neige"] },
  { name: "Noir chaud", hex: "#1E1B18", family: "Noirs & Gris", aliases: ["Ink", "Noir Teranga", "Encre"] },
  { name: "Noir profond", hex: "#0F0E0D", family: "Noirs & Gris", aliases: ["Black", "Noir absolu"] },
  { name: "Anthracite", hex: "#374151", family: "Noirs & Gris", aliases: ["Charcoal", "Gris foncé"] },
  { name: "Gris perle", hex: "#9CA3AF", family: "Noirs & Gris", aliases: ["Gris moyen", "Silver"] },
  // --- Métaux, Teintes Nude & Autres ---
  { name: "Bronze", hex: "#CD7F32", family: "Jaunes & Épices", aliases: ["Bronze doré", "Métal bronze"] },
  { name: "Cuivre antique", hex: "#8B4513", family: "Oranges & Corail", aliases: ["Vieux cuivre"] },
  { name: "Nude", hex: "#E3BC9A", family: "Neutres & Sables", aliases: ["Peau", "Chair", "Nude beige"] },
  { name: "Caramel", hex: "#C67A26", family: "Bruns & Fauves", aliases: ["Toffee", "Sucre roux"] },
  { name: "Pêche claire", hex: "#FCD5CE", family: "Oranges & Corail", aliases: ["Pêche pastel"] },
  { name: "Bleu glacier", hex: "#E0F2FE", family: "Bleus & Indigos", aliases: ["Ice blue", "Bleu givré"] },
  { name: "Bleu céleste", hex: "#38BDF8", family: "Bleus & Indigos", aliases: ["Bleu ciel vif", "Céleste"] },
  { name: "Jaune paille", hex: "#FDE68A", family: "Jaunes & Épices", aliases: ["Paille clair"] },
  { name: "Mauve poudré", hex: "#E9D5FF", family: "Violets & Prunes", aliases: ["Lilas poudré"] },
  { name: "Terracotta brûlée", hex: "#9C4124", family: "Terres & Ocres", aliases: ["Terracotta foncée"] },
  { name: "Vert sauge doux", hex: "#A3B899", family: "Verts & Végétaux", aliases: ["Sauge clair"] },
  { name: "Champagne", hex: "#F7E7CE", family: "Neutres & Blancs", aliases: ["Doré pâle", "Satin champagne"] },
  { name: "Bleu profond", hex: "#0B1936", family: "Bleus & Indigos", aliases: ["Bleu foncé", "Bleu nuit intense", "Marine sombre"] },
];

/**
 * Normalise une chaîne pour la recherche : minuscules, suppression des accents et tirets.
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_']/g, " ")
    .trim();
}

/**
 * Recherche des teintes par nom, famille ou alias.
 * Peut combiner les teintes natives avec les teintes personnalisées d'un tenant.
 */
export function searchColors(
  query: string,
  customColors: Array<{ name: string; hex: string; family?: string | null; aliases?: string[] }> = []
): ColorEntry[] {
  const q = normalize(query);
  if (!q) {
    // Par défaut, retourner les teintes les plus emblématiques en premier
    return [
      ...customColors.map((c) => ({
        name: c.name,
        hex: c.hex,
        family: c.family || "Personnalisées",
        aliases: c.aliases || [],
      })),
      ...COLOR_CATALOG.slice(0, 16),
    ];
  }

  const all: ColorEntry[] = [
    ...customColors.map((c) => ({
      name: c.name,
      hex: c.hex,
      family: c.family || "Personnalisées",
      aliases: c.aliases || [],
    })),
    ...COLOR_CATALOG,
  ];

  const words = q.split(/\s+/).filter(Boolean);
  const scored: Array<{ entry: ColorEntry; score: number }> = [];

  for (const entry of all) {
    const normName = normalize(entry.name);
    const corpus = `${normName} ${entry.aliases.map(normalize).join(" ")} ${normalize(entry.family)}`;
    let score = 0;

    if (normName === q) {
      score = 100;
    } else if (normName.startsWith(q)) {
      score = 80;
    } else if (normName.includes(q)) {
      score = 65;
    } else if (entry.aliases.some((a) => normalize(a) === q || normalize(a).startsWith(q))) {
      score = 60;
    } else if (entry.aliases.some((a) => normalize(a).includes(q))) {
      score = 50;
    } else if (words.length > 1 && words.every((w) => corpus.includes(w))) {
      score = 45;
    } else if (normalize(entry.family).includes(q)) {
      score = 30;
    } else if (words.some((w) => corpus.includes(w))) {
      score = 20;
    }

    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  // Dédupliquer par code hex et nom
  const seen = new Set<string>();
  const results: ColorEntry[] = [];
  for (const item of scored) {
    const key = `${item.entry.hex.toLowerCase()}-${normalize(item.entry.name)}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push(item.entry);
    }
  }

  return results;
}
