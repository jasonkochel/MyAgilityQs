import { useQueryClient } from "@tanstack/react-query";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { dogsApi, locationsApi, tokenManager } from "../lib/api";
import type { AuthResponse } from "../types";

interface User {
  email: string;
  id: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (authData: AuthResponse, userEmail: string) => Promise<void>;
  logout: () => void;
  preloadUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient(); // Preload user data (dogs, locations, etc.) after authentication
  const preloadUserData = useCallback(async (): Promise<void> => {
    try {
      // Prefetch dogs data with infinite stale time since we'll invalidate on changes
      await queryClient.prefetchQuery({
        queryKey: ["dogs"],
        queryFn: dogsApi.getAllDogs,
        staleTime: Infinity, // Never stale - we'll invalidate explicitly on changes
      });

      // Prefetch locations data with infinite stale time since we'll invalidate on changes
      await queryClient.prefetchQuery({
        queryKey: ["locations"],
        queryFn: locationsApi.getAll,
        staleTime: Infinity, // Never stale - we'll invalidate explicitly on changes
      });
    } catch (error) {
      console.error("❌ Failed to preload user data:", error);
    }
  }, [queryClient]);

  useEffect(() => {
    const initializeAuth = async () => {
      // Check if user is logged in on app start
      const token = tokenManager.getToken();
      const refreshToken = tokenManager.getRefreshToken();
      const userEmail = localStorage.getItem("userEmail");
      const userId = localStorage.getItem("userId");

      if (token && !tokenManager.isTokenExpired() && userEmail && userId) {
        setUser({ email: userEmail, id: userId });
        await preloadUserData();
      } else if (refreshToken && userEmail && userId) {
        // Try to refresh the token
        const refreshed = await tokenManager.refreshAccessToken();
        if (refreshed) {
          setUser({ email: userEmail, id: userId });
          await preloadUserData();
        } else {
          // Refresh failed, clear user data
          localStorage.removeItem("userEmail");
          localStorage.removeItem("userId");
        }
      }

      // Initialize security enhancements
      tokenManager.clearOnVisibilityChange();
      setIsLoading(false);
    };

    initializeAuth();
  }, [queryClient, preloadUserData]);

  const login = async (authData: AuthResponse, userEmail: string) => {
    tokenManager.setTokens(authData);

    // Decode JWT to get user ID (simple base64 decode for demo)
    try {
      const payload = JSON.parse(atob(authData.accessToken.split(".")[1]));
      const userId = payload.sub || payload.username || "unknown";

      const userData = { email: userEmail, id: userId };
      setUser(userData);

      // Store user info in localStorage
      localStorage.setItem("userEmail", userEmail);
      localStorage.setItem("userId", userId);

      // Preload user data after successful login
      await preloadUserData();
    } catch (error) {
      console.error("Error parsing JWT:", error);
      setUser({ email: userEmail, id: "unknown" });
      localStorage.setItem("userEmail", userEmail);
      localStorage.setItem("userId", "unknown");
    }
  };

  const logout = () => {
    tokenManager.removeToken();
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userId");
    queryClient.clear(); // Clear all cached data on logout
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    preloadUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
