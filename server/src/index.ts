import middy from "@middy/core";
import cors from "@middy/http-cors";
import httpErrorHandler from "@middy/http-error-handler";
import jsonBodyParser from "@middy/http-json-body-parser";
import createRouter from "@middy/http-router";
import * as Sentry from "@sentry/serverless";
import { conditionalJwtAuth } from "./middleware/jwtAuth";
import { sentryContext } from "./middleware/sentryContext";
import { routes } from "./router";

// Validate required environment variables
if (!process.env.SENTRY_DSN) {
  throw new Error('SENTRY_DSN environment variable is required');
}
if (!process.env.ENVIRONMENT) {
  throw new Error('ENVIRONMENT environment variable is required');
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.ENVIRONMENT,
  tracesSampleRate: process.env.ENVIRONMENT === "production" ? 0.1 : 1.0,
});

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
  .use(conditionalJwtAuth())
  .use(sentryContext())
  .use(httpErrorHandler());
