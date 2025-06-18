import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { CreateRunRequest, Run, RunsQuery, UpdateRunRequest } from "@my-agility-qs/shared";
import {
  createSortableTimestamp,
  createTimestamp,
  dynamoClient,
  generateId,
  KeyPatterns,
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

  // Store run details
  const runKeys = KeyPatterns.runDetails(runId);
  await dynamoClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...runKeys,
        ...run,
        userId, // Store userId for authorization
        EntityType: "RUN",
      },
    })
  );

  // Store dog -> run relationship
  const dogRunKeys = KeyPatterns.dogRun(request.dogId, sortableTimestamp);
  await dynamoClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...dogRunKeys,
        runId,
        date: request.date,
        class: request.class,
        level: request.level,
        qualified: run.qualified,
        placement: run.placement,
        time: run.time,
        machPoints: run.machPoints,
        createdAt: now,
        EntityType: "DOG_RUN",
        GSI1PK: `DOG#${request.dogId}`,
        GSI1SK: `RUN#${sortableTimestamp}`,
      },
    })
  );

  // Store user -> run relationship
  const userRunKeys = KeyPatterns.userRun(userId, sortableTimestamp);
  await dynamoClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...userRunKeys,
        runId,
        dogId: request.dogId,
        date: request.date,
        class: request.class,
        level: request.level,
        qualified: run.qualified,
        placement: run.placement,
        time: run.time,
        machPoints: run.machPoints,
        createdAt: now,
        EntityType: "USER_RUN",
        GSI1PK: `USER#${userId}`,
        GSI1SK: `RUN#${sortableTimestamp}`,
      },
    })
  );

  return run;
}

// Get a run by ID
export async function getRunById(runId: string): Promise<Run | null> {
  const keys = KeyPatterns.runDetails(runId);

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
  const { PK, SK, EntityType, userId, ...run } = result.Item;
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

  // Convert to runs and get full details
  const runIds = result.Items.map((item) => item.runId);
  const runs: Run[] = [];

  for (const runId of runIds) {
    const run = await getRunById(runId);
    if (run) {
      runs.push(run);
    }
  }

  return runs;
}

// Get runs for a user with filtering and pagination
export async function getRunsByUserId(userId: string, query: RunsQuery = {}): Promise<Run[]> {
  const queryParams: any = {
    TableName: TABLE_NAME,
    IndexName: "GSI1",
    KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :sk)",
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

  // Convert to runs and get full details
  const runIds = result.Items.map((item) => item.runId);
  const runs: Run[] = [];

  for (const runId of runIds) {
    const run = await getRunById(runId);
    if (run) {
      runs.push(run);
    }
  }

  return runs;
}

// Update a run
export async function updateRun(
  runId: string,
  userId: string,
  request: UpdateRunRequest
): Promise<Run | null> {
  const keys = KeyPatterns.runDetails(runId);

  // Build update expression
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  if (request.date !== undefined) {
    updateExpressions.push("#date = :date");
    expressionAttributeNames["#date"] = "date";
    expressionAttributeValues[":date"] = request.date;
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
    // Only updatedAt
    return null;
  }

  const result = await dynamoClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: keys,
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: {
        ...expressionAttributeValues,
        ":userId": userId,
      },
      ConditionExpression: "userId = :userId",
      ReturnValues: "ALL_NEW",
    })
  );

  if (!result.Attributes) {
    return null;
  }

  // TODO: Update the dog -> run and user -> run relationships if needed
  // This would require additional logic to handle date changes (which affect sort keys)

  // Remove DynamoDB-specific fields
  const { PK, SK, EntityType, userId: _, ...run } = result.Attributes;
  return run as Run;
}

// Delete a run
export async function deleteRun(runId: string, userId: string): Promise<boolean> {
  // First get the run to get the dogId and date for cleanup
  const run = await getRunById(runId);
  if (!run) {
    return false;
  }

  const sortableTimestamp = createSortableTimestamp(new Date(run.date));

  const runKeys = KeyPatterns.runDetails(runId);
  const dogRunKeys = KeyPatterns.dogRun(run.dogId, sortableTimestamp);
  const userRunKeys = KeyPatterns.userRun(userId, sortableTimestamp);

  try {
    // Delete run details
    await dynamoClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: runKeys,
        ConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      })
    );

    // Delete dog -> run relationship
    await dynamoClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: dogRunKeys,
      })
    );

    // Delete user -> run relationship
    await dynamoClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: userRunKeys,
      })
    );

    return true;
  } catch (error) {
    console.error("Error deleting run:", error);
    return false;
  }
}
