#!/usr/bin/env node

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "MyAgilityQs-Dev";

async function debugDogs() {
  console.log("🔍 Scanning for all items...");

  try {
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
      })
    );

    const items = scanResult.Items || [];
    console.log(`📊 Found ${items.length} total items`);

    const dogs = items.filter((item) => item.type === "dog");
    console.log(`🐕 Found ${dogs.length} dogs`);

    dogs.forEach((dog) => {
      console.log(`\n--- Dog: ${dog.name} (${dog.id}) ---`);
      console.log(`Active: ${dog.active}`);
      console.log(`Classes: ${JSON.stringify(dog.classes, null, 2)}`);
    });
  } catch (error) {
    console.error("❌ Debug failed:", error);
  }
}

debugDogs();
