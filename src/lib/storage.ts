import type { PantryItem, AppSettings, CookEvent } from "./types";

const KEYS = {
  pantry: "pantry-app:pantry",
  settings: "pantry-app:settings",
  favorites: "pantry-app:favorites",
  cookHistory: "pantry-app:cookHistory",
  anonymousId: "pantry-app:anonymousId",
} as const;

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Storage write failed:", e);
  }
}

// ── Pantry ──
export function loadPantry(): PantryItem[] {
  return safeGet<PantryItem[]>(KEYS.pantry, []);
}
export function savePantry(items: PantryItem[]): void {
  safeSet(KEYS.pantry, items);
}

// ── Settings ──
export function loadSettings(): AppSettings {
  return safeGet<AppSettings>(KEYS.settings, {
    servings: 2,
    mealType: "any",
    mealCount: 1,
  });
}
export function saveSettings(s: AppSettings): void {
  safeSet(KEYS.settings, s);
}

// ── Favorites ──
export function loadFavorites(): string[] {
  return safeGet<string[]>(KEYS.favorites, []);
}
export function saveFavorites(ids: string[]): void {
  safeSet(KEYS.favorites, ids);
}

// ── Cook History ──
export function loadCookHistory(): CookEvent[] {
  return safeGet<CookEvent[]>(KEYS.cookHistory, []);
}
export function addCookEvent(event: CookEvent): void {
  const history = loadCookHistory();
  history.push(event);
  // Keep last 100 events
  safeSet(KEYS.cookHistory, history.slice(-100));
}

// ── Anonymous ID (for analytics) ──
export function getAnonymousId(): string {
  let id = safeGet<string>(KEYS.anonymousId, "");
  if (!id) {
    id = "anon_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    safeSet(KEYS.anonymousId, id);
  }
  return id;
}

// ── Returning user check ──
export function isReturningUser(): boolean {
  return loadPantry().length > 0 || loadCookHistory().length > 0;
}
