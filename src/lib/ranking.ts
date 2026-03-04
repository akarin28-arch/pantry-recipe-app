import type { PantryItem, Recipe, RankedRecipe, RankingOptions, MissingItem } from "./types";
import { recipes } from "./recipes";

/**
 * Find matching stock item for a recipe ingredient (fuzzy match).
 * Matches exact name, or substring containment in either direction.
 */
function findStock(pantry: PantryItem[], ingredientName: string): PantryItem | null {
  return (
    pantry.find(p => p.name === ingredientName) ||
    pantry.find(p => ingredientName.includes(p.name) || p.name.includes(ingredientName)) ||
    null
  );
}

/**
 * Core ranking function.
 *
 * For each recipe:
 *   1. Scale ingredients by (servings / baseServings) * mealCount
 *   2. Compare with pantry stock to find missing items
 *   3. Score by: missingCount → missingAmount → useUpScore → time
 *
 * Returns sorted array of RankedRecipe filtered by maxMissing.
 */
export function rankRecipes(
  pantry: PantryItem[],
  options: RankingOptions
): RankedRecipe[] {
  const { servings = 2, mealType = "any", mealCount = 1, maxMissing = 0 } = options;
  const today = new Date().toISOString().slice(0, 10);

  const ranked = recipes
    // Filter by meal type
    .filter(r => mealType === "any" || r.mealType.includes(mealType))
    .map(recipe => {
      const scale = (servings / recipe.baseServings) * mealCount;

      // Scale ingredients
      const scaledIngredients = recipe.ingredients.map(ing => ({
        ...ing,
        required: Math.round(ing.amount * scale * 100) / 100,
      }));

      // Calculate missing & use-up score
      const missingItems: MissingItem[] = [];
      let missingAmount = 0;
      let useUpScore = 0;

      for (const ing of scaledIngredients) {
        const stock = findStock(pantry, ing.name);
        const have = stock ? stock.amount : 0;
        const need = ing.required;
        const sameUnit = !stock || stock.unit === ing.unit;

        if (!stock || (sameUnit && have < need)) {
          // Missing or insufficient
          const deficit = sameUnit ? need - have : need;
          missingItems.push({
            name: ing.name,
            need,
            have,
            deficit: Math.round(deficit * 100) / 100,
            unit: ing.unit,
          });
          missingAmount += deficit;
        } else {
          // Available — contribute to use-up score
          const usage = Math.min(need, have);

          if (stock.expiry) {
            if (stock.expiry <= today) {
              // Expired — high priority to use
              useUpScore += usage * 3;
            } else {
              const daysLeft = Math.max(
                0,
                (new Date(stock.expiry).getTime() - Date.now()) / 86400000
              );
              useUpScore += usage * (daysLeft < 3 ? 2 : 1);
            }
          } else {
            useUpScore += usage * 0.5;
          }
        }
      }

      return {
        ...recipe,
        scaledIngredients,
        missingItems,
        missingCount: missingItems.length,
        missingAmount: Math.round(missingAmount * 100) / 100,
        useUpScore: Math.round(useUpScore * 100) / 100,
        scale,
      } satisfies RankedRecipe;
    })
    // Filter by max missing threshold
    .filter(r => r.missingCount <= maxMissing)
    // Sort: missing count → missing amount → use-up score (desc) → time
    .sort((a, b) => {
      if (a.missingCount !== b.missingCount) return a.missingCount - b.missingCount;
      if (a.missingAmount !== b.missingAmount) return a.missingAmount - b.missingAmount;
      if (b.useUpScore !== a.useUpScore) return b.useUpScore - a.useUpScore;
      return a.time - b.time;
    });

  return ranked;
}

/**
 * Apply "cooked" action: decrement pantry by recipe's scaled amounts.
 * Returns new pantry array with updated amounts (items at 0 are removed).
 */
export function decrementPantry(
  pantry: PantryItem[],
  recipe: RankedRecipe
): PantryItem[] {
  const next = pantry.map(p => ({ ...p }));

  for (const ing of recipe.scaledIngredients) {
    const idx = next.findIndex(
      p =>
        (p.name === ing.name ||
          ing.name.includes(p.name) ||
          p.name.includes(ing.name)) &&
        p.unit === ing.unit
    );
    if (idx >= 0) {
      next[idx].amount = Math.max(
        0,
        Math.round((next[idx].amount - ing.required) * 100) / 100
      );
    }
  }

  return next.filter(item => item.amount > 0);
}
