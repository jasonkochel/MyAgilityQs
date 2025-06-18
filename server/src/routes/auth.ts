import {
  AdminCreateUserCommand,
  AdminInitiateAuthCommand,
  AdminSetUserPasswordCommand,
  AuthFlowType,
  CognitoIdentityProviderClient,
  MessageActionType,
} from "@aws-sdk/client-cognito-identity-provider";
import { ApiResponse } from "@my-agility-qs/shared";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { AuthenticatedEvent } from "../middleware/jwtAuth";

// Initialize Cognito client
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || "us-east-1",
});

// Note: calculateSecretHash function removed - not needed for React app (public client)

interface LoginRequest {
  email: string;
  password: string;
}

interface SignupRequest {
  email: string;
  password: string;
  name?: string;
}

interface RefreshRequest {
  refreshToken: string;
}

// Auth handlers - real implementations
export const authHandler = {
  login: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      if (!event.body) {
        const response: ApiResponse = {
          success: false,
          error: "bad_request",
          message: "Request body is required",
        };
        return {
          statusCode: 400,
          body: JSON.stringify(response),
          headers: { "Content-Type": "application/json" },
        };
      }

      // Handle both parsed and unparsed body (Middy may have already parsed it)
      let parsedBody: LoginRequest;
      if (typeof event.body === "string") {
        parsedBody = JSON.parse(event.body);
      } else {
        parsedBody = event.body as LoginRequest;
      }

      const { email, password } = parsedBody;

      if (!email || !password) {
        const response: ApiResponse = {
          success: false,
          error: "bad_request",
          message: "Email and password are required",
        };
        return {
          statusCode: 400,
          body: JSON.stringify(response),
          headers: { "Content-Type": "application/json" },
        };
      }

      // Authenticate with Cognito (public client - no secret hash needed)
      const command = new AdminInitiateAuthCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID!,
        ClientId: process.env.COGNITO_CLIENT_ID!,
        AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });

      const result = await cognitoClient.send(command);

      if (result.AuthenticationResult) {
        const response: ApiResponse = {
          success: true,
          message: "Login successful",
          data: {
            accessToken: result.AuthenticationResult.AccessToken,
            refreshToken: result.AuthenticationResult.RefreshToken,
            idToken: result.AuthenticationResult.IdToken,
            expiresIn: result.AuthenticationResult.ExpiresIn,
          },
        };

        return {
          statusCode: 200,
          body: JSON.stringify(response),
          headers: { "Content-Type": "application/json" },
        };
      }

      // Fallback if no result was returned
      const response: ApiResponse = {
        success: false,
        error: "authentication_failed",
        message: "Authentication failed",
      };
      return {
        statusCode: 401,
        body: JSON.stringify(response),
        headers: { "Content-Type": "application/json" },
      };
    } catch (error: any) {
      console.error("Login error:", error);

      let message = "Login failed";
      let statusCode = 500;

      // Handle specific Cognito errors
      if (error.name === "NotAuthorizedException") {
        message = "Invalid email or password";
        statusCode = 401;
      } else if (error.name === "UserNotFoundException") {
        message = "User not found";
        statusCode = 404;
      } else if (error.name === "UserNotConfirmedException") {
        message = "Please verify your email address";
        statusCode = 403;
      }

      const response: ApiResponse = {
        success: false,
        error: "login_failed",
        message,
      };

      return {
        statusCode,
        body: JSON.stringify(response),
        headers: { "Content-Type": "application/json" },
      };
    }
  },

  signup: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      if (!event.body) {
        const response: ApiResponse = {
          success: false,
          error: "bad_request",
          message: "Request body is required",
        };
        return {
          statusCode: 400,
          body: JSON.stringify(response),
          headers: { "Content-Type": "application/json" },
        };
      }

      // Handle both parsed and unparsed body (Middy may have already parsed it)
      let parsedBody: SignupRequest;
      if (typeof event.body === "string") {
        parsedBody = JSON.parse(event.body);
      } else {
        parsedBody = event.body as SignupRequest;
      }

      const { email, password, name } = parsedBody;

      if (!email || !password) {
        const response: ApiResponse = {
          success: false,
          error: "bad_request",
          message: "Email and password are required",
        };
        return {
          statusCode: 400,
          body: JSON.stringify(response),
          headers: { "Content-Type": "application/json" },
        };
      }

      // Create user in Cognito
      const createUserCommand = new AdminCreateUserCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID!,
        Username: email,
        UserAttributes: [
          {
            Name: "email",
            Value: email,
          },
          {
            Name: "email_verified",
            Value: "true",
          },
          ...(name
            ? [
                {
                  Name: "name",
                  Value: name,
                },
              ]
            : []),
        ],
        TemporaryPassword: password,
        MessageAction: MessageActionType.SUPPRESS, // Don't send welcome email
      });

      await cognitoClient.send(createUserCommand);

      // Set permanent password
      const setPasswordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID!,
        Username: email,
        Password: password,
        Permanent: true,
      });

      await cognitoClient.send(setPasswordCommand);

      const response: ApiResponse = {
        success: true,
        message: "Account created successfully",
        data: {
          email,
          message: "You can now log in with your credentials",
        },
      };

      return {
        statusCode: 201,
        body: JSON.stringify(response),
        headers: { "Content-Type": "application/json" },
      };
    } catch (error: any) {
      console.error("Signup error:", error);

      let message = "Account creation failed";
      let statusCode = 500;

      // Handle specific Cognito errors
      if (error.name === "UsernameExistsException") {
        message = "An account with this email already exists";
        statusCode = 409;
      } else if (error.name === "InvalidPasswordException") {
        message = "Password does not meet requirements";
        statusCode = 400;
      }

      const response: ApiResponse = {
        success: false,
        error: "signup_failed",
        message,
      };

      return {
        statusCode,
        body: JSON.stringify(response),
        headers: { "Content-Type": "application/json" },
      };
    }
  },

  googleLogin: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    const response: ApiResponse = {
      success: false,
      error: "not_implemented",
      message: "Google login will be implemented in a future version",
    };

    return {
      statusCode: 501,
      body: JSON.stringify(response),
      headers: { "Content-Type": "application/json" },
    };
  },

  refresh: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      if (!event.body) {
        const response: ApiResponse = {
          success: false,
          error: "bad_request",
          message: "Request body is required",
        };
        return {
          statusCode: 400,
          body: JSON.stringify(response),
          headers: { "Content-Type": "application/json" },
        };
      }

      // Handle both parsed and unparsed body (Middy may have already parsed it)
      let parsedBody: RefreshRequest;
      if (typeof event.body === "string") {
        parsedBody = JSON.parse(event.body);
      } else {
        parsedBody = event.body as RefreshRequest;
      }

      const { refreshToken } = parsedBody;

      if (!refreshToken) {
        const response: ApiResponse = {
          success: false,
          error: "bad_request",
          message: "Refresh token is required",
        };
        return {
          statusCode: 400,
          body: JSON.stringify(response),
          headers: { "Content-Type": "application/json" },
        };
      }

      // Use refresh token to get new access token
      const command = new AdminInitiateAuthCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID!,
        ClientId: process.env.COGNITO_CLIENT_ID!,
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      });

      const result = await cognitoClient.send(command);

      if (result.AuthenticationResult) {
        const response: ApiResponse = {
          success: true,
          message: "Token refreshed successfully",
          data: {
            accessToken: result.AuthenticationResult.AccessToken,
            idToken: result.AuthenticationResult.IdToken,
            expiresIn: result.AuthenticationResult.ExpiresIn,
          },
        };

        return {
          statusCode: 200,
          body: JSON.stringify(response),
          headers: { "Content-Type": "application/json" },
        };
      } else {
        throw new Error("No authentication result returned");
      }
    } catch (error: any) {
      console.error("Token refresh error:", error);

      const response: ApiResponse = {
        success: false,
        error: "token_refresh_failed",
        message: "Failed to refresh token",
      };

      return {
        statusCode: 401,
        body: JSON.stringify(response),
        headers: { "Content-Type": "application/json" },
      };
    }
  },

  logout: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    // For Cognito, logout is primarily client-side (clearing tokens)
    // Server-side logout would require revoking tokens, which we'll implement later
    const response: ApiResponse = {
      success: true,
      message: "Logged out successfully",
      data: {
        message: "Please clear your local tokens",
      },
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
      headers: { "Content-Type": "application/json" },
    };
  },
};
