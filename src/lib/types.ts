// ═══ Data Models ═══
// Future DB migration: each type maps to a table

export interface PantryItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  category: "meat" | "vegetable" | "dairy" | "grain" | "other";
  expiry?: string; // YYYY-MM-DD, optional
}

export interface RecipeIngredient {
  name: string;
  amount: number;     // base amount for baseServings
  unit: string;
  category: string;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  mealType: string[];  // "breakfast" | "lunch" | "dinner" | "snack"
  time: number;        // minutes
  difficulty: "簡単" | "普通" | "本格的";
  baseServings: number;
  ingredients: RecipeIngredient[];
  seasonings: string[];
  steps: string[];
}

export interface MissingItem {
  name: string;
  need: number;
  have: number;
  deficit: number;
  unit: string;
}

export interface RankedRecipe extends Recipe {
  scaledIngredients: (RecipeIngredient & { required: number })[];
  missingItems: MissingItem[];
  missingCount: number;
  missingAmount: number;
  useUpScore: number;
  scale: number;
}

export interface RankingOptions {
  servings: number;
  mealType: string;
  mealCount: number;
  maxMissing: number;
}

export interface AppSettings {
  servings: number;
  mealType: string;
  mealCount: number;
}

export interface AppData {
  pantry: PantryItem[];
  settings: AppSettings;
  favorites: string[];       // recipe ids
  cookHistory: CookEvent[];
}

export interface CookEvent {
  recipeId: string;
  cookedAt: string; // ISO
  servings: number;
}

// ═══ Analytics Events ═══
export type AnalyticsEvent =
  | "generate_viewed"
  | "recipe_opened"
  | "cooked_clicked"
  | "shopping_list_copied"
  | "pantry_edited"
  | "mode_switched";

export interface AnalyticsProps {
  missing_items_count?: number;
  mealType?: string;
  peopleCount?: number;
  mealCount?: number;
  deviceType?: string;
  returningUser?: boolean;
  recipe?: string;
  action?: string;
  [key: string]: unknown;
}
