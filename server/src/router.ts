import { Route } from "@middy/http-router";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { authHandler } from "./routes/auth";
import { dogHandler } from "./routes/dogs";
import { healthHandler } from "./routes/health";
import { progressHandler } from "./routes/progress";
import { runHandler } from "./routes/runs";

// Extended Route interface to include allowAnonymous property
interface ExtendedRoute extends Route<APIGatewayProxyEventV2, APIGatewayProxyResultV2> {
  allowAnonymous?: boolean;
}

// OPTIONS handler for CORS preflight requests
const optionsHandler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
      "Access-Control-Max-Age": "86400", // 24 hours
    },
    body: "",
  };
};

// Define routes with their handlers
export const routes: ExtendedRoute[] = [
  // Catch-all OPTIONS handler for CORS preflight requests
  {
    method: "OPTIONS",
    path: "/{proxy+}",
    handler: optionsHandler,
    allowAnonymous: true,
  },

  // Health endpoint - no auth required
  {
    method: "GET",
    path: "/health",
    handler: healthHandler,
    allowAnonymous: true,
  },

  // Auth endpoints - no auth required
  {
    method: "POST",
    path: "/auth/login",
    handler: authHandler.login,
    allowAnonymous: true,
  },
  {
    method: "POST",
    path: "/auth/signup",
    handler: authHandler.signup,
    allowAnonymous: true,
  },
  {
    method: "POST",
    path: "/auth/google",
    handler: authHandler.googleLogin,
    allowAnonymous: true,
  },
  {
    method: "POST",
    path: "/auth/refresh",
    handler: authHandler.refresh,
    allowAnonymous: true,
  },
  {
    method: "POST",
    path: "/auth/logout",
    handler: authHandler.logout,
    allowAnonymous: true,
  },
  // Dog endpoints - require authentication
  {
    method: "GET",
    path: "/dogs",
    handler: dogHandler.getDogs,
  },
  {
    method: "GET",
    path: "/dogs/{id}",
    handler: dogHandler.getDog,
  },
  {
    method: "POST",
    path: "/dogs",
    handler: dogHandler.createDog,
  },
  {
    method: "PUT",
    path: "/dogs/{id}",
    handler: dogHandler.updateDog,
  },
  {
    method: "DELETE",
    path: "/dogs/{id}",
    handler: dogHandler.hardDeleteDog,
  },

  // Run endpoints - require authentication
  {
    method: "GET",
    path: "/runs",
    handler: runHandler.getRuns,
  },
  {
    method: "GET",
    path: "/runs/dog/{dogId}",
    handler: runHandler.getRunsByDog,
  },
  {
    method: "POST",
    path: "/runs",
    handler: runHandler.createRun,
  },
  {
    method: "PUT",
    path: "/runs/{id}",
    handler: runHandler.updateRun,
  },
  {
    method: "DELETE",
    path: "/runs/{id}",
    handler: runHandler.deleteRun,
  },
  // Progress endpoints - require authentication
  {
    method: "GET",
    path: "/progress",
    handler: progressHandler.getAllProgress,
  },
  {
    method: "GET",
    path: "/progress/summary",
    handler: progressHandler.getProgressSummary,
  },
  {
    method: "GET",
    path: "/progress/dog/{dogId}",
    handler: progressHandler.getDogProgress,
  },
  {
    method: "GET",
    path: "/locations",
    handler: progressHandler.getLocations,
  },
];

// Dynamically derive anonymous routes from routes with allowAnonymous: true
export const anonymousRoutes = routes
  .filter((route): route is ExtendedRoute => (route as ExtendedRoute).allowAnonymous === true)
  .map((route) => `${route.method} ${route.path}`);
