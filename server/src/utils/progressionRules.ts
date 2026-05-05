import { BaselineClassCounts, CompetitionClass, CompetitionLevel, Run, ClassProgressionRules, LevelComputationResult } from "@my-agility-qs/shared";

const LEVEL_ORDER: CompetitionLevel[] = ["Novice", "Open", "Excellent", "Masters"];

const levelIndex = (level: CompetitionLevel): number => LEVEL_ORDER.indexOf(level);

/**
 * AKC Agility Progression Rules
 * Rules are evaluated in order - the highest applicable rule determines the dog's level
 */
export const AKC_PROGRESSION_RULES: ClassProgressionRules[] = [
  {
    class: "Standard",
    startingLevel: "Novice",
    rules: [
      {
        fromLevel: "Novice",
        qualifyingRunsRequired: 3,
        toLevel: "Open",
        titleEarned: "NA"
      },
      {
        fromLevel: "Open", 
        qualifyingRunsRequired: 3,
        toLevel: "Excellent",
        titleEarned: "OA"
      },
      {
        fromLevel: "Excellent",
        qualifyingRunsRequired: 3,
        toLevel: "Masters",
        titleEarned: "AX"
      },
      {
        fromLevel: "Masters",
        qualifyingRunsRequired: 10,
        toLevel: null, // Stay at Masters
        titleEarned: "MX"
      }
    ]
  },
  {
    class: "Jumpers",
    startingLevel: "Novice", 
    rules: [
      {
        fromLevel: "Novice",
        qualifyingRunsRequired: 3,
        toLevel: "Open",
        titleEarned: "NAJ"
      },
      {
        fromLevel: "Open",
        qualifyingRunsRequired: 3, 
        toLevel: "Excellent",
        titleEarned: "OAJ"
      },
      {
        fromLevel: "Excellent",
        qualifyingRunsRequired: 3,
        toLevel: "Masters",
        titleEarned: "AXJ"
      },
      {
        fromLevel: "Masters",
        qualifyingRunsRequired: 10,
        toLevel: null, // Stay at Masters
        titleEarned: "MXJ"
      }
    ]
  },
  {
    class: "T2B",
    startingLevel: "Novice",
    rules: [
      {
        fromLevel: "Novice",
        qualifyingRunsRequired: 3,
        toLevel: "Open",
        titleEarned: "NAT"
      },
      {
        fromLevel: "Open", 
        qualifyingRunsRequired: 3,
        toLevel: "Excellent",
        titleEarned: "OAT"
      },
      {
        fromLevel: "Excellent",
        qualifyingRunsRequired: 3,
        toLevel: "Masters",
        titleEarned: "AXT"
      },
      {
        fromLevel: "Masters",
        qualifyingRunsRequired: 10,
        toLevel: null, // Stay at Masters
        titleEarned: "MXT"
      }
    ]
  },
  {
    class: "FAST",
    startingLevel: "Novice",
    rules: [
      {
        fromLevel: "Novice",
        qualifyingRunsRequired: 3,
        toLevel: "Open", 
        titleEarned: "NAF"
      },
      {
        fromLevel: "Open",
        qualifyingRunsRequired: 3,
        toLevel: "Excellent",
        titleEarned: "OAF"
      },
      {
        fromLevel: "Excellent", 
        qualifyingRunsRequired: 3,
        toLevel: "Masters",
        titleEarned: "AXF"
      },
      {
        fromLevel: "Masters",
        qualifyingRunsRequired: 10,
        toLevel: null, // Stay at Masters
        titleEarned: "MXF"
      }
    ]
  },
  {
    class: "Premier Std",
    startingLevel: "Masters", // Premier is an advanced class, starts and stays at Masters
    rules: [
      {
        fromLevel: "Masters",
        qualifyingRunsRequired: 25,
        toLevel: null, // Stay at Masters
        titleEarned: "PAD" // Premier Agility Dog
      }
    ]
  },
  {
    class: "Premier JWW",
    startingLevel: "Masters", // Premier is an advanced class, starts and stays at Masters
    rules: [
      {
        fromLevel: "Masters",
        qualifyingRunsRequired: 25,
        toLevel: null, // Stay at Masters
        titleEarned: "PJD" // Premier Jumpers Dog
      }
    ]
  }
];

/**
 * Get progression rules for a specific competition class
 */
export function getProgressionRules(competitionClass: CompetitionClass): ClassProgressionRules | undefined {
  return AKC_PROGRESSION_RULES.find(rules => rules.class === competitionClass);
}

/**
 * Get the starting level for a competition class
 */
export function getStartingLevel(competitionClass: CompetitionClass): CompetitionLevel {
  const rules = getProgressionRules(competitionClass);
  return rules?.startingLevel || "Novice";
}

