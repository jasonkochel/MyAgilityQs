#!/usr/bin/env node

/**
 * Simple test script for auto-progression logic
 * Run with: node test-auto-progression.mjs
 */

import { createDog, getDogById } from "./dist/database/dogs.js";
import { createRun } from "./dist/database/runs.js";

async function testAutoProgression() {
  console.log("🧪 Testing Auto-Level Progression...");

  const userId = "test-user-" + Date.now();

  try {
    // Create a test dog
    console.log("1. Creating test dog...");
    const dogRequest = {
      name: "Test Dog",
      classes: [
        { name: "Standard", level: "Novice" },
        { name: "Jumpers", level: "Novice" },
      ],
    };

    const dog = await createDog(userId, dogRequest);
    console.log(`✅ Created dog: ${dog.name} (ID: ${dog.id})`);

    // Test 1: Add 2 qualifying runs - should NOT advance
    console.log("\n2. Adding 2 qualifying runs (should NOT advance)...");

    for (let i = 0; i < 2; i++) {
      const runRequest = {
        dogId: dog.id,
        date: new Date(`2024-01-0${i + 1}`).toISOString(),
        class: "Standard",
        level: "Novice",
        qualified: true,
        time: 30 + i,
        location: "Test Location",
      };
      await createRun(userId, runRequest);
      console.log(`  ✅ Added qualifying run ${i + 1}`);
    }

    let updatedDog = await getDogById(dog.id);
    let standardClass = updatedDog.classes.find((c) => c.name === "Standard");
    console.log(`  📊 Current level: ${standardClass.level}`);

    if (standardClass.level === "Novice") {
      console.log("  ✅ PASS: Dog still at Novice (expected)");
    } else {
      console.log("  ❌ FAIL: Dog should still be at Novice");
      return;
    }

    // Test 2: Add 3rd qualifying run - should advance to Open
    console.log("\n3. Adding 3rd qualifying run (should advance to Open)...");

    const runRequest = {
      dogId: dog.id,
      date: new Date("2024-01-03").toISOString(),
      class: "Standard",
      level: "Novice",
      qualified: true,
      time: 32,
      location: "Test Location",
    };

    await createRun(userId, runRequest);
    console.log("  ✅ Added 3rd qualifying run");

    updatedDog = await getDogById(dog.id);
    standardClass = updatedDog.classes.find((c) => c.name === "Standard");
    console.log(`  📊 Current level: ${standardClass.level}`);

    if (standardClass.level === "Open") {
      console.log("  ✅ PASS: Dog advanced to Open");
    } else {
      console.log("  ❌ FAIL: Dog should have advanced to Open");
      return;
    }

    // Test 3: Check Jumpers is still at Novice
    const jumpersClass = updatedDog.classes.find((c) => c.name === "Jumpers");
    console.log(`  📊 Jumpers level: ${jumpersClass.level}`);

    if (jumpersClass.level === "Novice") {
      console.log("  ✅ PASS: Jumpers still at Novice (class-specific progression)");
    } else {
      console.log("  ❌ FAIL: Jumpers should still be at Novice");
      return;
    }

    // Test 4: Test progression through multiple levels
    console.log("\n4. Testing progression from Open -> Excellent -> Masters...");

    // Add 3 Open qualifying runs
    for (let i = 0; i < 3; i++) {
      const runRequest = {
        dogId: dog.id,
        date: new Date(`2024-02-0${i + 1}`).toISOString(),
        class: "Standard",
        level: "Open",
        qualified: true,
        time: 28 + i,
        location: "Test Location",
      };
      await createRun(userId, runRequest);
    }

    updatedDog = await getDogById(dog.id);
    standardClass = updatedDog.classes.find((c) => c.name === "Standard");
    console.log(`  📊 After 3 Open Qs: ${standardClass.level}`);

    if (standardClass.level === "Excellent") {
      console.log("  ✅ PASS: Dog advanced to Excellent");
    } else {
      console.log("  ❌ FAIL: Dog should have advanced to Excellent");
      return;
    }

    // Add 3 Excellent qualifying runs
    for (let i = 0; i < 3; i++) {
      const runRequest = {
        dogId: dog.id,
        date: new Date(`2024-03-0${i + 1}`).toISOString(),
        class: "Standard",
        level: "Excellent",
        qualified: true,
        time: 26 + i,
        location: "Test Location",
      };
      await createRun(userId, runRequest);
    }

    updatedDog = await getDogById(dog.id);
    standardClass = updatedDog.classes.find((c) => c.name === "Standard");
    console.log(`  📊 After 3 Excellent Qs: ${standardClass.level}`);

    if (standardClass.level === "Masters") {
      console.log("  ✅ PASS: Dog advanced to Masters");
    } else {
      console.log("  ❌ FAIL: Dog should have advanced to Masters");
      return;
    }

    // Test 5: Test that Masters doesn't advance further
    console.log("\n5. Testing that Masters doesn't advance further...");

    for (let i = 0; i < 5; i++) {
      const runRequest = {
        dogId: dog.id,
        date: new Date(`2024-04-0${i + 1}`).toISOString(),
        class: "Standard",
        level: "Masters",
        qualified: true,
        time: 24 + i,
        location: "Test Location",
      };
      await createRun(userId, runRequest);
    }

    updatedDog = await getDogById(dog.id);
    standardClass = updatedDog.classes.find((c) => c.name === "Standard");
    console.log(`  📊 After 5 Masters Qs: ${standardClass.level}`);

    if (standardClass.level === "Masters") {
      console.log("  ✅ PASS: Dog stays at Masters (no advancement beyond)");
    } else {
      console.log("  ❌ FAIL: Dog should stay at Masters");
      return;
    }

    console.log("\n🎉 ALL TESTS PASSED! Auto-progression is working correctly.");
  } catch (error) {
    console.error("\n❌ TEST FAILED:", error);
    process.exit(1);
  }
}

// Run the test
testAutoProgression();
