import {
  ClassProgress,
  CompetitionClass,
  CompetitionLevel,
  DogProgress,
} from "@my-agility-qs/shared";
import {
  calculateDoubleQs,
  calculateTotalMachPoints,
  calculateMachProgress,
  calculateMastersTitleProgress,
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

  // Calculate MACH-related progress using shared utilities
  const doubleQs = calculateDoubleQs(runs);
  const totalMachPoints = calculateTotalMachPoints(runs);
  const machProgressData = calculateMachProgress(runs);

  // Calculate Masters title progress if dog has Masters classes
  const mastersTitles = dog ? calculateMastersTitleProgress(runs, dog.classes) : undefined;

  const progress: DogProgress = {
    dogId,
    dogName,
    classProgress,
    doubleQs,
    machProgress: totalMachPoints, // Total MACH points (not capped)
    completeMachs: machProgressData.completeMachs,
    mastersTitles,
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
    const dogDoubleQs = calculateDoubleQs(dogRuns);
    const dogMachPoints = calculateTotalMachPoints(dogRuns);
    const dogMachProgress = calculateMachProgress(dogRuns);

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
