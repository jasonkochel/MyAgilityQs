import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { CreateDogRequest, Dog, UpdateDogRequest } from "@my-agility-qs/shared";
import { createTimestamp, dynamoClient, generateId, KeyPatterns, TABLE_NAME } from "./client.js";

// Create a new dog
export async function createDog(userId: string, request: CreateDogRequest): Promise<Dog> {
  const dogId = generateId();
  const now = createTimestamp();

  const dog: Dog = {
    id: dogId,
    userId,
    name: request.name,
    registeredName: request.registeredName,
    active: true,
    classes: request.classes,
    createdAt: now,
    updatedAt: now,
  };

  // Store dog profile
  const dogProfileKeys = KeyPatterns.dogProfile(dogId);
  await dynamoClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...dogProfileKeys,
        ...dog,
        EntityType: "DOG",
        GSI1PK: `USER#${userId}`,
        GSI1SK: `DOG#${dogId}`,
      },
    })
  );

  // Store user -> dog relationship
  const userDogKeys = KeyPatterns.userDog(userId, dogId);
  await dynamoClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...userDogKeys,
        dogId,
        dogName: dog.name,
        active: dog.active,
        createdAt: now,
        EntityType: "USER_DOG",
      },
    })
  );

  return dog;
}

// Get a dog by ID
export async function getDogById(dogId: string): Promise<Dog | null> {
  const keys = KeyPatterns.dogProfile(dogId);

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
  const { PK, SK, EntityType, GSI1PK, GSI1SK, ...dog } = result.Item;
  return dog as Dog;
}

// Get all dogs for a user
export async function getDogsByUserId(userId: string): Promise<Dog[]> {
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ":sk": "DOG#",
      },
    })
  );

  if (!result.Items) {
    return [];
  }

  // Return dogs, removing DynamoDB-specific fields
  return result.Items.map((item) => {
    const { PK, SK, EntityType, GSI1PK, GSI1SK, ...dog } = item;
    return dog as Dog;
  });
}

// Update a dog
export async function updateDog(
  dogId: string,
  userId: string,
  request: UpdateDogRequest
): Promise<Dog | null> {
  const keys = KeyPatterns.dogProfile(dogId);

  // Build update expression
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  if (request.name !== undefined) {
    updateExpressions.push("#name = :name");
    expressionAttributeNames["#name"] = "name";
    expressionAttributeValues[":name"] = request.name;
  }

  if (request.registeredName !== undefined) {
    updateExpressions.push("#registeredName = :registeredName");
    expressionAttributeNames["#registeredName"] = "registeredName";
    expressionAttributeValues[":registeredName"] = request.registeredName;
  }

  if (request.classes !== undefined) {
    updateExpressions.push("#classes = :classes");
    expressionAttributeNames["#classes"] = "classes";
    expressionAttributeValues[":classes"] = request.classes;
  }

  if (request.active !== undefined) {
    updateExpressions.push("#active = :active");
    expressionAttributeNames["#active"] = "active";
    expressionAttributeValues[":active"] = request.active;
  }

  if (request.photoUrl !== undefined) {
    updateExpressions.push("#photoUrl = :photoUrl");
    expressionAttributeNames["#photoUrl"] = "photoUrl";
    expressionAttributeValues[":photoUrl"] = request.photoUrl;
  }

  if (request.originalPhotoUrl !== undefined) {
    updateExpressions.push("#originalPhotoUrl = :originalPhotoUrl");
    expressionAttributeNames["#originalPhotoUrl"] = "originalPhotoUrl";
    expressionAttributeValues[":originalPhotoUrl"] = request.originalPhotoUrl;
  }

  if (request.photoCrop !== undefined) {
    updateExpressions.push("#photoCrop = :photoCrop");
    expressionAttributeNames["#photoCrop"] = "photoCrop";
    expressionAttributeValues[":photoCrop"] = request.photoCrop;
  }

  updateExpressions.push("#updatedAt = :updatedAt");
  expressionAttributeNames["#updatedAt"] = "updatedAt";
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

  // Update the user -> dog relationship if name or active status changed
  if (request.name !== undefined || request.active !== undefined) {
    const userDogKeys = KeyPatterns.userDog(userId, dogId);
    const userDogUpdateExpressions: string[] = [];
    const userDogExpressionAttributeNames: Record<string, string> = {};
    const userDogExpressionAttributeValues: Record<string, any> = {};

    if (request.name !== undefined) {
      userDogUpdateExpressions.push("#dogName = :dogName");
      userDogExpressionAttributeNames["#dogName"] = "dogName";
      userDogExpressionAttributeValues[":dogName"] = request.name;
    }

    if (request.active !== undefined) {
      userDogUpdateExpressions.push("#active = :active");
      userDogExpressionAttributeNames["#active"] = "active";
      userDogExpressionAttributeValues[":active"] = request.active;
    }

    if (userDogUpdateExpressions.length > 0) {
      await dynamoClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: userDogKeys,
          UpdateExpression: `SET ${userDogUpdateExpressions.join(", ")}`,
          ExpressionAttributeNames: userDogExpressionAttributeNames,
          ExpressionAttributeValues: userDogExpressionAttributeValues,
        })
      );
    }
  }

  // Remove DynamoDB-specific fields
  const { PK, SK, EntityType, GSI1PK, GSI1SK, ...dog } = result.Attributes;
  return dog as Dog;
}

// Hard delete a dog (permanent deletion)
export async function hardDeleteDog(dogId: string, userId: string): Promise<boolean> {
  const dogKeys = KeyPatterns.dogProfile(dogId);
  const userDogKeys = KeyPatterns.userDog(userId, dogId);

  try {
    // First, get all runs for this dog to delete them
    const { getRunsByDogId } = await import("./runs.js");
    const runs = await getRunsByDogId(dogId);

    // Delete all runs for this dog
    for (const run of runs) {
      const { deleteRun } = await import("./runs.js");
      await deleteRun(run.id, userId);
    }

    // Delete dog profile
    await dynamoClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: dogKeys,
        ConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      })
    );

    // Delete user -> dog relationship
    await dynamoClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: userDogKeys,
      })
    );

    console.log(`Hard deleted dog ${dogId} and ${runs.length} associated runs`);
    return true;
  } catch (error) {
    console.error("Error hard deleting dog:", error);
    return false;
  }
}
