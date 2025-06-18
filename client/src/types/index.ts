// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// Authentication Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
}

// Dog Types
export interface DogClass {
  name: string;
  level: string;
}

export interface Dog {
  id: string;
  userId: string;
  name: string;
  active: boolean;
  classes: DogClass[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDogRequest {
  name: string;
  classes: DogClass[];
}

export interface UpdateDogRequest {
  name?: string;
  classes?: DogClass[];
  active?: boolean;
}

// Run Types
export interface Run {
  id: string;
  userId: string;
  dogId: string;
  class: string;
  level: string;
  time?: number;
  qualified: boolean;
  placement?: number;
  location?: string;
  notes?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRunRequest {
  dogId: string;
  class: string;
  level: string;
  date: string;
  qualified?: boolean;
  placement?: number;
  time?: number;
  location?: string;
  notes?: string;
}

// Progress Types
export interface ClassProgress {
  className: string;
  level: string;
  totalRuns: number;
  qualifyingRuns: number;
  averageTime: number;
  bestTime: number;
  lastRun?: string;
}

export interface DogProgress {
  dogId: string;
  dogName: string;
  totalRuns: number;
  qualifyingRuns: number;
  doubleQs: number;
  machPoints: number;
  classes: ClassProgress[];
}

export interface ProgressSummary {
  totalDogs: number;
  totalRuns: number;
  totalQs: number;
  doubleQs: number;
  averageSuccessRate: number;
}

// Form Types
export interface LoginForm {
  email: string;
  password: string;
}

export interface DogForm {
  name: string;
  classes: DogClass[];
}

// Common utility types
export type LoadingState = "idle" | "loading" | "success" | "error";

// Navigation types
export interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}
