import middy from "@middy/core";
import cors from "@middy/http-cors";
import httpErrorHandler from "@middy/http-error-handler";
import jsonBodyParser from "@middy/http-json-body-parser";
import createRouter from "@middy/http-router";

// Import routes and conditional auth middleware
// DEBUG: CORS middleware temporarily disabled for testing
import { conditionalJwtAuth } from "./middleware/jwtAuth";
import { routes } from "./router";

// Create the router with all route definitions
const router = createRouter(routes);

// Main handler with middleware stack
export const handler = middy(router)
  .use(jsonBodyParser({ disableContentTypeError: true }))
  .use(
    cors({
      origin: "*", // Allow any origin
      credentials: false, // Must be false when origin is "*"
      headers: "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token", // Allowed headers
      methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS", // Allowed methods
    })
  )
  .use(conditionalJwtAuth()) // Apply JWT auth conditionally based on route
  .use(httpErrorHandler());
