#!/usr/bin/env node

/**
 * Migration script to update class names from legacy formats to simplified versions:
 * - "Jumpers With Weaves" -> "Jumpers"
 * - "Premier Jumpers" -> "Premier Jumpers" (keep as full name in DB)
 * - "Time 2 Beat" -> "Time 2 Beat" (keep as full name in DB)
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "MyAgilityQs-Dev";

async function migrateDogClassNames() {
  console.log("🔍 Scanning for dogs with old class names...");

  try {
    // Scan for all dogs using EntityType
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "EntityType = :dogType",
        ExpressionAttributeValues: {
          ":dogType": "DOG",
        },
      })
    );

    const dogs = scanResult.Items || [];
    console.log(`📊 Found ${dogs.length} dogs`);

    let updatedCount = 0;

    for (const dog of dogs) {
      if (!dog.classes || !Array.isArray(dog.classes)) {
        console.log(`⚠️  Dog ${dog.name} has no classes field`);
        continue;
      }

      let needsUpdate = false;
      const updatedClasses = dog.classes.map((cls) => {
        if (cls.name === "Jumpers With Weaves") {
          needsUpdate = true;
          return { ...cls, name: "Jumpers" };
        }
        return cls;
      });

      if (needsUpdate) {
        console.log(`🔄 Updating ${dog.name} (${dog.id})`);
        console.log(`   Old classes: ${dog.classes.map((c) => c.name).join(", ")}`);
        console.log(`   New classes: ${updatedClasses.map((c) => c.name).join(", ")}`);

        await docClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: dog.PK,
              SK: dog.SK,
            },
            UpdateExpression: "SET classes = :classes, updatedAt = :updatedAt",
            ExpressionAttributeValues: {
              ":classes": updatedClasses,
              ":updatedAt": new Date().toISOString(),
            },
          })
        );

        updatedCount++;
      } else {
        console.log(`✅ Dog ${dog.name} - no updates needed`);
      }
    }

    console.log(`✅ Migration complete! Updated ${updatedCount} dogs`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

async function migrateRunClassNames() {
  console.log("🔍 Scanning for runs with old class names...");

  try {
    // Scan for all runs using EntityType
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "EntityType = :runType",
        ExpressionAttributeValues: {
          ":runType": "Run",
        },
      })
    );

    const runs = scanResult.Items || [];
    console.log(`📊 Found ${runs.length} runs`);

    let updatedCount = 0;

    for (const run of runs) {
      let needsUpdate = false;
      let updatedClass = run.class;

      if (run.class === "Jumpers With Weaves") {
        needsUpdate = true;
        updatedClass = "Jumpers";
      }

      if (needsUpdate) {
        console.log(`🔄 Updating run ${run.id}`);
        console.log(`   Old class: ${run.class}`);
        console.log(`   New class: ${updatedClass}`);

        await docClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: run.PK,
              SK: run.SK,
            },
            UpdateExpression: "SET #class = :class, updatedAt = :updatedAt",
            ExpressionAttributeNames: {
              "#class": "class",
            },
            ExpressionAttributeValues: {
              ":class": updatedClass,
              ":updatedAt": new Date().toISOString(),
            },
          })
        );

        updatedCount++;
      }
    }

    console.log(`✅ Run migration complete! Updated ${updatedCount} runs`);
  } catch (error) {
    console.error("❌ Run migration failed:", error);
    process.exit(1);
  }
}

async function main() {
  console.log("🚀 Starting class name migration...");
  await migrateDogClassNames();
  await migrateRunClassNames();
  console.log("🎉 All migrations complete!");
}

main().catch(console.error);
