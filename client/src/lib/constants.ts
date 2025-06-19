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

// Map display names to full names for API/database
export const CLASS_DISPLAY_NAMES: Record<string, string> = {
  Standard: "Standard",
  Jumpers: "Jumpers",
  FAST: "FAST",
  T2B: "Time 2 Beat",
  "Premier Std": "Premier Standard",
  "Premier JWW": "Premier Jumpers",
};

// Competition levels (ordered highest to lowest)
export const COMPETITION_LEVELS = ["Masters", "Excellent", "Open", "Novice"] as const;

// Type for competition classes
export type CompetitionClass = (typeof COMPETITION_CLASSES)[number];

// Type for competition levels
export type CompetitionLevel = (typeof COMPETITION_LEVELS)[number];
