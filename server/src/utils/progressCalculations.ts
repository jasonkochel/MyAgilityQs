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

  // Define title requirements
  const titleRequirements = [
    { title: "MX", level: "Masters", needed: 10 }, // Base title requires 10 Qs in Masters
    { title: "MXB", level: "Bronze", needed: 25 },
    { title: "MXS", level: "Silver", needed: 50 },
    { title: "MXG", level: "Gold", needed: 75 },
    { title: "MXC", level: "Century", needed: 100 }
  ];

  const jumpersRequirements = [
    { title: "MXJ", level: "Masters", needed: 10 }, // Base title requires 10 Qs in Masters
    { title: "MJB", level: "Bronze", needed: 25 },
    { title: "MJS", level: "Silver", needed: 50 },
    { title: "MJG", level: "Gold", needed: 75 },
    { title: "MJC", level: "Century", needed: 100 }
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

  // Define FAST title requirements
  const titleRequirements = [
    { title: "MXF", level: "Masters", needed: 10 }, // Base title requires 10 Qs in Masters
    { title: "MFB", level: "Bronze", needed: 25 },
    { title: "MFS", level: "Silver", needed: 50 },
    { title: "MFG", level: "Gold", needed: 75 },
    { title: "MFC", level: "Century", needed: 100 }
  ];

  return titleRequirements.map(req => ({
    title: req.title,
    level: req.level,
    earned: fastIsMasters && fastQs >= req.needed,
    progress: fastIsMasters ? Math.min(fastQs, req.needed) : 0,
    needed: req.needed
  }));
}

/**
 * Calculate title progress for Premier Standard class
 * Includes PAD (base), PADB (Bronze), PADS (Silver), PADG (Gold), PADC (Century)
 * Premier requires 25 Qs for base title, then 25 more for each advanced title
 */
export function calculatePremierStdTitleProgress(runs: any[], dogClasses: Array<{ name: CompetitionClass; level: CompetitionLevel }>): MastersTitle[] {
  const premierClass = dogClasses.find(c => c.name === "Premier Std");
  const premierIsMasters = premierClass?.level === "Masters";

  // Count all qualifying runs (Premier only has Masters level)
  const premierQs = runs.filter(run =>
    run.qualified &&
    run.class === "Premier Std"
  ).length;

  // Define Premier Standard title requirements
  const titleRequirements = [
    { title: "PAD", level: "Premier", needed: 25 }, // Base title requires 25 Qs
    { title: "PADB", level: "Bronze", needed: 50 },  // Additional 25 Qs
    { title: "PADS", level: "Silver", needed: 75 },  // Additional 25 Qs
    { title: "PADG", level: "Gold", needed: 100 },   // Additional 25 Qs
    { title: "PADC", level: "Century", needed: 125 } // Additional 25 Qs
  ];

  return titleRequirements.map(req => ({
    title: req.title,
    level: req.level,
    earned: premierIsMasters && premierQs >= req.needed,
    progress: premierIsMasters ? Math.min(premierQs, req.needed) : 0,
    needed: req.needed
  }));
}

/**
 * Calculate title progress for Premier Jumpers class
 * Includes PJD (base), PJDB (Bronze), PJDS (Silver), PJDG (Gold), PJDC (Century)
 * Premier requires 25 Qs for base title, then 25 more for each advanced title
 */
export function calculatePremierJwwTitleProgress(runs: any[], dogClasses: Array<{ name: CompetitionClass; level: CompetitionLevel }>): MastersTitle[] {
  const premierClass = dogClasses.find(c => c.name === "Premier JWW");
  const premierIsMasters = premierClass?.level === "Masters";

  // Count all qualifying runs (Premier only has Masters level)
  const premierQs = runs.filter(run =>
    run.qualified &&
    run.class === "Premier JWW"
  ).length;

  // Define Premier Jumpers title requirements
  const titleRequirements = [
    { title: "PJD", level: "Premier", needed: 25 }, // Base title requires 25 Qs
    { title: "PJDB", level: "Bronze", needed: 50 },  // Additional 25 Qs
    { title: "PJDS", level: "Silver", needed: 75 },  // Additional 25 Qs
    { title: "PJDG", level: "Gold", needed: 100 },   // Additional 25 Qs
    { title: "PJDC", level: "Century", needed: 125 } // Additional 25 Qs
  ];

  return titleRequirements.map(req => ({
    title: req.title,
    level: req.level,
    earned: premierIsMasters && premierQs >= req.needed,
    progress: premierIsMasters ? Math.min(premierQs, req.needed) : 0,
    needed: req.needed
  }));
}