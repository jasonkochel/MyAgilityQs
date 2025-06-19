import type { User } from "@my-agility-qs/shared";
import { useQueryClient } from "@tanstack/react-query";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { dogsApi, locationsApi, tokenManager, userApi } from "../lib/api";
import type { AuthResponse } from "../types";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (authData: AuthResponse) => Promise<void>;
  logout: () => void;
  preloadUserData: () => Promise<void>;
  updateUserPreferences: (preferences: Partial<Pick<User, "trackQsOnly">>) => Promise<void>;
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

      if (token && !tokenManager.isTokenExpired()) {
        // Fetch user profile from API - database is single source of truth for email
        try {
          const userProfile = await userApi.getProfile();
          setUser(userProfile);
          await preloadUserData();
        } catch (error) {
          console.error("Failed to fetch user profile:", error);
          // Fall back to clearing tokens if API call fails
          tokenManager.removeToken();
        }
      } else if (refreshToken) {
        // Try to refresh the token
        const refreshed = await tokenManager.refreshAccessToken();
        if (refreshed) {
          try {
            const userProfile = await userApi.getProfile();
            setUser(userProfile); // Use database email as single source of truth
            await preloadUserData();
          } catch (error) {
            console.error("Failed to fetch user profile after refresh:", error);
            tokenManager.removeToken();
          }
        } else {
          // Refresh failed, clear user data
          tokenManager.removeToken();
        }
      }

      // Initialize security enhancements
      tokenManager.clearOnVisibilityChange();
      setIsLoading(false);
    };

    initializeAuth();
  }, [queryClient, preloadUserData]);
  const login = async (authData: AuthResponse) => {
    tokenManager.setTokens(authData);

    try {
      // Fetch user profile from API - database is single source of truth for email
      const userProfile = await userApi.getProfile();
      setUser(userProfile);

      // Preload user data after successful login
      await preloadUserData();
    } catch (error) {
      console.error("Error during login:", error);
      // Clear tokens if something goes wrong
      tokenManager.removeToken();
      throw error;
    }
  };

  const updateUserPreferences = async (preferences: Partial<Pick<User, "trackQsOnly">>) => {
    if (!user) return;

    try {
      const updatedUser = await userApi.updateProfile(preferences);
      setUser(updatedUser);
    } catch (error) {
      console.error("Failed to update user preferences:", error);
      throw error;
    }
  };
  const logout = () => {
    tokenManager.removeToken();
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
    updateUserPreferences,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
