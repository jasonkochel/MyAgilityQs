import { beforeEach, describe, expect, it, vi } from "vitest";
import { tokenManager } from "../lib/api";
import type { AuthResponse } from "../types";

// Mock localStorage and sessionStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
});

Object.defineProperty(window, "sessionStorage", {
  value: mockSessionStorage,
});

describe("tokenManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("token storage", () => {
    it("stores access token in sessionStorage", () => {
      const token = "test-access-token";
      tokenManager.setToken(token);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith("accessToken", token);
    });

    it("retrieves access token from sessionStorage", () => {
      const token = "test-access-token";
      mockSessionStorage.getItem.mockReturnValue(token);

      const result = tokenManager.getToken();

      expect(mockSessionStorage.getItem).toHaveBeenCalledWith("accessToken");
      expect(result).toBe(token);
    });

    it("stores refresh token in localStorage", () => {
      const token = "test-refresh-token";
      mockLocalStorage.getItem.mockReturnValue(token);

      const result = tokenManager.getRefreshToken();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith("refreshToken");
      expect(result).toBe(token);
    });
  });

  describe("setTokens", () => {
    it("stores all auth tokens correctly", () => {
      const authData: AuthResponse = {
        accessToken: "access-token-123",
        refreshToken: "refresh-token-123",
        idToken: "id-token-123",
        expiresIn: 3600,
      };

      tokenManager.setTokens(authData);

      // Access token in sessionStorage
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith("accessToken", "access-token-123");

      // Other tokens in localStorage
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("refreshToken", "refresh-token-123");
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("idToken", "id-token-123");
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("tokenExpiry", expect.any(String));
    });
  });

  describe("removeToken", () => {
    it("removes all tokens from storage", () => {
      tokenManager.removeToken();

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith("accessToken");
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("refreshToken");
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("idToken");
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("tokenExpiry");
    });
  });

  describe("isTokenExpired", () => {
    it("returns true when no expiry is stored", () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      expect(tokenManager.isTokenExpired()).toBe(true);
    });

    it("returns true when token is expired", () => {
      const pastTime = Date.now() - 1000; // 1 second ago
      mockLocalStorage.getItem.mockReturnValue(pastTime.toString());

      expect(tokenManager.isTokenExpired()).toBe(true);
    });

    it("returns false when token is not expired", () => {
      const futureTime = Date.now() + 3600000; // 1 hour from now
      mockLocalStorage.getItem.mockReturnValue(futureTime.toString());

      expect(tokenManager.isTokenExpired()).toBe(false);
    });
  });
});
