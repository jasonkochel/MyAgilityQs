import type { CompetitionClass, CompetitionLevel, Dog, DogProgress } from "@my-agility-qs/shared";

/**
 * Calculate earned AKC titles based on dog's current class levels
 * Returns title abbreviations that should be appended to the registered name
 */
export function calculateEarnedTitles(dogClasses: Array<{ name: CompetitionClass; level: CompetitionLevel }>): string[] {
  const titles: string[] = [];
  
  // Standard class titles - only show highest earned title
  const standardClass = dogClasses.find(c => c.name === "Standard");
  if (standardClass) {
    switch (standardClass.level) {
      case "Open":
        titles.push("NA"); // Novice Agility (earned by advancing to Open)
        break;
      case "Excellent":
        titles.push("OA"); // Open Agility (highest earned)
        break;
      case "Masters":
        titles.push("AX"); // Agility Excellent (highest earned)
        break;
    }
  }
  
  // Jumpers class titles - only show highest earned title
  const jumpersClass = dogClasses.find(c => c.name === "Jumpers");
  if (jumpersClass) {
    switch (jumpersClass.level) {
      case "Open":
        titles.push("NAJ"); // Novice Agility Jumpers
        break;
      case "Excellent":
        titles.push("OAJ"); // Open Agility Jumpers (highest earned)
        break;
      case "Masters":
        titles.push("AXJ"); // Agility Excellent Jumpers (highest earned)
        break;
    }
  }
  
  // Sort titles in conventional order: Standard first, then Jumpers
  const titleOrder = ["NA", "NAJ", "OA", "OAJ", "AX", "AXJ"];
  return titles.sort((a, b) => titleOrder.indexOf(a) - titleOrder.indexOf(b));
}

const MASTERS_STD_TITLES = ["MX", "MXB", "MXS", "MXG"];
const MASTERS_JWW_TITLES = ["MXJ", "MJB", "MJS", "MJG"];

/**
 * Get the highest earned Masters-level title for Standard and Jumpers from progress data
 */
function getMastersTitlesFromProgress(dogProgress: DogProgress | undefined): string[] {
  if (!dogProgress?.mastersTitles) return [];
  const titles: string[] = [];

  const stdTitles = dogProgress.mastersTitles.standardTitles || [];
  const highestStd = [...stdTitles].reverse().find(t => t.earned);
  if (highestStd) titles.push(highestStd.title);

  const jwwTitles = dogProgress.mastersTitles.jumpersTitles || [];
  const highestJww = [...jwwTitles].reverse().find(t => t.earned);
  if (highestJww) titles.push(highestJww.title);

  return titles;
}

/**
 * Get earned title suffixes for a dog, combining level-based and Masters progress titles.
 * Returns an array of title abbreviations (e.g., ["MX", "MXJ"]).
 */
export function getEarnedTitleSuffixes(dog: Dog, dogProgress: DogProgress | undefined): string[] {
  const levelTitles = calculateEarnedTitles(dog.classes || []);
  const mastersTitles = getMastersTitlesFromProgress(dogProgress);
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

  return finalTitles;
}