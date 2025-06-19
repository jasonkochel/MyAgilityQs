// Client-specific API Response Types (enhanced with meta for level progression)
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  meta?: {
    levelProgression?: {
      dogName: string;
      class: string;
      fromLevel: string;
      toLevel: string;
    };
  };
}

// Authentication Types (Client-specific - not shared with server)
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
}

// UI Form Types (Client-specific form state)
export interface LoginForm {
  email: string;
  password: string;
}

export interface DogForm {
  name: string;
  classes: Array<{ name: string; level: string }>;
}

// UI State Types (Client-specific)
export type LoadingState = "idle" | "loading" | "success" | "error";

// Navigation types (Client-specific)
export interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}

// NOTE: Dog, Run, CreateRunRequest, etc. are now imported from @my-agility-qs/shared
// This eliminates duplication and ensures type consistency across client and server
