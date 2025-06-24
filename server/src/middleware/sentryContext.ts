import * as Sentry from "@sentry/serverless";
import type { Request } from "@middy/core";

/**
 * Middy middleware to add Sentry context for better error tracking
 */
export const sentryContext = () => ({
  before: (request: Request) => {
    Sentry.withScope((scope) => {
      // Add request context
      scope.setTag("requestId", request.context.awsRequestId);
      scope.setTag("functionName", request.context.functionName);
      scope.setTag("functionVersion", request.context.functionVersion);
      
      // Add HTTP context
      if (request.event.httpMethod) {
        scope.setTag("httpMethod", request.event.httpMethod);
        scope.setTag("path", request.event.path);
        scope.setTag("userAgent", request.event.headers?.["User-Agent"] || request.event.headers?.["user-agent"]);
        scope.setTag("sourceIp", request.event.requestContext?.identity?.sourceIp);
      }

      // Add user context if available (from JWT auth middleware)
      if (request.event.user) {
        scope.setUser({
          id: request.event.user.userId,
          email: request.event.user.email,
          username: request.event.user.username,
        });
        scope.setTag("userId", request.event.user.userId);
      }

      // Add route-specific context
      if (request.event.pathParameters) {
        scope.setContext("pathParameters", request.event.pathParameters);
      }
      
      if (request.event.queryStringParameters) {
        scope.setContext("queryStringParameters", request.event.queryStringParameters);
      }

      // Set transaction name for performance monitoring
      const routeName = `${request.event.httpMethod} ${request.event.path}`;
      scope.setTransactionName(routeName);
    });

    // Add breadcrumb for the incoming request
    Sentry.addBreadcrumb({
      category: "http",
      message: `${request.event.httpMethod} ${request.event.path}`,
      data: {
        url: request.event.path,
        method: request.event.httpMethod,
        userId: request.event.user?.userId,
        requestId: request.context.awsRequestId,
      },
      level: "info",
      timestamp: Date.now() / 1000,
    });
  },

  after: (request: Request) => {
    // Add breadcrumb for successful responses
    const response = request.response;
    if (response && response.statusCode < 400) {
      Sentry.addBreadcrumb({
        category: "http",
        message: `${request.event.httpMethod} ${request.event.path} - ${response.statusCode}`,
        data: {
          statusCode: response.statusCode,
          userId: request.event.user?.userId,
          requestId: request.context.awsRequestId,
        },
        level: "info",
        timestamp: Date.now() / 1000,
      });
    }
  },

  onError: (request: Request) => {
    // Additional context on error
    Sentry.withScope((scope) => {
      scope.setTag("hasError", true);
      scope.setTag("apiRoute", `${request.event.httpMethod} ${request.event.path}`);
      scope.setContext("requestBody", request.event.body);
      scope.setContext("requestHeaders", request.event.headers);
      
      // Capture any additional error context
      if (request.error) {
        scope.setLevel("error");
        
        // Add specific context based on error type
        const errorName = request.error.name;
        if (errorName.includes("DynamoDB") || errorName.includes("Dynamo")) {
          scope.setTag("errorCategory", "database");
        } else if (errorName.includes("Cognito")) {
          scope.setTag("errorCategory", "auth");
        } else if (errorName.includes("HTTP") || errorName.includes("Http")) {
          scope.setTag("errorCategory", "http");
        } else {
          scope.setTag("errorCategory", "application");
        }

        scope.setContext("errorDetails", {
          name: request.error.name,
          message: request.error.message,
          statusCode: (request.error as any).statusCode || 500,
          stack: request.error.stack,
        });
      }

      // Capture the error
      Sentry.captureException(request.error);
    });
  },
});