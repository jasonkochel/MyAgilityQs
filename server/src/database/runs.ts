import {
  DeleteCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  CompetitionLevel,
  CreateRunRequest,
  Run,
  RunsQuery,
  UpdateRunRequest,
  computeDogLevel,
  computeAllDogLevels,
  getStartingLevel,
} from "@my-agility-qs/shared";
import {
  createSortableTimestamp,
  createTimestamp,
  dynamoClient,
  generateId,
  TABLE_NAME,
} from "./client.js";
import { getDogById, updateDog } from "./dogs.js";

// Note: countQualifyingRuns function removed - progression logic now uses rules engine

// Helper function to get all runs for a dog (used by progression engine)
async function getAllRunsForDog(dogId: string): Promise<Run[]> {
  return await getRunsByDogId(dogId);
}

// Function to check and update dog levels after a qualifying run using rules engine
async function checkAndUpdateDogLevel(
  userId: string,
  dogId: string,
  competitionClass: string
): Promise<{
  progressed: boolean;
  fromLevel?: string;
  toLevel?: string;
  dogName?: string;
  class?: string;
} | null> {
  // Get all runs for the dog to compute their current level with rules engine
  const allRuns = await getAllRunsForDog(dogId);
  const levelResult = computeDogLevel(allRuns, competitionClass as any);
  
  // Get current dog data
  const dog = await getDogById(dogId);
  if (!dog) {
    throw new Error(`Dog not found: ${dogId}`);
  }

  // Find current level in dog's class configuration
  const dogClass = dog.classes.find(dc => dc.name === competitionClass);
  const currentStoredLevel = dogClass?.level || getStartingLevel(competitionClass as any);

  // Check if the computed level is different from stored level
  if (levelResult.currentLevel !== currentStoredLevel) {
    // Update the specific class level
    const updatedClasses = dog.classes.map((dogClass) =>
      dogClass.name === competitionClass
        ? { ...dogClass, level: levelResult.currentLevel as CompetitionLevel }
        : dogClass
    );

    // Update the dog in the database
    await updateDog(dogId, userId, { classes: updatedClasses });

    console.log(
      `🎉 Auto-progression: ${dog.name} advanced from ${currentStoredLevel} to ${levelResult.currentLevel} in ${competitionClass}`
    );

    return {
      progressed: true,
      fromLevel: currentStoredLevel,
      toLevel: levelResult.currentLevel,
      dogName: dog.name,
      class: competitionClass,
    };
  }

  return { progressed: false };
}

// Recalculate dog levels from scratch based on all runs using rules engine
// This is used after batch imports to ensure correct levels regardless of import order
export async function recalculateDogLevels(userId: string, dogId: string): Promise<void> {
  // Get all runs for this dog
  const allRuns = await getRunsByDogId(dogId);

  // Get current dog data
  const dog = await getDogById(dogId);
  if (!dog) {
    throw new Error(`Dog not found: ${dogId}`);
  }

  // Use rules engine to compute levels for all classes
  const levelResults = computeAllDogLevels(allRuns);

  // Update dog's class levels in database based on computed results
  const updatedClasses = dog.classes.map(dogClass => {
    const levelResult = levelResults[dogClass.name];
    return {
      ...dogClass,
      level: levelResult ? levelResult.currentLevel as CompetitionLevel : dogClass.level
    };
  });

  await updateDog(dogId, userId, { classes: updatedClasses });
  
  // Log the results
  const finalLevels = Object.fromEntries(
    Object.entries(levelResults).map(([className, result]) => [className, result.currentLevel])
  );
  console.log(`📊 Recalculated levels for ${dog.name}:`, finalLevels);
}

// Response type for createRun with progression info
interface CreateRunResponse {
  run: Run;
  levelProgression?: {
    dogName: string;
    class: string;
    fromLevel: string;
    toLevel: string;
  };
}

