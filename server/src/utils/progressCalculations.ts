import { CompetitionClass, CompetitionLevel, MastersTitle, MastersTitleProgress } from "@my-agility-qs/shared";

export interface MachProgress {
  completeMachs: number;
  nextMachNumber: number;
  pointsTowardNext: number;
  doubleQsTowardNext: number;
  totalMachPoints: number;
  totalDoubleQs: number;
  pointsProgress: string; // e.g., "250/750"
  doubleQProgress: string; // e.g., "5/20"
}

/**
 * Calculate Double Qs from runs
 * Double Q = Masters Standard + Masters Jumpers qualifying runs on the same date
 */
export function calculateDoubleQs(runs: any[]): number {
  // Only Masters level Standard and Jumpers qualify for Double Qs
  const mastersRuns = runs.filter(run => 
    run.qualified && 
    run.level === "Masters" && 
    (run.class === "Standard" || run.class === "Jumpers")
  );

  // Group runs by date
  const runsByDate = new Map<string, any[]>();
  for (const run of mastersRuns) {
    if (!runsByDate.has(run.date)) {
      runsByDate.set(run.date, []);
    }
    runsByDate.get(run.date)!.push(run);
  }

  // Count dates with both Standard and Jumpers Qs
  let doubleQs = 0;
  for (const [, dateRuns] of runsByDate.entries()) {
    const hasStandardQ = dateRuns.some(r => r.class === "Standard" && r.qualified);
    const hasJumpersQ = dateRuns.some(r => r.class === "Jumpers" && r.qualified);
    if (hasStandardQ && hasJumpersQ) {
      doubleQs++;
    }
  }

  return doubleQs;
}

/**
 * Calculate total MACH points from qualifying runs
 * Only Masters Standard and Jumpers runs count toward MACH points
 */
export function calculateTotalMachPoints(runs: any[]): number {
  const qualifyingRuns = runs.filter(run => 
    run.qualified && 
    run.level === "Masters" && 
    (run.class === "Standard" || run.class === "Jumpers") &&
    run.machPoints
  );

  return qualifyingRuns.reduce((sum, run) => sum + (run.machPoints || 0), 0);
}

/**
 * Calculate complete MACH progress including multiple MACHs
 */
export function calculateMachProgress(runs: any[]): MachProgress {
  const totalMachPoints = calculateTotalMachPoints(runs);
  const totalDoubleQs = calculateDoubleQs(runs);
  
  // How many complete MACHs earned?
  // A MACH requires both 750 points AND 20 Double Qs
  const completeMachs = Math.min(
    Math.floor(totalMachPoints / 750),
    Math.floor(totalDoubleQs / 20)
  );
  
  // Progress toward next MACH
  const pointsTowardNext = totalMachPoints - (completeMachs * 750);
  const doubleQsTowardNext = totalDoubleQs - (completeMachs * 20);
  
  return {
    completeMachs,
    nextMachNumber: completeMachs + 1,
    pointsTowardNext,
    doubleQsTowardNext, 
    totalMachPoints,
    totalDoubleQs,
    pointsProgress: `${pointsTowardNext}/750`,
    doubleQProgress: `${doubleQsTowardNext}/20`
  };
}

/**
 * Calculate progress for class level advancement
 */
export function calculateClassProgress(runs: any[], targetClass: CompetitionClass): Map<CompetitionLevel, number> {
  const classRuns = runs.filter(run => run.class === targetClass && run.qualified);
  const levelCounts = new Map<CompetitionLevel, number>();
  
  for (const run of classRuns) {
    const current = levelCounts.get(run.level) || 0;
    levelCounts.set(run.level, current + 1);
  }
  
  return levelCounts;
}

/**
 * Check if a dog is MACH eligible (Masters in both Standard and Jumpers)
 */
export function isMachEligible(dogClasses: Array<{ name: CompetitionClass; level: CompetitionLevel }>): boolean {
  const standardClass = dogClasses.find(c => c.name === "Standard");
  const jumpersClass = dogClasses.find(c => c.name === "Jumpers");
  return standardClass?.level === "Masters" && jumpersClass?.level === "Masters";
}


/**
 * Calculate Masters-level title progress for Standard and Jumpers classes
 * Includes MX/MXJ (base), MXB/MJB (Bronze), MXS/MJS (Silver), MXG/MJG (Gold), MXC/MJC (Century)
 */
