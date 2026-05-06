import type { User } from "@my-agility-qs/shared";
import { useQueryClient } from "@tanstack/react-query";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { tokenManager, userApi } from "../lib/api";
import { reportAuthError } from "../lib/sentry";
import type { AuthResponse } from "../types";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  // True while we're still figuring out whether the user is signed in
  // (token check / refresh).
  isLoading: boolean;
  login: (authData: AuthResponse) => Promise<void>;
  logout: () => void;
  updateUserPreferences: (preferences: Partial<Pick<User, "trackQsOnly">>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
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
  const queryClient = useQueryClient();

  // Helper function to set user state and Sentry context
  const setUserWithSentry = useCallback((userProfile: User | null) => {
    setUser(userProfile);

    if (userProfile) {
      // Set user context for Sentry
      Sentry.setUser({
        id: userProfile.id,
        email: userProfile.email,
      });
    } else {
      // Clear user context from Sentry
      Sentry.setUser(null);
    }
  }, []);

  // Build a minimal User object from the JWT id token's claims so the UI can
  // flip to "authenticated" state instantly, without waiting on /user/profile.
  // Fields like `trackQsOnly` get filled in by a background getProfile() call.
  const hydrateUserFromToken = useCallback((idToken: string): User | null => {
    try {
      const payload = JSON.parse(atob(idToken.split(".")[1])) as {
        email?: string;
      };
      if (!payload.email) return null;
      return {
        id: payload.email, // server uses email as userId for DB ops
        email: payload.email,
        createdAt: "",
        updatedAt: "",
      };
    } catch {
      return null;
    }
  }, []);

  // Refresh the user profile from the API in the background. If the request
  // fails with an auth error, log out; otherwise log and move on.
  const refreshUserProfile = useCallback(async (): Promise<void> => {
    try {
      const userProfile = await userApi.getProfile();
      setUserWithSentry(userProfile);
    } catch (error) {
      console.error("Background profile refresh failed:", error);
      if (error instanceof Error) {
        reportAuthError(error, 'refresh', { error: error.message, source: 'profile-refresh' });
        // Token rejected — log out so the user can sign in again
        if (/401|unauthorized/i.test(error.message)) {
          tokenManager.removeToken();
          setUserWithSentry(null);
        }
      }
    }
  }, [setUserWithSentry]);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = tokenManager.getToken();
      const refreshToken = tokenManager.getRefreshToken();

      const hydrateAndKickOffRefresh = (idToken: string) => {
        const initialUser = hydrateUserFromToken(idToken);
        if (initialUser) {
          setUserWithSentry(initialUser);
        }
        // Fire-and-forget — don't block app render on the network call
        refreshUserProfile();
      };

      if (token && !tokenManager.isTokenExpired()) {
        hydrateAndKickOffRefresh(token);
      } else if (refreshToken) {
        // Try to refresh access tokens. If that succeeds, hydrate from the
        // new id token; if it fails, clear and let the user log in again.
        const refreshed = await tokenManager.refreshAccessToken();
        if (refreshed) {
          const newToken = tokenManager.getToken();
          if (newToken) {
            hydrateAndKickOffRefresh(newToken);
          }
        } else {
          tokenManager.removeToken();
        }
      }

      setIsLoading(false);
    };

    initializeAuth();
  }, [hydrateUserFromToken, refreshUserProfile, setUserWithSentry]);

  // Validate auth when app resumes from background (PWA / long-idle tab)
  useEffect(() => {
    const cleanup = tokenManager.onVisibilityResumeValidate(() => {
      // Session is no longer valid — log out immediately
      tokenManager.removeToken();
      queryClient.clear();
      setUserWithSentry(null);
    });

    return cleanup;
  }, [queryClient, setUserWithSentry]);

  const login = useCallback(
    async (authData: AuthResponse) => {
      tokenManager.setTokens(authData);

      // Hydrate user state from the JWT immediately so isAuthenticated flips
      // true now, the post-login redirect happens without waiting on the
      // network, and ProtectedRoute lets the user through. The full profile
      // (with trackQsOnly etc.) is refreshed in the background. Initial data
      // (dogs, locations) is loaded by AppBootstrap on the post-auth render.
      const initialUser = hydrateUserFromToken(authData.idToken);
      if (initialUser) {
        setUserWithSentry(initialUser);
      }
      refreshUserProfile();
    },
    [hydrateUserFromToken, refreshUserProfile, setUserWithSentry]
  );

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
    setUserWithSentry(null);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    updateUserPreferences,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