// Create a new run
export async function createRun(
  userId: string,
  request: CreateRunRequest,
  skipAutoProgression = false // Allow disabling auto-progression for batch imports
): Promise<CreateRunResponse> {
  const runId = generateId();
  const now = createTimestamp();
  const sortableTimestamp = createSortableTimestamp(new Date(request.date));

  const run: Run = {
    id: runId,
    dogId: request.dogId,
    date: request.date,
    class: request.class,
    level: request.level,
    qualified: request.qualified || false,
    placement: request.placement || null,
    time: request.time,
    machPoints: request.machPoints,
    location: request.location,
    notes: request.notes,
    createdAt: now,
    updatedAt: now,
  };

  // Store run once under USER#{userId} | RUN#{timestamp}#{runId}
  // GSI1 will automatically index it under DOG#{dogId} | RUN#{timestamp}#{runId}
  await dynamoClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `USER#${userId}`,
        SK: `RUN#${sortableTimestamp}#${runId}`,
        ...run, // All run data
        EntityType: "USER_RUN",
        // GSI1 for dog-based queries
        GSI1PK: `DOG#${request.dogId}`,
        GSI1SK: `RUN#${sortableTimestamp}#${runId}`,
      },
    })
  );

  let levelProgression: CreateRunResponse["levelProgression"] = undefined;

  // Check for auto-level progression if this was a qualifying run and auto-progression is enabled
  if (run.qualified && !skipAutoProgression) {
    try {
      const progressionResult = await checkAndUpdateDogLevel(
        userId,
        request.dogId,
        request.class
      );
      if (progressionResult && progressionResult.progressed) {
        levelProgression = {
          dogName: progressionResult.dogName!,
          class: progressionResult.class! as any,
          fromLevel: progressionResult.fromLevel! as any,
          toLevel: progressionResult.toLevel! as any,
        };
      }
    } catch (error) {
      console.error("Error checking dog level progression:", error);
      // Don't fail the run creation if level update fails - just log the error
    }
  }

  return {
    run,
    levelProgression,
  };
}

// Get a run by ID (needs to scan since we don't know which user owns it)
export async function getRunById(runId: string): Promise<Run | null> {
  // Since we store runs under users, we need to scan to find it
  // This is less efficient but getRunById is rarely used directly
  const result = await dynamoClient.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "#id = :runId AND EntityType = :entityType",
      ExpressionAttributeNames: {
        "#id": "id",
      },
      ExpressionAttributeValues: {
        ":runId": runId,
        ":entityType": "USER_RUN",
      },
    })
  );

  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  const item = result.Items[0];
  // Remove DynamoDB-specific fields
  const { PK, SK, EntityType, GSI1PK, GSI1SK, ...run } = item;
  return run as Run;
}

// Get runs for a dog with filtering and pagination
export async function getRunsByDogId(dogId: string, query: RunsQuery = {}): Promise<Run[]> {
  const queryParams: any = {
    TableName: TABLE_NAME,
    IndexName: "GSI1",
    KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :sk)",
    ExpressionAttributeValues: {
      ":pk": `DOG#${dogId}`,
      ":sk": "RUN#",
    },
    ScanIndexForward: query.order !== "asc", // Default to desc (newest first)
  };

  // Add limit if specified
  if (query.limit) {
    queryParams.Limit = query.limit;
  }

  // Add filter expression for additional filtering
  const filterExpressions: string[] = [];
  const filterAttributeNames: Record<string, string> = {};
  const filterAttributeValues: Record<string, any> = {};

  if (query.class) {
    filterExpressions.push("#class = :class");
    filterAttributeNames["#class"] = "class";
    filterAttributeValues[":class"] = query.class;
  }

  if (query.level) {
    filterExpressions.push("#level = :level");
    filterAttributeNames["#level"] = "level";
    filterAttributeValues[":level"] = query.level;
  }

  if (query.qualified !== undefined) {
    filterExpressions.push("qualified = :qualified");
    filterAttributeValues[":qualified"] = query.qualified;
  }

  if (filterExpressions.length > 0) {
    queryParams.FilterExpression = filterExpressions.join(" AND ");
    queryParams.ExpressionAttributeNames = filterAttributeNames;
    queryParams.ExpressionAttributeValues = {
      ...queryParams.ExpressionAttributeValues,
      ...filterAttributeValues,
    };
  }

  const result = await dynamoClient.send(new QueryCommand(queryParams));

  if (!result.Items) {
    return [];
  }

  // Convert GSI1 items directly to Run objects (all data is already there)
  const runs: Run[] = result.Items.map((item) => {
    // Remove DynamoDB-specific fields and return as Run
    const { PK, SK, EntityType, GSI1PK, GSI1SK, ...runData } = item;
    return runData as Run;
  });

  return runs;
}

