import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  ApiResponse,
  BaselineCounts,
  CompetitionClass,
  CreateDogRequest,
  DogClass,
  isPremierClass,
  normalizeClassName,
  UpdateDogRequest,
} from "@my-agility-qs/shared";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import createError from "http-errors";
import { asCaught } from "../utils/errors.js";
import {
    createDog,
    getDogById,
    getDogsByUserId,
    hardDeleteDog,
    recalculateDogLevels,
    updateDog,
} from "../database/index.js";
import { AuthenticatedEvent } from "../middleware/jwtAuth.js";

/**
 * Validates a baseline against the dog's class config. Throws a 400 createError
 * with a user-friendly message if invalid.
 *
 *  - All numeric fields must be finite, non-negative integers.
 *  - asOf must be YYYY-MM-DD.
 *  - perClass keys must be classes the dog competes in.
 *  - For Standard/Jumpers/FAST: when qs > 0, level is required and must be a valid CompetitionLevel.
 *  - top25 is only allowed for Premier classes.
 */
function validateBaseline(baseline: BaselineCounts, dogClasses: DogClass[]): void {
  if (typeof baseline !== "object" || baseline === null) {
    throw createError(400, "Invalid baseline: must be an object");
  }

  const isNonNegInt = (n: unknown): n is number =>
    typeof n === "number" && Number.isInteger(n) && n >= 0 && Number.isFinite(n);

  const isValidLevel = (l: unknown): l is "Novice" | "Open" | "Excellent" | "Masters" =>
    l === "Novice" || l === "Open" || l === "Excellent" || l === "Masters";

  if (baseline.machPoints !== undefined && !isNonNegInt(baseline.machPoints)) {
    throw createError(400, "Baseline machPoints must be a non-negative integer");
  }
  if (baseline.doubleQs !== undefined && !isNonNegInt(baseline.doubleQs)) {
    throw createError(400, "Baseline doubleQs must be a non-negative integer");
  }

  if (baseline.perClass) {
    for (const [className, classBaseline] of Object.entries(baseline.perClass)) {
      if (!classBaseline) continue;
      const cls = className as CompetitionClass;
      const dogClass = dogClasses.find(
        (c) => normalizeClassName(c.name) === normalizeClassName(cls)
      );
      if (!dogClass) {
        throw createError(400, `Baseline references class "${cls}" not in dog's classes`);
      }
      const isLevelGated = cls === "Standard" || cls === "Jumpers" || cls === "FAST";

      if (classBaseline.qs !== undefined) {
        if (!isNonNegInt(classBaseline.qs)) {
          throw createError(400, `Baseline qs for ${cls} must be a non-negative integer`);
        }
        // Std/Jmp/FAST need a level when qs > 0 so the engine knows where to seed them.
        if (isLevelGated && classBaseline.qs > 0 && !classBaseline.level) {
          throw createError(400, `Baseline level is required for ${cls}`);
        }
      }
      if (classBaseline.level !== undefined) {
        if (!isValidLevel(classBaseline.level)) {
          throw createError(400, `Baseline level for ${cls} must be a valid level`);
        }
        if (!isLevelGated) {
          throw createError(
            400,
            `Baseline level does not apply to ${cls} (no level progression in this class)`
          );
        }
      }
      if (classBaseline.top25 !== undefined) {
        if (!isNonNegInt(classBaseline.top25)) {
          throw createError(400, `Baseline top25 for ${cls} must be a non-negative integer`);
        }
        if (!isPremierClass(cls) && classBaseline.top25 > 0) {
          throw createError(400, `Baseline top25 only applies to Premier classes`);
        }
      }
    }
  }
}

