import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  ClassProgress,
  CompetitionClass,
  CompetitionLevel,
  DogProgress,
} from "@my-agility-qs/shared";
import { createTimestamp, dynamoClient, KeyPatterns, TABLE_NAME } from "./client.js";
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
  let doubleQs = 0;
  let totalMachPoints = 0;

  // Process each run
  for (const run of runs) {
    if (!run.qualified) continue;

    // Track class/level Qs
    if (!classProgressMap.has(run.class)) {
      classProgressMap.set(run.class, new Map());
    }
    const levelMap = classProgressMap.get(run.class)!;
    const currentQs = levelMap.get(run.level) || 0;
    levelMap.set(run.level, currentQs + 1);

    // Track MACH points
    if (run.machPoints) {
      totalMachPoints += run.machPoints;
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

  // Calculate Double Qs (need both Standard and Jumpers Q on same day)
  const runsByDate = new Map<string, typeof runs>();
  for (const run of runs.filter((r) => r.qualified)) {
    if (!runsByDate.has(run.date)) {
      runsByDate.set(run.date, []);
    }
    runsByDate.get(run.date)!.push(run);
  }

  for (const [date, dateRuns] of runsByDate.entries()) {
    const hasStandardQ = dateRuns.some((r) => r.class === "Standard" && r.qualified);
    const hasJumpersQ = dateRuns.some((r) => r.class === "Jumpers" && r.qualified);
    if (hasStandardQ && hasJumpersQ) {
      doubleQs++;
    }
  }

  const progress: DogProgress = {
    dogId,
    dogName,
    classProgress,
    doubleQs,
    machProgress: Math.min(totalMachPoints, 20), // Cap at 20 for MACH
  };

  // Store calculated progress
  await storeDogProgress(userId, progress);

  return progress;
}

// Store dog progress in database
async function storeDogProgress(userId: string, progress: DogProgress): Promise<void> {
  const keys = KeyPatterns.dogProgress(userId, progress.dogId);

  await dynamoClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...keys,
        ...progress,
        calculatedAt: createTimestamp(),
        EntityType: "DOG_PROGRESS",
      },
    })
  );
}

// Get stored dog progress (returns cached version)
export async function getDogProgress(userId: string, dogId: string): Promise<DogProgress | null> {
  const keys = KeyPatterns.dogProgress(userId, dogId);

  const result = await dynamoClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: keys,
    })
  );

  if (!result.Item) {
    return null;
  }

  // Remove DynamoDB-specific fields
  const { PK, SK, EntityType, calculatedAt, ...progress } = result.Item;
  return progress as DogProgress;
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

  // Calculate double Qs across all dogs
  const runsByDate = new Map<string, typeof runs>();
  for (const run of qualifiedRuns) {
    if (!runsByDate.has(run.date)) {
      runsByDate.set(run.date, []);
    }
    runsByDate.get(run.date)!.push(run);
  }

  let totalDoubleQs = 0;
  for (const [date, dateRuns] of runsByDate.entries()) {
    const hasStandardQ = dateRuns.some((r) => r.class === "Standard" && r.qualified);
    const hasJumpersQ = dateRuns.some((r) => r.class === "Jumpers" && r.qualified);
    if (hasStandardQ && hasJumpersQ) {
      totalDoubleQs++;
    }
  }

  const totalMachPoints = runs.reduce((sum, run) => sum + (run.machPoints || 0), 0);

  // Calculate dogs with MACH
  let dogsWithMach = 0;
  for (const dog of activeDogs) {
    const dogRuns = runs.filter((r) => r.dogId === dog.id);
    const dogMachPoints = dogRuns.reduce((sum, run) => sum + (run.machPoints || 0), 0);
    if (dogMachPoints >= 20) {
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

  // Store summary
  const keys = KeyPatterns.userProgressSummary(userId);
  await dynamoClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...keys,
        ...summary,
        calculatedAt: createTimestamp(),
        EntityType: "USER_PROGRESS_SUMMARY",
      },
    })
  );

  return summary;
}

// Get stored user progress summary
export async function getUserProgressSummary(userId: string) {
  const keys = KeyPatterns.userProgressSummary(userId);

  const result = await dynamoClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: keys,
    })
  );

  if (!result.Item) {
    return null;
  }

  // Remove DynamoDB-specific fields
  const { PK, SK, EntityType, calculatedAt, ...summary } = result.Item;
  return summary;
}
