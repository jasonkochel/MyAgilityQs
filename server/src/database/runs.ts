import {
  DeleteCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { CreateRunRequest, Run, RunsQuery, UpdateRunRequest } from "@my-agility-qs/shared";
import {
  createSortableTimestamp,
  createTimestamp,
  dynamoClient,
  generateId,
  TABLE_NAME,
} from "./client.js";

// Create a new run
export async function createRun(userId: string, request: CreateRunRequest): Promise<Run> {
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

  return run;
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
    return run as Run;
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
