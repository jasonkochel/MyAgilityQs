import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ApiResponse, CreateDogRequest, UpdateDogRequest } from "@my-agility-qs/shared";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import createError from "http-errors";
import {
    createDog,
    getDogById,
    getDogsByUserId,
    hardDeleteDog,
    updateDog,
} from "../database/index.js";
import { AuthenticatedEvent } from "../middleware/jwtAuth.js";

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
    } catch (error: any) {
      console.error("Error creating dog:", error);

      if (error.statusCode) {
        const response: ApiResponse = {
          success: false,
          error: "validation_error",
          message: error.message,
        };

        return {
          statusCode: error.statusCode,
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

      const updatedDog = await updateDog(dogId, userId, request);

      if (!updatedDog) {
        throw createError(404, "Dog not found or no changes made");
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
    } catch (error: any) {
      console.error("Error updating dog:", error);

      if (error.statusCode) {
        const response: ApiResponse = {
          success: false,
          error: error.statusCode === 404 ? "not_found" : "validation_error",
          message: error.message,
        };

        return {
          statusCode: error.statusCode,
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
    } catch (error: any) {
      console.error("Error hard deleting dog:", error);

      if (error.statusCode) {
        const response: ApiResponse = {
          success: false,
          error: error.statusCode === 404 ? "not_found" : "validation_error",
          message: error.message,
        };

        return {
          statusCode: error.statusCode,
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
      const body = event.body as any;
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
    } catch (error: any) {
      const errorType = isCropped ? "cropped photo" : "photo";
      console.error(`Error generating ${errorType} upload URL:`, error);

      if (error.statusCode) {
        const response: ApiResponse = {
          success: false,
          error: error.statusCode === 404 ? "not_found" : "validation_error",
          message: error.message,
        };

        return {
          statusCode: error.statusCode,
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
