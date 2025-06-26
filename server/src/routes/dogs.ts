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
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Jimp } from "jimp";

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

  // POST /dogs/{id}/photo/upload-url - Generate presigned URL for photo upload
  generatePhotoUploadUrl: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
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

      // Initialize S3 client
      const s3Client = new S3Client({ 
        region: process.env.AWS_REGION || "us-east-1" 
      });
      
      // Parse content type from request body if provided
      const body = event.body as any;
      const contentType = body?.contentType || "image/jpeg";
      
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
      const key = `dog-photos/${dogId}/${timestamp}.${extension}`;
      
      // Create the PutObject command
      const command = new PutObjectCommand({
        Bucket: "myagilityqs-frontend", 
        Key: key,
        ContentType: contentType,
        Metadata: {
          dogId: dogId,
          userId: userId,
          uploadedAt: timestamp.toString()
        }
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
        message: "Presigned URL generated successfully",
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
      console.error("Error generating photo upload URL:", error);

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
        message: "Failed to generate photo upload URL",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
      };
    }
  },

  // POST /dogs/{id}/photo/crop - Generate cropped version of uploaded photo
  generateCroppedPhoto: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
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
        throw createError(403, "Not authorized to crop photo for this dog");
      }

      const body = event.body as any;
      if (!body?.originalKey || !body?.cropData) {
        throw createError(400, "Original photo key and crop data are required");
      }

      const { originalKey, cropData } = body;
      const { x, y, width, height } = cropData;

      // Initialize S3 client
      const s3Client = new S3Client({ 
        region: process.env.AWS_REGION || "us-east-1" 
      });

      // Download original image from S3
      const getCommand = new GetObjectCommand({
        Bucket: "myagilityqs-frontend",
        Key: originalKey
      });

      const originalObject = await s3Client.send(getCommand);
      if (!originalObject.Body) {
        throw createError(404, "Original photo not found");
      }

      // Convert stream to buffer
      const originalBuffer = Buffer.from(await originalObject.Body.transformToByteArray());

      // Load image with Jimp
      const image = await Jimp.read(originalBuffer);
      
      // Get original image dimensions
      const imageWidth = image.getWidth();
      const imageHeight = image.getHeight();

      // Convert percentage-based crop coordinates to pixels
      const cropLeft = Math.round((x / 100) * imageWidth);
      const cropTop = Math.round((y / 100) * imageHeight);
      const cropWidth = Math.round((width / 100) * imageWidth);
      const cropHeight = Math.round((height / 100) * imageHeight);

      // Generate cropped image with Jimp
      const croppedImage = image.crop(cropLeft, cropTop, cropWidth, cropHeight);
      
      // Set JPEG quality and get buffer
      croppedImage.quality(85);
      const croppedBuffer = await croppedImage.getBufferAsync(Jimp.MIME_JPEG);

      // Generate key for cropped image
      const originalKeyParts = originalKey.split('.');
      const extension = originalKeyParts.pop();
      const baseName = originalKeyParts.join('.');
      const croppedKey = `${baseName}-cropped.${extension}`;

      // Upload cropped image to S3
      const putCommand = new PutObjectCommand({
        Bucket: "myagilityqs-frontend",
        Key: croppedKey,
        Body: croppedBuffer,
        ContentType: "image/jpeg",
        Metadata: {
          dogId: dogId,
          userId: userId,
          originalKey: originalKey,
          cropData: JSON.stringify(cropData),
          generatedAt: Date.now().toString()
        }
      });

      await s3Client.send(putCommand);

      // Generate the URL for the cropped image
      const croppedPhotoUrl = `https://myagilityqs.com/${croppedKey}`;

      const response: ApiResponse = {
        success: true,
        data: {
          croppedPhotoUrl,
          croppedKey
        },
        message: "Cropped photo generated successfully"
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      console.error("Error generating cropped photo:", error);

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
        message: "Failed to generate cropped photo",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
      };
    }
  },
};
