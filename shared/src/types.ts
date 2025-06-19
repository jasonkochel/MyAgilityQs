// Competition classes
export const COMPETITION_CLASSES = [
  "Standard",
  "Jumpers",
  "T2B",
  "FAST",
  "Premier Std",
  "Premier JWW",
] as const;

export type CompetitionClass = (typeof COMPETITION_CLASSES)[number];

// Competition levels
export const COMPETITION_LEVELS = ["Novice", "Open", "Excellent", "Masters"] as const;

export type CompetitionLevel = (typeof COMPETITION_LEVELS)[number];

// User types
export interface User {
  id: string; // Cognito UUID
  email: string;
  trackQsOnly?: boolean; // User preference for tracking only qualifying runs
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserRequest {
  trackQsOnly?: boolean;
  // Note: email is immutable after signup to maintain Cognito consistency
}

// Dog types
export interface DogClass {
  name: CompetitionClass;
  level: CompetitionLevel;
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

// Run types
export interface Run {
  id: string;
  dogId: string;
  date: string; // YYYY-MM-DD format
  class: CompetitionClass;
  level: CompetitionLevel;
  qualified: boolean;
  placement: number | null; // 1-4 for placements, null for no placement
  time?: number; // decimal seconds
  machPoints?: number;
  location?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRunRequest {
  dogId: string;
  date: string;
  class: CompetitionClass;
  level: CompetitionLevel;
  qualified?: boolean;
  placement?: number | null;
  time?: number;
  machPoints?: number;
  location?: string;
  notes?: string;
}

export interface CreateRunResponse {
  run: Run;
  levelProgression?: {
    dogName: string;
    class: CompetitionClass;
    fromLevel: CompetitionLevel;
    toLevel: CompetitionLevel;
  };
}

export interface UpdateRunRequest {
  date?: string;
  class?: CompetitionClass;
  level?: CompetitionLevel;
  qualified?: boolean;
  placement?: number | null;
  time?: number;
  machPoints?: number;
  location?: string;
  notes?: string;
}

export interface BatchImportRunsRequest {
  runs: CreateRunRequest[];
}

export interface BatchImportRunsResponse {
  successful: Run[];
  failed: Array<{
    request: CreateRunRequest;
    error: string;
  }>;
  totalRequested: number;
  totalSuccessful: number;
  totalFailed: number;
}

// Statistics types
export interface ClassProgress {
  class: CompetitionClass;
  levels: {
    [K in CompetitionLevel]?: number;
  };
}

export interface DogProgress {
  dogId: string;
  dogName: string;
  classProgress: ClassProgress[];
  doubleQs: number;
  machProgress: number; // 0-20
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: Record<string, any>;
}

export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, any>;
}

// Query parameters
export interface RunsQuery {
  dogId?: string;
  class?: CompetitionClass;
  level?: CompetitionLevel;
  qualified?: boolean;
  limit?: number;
  offset?: number;
  sort?: "date" | "class" | "level" | "time" | "placement";
  order?: "asc" | "desc";
}

// Authentication types
export interface AuthUser {
  id: string;
  email: string;
  token: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface GoogleLoginRequest {
  token: string;
}
