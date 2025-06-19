import { ApiResponse, UpdateUserRequest } from "@my-agility-qs/shared";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import createError from "http-errors";
import {
  createOrUpdateUserProfile,
  getUserProfile,
  updateUserPreferences,
} from "../database/index.js";
import { AuthenticatedEvent } from "../middleware/jwtAuth.js";

// User management handlers
export const userHandler = {
  // GET /user/profile - Get current user profile
  getUserProfile: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      const userId = event.user!.userId;
      const userEmail = event.user!.email || ""; // Empty string if not in JWT

      // Try to get existing profile
      let user = await getUserProfile(userId);

      if (!user) {
        // Create default profile for new users
        // For legacy users (created before proper signup flow), email might not be available
        // Use "unknown" as a placeholder - the client can handle this
        user = await createOrUpdateUserProfile(userId, userEmail || "unknown");
      }

      const response: ApiResponse = {
        success: true,
        data: user,
        message: "User profile retrieved successfully",
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error) {
      console.error("Error getting user profile:", error);

      const response: ApiResponse = {
        success: false,
        error: "database_error",
        message: "Failed to retrieve user profile",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
      };
    }
  },

  // PUT /user/profile - Update user preferences
  updateUserProfile: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      const userId = event.user!.userId;

      if (!event.body) {
        throw createError(400, "Request body is required");
      }

      const request = event.body as unknown as UpdateUserRequest;

      const updatedUser = await updateUserPreferences(userId, request);

      if (!updatedUser) {
        throw createError(404, "User profile not found");
      }

      const response: ApiResponse = {
        success: true,
        data: updatedUser,
        message: "User profile updated successfully",
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      console.error("Error updating user profile:", error);

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
        message: "Failed to update user profile",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
      };
    }
  },
};
