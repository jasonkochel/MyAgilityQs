import { CompetitionClass, CompetitionLevel, Run } from './types';

export interface ProgressionRule {
  /** Starting level for this rule */
  fromLevel: CompetitionLevel;
  /** Number of qualifying runs required at fromLevel */
  qualifyingRunsRequired: number;
  /** Level to advance to (null means stay at current level) */
  toLevel: CompetitionLevel | null;
  /** Title earned when this rule is satisfied */
  titleEarned?: string;
  /** Additional qualifying runs required at toLevel (for titles like MX) */
  additionalQsAtToLevel?: number;
}

export interface ClassProgressionRules {
  /** Competition class these rules apply to */
  class: CompetitionClass;
  /** Starting level for new dogs in this class */
  startingLevel: CompetitionLevel;
  /** Ordered list of progression rules (evaluated in order) */
  rules: ProgressionRule[];
}

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
    startingLevel: "Open", // Premier classes start at Open
    rules: [
      {
        fromLevel: "Open",
        qualifyingRunsRequired: 3,
        toLevel: "Excellent",
        titleEarned: "OP"
      },
      {
        fromLevel: "Excellent",
        qualifyingRunsRequired: 3,
        toLevel: "Masters",
        titleEarned: "XP"
      },
      {
        fromLevel: "Masters",
        qualifyingRunsRequired: 10,
        toLevel: null, // Stay at Masters
        titleEarned: "MP"
      }
    ]
  },
  {
    class: "Premier JWW",
    startingLevel: "Open", // Premier classes start at Open
    rules: [
      {
        fromLevel: "Open",
        qualifyingRunsRequired: 3,
        toLevel: "Excellent", 
        titleEarned: "OPJ"
      },
      {
        fromLevel: "Excellent",
        qualifyingRunsRequired: 3,
        toLevel: "Masters",
        titleEarned: "XPJ"
      },
      {
        fromLevel: "Masters",
        qualifyingRunsRequired: 10,
        toLevel: null, // Stay at Masters
        titleEarned: "MPJ"
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
 * Result of level computation for a dog in a specific class
 */
export interface LevelComputationResult {
  /** Current level the dog should be at */
  currentLevel: CompetitionLevel;
  /** Titles earned in this class */
  titlesEarned: string[];
  /** Qualifying runs at current level */
  qualifyingRunsAtCurrentLevel: number;
  /** Next progression rule that applies (null if at terminal level) */
  nextRule: ProgressionRule | null;
  /** Whether this dog has progressed from their starting level */
  hasProgressed: boolean;
}

/**
 * Compute a dog's current level and progress in a specific competition class
 * based on their complete run history
 */
export function computeDogLevel(
  runs: Run[], 
  competitionClass: CompetitionClass
): LevelComputationResult {
  const rules = getProgressionRules(competitionClass);
  if (!rules) {
    throw new Error(`No progression rules found for class: ${competitionClass}`);
  }

  // Filter runs for this class only and sort by date
  const classRuns = runs
    .filter(run => run.class === competitionClass)
    .sort((a, b) => a.date.localeCompare(b.date));

  let currentLevel = rules.startingLevel;
  const titlesEarned: string[] = [];
  
  // Process each rule in order to find the highest level achieved
  for (const rule of rules.rules) {
    // Count qualifying runs at the rule's fromLevel
    const qsAtLevel = classRuns.filter(run => 
      run.level === rule.fromLevel && run.qualified
    ).length;
    
    // If this rule is satisfied, advance level and record title
    if (qsAtLevel >= rule.qualifyingRunsRequired) {
      if (rule.toLevel) {
        currentLevel = rule.toLevel;
      }
      if (rule.titleEarned) {
        titlesEarned.push(rule.titleEarned);
      }
    }
  }

  // Count current qualifying runs at the computed level
  const qualifyingRunsAtCurrentLevel = classRuns.filter(run =>
    run.level === currentLevel && run.qualified
  ).length;

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
 * Compute levels for all classes a dog competes in
 */
export function computeAllDogLevels(runs: Run[]): Record<CompetitionClass, LevelComputationResult> {
  const result: Record<string, LevelComputationResult> = {};
  
  // Get unique classes from runs
  const classesInRuns = [...new Set(runs.map(run => run.class))];
  
  for (const competitionClass of classesInRuns) {
    result[competitionClass] = computeDogLevel(runs, competitionClass);
  }
  
  return result as Record<CompetitionClass, LevelComputationResult>;
}