/**
 * Compute a dog's current level and progress in a specific competition class
 * based on their run history and an optional baseline.
 *
 * Rules walk: iterates every progression rule from the class's starting level,
 * counting qualifying Qs at each `fromLevel` (logged runs + baseline qs at that
 * level), advancing currentLevel and recording titles when thresholds are met.
 *
 * Floor clamp: after the walk, currentLevel is clamped to be at least the
 * highest level we have evidence the dog has competed at — the max of the
 * class's starting level, baseline.level, and the highest level appearing in
 * any logged run for this class. A logged Q at Excellent is proof the dog
 * entered Excellent class, so the engine never demotes them below it even if
 * the qualifying count alone wouldn't justify the advancement (e.g. after a
 * baseline that pushed them past a threshold is later removed).
 */
export function computeDogLevel(
  runs: Run[],
  competitionClass: CompetitionClass,
  baseline?: BaselineClassCounts
): LevelComputationResult {
  const rules = getProgressionRules(competitionClass);
  if (!rules) {
    throw new Error(`No progression rules found for class: ${competitionClass}`);
  }

  // Filter runs for this class only and sort by date
  const classRuns = runs
    .filter(run => run.class === competitionClass)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Walk all rules from the starting level so we record titles earned by
  // organic progression (e.g. OA from 3 Open Qs) regardless of whether the
  // dog later jumped further via baseline or back-entered higher-level runs.
  let walkedLevel: CompetitionLevel = rules.startingLevel;
  const titlesEarned: string[] = [];

  for (const rule of rules.rules) {
    const qsFromRuns = classRuns.filter(run =>
      run.level === rule.fromLevel && run.qualified
    ).length;
    const qsFromBaseline =
      baseline?.level === rule.fromLevel ? (baseline.qs ?? 0) : 0;
    const qsAtLevel = qsFromRuns + qsFromBaseline;

    if (qsAtLevel >= rule.qualifyingRunsRequired) {
      if (rule.toLevel) {
        walkedLevel = rule.toLevel;
      }
      if (rule.titleEarned) {
        titlesEarned.push(rule.titleEarned);
      }
    }
  }

  // Floor: the dog's level can't be lower than the highest level we've seen
  // them compete at — either via baseline or a logged run.
  const highestRunLevel = classRuns.reduce<CompetitionLevel | null>((max, run) => {
    if (max === null) return run.level;
    return levelIndex(run.level) > levelIndex(max) ? run.level : max;
  }, null);

  const candidates: CompetitionLevel[] = [rules.startingLevel];
  if (baseline?.level) candidates.push(baseline.level);
  if (highestRunLevel) candidates.push(highestRunLevel);
  const floorLevel = candidates.reduce((max, lvl) =>
    levelIndex(lvl) > levelIndex(max) ? lvl : max
  );

  const currentLevel: CompetitionLevel =
    levelIndex(walkedLevel) >= levelIndex(floorLevel) ? walkedLevel : floorLevel;

  // Count current qualifying runs at the computed level (including baseline at this level)
  const qualifyingRunsAtCurrentLevel =
    classRuns.filter(run => run.level === currentLevel && run.qualified).length +
    (baseline?.level === currentLevel ? (baseline.qs ?? 0) : 0);

  // Find the next applicable rule
  const nextRule = rules.rules.find(rule =>
    rule.fromLevel === currentLevel &&
    qualifyingRunsAtCurrentLevel < rule.qualifyingRunsRequired
  ) || null;

  return {
    currentLevel,
    titlesEarned,
    qualifyingRunsAtCurrentLevel,
    nextRule,
    hasProgressed: currentLevel !== rules.startingLevel
  };
}

/**
 * Compute levels for all classes a dog competes in, given the dog's runs
 * and optional per-class baselines.
 */
export function computeAllDogLevels(
  runs: Run[],
  baselines?: Partial<Record<CompetitionClass, BaselineClassCounts>>
): Record<CompetitionClass, LevelComputationResult> {
  const result: Record<string, LevelComputationResult> = {};

  // Include both classes seen in runs and classes that have baseline entries.
  const classesFromRuns = [...new Set(runs.map(run => run.class))];
  const classesFromBaseline = baselines ? (Object.keys(baselines) as CompetitionClass[]) : [];
  const allClasses = [...new Set([...classesFromRuns, ...classesFromBaseline])];

  for (const competitionClass of allClasses) {
    result[competitionClass] = computeDogLevel(runs, competitionClass, baselines?.[competitionClass]);
  }

  return result as Record<CompetitionClass, LevelComputationResult>;
}