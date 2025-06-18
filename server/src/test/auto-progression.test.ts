import { beforeEach, describe, expect, it } from "@jest/globals";
import { CreateDogRequest, CreateRunRequest } from "@my-agility-qs/shared";
import { createDog, getDogById } from "../database/dogs.js";
import { createRun } from "../database/runs.js";

describe("Auto-Level Progression", () => {
  const userId = "test-user";
  let dogId: string;

  beforeEach(async () => {
    // Create a test dog with Standard Novice level
    const dogRequest: CreateDogRequest = {
      name: "Test Dog",
      classes: [
        { name: "Standard", level: "Novice" },
        { name: "Jumpers", level: "Novice" },
      ],
    };

    const dog = await createDog(userId, dogRequest);
    dogId = dog.id;
  });

  it("should advance dog from Novice to Open after 3 qualifying runs", async () => {
    // Add 3 qualifying Standard Novice runs
    for (let i = 0; i < 3; i++) {
      const runRequest: CreateRunRequest = {
        dogId,
        date: new Date(`2024-01-0${i + 1}`).toISOString(),
        class: "Standard",
        level: "Novice",
        qualified: true,
        time: 30 + i,
        location: "Test Location",
      };

      await createRun(userId, runRequest);
    }

    // Check that dog has been advanced to Open in Standard
    const updatedDog = await getDogById(dogId);
    expect(updatedDog).toBeTruthy();

    const standardClass = updatedDog!.classes.find((c) => c.name === "Standard");
    expect(standardClass?.level).toBe("Open");

    // Jumpers should still be at Novice
    const jumpersClass = updatedDog!.classes.find((c) => c.name === "Jumpers");
    expect(jumpersClass?.level).toBe("Novice");
  });

  it("should not advance dog with only 2 qualifying runs", async () => {
    // Add only 2 qualifying Standard Novice runs
    for (let i = 0; i < 2; i++) {
      const runRequest: CreateRunRequest = {
        dogId,
        date: new Date(`2024-01-0${i + 1}`).toISOString(),
        class: "Standard",
        level: "Novice",
        qualified: true,
        time: 30 + i,
        location: "Test Location",
      };

      await createRun(userId, runRequest);
    }

    // Check that dog is still at Novice
    const updatedDog = await getDogById(dogId);
    expect(updatedDog).toBeTruthy();

    const standardClass = updatedDog!.classes.find((c) => c.name === "Standard");
    expect(standardClass?.level).toBe("Novice");
  });

  it("should not advance dog with non-qualifying runs", async () => {
    // Add 3 non-qualifying Standard Novice runs
    for (let i = 0; i < 3; i++) {
      const runRequest: CreateRunRequest = {
        dogId,
        date: new Date(`2024-01-0${i + 1}`).toISOString(),
        class: "Standard",
        level: "Novice",
        qualified: false,
        time: 50 + i,
        location: "Test Location",
      };

      await createRun(userId, runRequest);
    }

    // Check that dog is still at Novice
    const updatedDog = await getDogById(dogId);
    expect(updatedDog).toBeTruthy();

    const standardClass = updatedDog!.classes.find((c) => c.name === "Standard");
    expect(standardClass?.level).toBe("Novice");
  });

  it("should progress through multiple levels: Novice -> Open -> Excellent -> Masters", async () => {
    // Progress from Novice to Open (3 Qs)
    for (let i = 0; i < 3; i++) {
      const runRequest: CreateRunRequest = {
        dogId,
        date: new Date(`2024-01-0${i + 1}`).toISOString(),
        class: "Standard",
        level: "Novice",
        qualified: true,
        time: 30 + i,
        location: "Test Location",
      };
      await createRun(userId, runRequest);
    }

    // Check progression to Open
    let updatedDog = await getDogById(dogId);
    let standardClass = updatedDog!.classes.find((c) => c.name === "Standard");
    expect(standardClass?.level).toBe("Open");

    // Progress from Open to Excellent (3 more Qs)
    for (let i = 0; i < 3; i++) {
      const runRequest: CreateRunRequest = {
        dogId,
        date: new Date(`2024-02-0${i + 1}`).toISOString(),
        class: "Standard",
        level: "Open",
        qualified: true,
        time: 28 + i,
        location: "Test Location",
      };
      await createRun(userId, runRequest);
    }

    // Check progression to Excellent
    updatedDog = await getDogById(dogId);
    standardClass = updatedDog!.classes.find((c) => c.name === "Standard");
    expect(standardClass?.level).toBe("Excellent");

    // Progress from Excellent to Masters (3 more Qs)
    for (let i = 0; i < 3; i++) {
      const runRequest: CreateRunRequest = {
        dogId,
        date: new Date(`2024-03-0${i + 1}`).toISOString(),
        class: "Standard",
        level: "Excellent",
        qualified: true,
        time: 26 + i,
        location: "Test Location",
      };
      await createRun(userId, runRequest);
    }

    // Check progression to Masters
    updatedDog = await getDogById(dogId);
    standardClass = updatedDog!.classes.find((c) => c.name === "Standard");
    expect(standardClass?.level).toBe("Masters");
  });

  it("should not advance beyond Masters level", async () => {
    // First, manually advance dog to Masters for this test
    const dog = await getDogById(dogId);
    const updatedClasses = dog!.classes.map((c) =>
      c.name === "Standard" ? { ...c, level: "Masters" } : c
    );

    // We'll need to update the dog manually for this test
    // This is testing the edge case where a dog is already at Masters

    // Add qualifying runs at Masters level
    for (let i = 0; i < 5; i++) {
      const runRequest: CreateRunRequest = {
        dogId,
        date: new Date(`2024-04-0${i + 1}`).toISOString(),
        class: "Standard",
        level: "Masters",
        qualified: true,
        time: 25 + i,
        location: "Test Location",
      };
      await createRun(userId, runRequest);
    }

    // Check that dog is still at Masters (no advancement)
    const finalDog = await getDogById(dogId);
    const standardClass = finalDog!.classes.find((c) => c.name === "Standard");
    expect(standardClass?.level).toBe("Masters");
  });
});
