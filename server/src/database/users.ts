import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { User } from "@my-agility-qs/shared";
import { createTimestamp, dynamoClient, KeyPatterns, TABLE_NAME } from "./client.js";

// Create or update user profile
export async function createOrUpdateUserProfile(
  userId: string,
  userEmail: string,
  profileData?: Partial<Pick<User, "trackQsOnly">>
): Promise<User> {
  const now = createTimestamp();
  const keys = KeyPatterns.userProfile(userId);

  // Try to get existing user first
  const existingUser = await getUserProfile(userId);

  const user: User = {
    id: userId,
    email: userEmail,
    trackQsOnly: profileData?.trackQsOnly ?? existingUser?.trackQsOnly ?? false,
    createdAt: existingUser?.createdAt ?? now,
    updatedAt: now,
  };

  await dynamoClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...keys,
        ...user,
        EntityType: "USER_PROFILE",
      },
    })
  );

  return user;
}

// Get user profile by ID
export async function getUserProfile(userId: string): Promise<User | null> {
  const keys = KeyPatterns.userProfile(userId);

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
  const { PK, SK, EntityType, ...user } = result.Item;
  return user as User;
}

// Update user preferences
export async function updateUserPreferences(
  userId: string,
  preferences: Partial<Pick<User, "trackQsOnly">>
): Promise<User | null> {
  console.log("[updateUserPreferences] Starting update for userId:", userId);
  console.log("[updateUserPreferences] Preferences received:", preferences);
  
  const keys = KeyPatterns.userProfile(userId);

  // Build update expression
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  if (preferences.trackQsOnly !== undefined) {
    console.log("[updateUserPreferences] Adding trackQsOnly update:", preferences.trackQsOnly);
    updateExpressions.push("#trackQsOnly = :trackQsOnly");
    expressionAttributeNames["#trackQsOnly"] = "trackQsOnly";
    expressionAttributeValues[":trackQsOnly"] = preferences.trackQsOnly;
  }

  updateExpressions.push("#updatedAt = :updatedAt");
  expressionAttributeNames["#updatedAt"] = "updatedAt";
  expressionAttributeValues[":updatedAt"] = createTimestamp();

  console.log("[updateUserPreferences] Update expressions:", updateExpressions);
  console.log("[updateUserPreferences] Expression values:", expressionAttributeValues);

  if (updateExpressions.length === 1) {
    // Only updatedAt, no actual changes
    console.log("[updateUserPreferences] No changes detected, returning existing profile");
    return getUserProfile(userId);
  }

  try {
    console.log("[updateUserPreferences] Executing DynamoDB update...");
    const result = await dynamoClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: keys,
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: "attribute_exists(PK)", // Ensure user exists
        ReturnValues: "ALL_NEW",
      })
    );

    if (!result.Attributes) {
      console.log("[updateUserPreferences] No attributes returned from update");
      return null;
    }

    // Remove DynamoDB-specific fields
    const { PK, SK, EntityType, ...user } = result.Attributes;
    console.log("[updateUserPreferences] Update successful, returning user:", user);
    return user as User;
  } catch (error: any) {
    console.error("[updateUserPreferences] DynamoDB error:", error);
    if (error.name === "ConditionalCheckFailedException") {
      // User doesn't exist
      console.log("[updateUserPreferences] User does not exist, returning null");
      return null;
    }
    console.error("[updateUserPreferences] Throwing error:", error);
    throw error;
  }
}
