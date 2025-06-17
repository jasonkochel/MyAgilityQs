import middy from "@middy/core";
import cors from "@middy/http-cors";
import httpErrorHandler from "@middy/http-error-handler";
import jsonBodyParser from "@middy/http-json-body-parser";
import { ApiResponse } from "@my-agility-qs/shared";
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";

// Route handlers
import { authHandler } from "./routes/auth";
import { dogHandler } from "./routes/dogs";
import { healthHandler } from "./routes/health";
import { progressHandler } from "./routes/progress";
import { runHandler } from "./routes/runs";

// Route definitions - clean and declarative
const routes: Record<string, (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>> = {
  // Health
  "GET /health": healthHandler,

  // Auth
  "POST /auth/login": authHandler.login,
  "POST /auth/google": authHandler.googleLogin,
  "POST /auth/refresh": authHandler.refresh,
  "POST /auth/logout": authHandler.logout,

  // Dogs
  "GET /dogs": dogHandler.getDogs,
  "POST /dogs": dogHandler.createDog,
  "PUT /dogs/{id}": dogHandler.updateDog,
  "PATCH /dogs/{id}/status": dogHandler.updateDogStatus,

  // Runs
  "GET /runs": runHandler.getRuns,
  "GET /runs/dog/{dogId}": runHandler.getRunsByDog,
  "POST /runs": runHandler.createRun,
  "PUT /runs/{id}": runHandler.updateRun,
  "DELETE /runs/{id}": runHandler.deleteRun,

  // Progress
  "GET /progress/{dogId}": progressHandler.getDogProgress,
  "GET /locations": progressHandler.getLocations,
};

// Helper function to extract path parameters from dynamic routes
const extractPathParams = (
  routePattern: string,
  actualPath: string
): Record<string, string> | null => {
  const routeParts = routePattern.split("/");
  const pathParts = actualPath.split("/");

  if (routeParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i];
    const pathPart = pathParts[i];

    if (routePart.startsWith("{") && routePart.endsWith("}")) {
      // This is a parameter
      const paramName = routePart.slice(1, -1);
      params[paramName] = pathPart;
    } else if (routePart !== pathPart) {
      // Static parts don't match
      return null;
    }
  }

  return params;
};

// Clean router function
const router = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const { httpMethod, path } = event;
  const routeKey = `${httpMethod} ${path}`;

  // Try exact match first
  if (routes[routeKey]) {
    return await routes[routeKey](event);
  }

  // Try pattern matching for dynamic routes
  for (const [pattern, handler] of Object.entries(routes)) {
    const [method, routePath] = pattern.split(" ", 2);

    if (method === httpMethod) {
      const pathParams = extractPathParams(routePath, path);
      if (pathParams) {
        // Add path parameters to the event
        event.pathParameters = { ...event.pathParameters, ...pathParams };
        return await handler(event);
      }
    }
  }

  // 404 for unknown routes
  const notFoundResponse: ApiResponse = {
    success: false,
    error: "not_found",
    message: `Route ${httpMethod} ${path} not found`,
  };

  return {
    statusCode: 404,
    body: JSON.stringify(notFoundResponse),
    headers: {
      "Content-Type": "application/json",
    },
  };
};

// Main handler function
const lambdaHandler = async (
  event: any, // Use any to handle both REST API and HTTP API formats
  context: Context
): Promise<APIGatewayProxyResult> => {
  // Handle both REST API and HTTP API formats
  const httpMethod = event.httpMethod || event.requestContext?.http?.method || 'GET';
  const path = event.path || event.rawPath || event.requestContext?.http?.path || '/';
  
  console.log(`Event structure:`, JSON.stringify(event, null, 2));
  console.log(`${httpMethod} ${path}`);

  // Add the normalized values to the event for the router
  const normalizedEvent = {
    ...event,
    httpMethod,
    path,
  };

  try {
    return await router(normalizedEvent);
  } catch (error) {
    console.error("Handler error:", error);

    const errorResponse: ApiResponse = {
      success: false,
      error: "internal_server_error",
      message: "An unexpected error occurred",
    };

    return {
      statusCode: 500,
      body: JSON.stringify(errorResponse),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }
};

// Export the handler with Middy middleware
export const handler = middy(lambdaHandler)
  .use(jsonBodyParser({
    disableContentTypeError: true,
  }))
  .use(
    cors({
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      credentials: true,
    })
  )
  .use(httpErrorHandler());
