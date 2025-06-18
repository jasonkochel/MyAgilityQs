#!/usr/bin/env node

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "MyAgilityQs-Dev";

async function debugTypes() {
  console.log("🔍 Scanning for all items and their types...");

  try {
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
      })
    );

    const items = scanResult.Items || [];
    console.log(`📊 Found ${items.length} total items`);

    const types = {};
    items.forEach((item) => {
      const type = item.type || "undefined";
      if (!types[type]) {
        types[type] = [];
      }
      types[type].push(item);
    });

    Object.entries(types).forEach(([type, items]) => {
      console.log(`\n--- Type: ${type} (${items.length} items) ---`);
      items.forEach((item) => {
        if (type === "undefined") {
          console.log(`  ID: ${item.id}, Keys: ${Object.keys(item).join(", ")}`);
        } else {
          console.log(`  ID: ${item.id}, Name: ${item.name || "N/A"}`);
          if (item.classes) {
            console.log(`    Classes: ${JSON.stringify(item.classes, null, 2)}`);
          }
        }
      });
    });
  } catch (error) {
    console.error("❌ Debug failed:", error);
  }
}

debugTypes();
