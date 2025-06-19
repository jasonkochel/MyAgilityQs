import { ApiResponse } from "@my-agility-qs/shared";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import createError from "http-errors";
import {
  calculateDogProgress,
  calculateUserProgressSummary,
  getAllDogsProgress,
  getDogById,
  getRunsByUserId,
} from "../database/index.js";
import { AuthenticatedEvent } from "../middleware/jwtAuth.js";

// Progress/statistics handlers - full database implementation
export const progressHandler = {
  // GET /progress/dog/{dogId} - Get progress for a specific dog
  getDogProgress: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
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
        throw createError(403, "Not authorized to view progress for this dog");
      }

      // Calculate fresh progress
      const progress = await calculateDogProgress(userId, dogId);

      const response: ApiResponse = {
        success: true,
        data: progress,
        message: `Progress calculated for ${dog.name}`,
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      console.error("Error getting dog progress:", error);

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
        message: "Failed to retrieve dog progress",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
      };
    }
  },

  // GET /progress - Get progress for all user's dogs
  getAllProgress: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      const userId = event.user!.userId;

      const progressList = await getAllDogsProgress(userId);

      const response: ApiResponse = {
        success: true,
        data: progressList,
        message: `Progress calculated for ${progressList.length} dogs`,
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      console.error("Error getting all progress:", error);

      const response: ApiResponse = {
        success: false,
        error: "database_error",
        message: "Failed to retrieve progress",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
      };
    }
  },

  // GET /progress/summary - Get summary statistics for user
  getProgressSummary: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      const userId = event.user!.userId;

      const summary = await calculateUserProgressSummary(userId);

      const response: ApiResponse = {
        success: true,
        data: summary,
        message: `Summary calculated for user`,
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      console.error("Error getting progress summary:", error);

      const response: ApiResponse = {
        success: false,
        error: "database_error",
        message: "Failed to retrieve progress summary",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
      };
    }
  },

  // GET /locations - Get unique locations from user's runs
  getLocations: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      const userId = event.user!.userId;

      const runs = await getRunsByUserId(userId);
      const locations = [
        ...new Set(runs.map((run) => run.location).filter((location) => location)),
      ];

      const response: ApiResponse = {
        success: true,
        data: locations.sort(),
        message: `Found ${locations.length} unique locations`,
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      console.error("Error getting locations:", error);

      const response: ApiResponse = {
        success: false,
        error: "database_error",
        message: "Failed to retrieve locations",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
      };
    }
  },
};
