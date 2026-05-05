import { BaselineCounts, CompetitionClass, CompetitionLevel, MastersTitle, MastersTitleProgress, normalizeClassName, Run } from "@my-agility-qs/shared";

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

const baselineQsFor = (
  baseline: BaselineCounts | undefined,
  cls: CompetitionClass
): number => baseline?.perClass?.[cls]?.qs ?? 0;

/**
 * Baseline Qs that count toward Masters-level title tiers (MX/MXB/...).
 * Only Masters-level baseline qs contribute — Novice/Open/Excellent baseline
 * qs feed level advancement instead.
 */
const baselineMastersQsFor = (
  baseline: BaselineCounts | undefined,
  cls: CompetitionClass
): number => {
  const entry = baseline?.perClass?.[cls];
  if (!entry || entry.level !== "Masters") return 0;
  return entry.qs ?? 0;
};

const baselineTop25For = (
  baseline: BaselineCounts | undefined,
  cls: CompetitionClass
): number => baseline?.perClass?.[cls]?.top25 ?? 0;

// Tolerate legacy long-form class names ("Time 2 Beat", "Premier Standard")
// stored on dog.classes[].name by matching via normalizeClassName.
const findDogClass = (
  dogClasses: Array<{ name: CompetitionClass; level: CompetitionLevel }>,
  cls: CompetitionClass
) => dogClasses.find((c) => normalizeClassName(c.name) === cls);

/**
 * Calculate Double Qs from runs.
 * Double Q = Masters Standard + Masters Jumpers qualifying runs on the same date.
 * Adds baseline.doubleQs if a baseline is set.
 */
export function calculateDoubleQs(runs: Run[], baseline?: BaselineCounts): number {
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
  for (const [, dateRuns] of runsByDate.entries()) {
    const hasStandardQ = dateRuns.some(r => r.class === "Standard" && r.qualified);
    const hasJumpersQ = dateRuns.some(r => r.class === "Jumpers" && r.qualified);
    if (hasStandardQ && hasJumpersQ) {
      doubleQs++;
    }
  }

  return doubleQs + (baseline?.doubleQs ?? 0);
}

/**
 * Calculate total MACH points from qualifying runs.
 * Only Masters Standard and Jumpers runs count toward MACH points.
 * Adds baseline.machPoints if a baseline is set.
 */
export function calculateTotalMachPoints(runs: Run[], baseline?: BaselineCounts): number {
  const qualifyingRuns = runs.filter(run =>
    run.qualified &&
    run.level === "Masters" &&
    (run.class === "Standard" || run.class === "Jumpers") &&
    run.machPoints
  );

  const fromRuns = qualifyingRuns.reduce((sum, run) => sum + (run.machPoints || 0), 0);
  return fromRuns + (baseline?.machPoints ?? 0);
}

/**
 * Calculate complete MACH progress including multiple MACHs.
 */
