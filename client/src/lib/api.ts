import type {
  ApiResponse,
  CreateDogRequest,
  CreateRunRequest,
  Dog,
  DogProgress,
  LoginRequest,
  PhotoUploadUrlResponse,
  ProgressionDiagnostics,
  Run,
  UpdateDogRequest,
  UpdateRunRequest,
  UpdateUserRequest,
  User,
} from "@my-agility-qs/shared";
import ky from "ky";
import type { AuthResponse } from "../types";
import { reportHttpError } from "./sentry";

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL;

// Validate required environment variables
if (!API_BASE_URL) {
  throw new Error("VITE_API_URL environment variable is required");
}

// Enhanced token management with security improvements
export const tokenManager = {
  // Use sessionStorage for tokens (cleared on browser close)
  getToken: (): string | null => {
    // Use ID token for API requests since we need user profile info (email)
    return sessionStorage.getItem("idToken") || sessionStorage.getItem("accessToken");
  },

  getAccessToken: (): string | null => {
    return sessionStorage.getItem("accessToken");
  },

  getIdToken: (): string | null => {
    return sessionStorage.getItem("idToken");
  },

  setToken: (token: string): void => {
    sessionStorage.setItem("accessToken", token);
  },

  // Keep refresh token in localStorage (longer persistence needed)
  getRefreshToken: (): string | null => {
    return localStorage.getItem("refreshToken");
  },
  removeToken: (): void => {
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("idToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("tokenExpiry");
    localStorage.removeItem("userEmail"); // Clean up legacy userEmail
    localStorage.removeItem("userId"); // Clean up userId (can be extracted from JWT)
  },

  setTokens: (authData: AuthResponse): void => {
    // Access token in sessionStorage (more secure, session-only)
    sessionStorage.setItem("accessToken", authData.accessToken);
    // ID token in sessionStorage - needed for user profile API calls
    sessionStorage.setItem("idToken", authData.idToken);
    // Refresh token in localStorage (needed for persistence)
    localStorage.setItem("refreshToken", authData.refreshToken);
    localStorage.setItem("tokenExpiry", (Date.now() + authData.expiresIn * 1000).toString());
  },
  isTokenExpired: (): boolean => {
    const expiry = localStorage.getItem("tokenExpiry");
    if (!expiry) return true;
    // Check if token expires in the next 5 minutes (300 seconds)
    return Date.now() > parseInt(expiry) - 300000;
  },

  // Extract user ID from JWT token (decode sub claim)
  getUserIdFromToken: (): string | null => {
    const token = tokenManager.getToken();
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.sub || payload.username || null;
    } catch (error) {
      console.error("Failed to decode JWT token:", error);
      return null;
    }
  }, // Refresh access token using refresh token
  refreshAccessToken: async (): Promise<boolean> => {
    const refreshToken = tokenManager.getRefreshToken();

    if (!refreshToken) {
      return false;
    }

    try {
      const response = await ky
        .post(`${API_BASE_URL}/auth/refresh`, {
          json: { refreshToken },
        })
        .json<ApiResponse<AuthResponse>>();

      if (response.success && response.data) {
        tokenManager.setTokens(response.data);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Token refresh failed:", error);
      tokenManager.removeToken();
      return false;
    }
  },

  // Clear sensitive data on page visibility change (user switches tabs/apps)
  clearOnVisibilityChange: (): void => {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        // Optional: Clear access token when tab becomes hidden
        // sessionStorage.removeItem('accessToken');
      }
    });
  },
};

// Create ky instance with default configuration
export const api = ky.create({
  prefixUrl: API_BASE_URL,
  hooks: {
    beforeRequest: [
      async (request) => {
        let token = tokenManager.getToken();
        const isTokenExpired = tokenManager.isTokenExpired();

        // Try to refresh token if expired but we have a refresh token
        if ((!token || isTokenExpired) && tokenManager.getRefreshToken()) {
          const refreshed = await tokenManager.refreshAccessToken();
          if (refreshed) {
            token = tokenManager.getToken();
          } else {
            // Only redirect if this isn't already a login/auth request
            if (!request.url.includes("/auth/")) {
              window.location.href = "/login";
            }
            return;
          }
        }

        if (token && !tokenManager.isTokenExpired()) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
      },
    ],
    beforeError: [
      (error) => {
        // Report HTTP errors to Sentry with detailed context (centralized error handling)
        if (error instanceof Error) {
          const requestContext: Record<string, unknown> = {};

          // Add HTTP-specific context if available
          if ("response" in error && error.response) {
            const response = error.response as Response;
            requestContext.url = response.url;
            requestContext.status = response.status;
            requestContext.statusText = response.statusText;
            requestContext.method =
              (error as Error & { request?: { method?: string } })?.request?.method || "unknown";
          }

          // Add request context if available
          if ("request" in error && error.request) {
            const request = error.request as Request;
            requestContext.requestUrl = request.url;
            requestContext.requestMethod = request.method;
          }

          reportHttpError(error, requestContext);
        }

        return error;
      },
    ],
    afterResponse: [
      async (_request, _options, response) => {
        if (response.status === 401) {
          tokenManager.removeToken();
          // Redirect to login if needed
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
        }
      },
    ],
  },
});

// API Helper function (Sentry error reporting now handled by ky beforeError hook)
async function apiRequest<T>(request: Promise<Response>): Promise<T> {
  try {
    const response = await request;
    const data = (await response.json()) as ApiResponse<T>;

    if (!data.success) {
      throw new Error(data.message || "API request failed");
    }

    return data.data as T;
  } catch (error) {
    // Handle Ky HTTPError specifically - just parse and rethrow
    if (error && typeof error === "object" && "response" in error) {
      try {
        const errorResponse = error as { response: Response };
        const errorData = (await errorResponse.response.json()) as ApiResponse;
        throw new Error(errorData.message || "API request failed");
      } catch {
        // If we can't parse the error response, fall back to generic message
        throw new Error("API request failed");
      }
    }

    // Re-throw as-is (error reporting handled by ky beforeError hook)
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Unknown error occurred");
  }
}

