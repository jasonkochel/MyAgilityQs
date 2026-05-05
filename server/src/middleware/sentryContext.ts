import * as Sentry from "@sentry/serverless";
import type { Request } from "@middy/core";
import type { AuthenticatedEvent } from "./jwtAuth";
import { asCaught } from "../utils/errors.js";

type SentryRequest = Request<AuthenticatedEvent>;

/**
 * Middy middleware to add Sentry context for better error tracking
 */
export const sentryContext = () => ({
  before: (request: SentryRequest) => {
    const { event } = request;
    const httpMethod = event.requestContext?.http?.method;
    const path = event.rawPath;
    const sourceIp = event.requestContext?.http?.sourceIp;

    Sentry.withScope((scope) => {
      scope.setTag("requestId", request.context.awsRequestId);
      scope.setTag("functionName", request.context.functionName);
      scope.setTag("functionVersion", request.context.functionVersion);

      if (httpMethod) {
        scope.setTag("httpMethod", httpMethod);
        scope.setTag("path", path);
        scope.setTag(
          "userAgent",
          event.headers?.["User-Agent"] || event.headers?.["user-agent"]
        );
        scope.setTag("sourceIp", sourceIp);
      }

      if (event.user) {
        scope.setUser({
          id: event.user.userId,
          email: event.user.email,
          username: event.user.username,
        });
        scope.setTag("userId", event.user.userId);
      }

      if (event.pathParameters) {
        scope.setContext("pathParameters", event.pathParameters);
      }

      if (event.queryStringParameters) {
        scope.setContext("queryStringParameters", event.queryStringParameters);
      }

      scope.setTransactionName(`${httpMethod} ${path}`);
    });

    Sentry.addBreadcrumb({
      category: "http",
      message: `${httpMethod} ${path}`,
      data: {
        url: path,
        method: httpMethod,
        userId: event.user?.userId,
        requestId: request.context.awsRequestId,
      },
      level: "info",
      timestamp: Date.now() / 1000,
    });
  },

  after: (request: SentryRequest) => {
    const { event } = request;
    const httpMethod = event.requestContext?.http?.method;
    const path = event.rawPath;
    const response = request.response as { statusCode?: number } | undefined;

    if (response?.statusCode !== undefined && response.statusCode < 400) {
      Sentry.addBreadcrumb({
        category: "http",
        message: `${httpMethod} ${path} - ${response.statusCode}`,
        data: {
          statusCode: response.statusCode,
          userId: event.user?.userId,
          requestId: request.context.awsRequestId,
        },
        level: "info",
        timestamp: Date.now() / 1000,
      });
    }
  },

  onError: (request: SentryRequest) => {
    const errorInfo = asCaught(request.error);
    const statusCode = errorInfo.statusCode ?? 500;
    if (statusCode >= 400 && statusCode < 500) return;

    const { event } = request;
    const httpMethod = event.requestContext?.http?.method;
    const path = event.rawPath;

    Sentry.withScope((scope) => {
      scope.setTag("hasError", true);
      scope.setTag("apiRoute", `${httpMethod} ${path}`);
      scope.setContext("requestBody", { body: event.body });
      scope.setContext("requestHeaders", event.headers ?? {});

      if (request.error) {
        scope.setLevel("error");

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
          statusCode,
          stack: request.error.stack,
        });
      }

      Sentry.captureException(request.error);
    });
  },
});