export function calculateMachProgress(runs: Run[], baseline?: BaselineCounts): MachProgress {
  const totalMachPoints = calculateTotalMachPoints(runs, baseline);
  const totalDoubleQs = calculateDoubleQs(runs, baseline);

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
 * Calculate progress for class level advancement.
 * Baseline qs are added at baseline.level (where they were earned).
 */
export function calculateClassProgress(
  runs: Run[],
  targetClass: CompetitionClass,
  baseline?: BaselineCounts
): Map<CompetitionLevel, number> {
  const classRuns = runs.filter(run => run.class === targetClass && run.qualified);
  const levelCounts = new Map<CompetitionLevel, number>();

  for (const run of classRuns) {
    const current = levelCounts.get(run.level) || 0;
    levelCounts.set(run.level, current + 1);
  }

  const classBaseline = baseline?.perClass?.[targetClass];
  if (classBaseline?.qs && classBaseline.qs > 0 && classBaseline.level) {
    const existing = levelCounts.get(classBaseline.level) || 0;
    levelCounts.set(classBaseline.level, existing + classBaseline.qs);
  }

  return levelCounts;
}

/**
 * Check if a dog is MACH eligible (Masters in both Standard and Jumpers)
 */
export function isMachEligible(dogClasses: Array<{ name: CompetitionClass; level: CompetitionLevel }>): boolean {
  const standardClass = findDogClass(dogClasses, "Standard");
  const jumpersClass = findDogClass(dogClasses, "Jumpers");
  return standardClass?.level === "Masters" && jumpersClass?.level === "Masters";
}


/**
 * Calculate Masters-level title progress for Standard and Jumpers classes
 * Includes MX/MXJ (base), MXB/MJB (Bronze), MXS/MJS (Silver), MXG/MJG (Gold), MXC/MJC (Century)
 */
export function calculateMastersTitleProgress(
  runs: Run[],
  dogClasses: Array<{ name: CompetitionClass; level: CompetitionLevel }>,
  baseline?: BaselineCounts
): MastersTitleProgress {
  const standardClass = findDogClass(dogClasses, "Standard");
  const jumpersClass = findDogClass(dogClasses, "Jumpers");

  // Only calculate for dogs that have reached Masters level
  const standardIsMasters = standardClass?.level === "Masters";
  const jumpersIsMasters = jumpersClass?.level === "Masters";

  // Count qualifying runs at Masters level + Masters-level baseline only
  const standardQs = runs.filter(run =>
    run.qualified &&
    run.level === "Masters" &&
    run.class === "Standard"
  ).length + baselineMastersQsFor(baseline, "Standard");

  const jumpersQs = runs.filter(run =>
    run.qualified &&
    run.level === "Masters" &&
    run.class === "Jumpers"
  ).length + baselineMastersQsFor(baseline, "Jumpers");

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
export function calculateFastTitleProgress(
  runs: Run[],
  dogClasses: Array<{ name: CompetitionClass; level: CompetitionLevel }>,
  baseline?: BaselineCounts
): MastersTitle[] {
  const fastClass = findDogClass(dogClasses, "FAST");
  const fastIsMasters = fastClass?.level === "Masters";

  // Count qualifying runs at Masters level + Masters-level baseline only
  const fastQs = runs.filter(run =>
    run.qualified &&
    run.level === "Masters" &&
    run.class === "FAST"
  ).length + baselineMastersQsFor(baseline, "FAST");

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

/**
 * Calculate T2B title progress.
 * AKC T2B is a cumulative title: every 15 qualifying runs earns a title.
 * First = T2B, then T2B2, T2B3, etc.
 */
export function calculateT2BTitleProgress(
  runs: Run[],
  dogClasses: Array<{ name: CompetitionClass; level: CompetitionLevel }>,
  baseline?: BaselineCounts
): MastersTitle[] {
  const t2bClass = findDogClass(dogClasses, "T2B");
  if (!t2bClass) return [];

  // Count ALL qualifying T2B runs (across all levels) + baseline
  const totalQs = runs.filter(run =>
    run.qualified && run.class === "T2B"
  ).length + baselineQsFor(baseline, "T2B");

  const qsPerTitle = 15;
  const completeTitles = Math.floor(totalQs / qsPerTitle);
  const qsTowardNext = totalQs % qsPerTitle;

  // Build title entries for earned titles + next in progress
  const titles: MastersTitle[] = [];
  const maxToShow = Math.max(completeTitles + 1, 1); // earned + next
  for (let i = 1; i <= maxToShow; i++) {
    const titleName = i === 1 ? "T2B" : `T2B${i}`;
    titles.push({
      title: titleName,
      level: i === 1 ? "T2B" : `T2B x${i}`,
      earned: i <= completeTitles,
      progress: i <= completeTitles ? qsPerTitle : qsTowardNext,
      needed: qsPerTitle,
    });
  }

  return titles;
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
export function calculatePremierProgress(
  runs: Run[],
  premierClass: "Premier Std" | "Premier JWW",
  baseline?: BaselineCounts
): PremierProgress {
  const classRuns = runs.filter(run => run.class === premierClass && run.qualified);
  const totalQs = classRuns.length + baselineQsFor(baseline, premierClass);
  const topTwentyFivePercentQs =
    classRuns.filter(run => run.topTwentyFivePercent).length +
    baselineTop25For(baseline, premierClass);

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
