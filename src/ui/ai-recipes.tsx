import { useState } from "preact/hooks";
import {
  RECIPE_STORAGE,
  parseRecipeLibrary,
  recipeLibrary,
  type SavedRecipe,
} from "../ai/recipes";

export function RecipeLibrary({
  es,
  busy,
  current,
  onUse,
}: {
  es: boolean;
  busy: boolean;
  current: Omit<SavedRecipe, "favorite"> | null;
  onUse: (recipe: SavedRecipe) => void;
}) {
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(RECIPE_STORAGE);
      return {
        items: raw ? parseRecipeLibrary(JSON.parse(raw)) : [],
        error: "",
      };
    } catch {
      return { items: [], error: "load" };
    }
  });
  const [storageError, setStorageError] = useState(initial.error);
  const [items, setItems] = useState<SavedRecipe[]>(initial.items);
  const [query, setQuery] = useState(""),
    [name, setName] = useState(""),
    [favorites, setFavorites] = useState(false);
  const [deleted, setDeleted] = useState<SavedRecipe | null>(null);
  const [message, setMessage] = useState("");
  const save = (next: SavedRecipe[]) => {
    if (storageError === "load") return false;
    try {
      const valid = parseRecipeLibrary(recipeLibrary(next));
      localStorage.setItem(
        RECIPE_STORAGE,
        JSON.stringify(recipeLibrary(valid)),
      );
      setItems(valid);
      setStorageError("");
      return true;
    } catch {
      setStorageError("save");
      return false;
    }
  };
  const visible = items
    .filter(
      (v) =>
        (!favorites || v.favorite) &&
        `${v.recipe.name} ${v.recipe.prompt} ${v.recipe.style}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(b.favorite) - Number(a.favorite) ||
        a.recipe.name.localeCompare(b.recipe.name),
    );
  return (
    <details class="ai-catalog" id="aiRecipeLibrary">
      <summary>
        {es ? "Mis recetas" : "My recipes"} · {items.length}
      </summary>
      <p>
        {es
          ? "Guarda el prompt, los ajustes y el sonido elegido en este navegador. El contexto se toma del proyecto al usarlas; no se guardan sus notas."
          : "Save the prompt, settings and chosen sound in this browser. Context comes from the project when used; its notes are not stored."}
      </p>
      <div class="ai-catalog-filters">
        <label>
          {es ? "Nombre de la receta" : "Recipe name"}
          <input
            id="aiRecipeName"
            maxLength={80}
            value={name}
            disabled={busy}
            onInput={(e) => setName(e.currentTarget.value)}
          />
        </label>
        <button
          id="saveAIRecipe"
          type="button"
          disabled={
            busy ||
            !current ||
            !name.trim() ||
            items.length >= 100 ||
            storageError === "load"
          }
          onClick={() => {
            if (
              current &&
              save([
                ...items,
                {
                  ...current,
                  recipe: {
                    ...current.recipe,
                    id: crypto.randomUUID(),
                    name: name.trim(),
                  },
                  favorite: false,
                },
              ])
            ) {
              setName("");
              setMessage(es ? "Receta guardada." : "Recipe saved.");
            }
          }}
        >
          {es ? "Guardar receta actual" : "Save current recipe"}
        </button>
      </div>
      <div class="ai-catalog-filters">
        <label>
          {es ? "Buscar mis recetas" : "Search my recipes"}
          <input
            id="aiRecipeSearch"
            type="search"
            value={query}
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
        </label>
        <button
          type="button"
          aria-pressed={favorites}
          onClick={() => setFavorites(!favorites)}
        >
          {es ? "★ Favoritas" : "★ Favorites"}
        </button>
      </div>
      <ul class="ai-preset-list">
        {visible.map((item) => (
          <li key={item.recipe.id} data-ai-recipe={item.recipe.id}>
            <b>{item.recipe.name}</b>
            <small>
              {item.recipe.style} · {item.recipe.tempo} BPM · {item.recipe.bars}{" "}
              {es ? "compases" : "bars"} ·{" "}
              {item.sound?.name ?? (es ? "sonido actual" : "current sound")}
            </small>
            <div class="ai-actions">
              <button type="button" disabled={busy} onClick={() => onUse(item)}>
                {es ? "Usar receta" : "Use recipe"}
              </button>
              <button
                type="button"
                disabled={busy}
                aria-pressed={item.favorite}
                aria-label={`${es ? "Favorita" : "Favorite"}: ${item.recipe.name}`}
                onClick={() =>
                  save(
                    items.map((v) =>
                      v === item ? { ...v, favorite: !v.favorite } : v,
                    ),
                  )
                }
              >
                {item.favorite ? "★" : "☆"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (save(items.filter((v) => v !== item))) setDeleted(item);
                }}
              >
                {es ? "Eliminar" : "Delete"}
              </button>
            </div>
            <details>
              <summary>{es ? "Cambiar nombre" : "Rename"}</summary>
              <form
                class="ai-actions"
                onSubmit={(e) => {
                  e.preventDefault();
                  const next = String(
                    new FormData(e.currentTarget).get("name") ?? "",
                  ).trim();
                  if (next)
                    save(
                      items.map((v) =>
                        v === item
                          ? { ...v, recipe: { ...v.recipe, name: next } }
                          : v,
                      ),
                    );
                }}
              >
                <input
                  name="name"
                  aria-label={es ? "Nuevo nombre" : "New name"}
                  defaultValue={item.recipe.name}
                  maxLength={80}
                  required
                  disabled={busy}
                />
                <button disabled={busy}>
                  {es ? "Guardar nombre" : "Save name"}
                </button>
              </form>
            </details>
          </li>
        ))}
      </ul>
      {!visible.length && (
        <p>{es ? "No hay recetas que mostrar." : "No recipes to show."}</p>
      )}
      {deleted && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (save([...items, deleted])) setDeleted(null);
          }}
        >
          {es ? "Deshacer borrado" : "Undo delete"}: {deleted.recipe.name}
        </button>
      )}
      {storageError && (
        <p role="alert">
          {es
            ? "No se pudo leer o guardar la biblioteca local. No se ha sobrescrito ningún dato."
            : "Could not read or save the local library. No data was overwritten."}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
