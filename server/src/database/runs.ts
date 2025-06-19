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
} from "@my-agility-qs/shared";
import {
  createSortableTimestamp,
  createTimestamp,
  dynamoClient,
  generateId,
  TABLE_NAME,
} from "./client.js";
import { getDogById, updateDog } from "./dogs.js";

// Helper function to count qualifying runs for a specific dog, class, and level
async function countQualifyingRuns(
  dogId: string,
  competitionClass: string,
  level: string
): Promise<number> {
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :dogId AND begins_with(GSI1SK, :runPrefix)",
      FilterExpression: "#class = :class AND #level = :level AND qualified = :qualified",
      ExpressionAttributeNames: {
        "#class": "class",
        "#level": "level",
      },
      ExpressionAttributeValues: {
        ":dogId": `DOG#${dogId}`,
        ":runPrefix": "RUN#",
        ":class": competitionClass,
        ":level": level,
        ":qualified": true,
      },
    })
  );

  return result.Items?.length || 0;
}

// Helper function to get the next level
function getNextLevel(currentLevel: string): CompetitionLevel | null {
  const levelProgression: Record<string, CompetitionLevel | null> = {
    Novice: "Open",
    Open: "Excellent",
    Excellent: "Masters",
    Masters: null, // Stay in Masters forever
  };
  return levelProgression[currentLevel] || null;
}

// Function to check and update dog levels after a qualifying run
async function checkAndUpdateDogLevel(
  userId: string,
  dogId: string,
  competitionClass: string,
  currentLevel: string
): Promise<{
  progressed: boolean;
  fromLevel?: string;
  toLevel?: string;
  dogName?: string;
  class?: string;
} | null> {
  // Only check progression if not already at Masters level
  if (currentLevel === "Masters") {
    return null;
  }

  // Count qualifying runs at the current level for this class
  const qualifyingRuns = await countQualifyingRuns(dogId, competitionClass, currentLevel);

  // If dog has 3 or more Qs at current level, advance to next level
  if (qualifyingRuns >= 3) {
    const nextLevel = getNextLevel(currentLevel);
    if (!nextLevel) {
      return null; // Should not happen since we check for Masters above
    }

    // Get current dog data
    const dog = await getDogById(dogId);
    if (!dog) {
      throw new Error(`Dog not found: ${dogId}`);
    } // Update the specific class level
    const updatedClasses = dog.classes.map((dogClass) =>
      dogClass.name === competitionClass
        ? { ...dogClass, level: nextLevel as CompetitionLevel }
        : dogClass
    );

    // Update the dog in the database
    await updateDog(dogId, userId, { classes: updatedClasses });

    console.log(
      `🎉 Auto-progression: ${dog.name} advanced from ${currentLevel} to ${nextLevel} in ${competitionClass}`
    );

    return {
      progressed: true,
      fromLevel: currentLevel,
      toLevel: nextLevel,
      dogName: dog.name,
      class: competitionClass,
    };
  }

  return { progressed: false };
}

