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
import { createOrUpdateUserProfile } from "../database/users.js";
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
}

interface RefreshRequest {
  refreshToken: string;
}

interface GoogleCallbackRequest {
  code: string;
}

interface CognitoTokenResponse {
  access_token: string;
  refresh_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
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

      // Create user record in database
      // Use email as the user ID since that's what Cognito uses as username
      await createOrUpdateUserProfile(email, email, {
        trackQsOnly: false, // Default setting
      });

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
    try {
      // Get redirect URI from query parameters
      const redirectUri =
        event.queryStringParameters?.redirect_uri ||
        `${process.env.FRONTEND_URL || "http://localhost:5173"}/auth/callback`;

      // Build the Cognito Hosted UI URL for Google OAuth
      const cognitoDomain = process.env.COGNITO_DOMAIN!;
      const clientId = process.env.COGNITO_CLIENT_ID!;

      const googleAuthUrl = new URL(`${cognitoDomain}/oauth2/authorize`);
      googleAuthUrl.searchParams.set("client_id", clientId);
      googleAuthUrl.searchParams.set("response_type", "code");
      googleAuthUrl.searchParams.set("scope", "openid email profile");
      googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
      googleAuthUrl.searchParams.set("identity_provider", "Google");

      const response: ApiResponse = {
        success: true,
        data: {
          url: googleAuthUrl.toString(),
        },
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
        headers: { "Content-Type": "application/json" },
      };
    } catch (error) {
      console.error("Google login URL generation error:", error);
      const response: ApiResponse = {
        success: false,
        error: "google_login_failed",
        message: "Failed to generate Google login URL",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
        headers: { "Content-Type": "application/json" },
      };
    }
  },

  googleCallback: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
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

      // Handle both parsed and unparsed body
      let parsedBody: GoogleCallbackRequest;
      if (typeof event.body === "string") {
        parsedBody = JSON.parse(event.body);
      } else {
        parsedBody = event.body as GoogleCallbackRequest;
      }

      const { code } = parsedBody;

      if (!code) {
        const response: ApiResponse = {
          success: false,
          error: "bad_request",
          message: "Authorization code is required",
        };
        return {
          statusCode: 400,
          body: JSON.stringify(response),
          headers: { "Content-Type": "application/json" },
        };
      }

      // Exchange the authorization code for tokens via Cognito
      const cognitoDomain = process.env.COGNITO_DOMAIN!;
      const clientId = process.env.COGNITO_CLIENT_ID!;
      const redirectUri = `${process.env.FRONTEND_URL || "http://localhost:5173"}/auth/callback`;

      const tokenRequest = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        code: code,
        redirect_uri: redirectUri,
      });

      const tokenResponse = await fetch(`${cognitoDomain}/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenRequest.toString(),
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
      }
      const tokenData = (await tokenResponse.json()) as CognitoTokenResponse; // Decode the ID token to get user information
      const idTokenPayload = JSON.parse(
        Buffer.from(tokenData.id_token.split(".")[1], "base64").toString()
      );

      // Create or update user in our database
      const email = idTokenPayload.email;
      const cognitoUserId = idTokenPayload.sub;

      // Validate that we have a valid email
      if (!email || typeof email !== "string" || email.trim() === "") {
        console.error("Invalid or missing email in Google ID token:", {
          email,
          payload: idTokenPayload,
        });
        const response: ApiResponse = {
          success: false,
          error: "authentication_error",
          message: "Email not found in Google authentication response",
        };
        return {
          statusCode: 400,
          body: JSON.stringify(response),
          headers: { "Content-Type": "application/json" },
        };
      }

      // Create user profile in our database using email as the user ID for consistency
      // This ensures users with same email from different IdPs share the same database record
      await createOrUpdateUserProfile(email, email, {
        trackQsOnly: false, // Default setting
      });
      const response: ApiResponse = {
        success: true,
        message: "Google authentication successful",
        data: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          idToken: tokenData.id_token, // Include ID token for user profile info
          expiresIn: tokenData.expires_in,
          user: {
            id: email, // Use email as the consistent user ID
            email: email,
          },
        },
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
        headers: { "Content-Type": "application/json" },
      };
    } catch (error) {
      console.error("Google callback error:", error);
      const response: ApiResponse = {
        success: false,
        error: "google_callback_failed",
        message: "Failed to process Google authentication",
      };

      return {
        statusCode: 500,
        body: JSON.stringify(response),
        headers: { "Content-Type": "application/json" },
      };
    }
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

  // logout handler removed - client handles logout locally
};
