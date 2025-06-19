import { ApiResponse, CreateRunRequest, RunsQuery, UpdateRunRequest } from "@my-agility-qs/shared";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import createError from "http-errors";
import {
  createRun,
  deleteRun,
  getDogById,
  getRunById,
  getRunsByDogId,
  getRunsByUserId,
  updateRun,
} from "../database/index.js";
import { AuthenticatedEvent } from "../middleware/jwtAuth.js";

// Run management handlers - full database implementation
export const runHandler = {
  // GET /runs - Get all runs for authenticated user with optional filtering
  getRuns: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      const userId = event.user!.userId;

      // Parse query parameters
      const query: RunsQuery = {};
      if (event.queryStringParameters) {
        const params = event.queryStringParameters;
        if (params.dogId) query.dogId = params.dogId;
        if (params.class) query.class = params.class as any;
        if (params.level) query.level = params.level as any;
        if (params.qualified) query.qualified = params.qualified === "true";
        if (params.limit) query.limit = parseInt(params.limit);
        if (params.sort) query.sort = params.sort as any;
        if (params.order) query.order = params.order as any;
      }

      const runs = await getRunsByUserId(userId, query);

      const response: ApiResponse = {
        success: true,
        data: runs,
        message: `Found ${runs.length} runs`,
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      console.error("Error getting runs:", error);

      const response: ApiResponse = {
        success: false,
        error: "database_error",
        message: "Failed to retrieve runs",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
      };
    }
  },

  // GET /runs/dog/{dogId} - Get runs for a specific dog
  getRunsByDog: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      const userId = event.user!.userId;
      const dogId = event.pathParameters?.dogId;

      if (!dogId) {
        throw createError(400, "Dog ID is required");
      }

      // Verify dog belongs to user
      const dog = await getDogById(dogId);
      if (!dog) {
        throw createError(404, "Dog not found");
      }

      if (dog.userId !== userId) {
        throw createError(403, "Not authorized to view runs for this dog");
      }

      // Parse query parameters
      const query: RunsQuery = {};
      if (event.queryStringParameters) {
        const params = event.queryStringParameters;
        if (params.class) query.class = params.class as any;
        if (params.level) query.level = params.level as any;
        if (params.qualified) query.qualified = params.qualified === "true";
        if (params.limit) query.limit = parseInt(params.limit);
        if (params.sort) query.sort = params.sort as any;
        if (params.order) query.order = params.order as any;
      }

      const runs = await getRunsByDogId(dogId, query);

      const response: ApiResponse = {
        success: true,
        data: runs,
        message: `Found ${runs.length} runs for ${dog.name}`,
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      console.error("Error getting runs by dog:", error);

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
        message: "Failed to retrieve runs",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
      };
    }
  },

  // POST /runs - Create a new run
  createRun: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      const userId = event.user!.userId;

      if (!event.body) {
        throw createError(400, "Request body is required");
      }

      const request = event.body as unknown as CreateRunRequest;

      // Validate required fields
      if (!request.dogId || !request.date || !request.class || !request.level) {
        throw createError(400, "Invalid request: dogId, date, class, and level are required");
      }

      // Verify dog belongs to user
      const dog = await getDogById(request.dogId);
      if (!dog) {
        throw createError(404, "Dog not found");
      }

      if (dog.userId !== userId) {
        throw createError(403, "Not authorized to create runs for this dog");
      }
      const result = await createRun(userId, request);

      const response: ApiResponse = {
        success: true,
        data: result.run,
        message: result.levelProgression
          ? `Run created successfully for ${dog.name}! 🎉 ${result.levelProgression.dogName} advanced from ${result.levelProgression.fromLevel} to ${result.levelProgression.toLevel} in ${result.levelProgression.class}!`
          : `Run created successfully for ${dog.name}`,
        meta: result.levelProgression ? { levelProgression: result.levelProgression } : undefined,
      };

      return {
        statusCode: 201,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      console.error("Error creating run:", error);

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
        message: "Failed to create run",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
      };
    }
  },

  // PUT /runs/{id} - Update a run
  updateRun: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      const userId = event.user!.userId;
      const runId = event.pathParameters?.id;

      if (!runId) {
        throw createError(400, "Run ID is required");
      }

      if (!event.body) {
        throw createError(400, "Request body is required");
      }

      const request = event.body as unknown as UpdateRunRequest;

      // Verify run exists and user has permission
      const existingRun = await getRunById(runId);
      if (!existingRun) {
        throw createError(404, "Run not found");
      }

      // Verify dog belongs to user
      const dog = await getDogById(existingRun.dogId);
      if (!dog || dog.userId !== userId) {
        throw createError(403, "Not authorized to update this run");
      }

      const updatedRun = await updateRun(runId, userId, request);

      if (!updatedRun) {
        throw createError(404, "Run not found or no changes made");
      }

      const response: ApiResponse = {
        success: true,
        data: updatedRun,
        message: `Run updated successfully`,
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      console.error("Error updating run:", error);

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
        message: "Failed to update run",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
      };
    }
  },

  // DELETE /runs/{id} - Delete a run
  deleteRun: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      const userId = event.user!.userId;
      const runId = event.pathParameters?.id;

      if (!runId) {
        throw createError(400, "Run ID is required");
      }

      // Verify run exists and user has permission
      const existingRun = await getRunById(runId);
      if (!existingRun) {
        throw createError(404, "Run not found");
      }

      // Verify dog belongs to user
      const dog = await getDogById(existingRun.dogId);
      if (!dog || dog.userId !== userId) {
        throw createError(403, "Not authorized to delete this run");
      }

      const success = await deleteRun(runId, userId);

      if (!success) {
        throw createError(404, "Run not found");
      }

      const response: ApiResponse = {
        success: true,
        message: `Run deleted successfully`,
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      console.error("Error deleting run:", error);

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
        message: "Failed to delete run",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
      };
    }
  },

  // POST /runs/batch - Batch import runs
  batchImportRuns: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      const userId = event.user!.userId;

      if (!event.body) {
        const response: ApiResponse = {
          success: false,
          error: "bad_request",
          message: "Request body is required",
        };
        return {
          statusCode: 400,
          body: JSON.stringify(response),
        };
      }

      let parsedBody;
      if (typeof event.body === "string") {
        parsedBody = JSON.parse(event.body);
      } else {
        parsedBody = event.body;
      }

      const { runs: runRequests } = parsedBody as { runs: CreateRunRequest[] };

      if (!Array.isArray(runRequests) || runRequests.length === 0) {
        const response: ApiResponse = {
          success: false,
          error: "bad_request",
          message: "Runs array is required and must not be empty",
        };
        return {
          statusCode: 400,
          body: JSON.stringify(response),
        };
      }

      const successful: any[] = [];
      const failed: Array<{ request: CreateRunRequest; error: string }> = [];

      // Process each run request
      for (const runRequest of runRequests) {
        try {
          // Validate that the dog belongs to the user
          const dog = await getDogById(runRequest.dogId);
          if (!dog || dog.userId !== userId) {
            failed.push({
              request: runRequest,
              error: "Dog not found or does not belong to user",
            });
            continue;
          } // Create the run
          const result = await createRun(userId, {
            ...runRequest,
            qualified: runRequest.qualified ?? false, // Default to false if not specified
          });

          successful.push(result.run);
        } catch (error: any) {
          failed.push({
            request: runRequest,
            error: error.message || "Failed to create run",
          });
        }
      }

      const batchResponse = {
        successful,
        failed,
        totalRequested: runRequests.length,
        totalSuccessful: successful.length,
        totalFailed: failed.length,
      };

      const response: ApiResponse = {
        success: true,
        data: batchResponse,
        message: `Batch import completed: ${successful.length} successful, ${failed.length} failed`,
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      console.error("Error in batch import runs:", error);

      const response: ApiResponse = {
        success: false,
        error: "internal_error",
        message: "Failed to process batch import",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
      };
    }
  },
};
