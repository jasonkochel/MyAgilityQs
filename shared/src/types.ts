// Competition classes - explicit union type (no const array needed)
export type CompetitionClass = 
  | "Standard"
  | "Jumpers" 
  | "T2B"
  | "FAST"
  | "Premier Std"
  | "Premier JWW";

// Competition levels - explicit union type (no const array needed)
export type CompetitionLevel = "Novice" | "Open" | "Excellent" | "Masters";

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
  registeredName?: string; // AKC registered name
  active: boolean;
  classes: DogClass[];
  photoUrl?: string; // URL to the cropped/display version of the photo
  originalPhotoUrl?: string; // URL to the original uploaded photo (for re-cropping)
  photoCrop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateDogRequest {
  name: string;
  registeredName?: string;
  classes: DogClass[];
}

export interface UpdateDogRequest {
  name?: string;
  registeredName?: string;
  classes?: DogClass[];
  active?: boolean;
  photoUrl?: string; // URL to the cropped/display version of the photo
  originalPhotoUrl?: string; // URL to the original uploaded photo (for re-cropping)
  photoCrop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
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
  date?: string; // YYYY-MM-DD format
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

export interface MastersTitle {
  title: string;
  level: string;
  earned: boolean;
  progress: number; // Qs toward this title
  needed: number; // Total Qs needed for this title
}

export interface MastersTitleProgress {
  standardTitles: MastersTitle[];
  jumpersTitles: MastersTitle[];
}

export interface DogProgress {
  dogId: string;
  dogName: string;
  classProgress: ClassProgress[];
  doubleQs: number;
  machProgress: number; // Total MACH points (not capped)
  completeMachs?: number; // Number of complete MACHs earned
  mastersTitles?: MastersTitleProgress; // Masters title progression
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

// Photo upload types
export interface PhotoUploadUrlResponse {
  uploadUrl: string;
  photoUrl: string;
  key: string;
}

// Progression Rule types
export interface ProgressionRule {
  /** Starting level for this rule */
  fromLevel: CompetitionLevel;
  /** Number of qualifying runs required at fromLevel */
  qualifyingRunsRequired: number;
  /** Level to advance to (null means stay at current level) */
  toLevel: CompetitionLevel | null;
  /** Title earned when this rule is satisfied */
  titleEarned?: string;
  /** Additional qualifying runs required at toLevel (for titles like MX) */
  additionalQsAtToLevel?: number;
}

export interface ClassProgressionRules {
  /** Competition class these rules apply to */
  class: CompetitionClass;
  /** Starting level for new dogs in this class */
  startingLevel: CompetitionLevel;
  /** Ordered list of progression rules (evaluated in order) */
  rules: ProgressionRule[];
}

export interface LevelComputationResult {
  /** Current level the dog should be at */
  currentLevel: CompetitionLevel;
  /** Titles earned in this class */
  titlesEarned: string[];
  /** Qualifying runs at current level */
  qualifyingRunsAtCurrentLevel: number;
  /** Next progression rule that applies (null if at terminal level) */
  nextRule: ProgressionRule | null;
  /** Whether this dog has progressed from their starting level */
  hasProgressed: boolean;
}

// Diagnostics types (for debugging progression rules)
export interface RuleEvaluation {
  rule: ProgressionRule;
  qsAtLevel: number;
  satisfied: boolean;
  qualifyingRuns: Run[];
}

export interface ClassDiagnosticDetail {
  className: string;
  result: LevelComputationResult;
  classRuns: Run[];
  rules: ClassProgressionRules | undefined;
  ruleEvaluations: RuleEvaluation[];
}

export interface DogDiagnostic {
  dog: Dog;
  dogRuns: Run[];
  allLevels: Record<CompetitionClass, LevelComputationResult>;
  classDetails: ClassDiagnosticDetail[];
}

export type ProgressionDiagnostics = DogDiagnostic[];

// MACH Progress types
export interface MachProgress {
  completeMachs: number;
  nextMachNumber: number;
  pointsTowardNext: number;
  doubleQsTowardNext: number;
  totalMachPoints: number;
  totalDoubleQs: number;
  pointsProgress: string; // e.g., "250/750"
  doubleQProgress: string; // e.g., "5/20"
}
