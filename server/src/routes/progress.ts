import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ApiResponse } from '@my-agility-qs/shared';

// Progress/statistics handlers - placeholder implementations
export const progressHandler = {
  getDogProgress: async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const response: ApiResponse = {
      success: false,
      error: 'not_implemented',
      message: 'Get dog progress endpoint not yet implemented'
    };

    return {
      statusCode: 501,
      body: JSON.stringify(response)
    };
  },

  getLocations: async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const response: ApiResponse = {
      success: false,
      error: 'not_implemented',
      message: 'Get locations endpoint not yet implemented'
    };

    return {
      statusCode: 501,
      body: JSON.stringify(response)
    };
  }
};
