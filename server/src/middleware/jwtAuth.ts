import { CognitoJwtVerifier } from "aws-jwt-verify";
import { APIGatewayProxyEventV2 } from "aws-lambda";
import createError from "http-errors";
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
        console.error("[JWT ERROR] Protected route accessed without token:", routeKey);
        throw createError(401, "Authorization header missing");
      }
      try {
        let payload;

        try {
          // Verify the ID token (contains user profile information like email)
          payload = await idTokenVerifier.verify(token);
          console.log("ID token verified successfully");
        } catch (idError) {
          console.error("[JWT ERROR] ID token verification failed:", idError);
          throw idError;
        }

        // Extract email from ID token
        const email = String(payload.email || "");

        console.log("JWT payload email:", email, "JWT payload sub:", payload.sub);
        console.log("Token type:", payload.token_use);

        // Validate email exists and is not empty
        if (!email || email.trim() === "") {
          console.error("JWT token missing email field:", { payload });
          throw createError(401, "Token missing required email field");
        }

        event.user = {
          userId: email, // Use email as userId for consistent database operations
          email: email,
          username: String(payload["cognito:username"] || payload.username || ""),
          cognitoSub: payload.sub, // Keep original Cognito user ID for reference
        };
      } catch (error: any) {
        console.error("[JWT ERROR] Authentication failed for protected route:", routeKey);
        console.error("[JWT ERROR] Error:", error.message);
        throw createError(401, "Invalid or expired token");
      }
    },
  };
};
