#!/usr/bin/env node
/**
 * One-time migration: normalize Dog.classes[].name and Run.class to canonical
 * short forms ("T2B", "Premier Std", "Premier JWW") instead of the legacy
 * long forms ("Time 2 Beat", "Premier Standard", "Premier Jumpers").
 *
 * Idempotent — re-running is a no-op.
 *
 * Usage:
 *   node scripts/normalize-class-names.mjs --dry-run   # preview changes
 *   node scripts/normalize-class-names.mjs             # apply changes
 *
 * Env:
 *   AWS_REGION        defaults to us-east-1
 *   TABLE_NAME        defaults to MyAgilityQs
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const region = process.env.AWS_REGION || "us-east-1";
const tableName = process.env.TABLE_NAME || "MyAgilityQs";
const dryRun = process.argv.includes("--dry-run");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

const NAME_MAP = {
  "Time 2 Beat": "T2B",
  "Premier Standard": "Premier Std",
  "Premier Jumpers": "Premier JWW",
};

const normalize = (name) => NAME_MAP[name] ?? name;

async function scanAll(filterExpression, expressionAttributeValues) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await client.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: filterExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExclusiveStartKey,
      })
    );
    items.push(...(result.Items ?? []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function migrateDogs() {
  console.log(`\n=== Dogs ===`);
  const dogs = await scanAll("EntityType = :t", { ":t": "DOG" });
  console.log(`Scanned ${dogs.length} dog records`);

  let changed = 0;
  for (const dog of dogs) {
    if (!Array.isArray(dog.classes)) continue;
    const original = dog.classes;
    const normalized = original.map((c) => ({ ...c, name: normalize(c.name) }));
    const isChanged = normalized.some((c, i) => c.name !== original[i].name);
    if (!isChanged) continue;

    changed++;
    const renamePairs = original
      .map((c, i) => (c.name !== normalized[i].name ? `${c.name} -> ${normalized[i].name}` : null))
      .filter(Boolean);
    console.log(`  ${dog.name} (${dog.id}): ${renamePairs.join(", ")}`);

    if (!dryRun) {
      await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { PK: dog.PK, SK: dog.SK },
          UpdateExpression: "SET #classes = :classes, #updatedAt = :updatedAt",
          ExpressionAttributeNames: {
            "#classes": "classes",
            "#updatedAt": "updatedAt",
          },
          ExpressionAttributeValues: {
            ":classes": normalized,
            ":updatedAt": new Date().toISOString(),
          },
        })
      );
    }
  }
  console.log(`Dogs changed: ${changed}${dryRun ? " (dry run, not applied)" : ""}`);
  return changed;
}

async function migrateRuns() {
  console.log(`\n=== Runs ===`);
  const runs = await scanAll("EntityType = :t", { ":t": "USER_RUN" });
  console.log(`Scanned ${runs.length} run records`);

  let changed = 0;
  for (const run of runs) {
    const original = run.class;
    const normalized = normalize(original);
    if (normalized === original) continue;

    changed++;
    console.log(`  run ${run.id}: ${original} -> ${normalized}`);

    if (!dryRun) {
      await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { PK: run.PK, SK: run.SK },
          UpdateExpression: "SET #class = :class, #updatedAt = :updatedAt",
          ExpressionAttributeNames: {
            "#class": "class",
            "#updatedAt": "updatedAt",
          },
          ExpressionAttributeValues: {
            ":class": normalized,
            ":updatedAt": new Date().toISOString(),
          },
        })
      );
    }
  }
  console.log(`Runs changed: ${changed}${dryRun ? " (dry run, not applied)" : ""}`);
  return changed;
}

async function main() {
  console.log(`Mode: ${dryRun ? "DRY RUN" : "APPLY"}`);
  console.log(`Region: ${region}`);
  console.log(`Table: ${tableName}`);

  const dogsChanged = await migrateDogs();
  const runsChanged = await migrateRuns();

  console.log(`\n=== Summary ===`);
  console.log(`Dogs changed: ${dogsChanged}`);
  console.log(`Runs changed: ${runsChanged}`);
  console.log(`Total: ${dogsChanged + runsChanged}`);
  if (dryRun) console.log(`(dry run — re-run without --dry-run to apply)`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
