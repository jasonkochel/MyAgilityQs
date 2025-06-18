import { CognitoJwtVerifier } from "aws-jwt-verify";
import { APIGatewayProxyEventV2 } from "aws-lambda";
import createError from "http-errors";
import { anonymousRoutes } from "../router";

// Create verifiers outside the handler to reuse them
const accessTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: "access",
  clientId: process.env.COGNITO_CLIENT_ID!,
  includeRawJwtInErrors: true,
});

export interface AuthenticatedEvent extends APIGatewayProxyEventV2 {
  user?: {
    userId: string;
    email: string;
    username: string;
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
        console.error("[JWT ERROR] Protected route accessed without token:", routeKey);
        throw createError(401, "Authorization header missing");
      }

      try {
        let payload;
        try {
          payload = await accessTokenVerifier.verify(token);
        } catch (accessError) {
          console.error("[JWT ERROR] Access token error:", accessError);
          throw accessError; // Throw the original access token error
        }

        // Add user context to the event
        event.user = {
          userId: payload.sub,
          email: String(payload.email || ""),
          username: String(payload["cognito:username"] || payload.username || ""),
        };
      } catch (error: any) {
        console.error("[JWT ERROR] Authentication failed for protected route:", routeKey);
        console.error("[JWT ERROR] Error:", error.message);
        throw createError(401, "Invalid or expired token");
      }
    },
  };
};