export function calculateMastersTitleProgress(runs: any[], dogClasses: Array<{ name: CompetitionClass; level: CompetitionLevel }>): MastersTitleProgress {
  const standardClass = dogClasses.find(c => c.name === "Standard");
  const jumpersClass = dogClasses.find(c => c.name === "Jumpers");

  // Only calculate for dogs that have reached Masters level
  const standardIsMasters = standardClass?.level === "Masters";
  const jumpersIsMasters = jumpersClass?.level === "Masters";

  // Count qualifying runs at Masters level
  const standardQs = runs.filter(run =>
    run.qualified &&
    run.level === "Masters" &&
    run.class === "Standard"
  ).length;

  const jumpersQs = runs.filter(run =>
    run.qualified &&
    run.level === "Masters" &&
    run.class === "Jumpers"
  ).length;

  // Define title requirements (AKC rules)
  const titleRequirements = [
    { title: "MX", level: "Masters", needed: 10 },
    { title: "MXB", level: "Bronze", needed: 25 },
    { title: "MXS", level: "Silver", needed: 50 },
    { title: "MXG", level: "Gold", needed: 100 },
  ];

  const jumpersRequirements = [
    { title: "MXJ", level: "Masters", needed: 10 },
    { title: "MJB", level: "Bronze", needed: 25 },
    { title: "MJS", level: "Silver", needed: 50 },
    { title: "MJG", level: "Gold", needed: 100 },
  ];

  // Calculate Standard titles
  const standardTitles = titleRequirements.map(req => ({
    title: req.title,
    level: req.level,
    earned: standardIsMasters && standardQs >= req.needed,
    progress: standardIsMasters ? Math.min(standardQs, req.needed) : 0,
    needed: req.needed
  }));

  // Calculate Jumpers titles
  const jumpersTitles = jumpersRequirements.map(req => ({
    title: req.title,
    level: req.level,
    earned: jumpersIsMasters && jumpersQs >= req.needed,
    progress: jumpersIsMasters ? Math.min(jumpersQs, req.needed) : 0,
    needed: req.needed
  }));

  return {
    standardTitles,
    jumpersTitles
  };
}

/**
 * Calculate Masters-level title progress for FAST class
 * Includes MXF (base), MFB (Bronze), MFS (Silver), MFG (Gold), MFC (Century)
 */
export function calculateFastTitleProgress(runs: any[], dogClasses: Array<{ name: CompetitionClass; level: CompetitionLevel }>): MastersTitle[] {
  const fastClass = dogClasses.find(c => c.name === "FAST");
  const fastIsMasters = fastClass?.level === "Masters";

  // Count qualifying runs at Masters level
  const fastQs = runs.filter(run =>
    run.qualified &&
    run.level === "Masters" &&
    run.class === "FAST"
  ).length;

  // Define FAST title requirements (AKC rules)
  const titleRequirements = [
    { title: "MXF", level: "Masters", needed: 10 },
    { title: "MFB", level: "Bronze", needed: 25 },
    { title: "MFS", level: "Silver", needed: 50 },
    { title: "MFG", level: "Gold", needed: 100 },
  ];

  return titleRequirements.map(req => ({
    title: req.title,
    level: req.level,
    earned: fastIsMasters && fastQs >= req.needed,
    progress: fastIsMasters ? Math.min(fastQs, req.needed) : 0,
    needed: req.needed
  }));
}

export interface PremierTitleTier {
  title: string; // e.g., "PAD", "PADB", "PADS", "PADG", "PADC"
  level: string; // e.g., "Premier", "Bronze", "Silver", "Gold", "Century"
  earned: boolean;
  qsProgress: number; // Qs toward this tier
  qsNeeded: number; // 25 per tier (cumulative: 25, 50, 75, 100, 125)
  top25Progress: number; // Top-25% placements toward this tier
  top25Needed: number; // 5 per tier (cumulative: 5, 10, 15, 20, 25)
}

export interface PremierProgress {
  class: "Premier Std" | "Premier JWW";
  totalQs: number;
  topTwentyFivePercentQs: number;
  tiers: PremierTitleTier[];
  nextTier: PremierTitleTier | null; // Next unearned tier
}

const PREMIER_STD_TIERS = [
  { title: "PAD", level: "Premier", qsNeeded: 25, top25Needed: 5 },
  { title: "PADB", level: "Bronze", qsNeeded: 50, top25Needed: 10 },
  { title: "PADS", level: "Silver", qsNeeded: 75, top25Needed: 15 },
  { title: "PADG", level: "Gold", qsNeeded: 100, top25Needed: 20 },
  { title: "PADC", level: "Century", qsNeeded: 125, top25Needed: 25 },
];

const PREMIER_JWW_TIERS = [
  { title: "PJD", level: "Premier", qsNeeded: 25, top25Needed: 5 },
  { title: "PJDB", level: "Bronze", qsNeeded: 50, top25Needed: 10 },
  { title: "PJDS", level: "Silver", qsNeeded: 75, top25Needed: 15 },
  { title: "PJDG", level: "Gold", qsNeeded: 100, top25Needed: 20 },
  { title: "PJDC", level: "Century", qsNeeded: 125, top25Needed: 25 },
];

/**
 * Calculate Premier title progress for a specific Premier class.
 * Each tier requires 25 qualifying scores + 5 top-25% placements (cumulative).
 */
export function calculatePremierProgress(runs: any[], premierClass: "Premier Std" | "Premier JWW"): PremierProgress {
  const classRuns = runs.filter(run => run.class === premierClass && run.qualified);
  const totalQs = classRuns.length;
  const topTwentyFivePercentQs = classRuns.filter(run => run.topTwentyFivePercent).length;

  const tierDefs = premierClass === "Premier Std" ? PREMIER_STD_TIERS : PREMIER_JWW_TIERS;

  const tiers: PremierTitleTier[] = tierDefs.map(def => ({
    title: def.title,
    level: def.level,
    earned: totalQs >= def.qsNeeded && topTwentyFivePercentQs >= def.top25Needed,
    qsProgress: Math.min(totalQs, def.qsNeeded),
    qsNeeded: def.qsNeeded,
    top25Progress: Math.min(topTwentyFivePercentQs, def.top25Needed),
    top25Needed: def.top25Needed,
  }));

  const nextTier = tiers.find(t => !t.earned) || null;

  return {
    class: premierClass,
    totalQs,
    topTwentyFivePercentQs,
    tiers,
    nextTier,
  };
}