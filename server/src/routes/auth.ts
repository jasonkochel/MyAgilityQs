import {
  AdminInitiateAuthCommand,
  AdminSetUserPasswordCommand,
  AuthFlowType,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ResendConfirmationCodeCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { ApiResponse } from "@my-agility-qs/shared";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { createOrUpdateUserProfile } from "../database/users.js";
import { AuthenticatedEvent } from "../middleware/jwtAuth";
import { asCaught } from "../utils/errors.js";

// Validate required environment variables
if (!process.env.COGNITO_REGION) {
  throw new Error('COGNITO_REGION environment variable is required');
}
if (!process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL environment variable is required');
}

// Initialize Cognito client
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION,
});

// Note: calculateSecretHash function removed - not needed for React app (public client)

const jsonError = (
  statusCode: number,
  error: string,
  message: string
): APIGatewayProxyResultV2 => {
  const response: ApiResponse = { success: false, error, message };
  return {
    statusCode,
    body: JSON.stringify(response),
    headers: { "Content-Type": "application/json" },
  };
};

interface LoginRequest {
  email: string;
  password: string;
}

interface SignupRequest {
  email: string;
  password: string;
}

interface ConfirmSignupRequest {
  email: string;
  code: string;
}

interface ResendCodeRequest {
  email: string;
}

interface ForgotPasswordRequest {
  email: string;
}

interface ConfirmForgotPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

interface RefreshRequest {
  refreshToken: string;
}

