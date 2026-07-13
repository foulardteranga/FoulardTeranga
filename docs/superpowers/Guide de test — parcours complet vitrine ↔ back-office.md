# Guide de test — parcours complet vitrine ↔ back-office

> Étapes de la Tâche 11 (`docs/superpowers/plans/2026-07-09-storefront-ui.md`), extraites pour un test manuel autonome.
> Contexte : Plan 1 (fondations) et Plan 2 (UI vitrine) sont terminés et doublement revus, mais ce parcours de bout en bout n'a jamais été cliqué réellement — les outils navigateur automatisés étaient indisponibles pendant toute la session d'implémentation.

## Avant de commencer

```bash
npm run dev
```

Si Turbopack panique au démarrage ou lors de la compilation d'un fichier modifié (bug connu, lié au nom du dossier parent « Vibe codé » avec un accent décomposé — indépendant du code), utiliser :

```bash
npx next dev --webpack
```

## Étapes

**1. Accueil** — Ouvrir `/`. Vérifier que les 9 blocs s'affichent dans l'ordre et que le bouton flottant « Aperçu des blocs » fonctionne.

**2. Ajout panier depuis la Home** — Dans « Nouveautés & best-sellers », ajouter **Foulard soie Kente** (`p2`, stock 6) via le bouton **+**. Vérifier le toast et le badge panier (doit passer à 1).

**3. Fiche produit** — Aller sur `/produit/p2`, changer la couleur, mettre la quantité à 2, cliquer **Ajouter au panier**. Badge panier → 3.

**4. Panier** — Aller sur `/panier`. Deux lignes, ou une ligne fusionnée qty 3 (les deux sont correctes selon que la variante correspondait — règle de fusion par `productId` + `variant`). Cliquer **Valider le panier**.

**5. Commander** — Sur `/commander`, remplir : nom « Fatou Bamba », lieu « Yopougon, Abidjan », téléphone « +225 05 33 21 09 44 ». Vérifier le spinner puis la redirection vers `/confirmation` avec une référence `#TER-27xx` et « Merci Fatou Bamba. »

**6. Back-office — nouvelle commande** — Ouvrir `/admin/commandes`. La commande doit apparaître en haut de « À valider » avec le bon nom/lieu/téléphone/articles (Foulard soie Kente × 3), et le badge sidebar doit avoir augmenté de 1.

**7. Validation** — Sélectionner la commande, cliquer **Valider**. Toast de succès (« Commande validée — stock déduit »), passage à « Confirmées ».

**8. Stock déduit** — Ouvrir `/admin/inventaire`. Le stock « Interne » de Foulard soie Kente doit être passé de 6 à 3.

**9. Retour vitrine** — Ouvrir `/produit/p2`. La puce de disponibilité doit afficher « Plus que 3 en stock » (ambre, car 3 ≤ 5).

**10. Épuisement** — Répéter les étapes 2–7 en commandant 3 unités supplémentaires de `p2` pour l'amener à 0, valider. Vérifier que `/produit/p2` et `/catalogue` affichent bien « Épuisé » avec le bouton d'ajout désactivé.

**11. Téléphone international** — Sur `/commander`, soumettre une commande avec un numéro non-ivoirien (ex. « +221 77 123 45 67 », « Dakar, Sénégal »). Doit être accepté et compléter la boucle normalement — preuve que l'exigence sous-régionale/internationale tient de bout en bout, pas seulement au niveau des tests unitaires.

**12. Persistance** — Recharger le navigateur à n'importe quel moment du parcours. Panier, statuts de commande et déductions de stock doivent tous survivre (persistance localStorage via `useShop`/`useStorefront`).

**13. Mobile** — Redimensionner en largeur mobile (ou émulation), répéter une version courte du parcours (Home → onglet « Boutique » → Panier → Commander). Vérifier le menu hamburger, la barre d'onglets bas, et les mises en page une colonne.

## Si un problème est trouvé

Corriger, ré-exécuter l'étape de vérification concernée, puis committer :

```bash
git add -A
git commit -m "fix: address issues found during full storefront-to-back-office walkthrough"
```

Si aucun correctif n'est nécessaire, ce test ne requiert aucun commit — le parcours réussi est lui-même la validation finale du Plan 2.
