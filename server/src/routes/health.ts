import { ApiResponse } from "@my-agility-qs/shared";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { AuthenticatedEvent } from "../middleware/jwtAuth";

export const healthHandler = async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResultV2> => {
  const response: ApiResponse = {
    success: true,
    message: "MyAgilityQs API is healthy",
    data: {
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    },
  };

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
};