// Auth API
export const authApi = {
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    return apiRequest(api.post("auth/login", { json: credentials }));
  },

  signup: async (signupData: { email: string; password: string }): Promise<void> => {
    return apiRequest(api.post("auth/signup", { json: signupData }));
  }, // Google OAuth methods
  getGoogleLoginUrl: async (
    redirectUri?: string
  ): Promise<{ url: string; redirectUri: string }> => {
    const searchParams = redirectUri ? { redirect_uri: redirectUri } : undefined;
    return apiRequest(api.get("auth/google/login", searchParams ? { searchParams } : {}));
  },

  googleCallback: async (code: string, redirectUri?: string): Promise<AuthResponse> => {
    const body: { code: string; redirectUri?: string } = { code };
    if (redirectUri) {
      body.redirectUri = redirectUri;
    }
    return apiRequest(api.post("auth/google/callback", { json: body }));
  },

  logout: (): void => {
    tokenManager.removeToken();
  },
};

// Health API
export const healthApi = {
  check: async (): Promise<{ timestamp: string; version: string }> => {
    return apiRequest(api.get("health"));
  },
};

// Dogs API - Consolidated from dogs-api.ts
export const dogsApi = {
  // Get all dogs for the authenticated user
  getAllDogs: async (): Promise<Dog[]> => {
    return apiRequest(api.get("dogs"));
  },

  // Alternative name for compatibility
  getAll: async (): Promise<Dog[]> => {
    return apiRequest(api.get("dogs"));
  },

  // Get a specific dog by ID
  getById: async (dogId: string): Promise<Dog> => {
    return apiRequest(api.get(`dogs/${dogId}`));
  },

  // Create a new dog
  create: async (dogData: CreateDogRequest): Promise<Dog> => {
    return apiRequest(api.post("dogs", { json: dogData }));
  },

  // Update an existing dog
  update: async (dogId: string, dogData: UpdateDogRequest): Promise<Dog> => {
    return apiRequest(api.put(`dogs/${dogId}`, { json: dogData }));
  },

  // Deactivate a dog (soft delete)
  deactivate: async (dogId: string): Promise<Dog> => {
    return apiRequest(api.put(`dogs/${dogId}`, { json: { active: false } }));
  },
  // Reactivate a dog
  reactivate: async (dogId: string): Promise<Dog> => {
    return apiRequest(api.put(`dogs/${dogId}`, { json: { active: true } }));
  },

  // Hard delete a dog (permanent removal)
  hardDelete: async (dogId: string): Promise<void> => {
    return apiRequest(api.delete(`dogs/${dogId}`));
  }, // Generate presigned URL for photo upload
  generatePhotoUploadUrl: async (
    dogId: string,
    contentType?: string
  ): Promise<PhotoUploadUrlResponse> => {
    return apiRequest(
      api.post(`dogs/${dogId}/photo/upload-url`, {
        json: { contentType },
      })
    );
  },

  // Generate presigned URL for cropped photo upload
  generateCroppedPhotoUploadUrl: async (
    dogId: string,
    contentType?: string
  ): Promise<PhotoUploadUrlResponse> => {
    return apiRequest(
      api.post(`dogs/${dogId}/photo/cropped-upload-url`, {
        json: { contentType },
      })
    );
  },

  // Note: Images are now processed on client-side for better performance
};

// Runs API
export const runsApi = {
  createRun: async (runData: CreateRunRequest): Promise<ApiResponse<Run>> => {
    const response = await api.post("runs", { json: runData }).json<ApiResponse<Run>>();
    return response;
  },

  getAllRuns: async (): Promise<Run[]> => {
    return apiRequest(api.get("runs")) as Promise<Run[]>;
  },

  // Batch import runs
  batchImportRuns: async (runs: CreateRunRequest[]): Promise<unknown> => {
    return apiRequest(api.post("runs/batch", { json: { runs } }));
  },

  // Update an existing run
  updateRun: async (runId: string, runData: UpdateRunRequest): Promise<Run> => {
    return apiRequest(api.put(`runs/${runId}`, { json: runData }));
  },

  // Hard delete a run (permanent removal)
  hardDelete: async (runId: string): Promise<void> => {
    return apiRequest(api.delete(`runs/${runId}`));
  },
};

// Locations API
export const locationsApi = {
  // Get all unique locations from user's runs
  getAll: async (): Promise<string[]> => {
    return apiRequest(api.get("locations"));
  },
};

// User API
export const userApi = {
  // Get current user profile
  getProfile: async (): Promise<User> => {
    return apiRequest(api.get("user/profile"));
  },

  // Update user preferences
  updateProfile: async (preferences: UpdateUserRequest): Promise<User> => {
    return apiRequest(api.put("user/profile", { json: preferences })) as Promise<User>;
  },
};

// Progress API
export const progressApi = {
  // Get progress for all user's dogs
  getAllProgress: async (): Promise<DogProgress[]> => {
    return apiRequest(api.get("progress")) as Promise<DogProgress[]>;
  },

  // Get detailed progression diagnostics for all user's dogs
  getDiagnostics: async (): Promise<ProgressionDiagnostics> => {
    return apiRequest(api.get("progress/diagnostics")) as Promise<ProgressionDiagnostics>;
  },
};

export default api;
