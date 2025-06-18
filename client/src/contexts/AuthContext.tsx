import React, { createContext, useContext, useEffect, useState } from "react";
import { tokenManager } from "../lib/api";
import type { AuthResponse } from "../types";

interface User {
  email: string;
  id: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (authData: AuthResponse, userEmail: string) => void;
  logout: () => void;
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
  useEffect(() => {
    // Check if user is logged in on app start
    const token = tokenManager.getToken();
    const refreshToken = tokenManager.getRefreshToken();
    const userEmail = localStorage.getItem("userEmail");
    const userId = localStorage.getItem("userId");

    if (token && !tokenManager.isTokenExpired() && userEmail && userId) {
      setUser({ email: userEmail, id: userId });
    } else if (refreshToken && userEmail && userId) {
      // TODO: Implement refresh token logic
      setUser({ email: userEmail, id: userId });
    }

    // Initialize security enhancements
    tokenManager.clearOnVisibilityChange();

    setIsLoading(false);
  }, []);

  const login = (authData: AuthResponse, userEmail: string) => {
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
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
