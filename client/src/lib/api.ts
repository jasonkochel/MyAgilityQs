import ky from "ky";
import type {
  ApiResponse,
  AuthResponse,
  CreateDogRequest,
  CreateRunRequest,
  Dog,
  LoginRequest,
  Run,
  UpdateDogRequest,
} from "../types";

// API Configuration
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://072j9gp0u7.execute-api.us-east-1.amazonaws.com";

// Enhanced token management with security improvements
export const tokenManager = {
  // Use sessionStorage for access tokens (cleared on browser close)
  getToken: (): string | null => {
    return sessionStorage.getItem("accessToken");
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
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("idToken");
    localStorage.removeItem("tokenExpiry");
  },

  setTokens: (authData: AuthResponse): void => {
    // Access token in sessionStorage (more secure, session-only)
    sessionStorage.setItem("accessToken", authData.accessToken);
    // Refresh token in localStorage (needed for persistence)
    localStorage.setItem("refreshToken", authData.refreshToken);
    localStorage.setItem("idToken", authData.idToken);
    localStorage.setItem("tokenExpiry", (Date.now() + authData.expiresIn * 1000).toString());
  },

  isTokenExpired: (): boolean => {
    const expiry = localStorage.getItem("tokenExpiry");
    if (!expiry) return true;
    return Date.now() > parseInt(expiry);
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
      (request) => {
        const token = tokenManager.getToken();
        console.log("🔍 Debug - Token exists:", !!token);
        console.log("🔍 Debug - Token expired:", tokenManager.isTokenExpired());
        console.log("🔍 Debug - Request URL:", request.url);

        if (token && !tokenManager.isTokenExpired()) {
          request.headers.set("Authorization", `Bearer ${token}`);
          console.log("✅ Authorization header set");
        } else {
          console.log("❌ No Authorization header set - missing or expired token");
        }
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

// API Helper function
async function apiRequest<T>(request: Promise<Response>): Promise<T> {
  try {
    const response = await request;
    const data = (await response.json()) as ApiResponse<T>;

    if (!data.success) {
      throw new Error(data.message || "API request failed");
    }

    return data.data as T;
  } catch (error) {
    // Handle Ky HTTPError specifically
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
};

// Runs API
export const runsApi = {
  createRun: async (runData: CreateRunRequest): Promise<Run> => {
    return apiRequest(api.post("runs", { json: runData }));
  },

  getAllRuns: async (): Promise<Run[]> => {
    return apiRequest(api.get("runs"));
  },
};

export default api;
