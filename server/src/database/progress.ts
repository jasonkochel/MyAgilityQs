import {
  ClassProgress,
  CompetitionClass,
  CompetitionLevel,
  DogProgress,
  normalizeClassName,
} from "@my-agility-qs/shared";
import {
  calculateDoubleQs,
  calculateTotalMachPoints,
  calculateMachProgress,
  calculateMastersTitleProgress,
  calculateFastTitleProgress,
  calculateT2BTitleProgress,
  calculatePremierProgress,
} from "../utils/progressCalculations.js";
import { getDogsByUserId } from "./dogs.js";
import { getRunsByDogId, getRunsByUserId } from "./runs.js";

// Calculate progress for a specific dog
export async function calculateDogProgress(userId: string, dogId: string): Promise<DogProgress> {
  // Get all runs for this dog
  const runs = await getRunsByDogId(dogId);

  // Get dog info
  const dogs = await getDogsByUserId(userId);
  const dog = dogs.find((d) => d.id === dogId);
  const dogName = dog?.name || "Unknown Dog";

  const baseline = dog?.baseline;

  // Initialize class progress tracking
  const classProgressMap = new Map<CompetitionClass, Map<CompetitionLevel, number>>();

  // Process each qualified run for class/level progress
  for (const run of runs) {
    if (!run.qualified) continue;

    // Track class/level Qs
    if (!classProgressMap.has(run.class)) {
      classProgressMap.set(run.class, new Map());
    }
    const levelMap = classProgressMap.get(run.class)!;
    const currentQs = levelMap.get(run.level) || 0;
    levelMap.set(run.level, currentQs + 1);
  }

  // Apply baseline Qs at baseline.level for each baselined class.
  // For classes without a baseline level (T2B/Premier), the baseline is
  // additive in the title calcs but not exposed in the per-level map.
  if (baseline?.perClass) {
    for (const [className, classBaseline] of Object.entries(baseline.perClass)) {
      const baselineQs = classBaseline?.qs ?? 0;
      const baselineLevel = classBaseline?.level;
      if (baselineQs <= 0 || !baselineLevel) continue;
      const cls = className as CompetitionClass;
      if (!classProgressMap.has(cls)) classProgressMap.set(cls, new Map());
      const levelMap = classProgressMap.get(cls)!;
      const existing = levelMap.get(baselineLevel) || 0;
      levelMap.set(baselineLevel, existing + baselineQs);
    }
  }

  // Convert to ClassProgress format
  const classProgress: ClassProgress[] = [];
  for (const [className, levelMap] of classProgressMap.entries()) {
    const levels: { [K in CompetitionLevel]?: number } = {};
    for (const [level, count] of levelMap.entries()) {
      levels[level] = count;
    }
    classProgress.push({
      class: className,
      levels,
    });
  }

  // Calculate MACH-related progress using shared utilities (baseline-aware)
  const doubleQs = calculateDoubleQs(runs, baseline);
  const totalMachPoints = calculateTotalMachPoints(runs, baseline);
  const machProgressData = calculateMachProgress(runs, baseline);

  // Calculate Masters title progress if dog has Masters classes
  const mastersTitles = dog ? calculateMastersTitleProgress(runs, dog.classes, baseline) : undefined;

  // Calculate FAST and T2B title progress
  const fastTitles = dog ? calculateFastTitleProgress(runs, dog.classes, baseline) : undefined;
  const t2bTitles = dog ? calculateT2BTitleProgress(runs, dog.classes, baseline) : undefined;

  // Calculate Premier progress if dog competes in Premier classes.
  // Normalize legacy long-form names ("Premier Standard") back to canonical short form.
  const premierProgress = dog ? (() => {
    const premierClasses = dog.classes
      .map((c) => normalizeClassName(c.name))
      .filter((c): c is "Premier Std" | "Premier JWW" => c === "Premier Std" || c === "Premier JWW");
    if (premierClasses.length === 0) return undefined;
    return premierClasses.map((cls) => calculatePremierProgress(runs, cls, baseline));
  })() : undefined;

  const progress: DogProgress = {
    dogId,
    dogName,
    classProgress,
    doubleQs,
    machProgress: totalMachPoints, // Total MACH points (not capped)
    completeMachs: machProgressData.completeMachs,
    mastersTitles,
    fastTitles,
    t2bTitles,
    premierProgress,
  };

  return progress;
}

// Get progress for all dogs owned by a user
export async function getAllDogsProgress(userId: string): Promise<DogProgress[]> {
  const dogs = await getDogsByUserId(userId);
  const progressList: DogProgress[] = [];

  for (const dog of dogs.filter((d) => d.active)) {
    const progress = await calculateDogProgress(userId, dog.id);
    progressList.push(progress);
  }

  return progressList;
}

// Calculate and store summary progress for a user
export async function calculateUserProgressSummary(userId: string): Promise<{
  totalDogs: number;
  totalRuns: number;
  totalQs: number;
  totalDoubleQs: number;
  totalMachPoints: number;
  dogsWithMach: number;
}> {
  const dogs = await getDogsByUserId(userId);
  const runs = await getRunsByUserId(userId);

  const activeDogs = dogs.filter((d) => d.active);
  const qualifiedRuns = runs.filter((r) => r.qualified);

  // Calculate double Qs and MACH points by dog using shared utilities
  let totalDoubleQs = 0;
  let totalMachPoints = 0;
  let dogsWithMach = 0;

  for (const dog of activeDogs) {
    const dogRuns = runs.filter((r) => r.dogId === dog.id);
    const dogDoubleQs = calculateDoubleQs(dogRuns, dog.baseline);
    const dogMachPoints = calculateTotalMachPoints(dogRuns, dog.baseline);
    const dogMachProgress = calculateMachProgress(dogRuns, dog.baseline);

    totalDoubleQs += dogDoubleQs;
    totalMachPoints += dogMachPoints;

    // Count dogs with at least one complete MACH
    if (dogMachProgress.completeMachs > 0) {
      dogsWithMach++;
    }
  }

  const summary = {
    totalDogs: activeDogs.length,
    totalRuns: runs.length,
    totalQs: qualifiedRuns.length,
    totalDoubleQs,
    totalMachPoints,
    dogsWithMach,
  };

  return summary;
}
