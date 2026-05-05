import { CognitoJwtVerifier } from "aws-jwt-verify";
import { APIGatewayProxyEventV2 } from "aws-lambda";
import createError from "http-errors";
import { asCaught } from "../utils/errors.js";
import { anonymousRoutes } from "../router";

// Create verifiers outside the handler to reuse them
const idTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: "id",
  clientId: process.env.COGNITO_CLIENT_ID!,
  includeRawJwtInErrors: true,
});

export interface AuthenticatedEvent extends APIGatewayProxyEventV2 {
  user?: {
    userId: string; // This will be the email for consistent database operations
    email: string;
    username: string;
    cognitoSub: string; // Original Cognito user ID for reference
  };
}

export const conditionalJwtAuth = () => {
  return {
    before: async (request: { event: AuthenticatedEvent }) => {
      const { event } = request; // Extract HTTP method and path from HTTP API Gateway v2 event
      const httpMethod = event.requestContext.http.method;
      const path = event.rawPath;

      // Always allow OPTIONS requests (CORS preflight)
      if (httpMethod === "OPTIONS") {
        return;
      }

      // Determine the route key
      const routeKey = `${httpMethod} ${path}`;

      // Check if this is an anonymous route
      const isAnonymous = anonymousRoutes.includes(routeKey);

      // For anonymous routes, skip authentication entirely
      if (isAnonymous) {
        return;
      }

      // For protected routes, require valid JWT
      const authHeader = event.headers?.authorization || event.headers?.Authorization;
      const token = authHeader?.replace(/^Bearer\s+/i, "");

      if (!token) {
        throw createError(401, "Authorization header missing");
      }
      try {
        const payload = await idTokenVerifier.verify(token);
        const email = String(payload.email || "");

        if (!email || email.trim() === "") {
          throw createError(401, "Token missing required email field");
        }

        event.user = {
          userId: email,
          email: email,
          username: String(payload["cognito:username"] || payload.username || ""),
          cognitoSub: payload.sub,
        };
      } catch (error: unknown) {
        if (asCaught(error).statusCode === 401) throw error;
        throw createError(401, "Invalid or expired token");
      }
    },
  };
};
