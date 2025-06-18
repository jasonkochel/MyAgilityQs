import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// DynamoDB client configuration
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});

// Document client for easier object handling
export const dynamoClient = DynamoDBDocumentClient.from(client);

// Table name from environment variable
export const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "MyAgilityQs-Dev";

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

  // Runs
  runDetails: (runId: string) => ({
    PK: `RUN#${runId}`,
    SK: "DETAILS",
  }),

  dogRun: (dogId: string, timestamp: string) => ({
    PK: `DOG#${dogId}`,
    SK: `RUN#${timestamp}`,
  }),

  userRun: (userId: string, timestamp: string) => ({
    PK: `USER#${userId}`,
    SK: `RUN#${timestamp}`,
  }),

  // Progress
  dogProgress: (userId: string, dogId: string) => ({
    PK: `PROGRESS#${userId}`,
    SK: `DOG#${dogId}`,
  }),

  userProgressSummary: (userId: string) => ({
    PK: `PROGRESS#${userId}`,
    SK: "SUMMARY",
  }),
};

// GSI patterns for efficient queries
export const GSIPatterns = {
  // Query all dogs for a user
  userDogs: (userId: string) => ({
    GSI1PK: `USER#${userId}`,
    GSI1SK: "DOG#",
  }),

  // Query all runs for a dog
  dogRuns: (dogId: string) => ({
    GSI1PK: `DOG#${dogId}`,
    GSI1SK: "RUN#",
  }),

  // Query all runs for a user
  userRuns: (userId: string) => ({
    GSI1PK: `USER#${userId}`,
    GSI1SK: "RUN#",
  }),
};

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
