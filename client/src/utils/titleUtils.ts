import type { CompetitionClass, CompetitionLevel, Dog, DogProgress } from "@my-agility-qs/shared";

/**
 * Calculate earned AKC titles based on dog's current class levels.
 * Returns title abbreviations that should be appended to the registered name.
 * Only shows the highest earned level-progression title per class.
 */
export function calculateEarnedTitles(dogClasses: Array<{ name: CompetitionClass; level: CompetitionLevel }>): string[] {
  const titles: string[] = [];

  // Standard class titles
  const standardClass = dogClasses.find(c => c.name === "Standard");
  if (standardClass) {
    switch (standardClass.level) {
      case "Open":
        titles.push("NA"); // Novice Agility
        break;
      case "Excellent":
        titles.push("OA"); // Open Agility
        break;
      case "Masters":
        titles.push("AX"); // Agility Excellent
        break;
    }
  }

  // Jumpers class titles
  const jumpersClass = dogClasses.find(c => c.name === "Jumpers");
  if (jumpersClass) {
    switch (jumpersClass.level) {
      case "Open":
        titles.push("NAJ");
        break;
      case "Excellent":
        titles.push("OAJ");
        break;
      case "Masters":
        titles.push("AXJ");
        break;
    }
  }

  // FAST class titles (AKC abbreviations: NF, OF, XF)
  const fastClass = dogClasses.find(c => c.name === "FAST");
  if (fastClass) {
    switch (fastClass.level) {
      case "Open":
        titles.push("NF"); // Novice FAST
        break;
      case "Excellent":
        titles.push("OF"); // Open FAST
        break;
      case "Masters":
        titles.push("XF"); // Excellent FAST
        break;
    }
  }

  // T2B titles are cumulative (T2B, T2B2, T2B3...) — handled via progress data, not level-based

  return titles;
}

const MASTERS_STD_TITLES = ["MX", "MXB", "MXS", "MXG"];
const MASTERS_JWW_TITLES = ["MXJ", "MJB", "MJS", "MJG"];
const MASTERS_FAST_TITLES = ["MXF", "MFB", "MFS", "MFG"];

/**
 * AKC title postfix ordering: Standard, JWW, Premier, FAST, T2B.
 * Within each class group, the single highest title is shown.
 */
const TITLE_SORT_ORDER: Record<string, number> = {
  // Standard
  NA: 10, OA: 11, AX: 12, MX: 13, MXB: 14, MXS: 15, MXG: 16,
  // Jumpers
  NAJ: 20, OAJ: 21, AXJ: 22, MXJ: 23, MJB: 24, MJS: 25, MJG: 26,
  // Premier Std (handled dynamically below)
  // Premier JWW (handled dynamically below)
  // FAST
  NF: 40, OF: 41, XF: 42, MXF: 43, MFB: 44, MFS: 45, MFG: 46,
};

function getTitleSortOrder(title: string): number {
  if (TITLE_SORT_ORDER[title] !== undefined) return TITLE_SORT_ORDER[title];
  // Premier Std (PAD, PADB, PADS, PADG, PADC)
  if (title.startsWith("PA")) return 30;
  // Premier JWW (PJD, PJDB, PJDS, PJDG, PJDC)
  if (title.startsWith("PJ")) return 31;
  // T2B, T2B2, T2B3...
  if (title.startsWith("T2B")) return 50;
  return 99;
}

/**
 * Get the highest earned Masters-level title for each class from progress data
 */
function getMastersTitlesFromProgress(dogProgress: DogProgress | undefined): string[] {
  if (!dogProgress) return [];
  const titles: string[] = [];

  // Standard Masters titles
  if (dogProgress.mastersTitles) {
    const stdTitles = dogProgress.mastersTitles.standardTitles || [];
    const highestStd = [...stdTitles].reverse().find(t => t.earned);
    if (highestStd) titles.push(highestStd.title);

    const jwwTitles = dogProgress.mastersTitles.jumpersTitles || [];
    const highestJww = [...jwwTitles].reverse().find(t => t.earned);
    if (highestJww) titles.push(highestJww.title);
  }

  // FAST Masters titles
  if (dogProgress.fastTitles) {
    const highestFast = [...dogProgress.fastTitles].reverse().find(t => t.earned);
    if (highestFast) titles.push(highestFast.title);
  }

  // T2B titles are handled directly in getEarnedTitleSuffixes (cumulative, not level-based)

  return titles;
}

/**
 * Get the highest earned Premier title for each Premier class from progress data
 */
function getPremierTitlesFromProgress(dogProgress: DogProgress | undefined): string[] {
  if (!dogProgress?.premierProgress) return [];
  const titles: string[] = [];

  for (const premier of dogProgress.premierProgress) {
    const highestTier = [...premier.tiers].reverse().find(t => t.earned);
    if (highestTier) titles.push(highestTier.title);
  }

  return titles;
}

/**
 * Get earned title suffixes for a dog, combining level-based and Masters progress titles.
 * Returns an array of title abbreviations (e.g., ["MX", "MXJ", "NF"]).
 */
export function getEarnedTitleSuffixes(dog: Dog, dogProgress: DogProgress | undefined): string[] {
  const levelTitles = calculateEarnedTitles(dog.classes || []);
  const mastersTitles = getMastersTitlesFromProgress(dogProgress);
  const premierTitles = getPremierTitlesFromProgress(dogProgress);
  const finalTitles = [...levelTitles];

  // Replace AX with actual Masters Standard title from progress
  if (mastersTitles.some(t => MASTERS_STD_TITLES.includes(t))) {
    const idx = finalTitles.indexOf("AX");
    if (idx >= 0) finalTitles.splice(idx, 1);
    const stdTitle = mastersTitles.find(t => MASTERS_STD_TITLES.includes(t));
    if (stdTitle) finalTitles.push(stdTitle);
  }

  // Replace AXJ with actual Masters Jumpers title from progress
  if (mastersTitles.some(t => MASTERS_JWW_TITLES.includes(t))) {
    const idx = finalTitles.indexOf("AXJ");
    if (idx >= 0) finalTitles.splice(idx, 1);
    const jwwTitle = mastersTitles.find(t => MASTERS_JWW_TITLES.includes(t));
    if (jwwTitle) finalTitles.push(jwwTitle);
  }

  // Replace XF with actual Masters FAST title from progress
  if (mastersTitles.some(t => MASTERS_FAST_TITLES.includes(t))) {
    const idx = finalTitles.indexOf("XF");
    if (idx >= 0) finalTitles.splice(idx, 1);
    const fastTitle = mastersTitles.find(t => MASTERS_FAST_TITLES.includes(t));
    if (fastTitle) finalTitles.push(fastTitle);
  }

  // Add T2B cumulative title (T2B, T2B2, etc.) — not level-based, comes directly from progress
  if (dogProgress?.t2bTitles) {
    const highestT2b = [...dogProgress.t2bTitles].reverse().find(t => t.earned);
    if (highestT2b) finalTitles.push(highestT2b.title);
  }

  // Add Premier titles
  finalTitles.push(...premierTitles);

  // Sort per AKC convention: highest Masters first, down to Novice, then optional
  finalTitles.sort((a, b) => getTitleSortOrder(a) - getTitleSortOrder(b));

  return finalTitles;
}