// Get runs for a user with filtering and pagination
export async function getRunsByUserId(userId: string, query: RunsQuery = {}): Promise<Run[]> {
  const queryParams: any = {
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: {
      ":pk": `USER#${userId}`,
      ":sk": "RUN#",
    },
    ScanIndexForward: query.order !== "asc", // Default to desc (newest first)
  };

  // Add limit if specified
  if (query.limit) {
    queryParams.Limit = query.limit;
  }

  // Add filter expression for additional filtering
  const filterExpressions: string[] = [];
  const filterAttributeNames: Record<string, string> = {};
  const filterAttributeValues: Record<string, any> = {};

  if (query.dogId) {
    filterExpressions.push("dogId = :dogId");
    filterAttributeValues[":dogId"] = query.dogId;
  }

  if (query.class) {
    filterExpressions.push("#class = :class");
    filterAttributeNames["#class"] = "class";
    filterAttributeValues[":class"] = query.class;
  }

  if (query.level) {
    filterExpressions.push("#level = :level");
    filterAttributeNames["#level"] = "level";
    filterAttributeValues[":level"] = query.level;
  }

  if (query.qualified !== undefined) {
    filterExpressions.push("qualified = :qualified");
    filterAttributeValues[":qualified"] = query.qualified;
  }

  if (filterExpressions.length > 0) {
    queryParams.FilterExpression = filterExpressions.join(" AND ");
    queryParams.ExpressionAttributeNames = filterAttributeNames;
    queryParams.ExpressionAttributeValues = {
      ...queryParams.ExpressionAttributeValues,
      ...filterAttributeValues,
    };
  }

  const result = await dynamoClient.send(new QueryCommand(queryParams));

  if (!result.Items) {
    return [];
  }

  // Convert USER_RUN items directly to Run objects (all data is already there)
  const runs: Run[] = result.Items.map((item) => {
    // Remove DynamoDB-specific fields and return as Run
    const { PK, SK, EntityType, GSI1PK, GSI1SK, userId, ...runData } = item;
    return runData as Run;
  });

  return runs;
}

// Update a run
export async function updateRun(
  runId: string,
  userId: string,
  request: UpdateRunRequest
): Promise<Run | null> {
  // First, find the run to get its current keys
  const currentRun = await getRunById(runId);
  if (!currentRun) {
    return null;
  }

  const currentSortableTimestamp = createSortableTimestamp(new Date(currentRun.date));
  const currentSK = `RUN#${currentSortableTimestamp}#${runId}`;

  // Build update expression for allowed fields only
  // Core fields (date, class, level, qualified) cannot be updated
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  if (request.placement !== undefined) {
    updateExpressions.push("placement = :placement");
    expressionAttributeValues[":placement"] = request.placement;
  }

  if (request.time !== undefined) {
    updateExpressions.push("#time = :time");
    expressionAttributeNames["#time"] = "time";
    expressionAttributeValues[":time"] = request.time;
  }

  if (request.machPoints !== undefined) {
    updateExpressions.push("machPoints = :machPoints");
    expressionAttributeValues[":machPoints"] = request.machPoints;
  }

  if (request.location !== undefined) {
    updateExpressions.push("#location = :location");
    expressionAttributeNames["#location"] = "location";
    expressionAttributeValues[":location"] = request.location;
  }

  if (request.notes !== undefined) {
    updateExpressions.push("notes = :notes");
    expressionAttributeValues[":notes"] = request.notes;
  }

  updateExpressions.push("updatedAt = :updatedAt");
  expressionAttributeValues[":updatedAt"] = createTimestamp();

  if (updateExpressions.length === 1) {
    // Only updatedAt, no real changes
    return currentRun;
  }

  // Simple update - no key changes since core fields cannot be updated
  const result = await dynamoClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: currentSK,
      },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    })
  );

  if (!result.Attributes) {
    return null;
  }

  // Remove DynamoDB-specific fields
  const { PK, SK, EntityType, GSI1PK, GSI1SK, ...run } = result.Attributes;
  const updatedRun = run as Run;

  // No level progression check needed since core fields (qualified, class, level) cannot be updated
  return updatedRun;
}

// Delete a run
export async function deleteRun(runId: string, userId: string): Promise<boolean> {
  // First get the run to get the date for the sort key
  const run = await getRunById(runId);
  if (!run) {
    return false;
  }

  const sortableTimestamp = createSortableTimestamp(new Date(run.date));
  const sk = `RUN#${sortableTimestamp}#${runId}`;

  try {
    // Delete the single run record
    await dynamoClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: sk,
        },
      })
    );

    // Recalculate dog levels after deletion (in case deleted run affected progression)
    try {
      await recalculateDogLevels(userId, run.dogId);
      console.log(`📊 Recalculated levels for dog ${run.dogId} after run deletion`);
    } catch (error) {
      console.error("Error recalculating dog levels after run deletion:", error);
      // Don't fail the deletion if level recalculation fails - just log the error
    }

    return true;
  } catch (error) {
    console.error("Error deleting run:", error);
    return false;
  }
}