// Recalculate dog levels from scratch based on all runs in chronological order
// This is used after batch imports to ensure correct levels regardless of import order
export async function recalculateDogLevels(userId: string, dogId: string): Promise<void> {
  // Get all qualifying runs for this dog, sorted chronologically
  const allRuns = await getRunsByDogId(dogId);
  const qualifyingRuns = allRuns
    .filter(run => run.qualified)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Get current dog data
  const dog = await getDogById(dogId);
  if (!dog) {
    throw new Error(`Dog not found: ${dogId}`);
  }

  // Track Qs by class and level
  const classLevelQs = new Map<string, Map<string, number>>();
  const finalLevels = new Map<string, string>();

  // Initialize starting levels for each class
  for (const dogClass of dog.classes) {
    finalLevels.set(dogClass.name, "Novice"); // Everyone starts at Novice
    classLevelQs.set(dogClass.name, new Map([
      ["Novice", 0],
      ["Open", 0], 
      ["Excellent", 0],
      ["Masters", 0]
    ]));
  }

  // Process runs chronologically to determine correct final levels
  for (const run of qualifyingRuns) {
    const classMap = classLevelQs.get(run.class);
    if (!classMap) continue; // Skip if dog doesn't compete in this class

    const currentLevel = finalLevels.get(run.class) || "Novice";
    
    // Only count Qs at the current level (you can't get credit for higher level Qs)
    if (run.level === currentLevel) {
      const currentCount = classMap.get(currentLevel) || 0;
      classMap.set(currentLevel, currentCount + 1);
      
      // Check if dog should advance after this Q
      if (currentCount + 1 >= 3 && currentLevel !== "Masters") {
        const nextLevel = getNextLevel(currentLevel);
        if (nextLevel) {
          finalLevels.set(run.class, nextLevel);
          console.log(`📈 ${dog.name} advanced from ${currentLevel} to ${nextLevel} in ${run.class} after Q #${currentCount + 1} on ${run.date}`);
        }
      }
    }
    // Note: Qs at levels higher than current are ignored (can't skip levels)
    // Qs at levels lower than current are also ignored (already advanced past)
  }

  // Update dog's class levels in database
  const updatedClasses = dog.classes.map(dogClass => ({
    ...dogClass,
    level: (finalLevels.get(dogClass.name) || "Novice") as any
  }));

  await updateDog(dogId, userId, { classes: updatedClasses });
  
  console.log(`📊 Recalculated levels for ${dog.name}:`, 
    Object.fromEntries(finalLevels));
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
        request.class,
        request.level
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

  // Build update expression
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  let needsKeyUpdate = false;
  let newSortableTimestamp = currentSortableTimestamp;

  if (request.date !== undefined) {
    updateExpressions.push("#date = :date");
    expressionAttributeNames["#date"] = "date";
    expressionAttributeValues[":date"] = request.date;
    newSortableTimestamp = createSortableTimestamp(new Date(request.date));
    needsKeyUpdate = newSortableTimestamp !== currentSortableTimestamp;
  }

  if (request.class !== undefined) {
    updateExpressions.push("#class = :class");
    expressionAttributeNames["#class"] = "class";
    expressionAttributeValues[":class"] = request.class;
  }

  if (request.level !== undefined) {
    updateExpressions.push("#level = :level");
    expressionAttributeNames["#level"] = "level";
    expressionAttributeValues[":level"] = request.level;
  }

  if (request.qualified !== undefined) {
    updateExpressions.push("qualified = :qualified");
    expressionAttributeValues[":qualified"] = request.qualified;
  }

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
  // If date changed, we need to delete the old record and create a new one
  // because the sort key includes the timestamp
  if (needsKeyUpdate) {
    const updatedRun = {
      ...currentRun,
      ...request,
      updatedAt: createTimestamp(),
    };

    const newSK = `RUN#${newSortableTimestamp}#${runId}`;
    const newGSI1SK = `RUN#${newSortableTimestamp}#${runId}`;

    // Delete old record
    await dynamoClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: currentSK,
        },
      })
    );

    // Create new record with updated date
    await dynamoClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `USER#${userId}`,
          SK: newSK,
          ...updatedRun,
          EntityType: "USER_RUN",
          GSI1PK: `DOG#${currentRun.dogId}`,
          GSI1SK: newGSI1SK,
        },
      })
    );

    // Check for auto-level progression if this is now a qualifying run
    if (updatedRun.qualified) {
      try {
        await checkAndUpdateDogLevel(userId, updatedRun.dogId, updatedRun.class, updatedRun.level);
      } catch (error) {
        console.error("Error checking dog level progression:", error);
        // Don't fail the run update if level update fails - just log the error
      }
    }

    return updatedRun;
  } else {
    // Simple update without key change
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

    // Check for auto-level progression if this is now a qualifying run
    if (updatedRun.qualified) {
      try {
        await checkAndUpdateDogLevel(userId, updatedRun.dogId, updatedRun.class, updatedRun.level);
      } catch (error) {
        console.error("Error checking dog level progression:", error);
        // Don't fail the run update if level update fails - just log the error
      }
    }

    return updatedRun;
  }
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

    return true;
  } catch (error) {
    console.error("Error deleting run:", error);
    return false;
  }
}
