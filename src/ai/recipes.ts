import {
  parsePresetCatalog,
  validateSoundPreset,
  type MelodyRecipe,
  type SoundPreset,
} from "./presets";
import { validateComposition, type CompositionOptions } from "./composer";

export const RECIPE_STORAGE = "kv-ai-recipes-v1";
export interface SavedRecipe {
  recipe: MelodyRecipe;
  composition: CompositionOptions;
  favorite: boolean;
  sound?: SoundPreset;
}
export function parseRecipeLibrary(input: unknown): SavedRecipe[] {
  const value = input as {
    format?: string;
    version?: number;
    recipes?: SavedRecipe[];
  };
  if (
    !value ||
    value.format !== "kiber-vengance-ai-recipes" ||
    value.version !== 1 ||
    !Array.isArray(value.recipes) ||
    value.recipes.length > 100
  )
    throw new Error("Invalid recipe library (maximum 100 recipes).");
  const seen = new Set<string>();
  return value.recipes.map((entry) => {
    if (!entry || typeof entry.favorite !== "boolean")
      throw new Error("Invalid saved recipe.");
    const recipe = parsePresetCatalog({
      format: "kiber-vengance-catalog",
      version: 1,
      presets: [entry.recipe],
    })[0];
    if (!recipe || recipe.kind !== "melody" || seen.has(recipe.id))
      throw new Error("Invalid or duplicate recipe.");
    seen.add(recipe.id);
    return {
      recipe,
      composition: validateComposition(entry.composition),
      favorite: entry.favorite,
      ...(entry.sound ? { sound: validateSoundPreset(entry.sound) } : {}),
    };
  });
}
export const recipeLibrary = (recipes: SavedRecipe[]) => ({
  format: "kiber-vengance-ai-recipes",
  version: 1,
  recipes,
});
