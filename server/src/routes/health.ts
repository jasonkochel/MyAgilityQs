import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ApiResponse } from '@my-agility-qs/shared';

export const healthHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const response: ApiResponse = {
    success: true,
    message: 'MyAgilityQs API is healthy',
    data: {
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  };

  return {
    statusCode: 200,
    body: JSON.stringify(response)
  };
};
