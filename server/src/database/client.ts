import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Validate required environment variables
if (!process.env.AWS_REGION) {
  throw new Error('AWS_REGION environment variable is required');
}
if (!process.env.DYNAMODB_TABLE_NAME) {
  throw new Error('DYNAMODB_TABLE_NAME environment variable is required');
}

// DynamoDB client configuration
const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
});

// Document client for easier object handling
export const dynamoClient = DynamoDBDocumentClient.from(client);

// Table name from environment variable
export const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;

// Single-table design key patterns
export const KeyPatterns = {
  // Users
  userProfile: (userId: string) => ({
    PK: `USER#${userId}`,
    SK: "PROFILE",
  }),

  // Dogs
  dogProfile: (dogId: string) => ({
    PK: `DOG#${dogId}`,
    SK: "PROFILE",
  }),

  userDog: (userId: string, dogId: string) => ({
    PK: `USER#${userId}`,
    SK: `DOG#${dogId}`,
  }),

  // No additional patterns needed - simplified
};

// GSI patterns removed - queries are hardcoded in database functions for better performance

// Helper function to create timestamps
export const createTimestamp = (date?: Date): string => {
  const timestamp = date || new Date();
  return timestamp.toISOString();
};

// Helper function to create sortable timestamp (for runs)
export const createSortableTimestamp = (date?: Date): string => {
  const timestamp = date || new Date();
  return timestamp
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
};

// Helper function to generate UUIDs
export const generateId = (): string => {
  return crypto.randomUUID();
};