interface GoogleCallbackRequest {
  code: string;
  redirectUri?: string; // Optional, falls back to FRONTEND_URL if not provided
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
    } catch (error: unknown) {
      const err = asCaught(error);
      console.error("Login error:", error);

      let message = "Login failed";
      let statusCode = 500;

      // Handle specific Cognito errors
      if (err.name === "NotAuthorizedException") {
        message = "Invalid email or password";
        statusCode = 401;
      } else if (err.name === "UserNotFoundException") {
        message = "User not found";
        statusCode = 404;
      } else if (err.name === "UserNotConfirmedException") {
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

      // Self-service signup. Cognito creates the user as UNCONFIRMED and emails
      // a verification code. The DB profile is created after confirmation.
      const signUpCommand = new SignUpCommand({
        ClientId: process.env.COGNITO_CLIENT_ID!,
        Username: email,
        Password: password,
        UserAttributes: [{ Name: "email", Value: email }],
      });
      await cognitoClient.send(signUpCommand);

      const response: ApiResponse = {
        success: true,
        message: "Verification code sent",
        data: {
          email,
          message: "Check your email for a verification code to complete signup.",
        },
      };

      return {
        statusCode: 201,
        body: JSON.stringify(response),
        headers: { "Content-Type": "application/json" },
      };
    } catch (error: unknown) {
      const err = asCaught(error);
      console.error("Signup error:", error);

      let message = "Account creation failed";
      let statusCode = 500;

      if (err.name === "UsernameExistsException") {
        message = "An account with this email already exists";
        statusCode = 409;
      } else if (err.name === "InvalidPasswordException") {
        message = "Password does not meet requirements";
        statusCode = 400;
      } else if (err.name === "InvalidParameterException") {
        message = err.message || "Invalid signup parameters";
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

  confirmSignup: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      if (!event.body) {
        return jsonError(400, "bad_request", "Request body is required");
      }

      const parsedBody: ConfirmSignupRequest =
        typeof event.body === "string" ? JSON.parse(event.body) : (event.body as ConfirmSignupRequest);
      const { email, code } = parsedBody;

      if (!email || !code) {
        return jsonError(400, "bad_request", "Email and confirmation code are required");
      }

      await cognitoClient.send(
        new ConfirmSignUpCommand({
          ClientId: process.env.COGNITO_CLIENT_ID!,
          Username: email,
          ConfirmationCode: code,
        })
      );

      // Create the database profile now that the account is confirmed.
      await createOrUpdateUserProfile(email, email, { trackQsOnly: true });

      const response: ApiResponse = {
        success: true,
        message: "Email verified",
        data: { email },
      };
      return {
        statusCode: 200,
        body: JSON.stringify(response),
        headers: { "Content-Type": "application/json" },
      };
    } catch (error: unknown) {
      const err = asCaught(error);
      console.error("Confirm signup error:", error);

      let message = "Failed to verify email";
      let statusCode = 500;

      if (err.name === "CodeMismatchException") {
        message = "Invalid verification code";
        statusCode = 400;
      } else if (err.name === "ExpiredCodeException") {
        message = "Verification code has expired. Please request a new one.";
        statusCode = 400;
      } else if (err.name === "NotAuthorizedException") {
        message = "Account is already confirmed";
        statusCode = 400;
      } else if (err.name === "UserNotFoundException") {
        message = "No account found with this email";
        statusCode = 404;
      }

      return jsonError(statusCode, "confirm_signup_failed", message);
    }
  },

  resendCode: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      if (!event.body) {
        return jsonError(400, "bad_request", "Request body is required");
      }

      const parsedBody: ResendCodeRequest =
        typeof event.body === "string" ? JSON.parse(event.body) : (event.body as ResendCodeRequest);
      const { email } = parsedBody;

      if (!email) {
        return jsonError(400, "bad_request", "Email is required");
      }

      await cognitoClient.send(
        new ResendConfirmationCodeCommand({
          ClientId: process.env.COGNITO_CLIENT_ID!,
          Username: email,
        })
      );

      const response: ApiResponse = {
        success: true,
        message: "Verification code resent",
      };
      return {
        statusCode: 200,
        body: JSON.stringify(response),
        headers: { "Content-Type": "application/json" },
      };
    } catch (error: unknown) {
      const err = asCaught(error);
      console.error("Resend code error:", error);

      let message = "Failed to resend code";
      let statusCode = 500;

      if (err.name === "UserNotFoundException") {
        message = "No account found with this email";
        statusCode = 404;
      } else if (err.name === "InvalidParameterException") {
        // Cognito returns this when the user is already confirmed.
        message = "Account is already confirmed. Please log in.";
        statusCode = 400;
      } else if (err.name === "LimitExceededException") {
        message = "Too many attempts. Please try again later.";
        statusCode = 429;
      }

      return jsonError(statusCode, "resend_code_failed", message);
    }
  },

  forgotPassword: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      if (!event.body) {
        return jsonError(400, "bad_request", "Request body is required");
      }

      const parsedBody: ForgotPasswordRequest =
        typeof event.body === "string" ? JSON.parse(event.body) : (event.body as ForgotPasswordRequest);
      const { email } = parsedBody;

      if (!email) {
        return jsonError(400, "bad_request", "Email is required");
      }

      await cognitoClient.send(
        new ForgotPasswordCommand({
          ClientId: process.env.COGNITO_CLIENT_ID!,
          Username: email,
        })
      );

      // Cognito's response is intentionally generic to avoid leaking account existence.
      const response: ApiResponse = {
        success: true,
        message: "If that email is registered, a reset code has been sent.",
      };
      return {
        statusCode: 200,
        body: JSON.stringify(response),
        headers: { "Content-Type": "application/json" },
      };
    } catch (error: unknown) {
      const err = asCaught(error);
      console.error("Forgot password error:", error);

      // For UserNotFound and similar, return the same generic success-shaped
      // message so we don't leak whether the email is registered.
      if (err.name === "UserNotFoundException") {
        const response: ApiResponse = {
          success: true,
          message: "If that email is registered, a reset code has been sent.",
        };
        return {
          statusCode: 200,
          body: JSON.stringify(response),
          headers: { "Content-Type": "application/json" },
        };
      }

      let message = "Failed to send reset code";
      let statusCode = 500;
      if (err.name === "LimitExceededException") {
        message = "Too many attempts. Please try again later.";
        statusCode = 429;
      } else if (err.name === "InvalidParameterException") {
        // Cognito returns this if the user has no verified email/phone — i.e.
        // unconfirmed accounts. Surface it so the user knows to verify first.
        message = "Account email is not verified. Please complete signup verification first.";
        statusCode = 400;
      }
      return jsonError(statusCode, "forgot_password_failed", message);
    }
  },

  confirmForgotPassword: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      if (!event.body) {
        return jsonError(400, "bad_request", "Request body is required");
      }

      const parsedBody: ConfirmForgotPasswordRequest =
        typeof event.body === "string"
          ? JSON.parse(event.body)
          : (event.body as ConfirmForgotPasswordRequest);
      const { email, code, newPassword } = parsedBody;

      if (!email || !code || !newPassword) {
        return jsonError(400, "bad_request", "Email, code, and new password are required");
      }

      await cognitoClient.send(
        new ConfirmForgotPasswordCommand({
          ClientId: process.env.COGNITO_CLIENT_ID!,
          Username: email,
          ConfirmationCode: code,
          Password: newPassword,
        })
      );

      const response: ApiResponse = {
        success: true,
        message: "Password reset successfully",
      };
      return {
        statusCode: 200,
        body: JSON.stringify(response),
        headers: { "Content-Type": "application/json" },
      };
    } catch (error: unknown) {
      const err = asCaught(error);
      console.error("Confirm forgot password error:", error);

      let message = "Failed to reset password";
      let statusCode = 500;

      if (err.name === "CodeMismatchException") {
        message = "Invalid reset code";
        statusCode = 400;
      } else if (err.name === "ExpiredCodeException") {
        message = "Reset code has expired. Please request a new one.";
        statusCode = 400;
      } else if (err.name === "InvalidPasswordException") {
        message = "Password does not meet requirements";
        statusCode = 400;
      } else if (err.name === "UserNotFoundException") {
        message = "No account found with this email";
        statusCode = 404;
      } else if (err.name === "LimitExceededException") {
        message = "Too many attempts. Please try again later.";
        statusCode = 429;
      }

      return jsonError(statusCode, "confirm_forgot_password_failed", message);
    }
  },  googleLogin: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      // Get redirect URI from query parameters
      const redirectUri =
        event.queryStringParameters?.redirect_uri ||
        `${process.env.FRONTEND_URL}/auth/callback`;      // Store the redirect URI in the response so the frontend can use the same one for the callback
      // This ensures consistency between the initial auth request and token exchange
      const cognitoDomain = process.env.COGNITO_DOMAIN!;
      const clientId = process.env.COGNITO_CLIENT_ID!;

      const googleAuthUrl = new URL(`${cognitoDomain}/oauth2/authorize`);
      googleAuthUrl.searchParams.set("client_id", clientId);
      googleAuthUrl.searchParams.set("response_type", "code");
      googleAuthUrl.searchParams.set("scope", "openid email profile");
      googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
      googleAuthUrl.searchParams.set("identity_provider", "Google");const response: ApiResponse = {
        success: true,
        data: {
          url: googleAuthUrl.toString(),
          redirectUri: redirectUri, // Include redirectUri in response so frontend can send it back
        },
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
        headers: { "Content-Type": "application/json" },
      };    } catch (error) {
      console.error("[GOOGLE_AUTH] Google login URL generation error:", error);
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
      }      console.log("[GOOGLE_AUTH] Google callback request received");

      const { code, redirectUri: requestRedirectUri } = parsedBody;      if (!code) {
        console.error("[GOOGLE_AUTH] No authorization code received");
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
      }// Exchange the authorization code for tokens via Cognito
      const cognitoDomain = process.env.COGNITO_DOMAIN!;
      const clientId = process.env.COGNITO_CLIENT_ID!;
      // Use the same redirect URI that was used in the initial OAuth request
      const redirectUri = requestRedirectUri || `${process.env.FRONTEND_URL}/auth/callback`;

      const tokenRequest = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        code: code,
        redirect_uri: redirectUri,
      });      const tokenResponse = await fetch(`${cognitoDomain}/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenRequest.toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("[GOOGLE_AUTH] Token exchange failed:", {
          status: tokenResponse.status,
          error: errorText
        });

        const response: ApiResponse = {
          success: false,
          error: "token_exchange_failed",
          message: `Token exchange failed: ${tokenResponse.status} - ${errorText}`,
        };
        return {
          statusCode: 400,
          body: JSON.stringify(response),
          headers: { "Content-Type": "application/json" },
        };
      }      const tokenData = (await tokenResponse.json()) as CognitoTokenResponse;

      // Decode the ID token to get user information
      if (!tokenData.id_token) {
        console.error("[GOOGLE_AUTH] No ID token received from Cognito");
        const response: ApiResponse = {
          success: false,
          error: "authentication_error",
          message: "No ID token received from authentication provider",
        };
        return {
          statusCode: 400,
          body: JSON.stringify(response),
          headers: { "Content-Type": "application/json" },
        };
      }      let idTokenPayload;
      try {
        idTokenPayload = JSON.parse(
          Buffer.from(tokenData.id_token.split(".")[1], "base64").toString()
        );
      } catch (error) {
        console.error("[GOOGLE_AUTH] Failed to decode ID token:", error);
        const response: ApiResponse = {
          success: false,
          error: "authentication_error",
          message: "Failed to decode authentication token",
        };
        return {
          statusCode: 400,
          body: JSON.stringify(response),
          headers: { "Content-Type": "application/json" },
        };
      }

      // Create or update user in our database
      const email = idTokenPayload.email;
      // Validate that we have a valid email
      if (!email || typeof email !== "string" || email.trim() === "") {
        console.error("[GOOGLE_AUTH] Invalid or missing email in ID token");
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
      }// Create user profile in our database using email as the user ID for consistency
      // This ensures users with same email from different IdPs share the same database record
      // For existing users, this preserves their current preferences (like trackQsOnly)
      try {
        await createOrUpdateUserProfile(email, email);
      } catch (dbError) {
        console.error("[GOOGLE_AUTH] Database error during user profile creation:", dbError);
        // Don't fail the auth flow for database errors - user can still log in
      }

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
          },        },
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
        headers: { "Content-Type": "application/json" },
      };
    } catch (error) {
      console.error("[GOOGLE_AUTH] Google callback error:", error);
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
      } else {
        throw new Error("No authentication result returned");
      }
    } catch (error: unknown) {
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

  changePassword: async (event: AuthenticatedEvent): Promise<APIGatewayProxyResultV2> => {
    try {
      if (!event.user) {
        return jsonError(401, "unauthorized", "Authentication required");
      }
      if (!event.body) {
        return jsonError(400, "bad_request", "Request body is required");
      }

      const parsedBody: ChangePasswordRequest =
        typeof event.body === "string"
          ? JSON.parse(event.body)
          : (event.body as ChangePasswordRequest);
      const { currentPassword, newPassword } = parsedBody;

      if (!currentPassword || !newPassword) {
        return jsonError(400, "bad_request", "Current and new passwords are required");
      }
      if (currentPassword === newPassword) {
        return jsonError(400, "bad_request", "New password must differ from current password");
      }

      const email = event.user.email;

      // Verify the current password by re-authenticating. If wrong, Cognito
      // throws NotAuthorizedException and we surface a 401.
      try {
        await cognitoClient.send(
          new AdminInitiateAuthCommand({
            UserPoolId: process.env.COGNITO_USER_POOL_ID!,
            ClientId: process.env.COGNITO_CLIENT_ID!,
            AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
            AuthParameters: { USERNAME: email, PASSWORD: currentPassword },
          })
        );
      } catch (authError: unknown) {
        const err = asCaught(authError);
        if (err.name === "NotAuthorizedException") {
          return jsonError(401, "incorrect_password", "Current password is incorrect");
        }
        throw authError;
      }

      // Re-auth succeeded — set the new password (permanent).
      await cognitoClient.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID!,
          Username: email,
          Password: newPassword,
          Permanent: true,
        })
      );

      const response: ApiResponse = {
        success: true,
        message: "Password changed successfully",
      };
      return {
        statusCode: 200,
        body: JSON.stringify(response),
        headers: { "Content-Type": "application/json" },
      };
    } catch (error: unknown) {
      const err = asCaught(error);
      console.error("Change password error:", error);

      if (err.name === "InvalidPasswordException") {
        return jsonError(400, "invalid_password", "Password does not meet requirements");
      }
      if (err.name === "LimitExceededException") {
        return jsonError(429, "rate_limited", "Too many attempts. Please try again later.");
      }
      return jsonError(500, "change_password_failed", "Failed to change password");
    }
  },
};
