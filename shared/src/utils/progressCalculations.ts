import { Run, CompetitionLevel, CompetitionClass } from '../types.js';

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
export function calculateDoubleQs(runs: Run[]): number {
  // Only Masters level Standard and Jumpers qualify for Double Qs
  const mastersRuns = runs.filter(run => 
    run.qualified && 
    run.level === "Masters" && 
    (run.class === "Standard" || run.class === "Jumpers")
  );

  // Group runs by date
  const runsByDate = new Map<string, Run[]>();
  for (const run of mastersRuns) {
    if (!runsByDate.has(run.date)) {
      runsByDate.set(run.date, []);
    }
    runsByDate.get(run.date)!.push(run);
  }

  // Count dates with both Standard and Jumpers Qs
  let doubleQs = 0;
  for (const [date, dateRuns] of runsByDate.entries()) {
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
export function calculateTotalMachPoints(runs: Run[]): number {
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
export function calculateMachProgress(runs: Run[]): MachProgress {
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
export function calculateClassProgress(runs: Run[], targetClass: CompetitionClass): Map<CompetitionLevel, number> {
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