/**
 * Competition class constants and mappings
 * Used across Add/Edit Dog and Add Run pages
 */

// Display names for UI (abbreviated for mobile)
export const COMPETITION_CLASSES = [
  "Standard",
  "Jumpers",
  "FAST",
  "T2B", // Time 2 Beat
  "Premier Std", // Premier Standard
  "Premier JWW", // Premier Jumpers With Weaves
] as const;

/**
 * Historically mapped UI display names to longer full names for storage
 * ("T2B" -> "Time 2 Beat", "Premier Std" -> "Premier Standard"). Storage is
 * now normalized to the canonical short form (matching CompetitionClass), so
 * this is an identity map. Kept around because several call sites still use
 * it for value-side lookups; safe to delete once those are removed.
 */
export const CLASS_DISPLAY_NAMES: Record<string, string> = {
  Standard: "Standard",
  Jumpers: "Jumpers",
  FAST: "FAST",
  T2B: "T2B",
  "Premier Std": "Premier Std",
  "Premier JWW": "Premier JWW",
};

// Competition levels (ordered highest to lowest)
export const COMPETITION_LEVELS = ["Masters", "Excellent", "Open", "Novice"] as const;

// Type for competition classes
export type CompetitionClass = (typeof COMPETITION_CLASSES)[number];

// Type for competition levels
export type CompetitionLevel = (typeof COMPETITION_LEVELS)[number];

// Premier class helpers (duplicated from shared due to Vite CJS re-export limitation)
export const PREMIER_CLASSES = ["Premier Std", "Premier JWW"] as const;
export const isPremierClass = (className: string): boolean =>
  className === "Premier Std" || className === "Premier JWW" ||
  className === "Premier Standard" || className === "Premier Jumpers";

/**
 * Sort a list of DogClass-shaped items by canonical AKC display order:
 * Standard, Jumpers, FAST, T2B, Premier Std, Premier JWW. Unknown classes
 * sort to the end (preserving relative order).
 */
export function sortDogClasses<T extends { name: string }>(classes: T[]): T[] {
  const indexOf = (name: string) => {
    const i = (COMPETITION_CLASSES as readonly string[]).indexOf(name);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...classes].sort((a, b) => indexOf(a.name) - indexOf(b.name));
}