// Dog management handlers - full database implementation
export const dogHandler = {
  // GET /dogs - Get all dogs for authenticated user
  getDogs: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      const userId = event.user!.userId;
      const dogs = await getDogsByUserId(userId);

      const response: ApiResponse = {
        success: true,
        data: dogs,
        message: `Found ${dogs.length} dogs`,
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error) {
      console.error("Error getting dogs:", error);

      const response: ApiResponse = {
        success: false,
        error: "database_error",
        message: "Failed to retrieve dogs",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
      };
    }
  },

  // GET /dogs/:id - Get a specific dog by ID
  getDog: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      const userId = event.user!.userId;
      const dogId = event.pathParameters?.id;

      if (!dogId) {
        const response: ApiResponse = {
          success: false,
          error: "validation_error",
          message: "Dog ID is required",
        };

        return {
          statusCode: 400,
          body: JSON.stringify(response),
        };
      }

      const dog = await getDogById(dogId);

      if (!dog) {
        const response: ApiResponse = {
          success: false,
          error: "not_found",
          message: "Dog not found",
        };

        return {
          statusCode: 404,
          body: JSON.stringify(response),
        };
      }

      // Verify dog belongs to the authenticated user
      if (dog.userId !== userId) {
        const response: ApiResponse = {
          success: false,
          error: "unauthorized",
          message: "Access denied",
        };

        return {
          statusCode: 403,
          body: JSON.stringify(response),
        };
      }

      const response: ApiResponse = {
        success: true,
        data: dog,
        message: "Dog retrieved successfully",
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error) {
      console.error("Error getting dog:", error);

      const response: ApiResponse = {
        success: false,
        error: "database_error",
        message: "Failed to retrieve dog",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
      };
    }
  },

  // POST /dogs - Create a new dog
  createDog: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      const userId = event.user!.userId;
      if (!event.body) {
        throw createError(400, "Request body is required");
      }

      const request = event.body as unknown as CreateDogRequest;

      // Validate required fields
      if (!request.name || !request.classes || !Array.isArray(request.classes)) {
        throw createError(400, "Invalid request: name and classes are required");
      }

      if (request.baseline) {
        validateBaseline(request.baseline, request.classes);
      }

      const dog = await createDog(userId, request);

      const response: ApiResponse = {
        success: true,
        data: dog,
        message: `Dog "${dog.name}" created successfully`,
      };

      return {
        statusCode: 201,
        body: JSON.stringify(response),
      };
    } catch (error: unknown) {
      const err = asCaught(error);
      console.error("Error creating dog:", error);

      if (err.statusCode) {
        const response: ApiResponse = {
          success: false,
          error: "validation_error",
          message: err.message,
        };

        return {
          statusCode: err.statusCode,
          body: JSON.stringify(response),
        };
      }

      const response: ApiResponse = {
        success: false,
        error: "database_error",
        message: "Failed to create dog",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
      };
    }
  },

  // PUT /dogs/{id} - Update a dog
  updateDog: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      const userId = event.user!.userId;
      const dogId = event.pathParameters?.id;

      if (!dogId) {
        throw createError(400, "Dog ID is required");
      }

      if (!event.body) {
        throw createError(400, "Request body is required");
      }

      const request = event.body as unknown as UpdateDogRequest;

      // Verify dog exists and belongs to user
      const existingDog = await getDogById(dogId);
      if (!existingDog) {
        throw createError(404, "Dog not found");
      }

      if (existingDog.userId !== userId) {
        throw createError(403, "Not authorized to update this dog");
      }

      if (request.baseline) {
        // Validate against the resulting class config (request override or existing).
        const effectiveClasses = request.classes ?? existingDog.classes;
        validateBaseline(request.baseline, effectiveClasses);
      }

      let updatedDog = await updateDog(dogId, userId, request);

      if (!updatedDog) {
        throw createError(404, "Dog not found or no changes made");
      }

      // If baseline was added/changed/cleared, the cached classes[].level may
      // be stale. Recompute through the rules engine so the cache is accurate.
      if (request.baseline !== undefined) {
        await recalculateDogLevels(userId, dogId);
        updatedDog = (await getDogById(dogId)) ?? updatedDog;
      }

      const response: ApiResponse = {
        success: true,
        data: updatedDog,
        message: `Dog "${updatedDog.name}" updated successfully`,
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: unknown) {
      const err = asCaught(error);
      console.error("Error updating dog:", error);

      if (err.statusCode) {
        const response: ApiResponse = {
          success: false,
          error: err.statusCode === 404 ? "not_found" : "validation_error",
          message: err.message,
        };

        return {
          statusCode: err.statusCode,
          body: JSON.stringify(response),
        };
      }

      const response: ApiResponse = {
        success: false,
        error: "database_error",
        message: "Failed to update dog",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
      };
    }
  },
  // DELETE /dogs/{id} - Hard delete a dog (permanent removal)
  hardDeleteDog: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      const userId = event.user!.userId;
      const dogId = event.pathParameters?.id;

      if (!dogId) {
        throw createError(400, "Dog ID is required");
      }

      // Verify dog exists and belongs to user
      const existingDog = await getDogById(dogId);
      if (!existingDog) {
        throw createError(404, "Dog not found");
      }

      if (existingDog.userId !== userId) {
        throw createError(403, "Not authorized to delete this dog");
      }

      const success = await hardDeleteDog(dogId, userId);

      if (!success) {
        throw createError(500, "Failed to delete dog");
      }

      const response: ApiResponse = {
        success: true,
        message: `Dog "${existingDog.name}" permanently deleted`,
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: unknown) {
      const err = asCaught(error);
      console.error("Error hard deleting dog:", error);

      if (err.statusCode) {
        const response: ApiResponse = {
          success: false,
          error: err.statusCode === 404 ? "not_found" : "validation_error",
          message: err.message,
        };

        return {
          statusCode: err.statusCode,
          body: JSON.stringify(response),
        };
      }

      const response: ApiResponse = {
        success: false,
        error: "database_error",
        message: "Failed to permanently delete dog",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
      };
    }
  },

  // Shared function to generate presigned URLs for photo uploads with full validation
  _generatePhotoUploadUrlInternal: async (
    event: AuthenticatedEvent,
    isCropped: boolean = false
  ): Promise<APIGatewayProxyResultV2> => {
    try {
      const userId = event.user!.userId;
      const dogId = event.pathParameters?.id;

      if (!dogId) {
        throw createError(400, "Dog ID is required");
      }

      // Verify dog exists and belongs to user
      const existingDog = await getDogById(dogId);
      if (!existingDog) {
        throw createError(404, "Dog not found");
      }

      if (existingDog.userId !== userId) {
        throw createError(403, "Not authorized to upload photo for this dog");
      }

      // Parse content type from request body if provided
      const body = event.body as { contentType?: string } | undefined;
      const contentType = body?.contentType || "image/jpeg";

      // Initialize S3 client
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || "us-east-1"
      });

      // Generate file extension based on content type
      const getFileExtension = (type: string): string => {
        switch (type) {
          case "image/png": return "png";
          case "image/gif": return "gif";
          case "image/webp": return "webp";
          default: return "jpg";
        }
      };

      // Generate unique key for the photo
      const timestamp = Date.now();
      const extension = getFileExtension(contentType);
      const suffix = isCropped ? "-cropped" : "";
      const key = `dog-photos/${dogId}/${timestamp}${suffix}.${extension}`;

      // Create metadata
      const metadata: Record<string, string> = {
        dogId: dogId,
        userId: userId,
        uploadedAt: timestamp.toString()
      };

      if (isCropped) {
        metadata.imageType = "cropped";
      }

      // Create the PutObject command
      const command = new PutObjectCommand({
        Bucket: "myagilityqs-frontend",
        Key: key,
        ContentType: contentType,
        Metadata: metadata
      });

      // Generate presigned URL (expires in 5 minutes)
      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

      // The photo will be accessible at this URL after upload
      const photoUrl = `https://myagilityqs.com/${key}`;

      const response: ApiResponse = {
        success: true,
        data: {
          uploadUrl,
          photoUrl,
          key
        },
        message: `Presigned URL${isCropped ? " for cropped photo" : ""} generated successfully`,
        meta: {
          corsNote: "If you get CORS errors, ensure the S3 bucket has proper CORS configuration allowing PUT requests from your origin",
          expiresIn: 300
        }
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: unknown) {
      const err = asCaught(error);
      const errorType = isCropped ? "cropped photo" : "photo";
      console.error(`Error generating ${errorType} upload URL:`, error);

      if (err.statusCode) {
        const response: ApiResponse = {
          success: false,
          error: err.statusCode === 404 ? "not_found" : "validation_error",
          message: err.message,
        };

        return {
          statusCode: err.statusCode,
          body: JSON.stringify(response),
        };
      }

      const response: ApiResponse = {
        success: false,
        error: "server_error",
        message: `Failed to generate ${errorType} upload URL`,
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
      };
    }
  },

  // POST /dogs/{id}/photo/upload-url - Generate presigned URL for photo upload
  generatePhotoUploadUrl: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    return dogHandler._generatePhotoUploadUrlInternal(event, false);
  },


  // POST /dogs/{id}/photo/cropped-upload-url - Generate presigned URL for cropped photo upload
  generateCroppedPhotoUploadUrl: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    return dogHandler._generatePhotoUploadUrlInternal(event, true);
  },
};
