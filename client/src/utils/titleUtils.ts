import type { CompetitionClass, CompetitionLevel } from "@my-agility-qs/shared";

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