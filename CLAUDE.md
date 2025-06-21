# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

MyAgilityQs is a full-stack AKC Canine Agility tracking application built as a serverless monorepo with:
- **Client**: React 19 + TypeScript + Mantine UI + Vite
- **Server**: AWS Lambda + TypeScript + DynamoDB single-table design
- **Shared**: Common types and utilities package
- **Architecture**: Production-deployed serverless application for tracking dog agility competition results

## Quick Commands Reference

### Monorepo Management (from root)
```bash
npm install              # Install all workspace dependencies (creates symlinks)
npm run dev              # Start both client and server concurrently
npm run build            # Build shared, client, and server in dependency order
npm run lint             # Lint all packages
npm run type-check       # TypeScript check all packages
```

### Client Development
```bash
cd client
npm run dev              # Vite dev server on http://localhost:5174
npm run build            # TypeScript + Vite build
npm run test             # Vitest unit tests
npm run lint             # ESLint with TypeScript rules
```

### Server Development
```bash
cd server
npm run dev              # Build + SAM local API on http://localhost:3001
npm run build            # esbuild compilation
npm run build:watch     # esbuild with watch mode
npm run type-check      # TypeScript validation
npm run test            # Build + type check validation
```

## Current Production Status

- **Live API**: https://lsuz1b0sgj.execute-api.us-east-1.amazonaws.com/
- **Health Check**: https://lsuz1b0sgj.execute-api.us-east-1.amazonaws.com/health
- **Database**: DynamoDB (`MyAgilityQs` prod / `MyAgilityQs-Dev` dev)
- **Authentication**: AWS Cognito with Google OAuth fully configured and tested
- **Status**: Production-ready, fully functional application

## Architecture & Code Patterns

### Database Design (DynamoDB Single-Table)

Uses single-table design with composite keys:
- **Primary Keys**: `PK` (Partition Key) + `SK` (Sort Key)
- **GSI**: `GSI1PK` + `GSI1SK` for cross-entity queries
- **Environment**: `MyAgilityQs` (prod) / `MyAgilityQs-Dev` (dev)

**Key Patterns**:
```typescript
// Users: PK: USER#${userId}, SK: PROFILE
// Dogs: PK: DOG#${dogId}, SK: PROFILE  
// Runs: PK: USER#${userId}, SK: RUN#${timestamp}#${runId}
// User-Dog Links: PK: USER#${userId}, SK: DOG#${dogId}
```

**Database Files**:
- `server/src/database/client.ts` - DynamoDB client setup
- `server/src/database/dogs.ts` - Dog CRUD operations
- `server/src/database/runs.ts` - Run CRUD with GSI queries
- `server/src/database/users.ts` - User management
- `server/src/database/progress.ts` - Progress calculation functions (no database storage)

### API Routes & Authentication

**Main Files**:
- `server/src/index.ts` - Lambda handler with Middy middleware stack
- `server/src/router.ts` - Route definitions with `ExtendedRoute` interface
- `server/src/middleware/jwtAuth.ts` - Conditional JWT authentication

**Route Pattern**:
```typescript
interface ExtendedRoute extends Route {
  allowAnonymous?: boolean; // Skip JWT auth for login/signup routes
}
```

**Auth Flow**:
- AWS Cognito with JWT tokens (90-day expiration)
- Email as consistent user identifier
- **Google OAuth**: Fully implemented, configured, and production-ready
  - Server endpoints: `/auth/google/login` and `/auth/google/callback`
  - Client: "Continue with Google" button with OAuth callback handling
  - Account linking via email for consistent user experience
  - AWS Cognito and Google Cloud Console fully configured and tested
- User object attached to event: `event.user = { userId, email, username, cognitoSub }`

### Shared Types System

**Location**: `shared/src/`
- Domain entities: `User`, `Dog`, `Run`, `DogProgress`
- API DTOs: `CreateDogRequest`, `UpdateDogRequest`, `ApiResponse<T>`
- Enums: `COMPETITION_CLASSES`, `COMPETITION_LEVELS`
- Progress utilities: `calculateMachProgress`, `calculateDoubleQs`, `isMachEligible`
- Business logic: validation, formatting, progress calculations

**Import Pattern**:
```typescript
import { Dog, CreateRunRequest, ApiResponse, calculateMachProgress } from '@my-agility-qs/shared';
```

### Client Architecture

**Key Files**:
- `client/src/App.tsx` - Main app with routing and auth
- `client/src/contexts/AuthContext.tsx` - JWT token management
- `client/src/lib/api.ts` - HTTP client with authentication
- `client/src/components/Layout/AppLayout.tsx` - Responsive layout

**State Management**:
- TanStack Query for server state
- React Context for auth state
- Local component state with hooks

**UI Patterns**:
- Mantine components with custom theming
- Mobile-first responsive design
- Touch-optimized interface for quick run entry

## Development Workflow

**WSL Development Environment**:
- **OS**: Ubuntu on Windows Subsystem for Linux (WSL2)
- **IDE**: VS Code on Windows with WSL extension (WSL-linked mode)
- **Terminal**: Bash shells within WSL Ubuntu
- **File System**: Project located at `~/src/MyAgilityQs` (Ubuntu partition, not `/mnt/c`)
- **Benefits**: Native Linux performance, better build speeds, no Windows file IO hangs
- **Network Access**: Vite dev server accessible from Windows at `http://172.31.91.177:5174/` (WSL IP)
- **Windows Path Access**: When Windows paths like `C:\Users\...` are provided, translate to `/mnt/c/Users/...` to access from WSL

**Local Development Setup**:
1. **Client**: Vite dev server with live AWS backend
2. **Server**: SAM CLI + Docker for local Lambda simulation
3. **Database**: Live DynamoDB (environment-based table selection)

**Build Dependencies**:
- Shared package must build first (dependency for client/server)
- Use workspace root `npm run build` for correct order
- Client uses symlinked shared package via npm workspaces

**Testing**:
- Client: Vitest + Testing Library
- Server: Build + type check validation
- Test credentials stored in `server/.env` (gitignored)

## Key Features

### Auto-Level Progression
- Dogs automatically advance levels after earning 3 qualifying runs
- Server-side progression logic in run creation/update
- Client cache invalidation for seamless UX

### Google OAuth Integration
- Complete OAuth 2.0 flow via Cognito Hosted UI
- Account linking by email for consistent user experience
- Production-ready with comprehensive error handling

### Hard Delete Functionality
- Safe permanent deletion for both dogs and runs
- Confirmation dialogs with destructive UI styling
- Cascade deletion maintains data integrity

### Track Qs Only Mode
- User preference to hide NQ tracking
- Stored in database user profile
- Affects AddRunPage and ViewRunsPage behavior

### Title Progress Tracking
- **Complete progress system** for AKC agility title advancement with MACH2+ support
- **Per-dog level tracking**: Shows current level in each class with progress toward next level
- **Multiple MACH tracking**: Full support for MACH, MACH2, MACH3, etc. with individual badges
- **MACH Points entry**: User-entered field on Add Run form (Masters Standard/Jumpers only)
- **Accurate AKC rules**: Double Qs only count Masters level, same-day Standard + Jumpers
- **Computed progress**: All progress calculated on-the-fly from runs data (no stored progress)
- **Real-time updates**: Progress reflects actual runs data, cache invalidation for seamless UX
- **Clean UI**: Streamlined display with MACH badges and progress toward next achievement

### Progress Calculation Architecture

**Computed vs Stored**: Progress is calculated on-demand from runs data, not stored in database
- **Benefits**: Always accurate, retroactive for existing data, no sync issues
- **Shared utilities**: `shared/src/utils/progressCalculations.ts` contains reusable calculation logic
- **Server**: `server/src/database/progress.ts` computes progress for API responses
- **Client**: Uses shared utilities for real-time MACH progress display

**Key Calculation Functions**:
```typescript
// Shared utilities used by both client and server
calculateDoubleQs(runs: Run[]): number
calculateTotalMachPoints(runs: Run[]): number  
calculateMachProgress(runs: Run[]): MachProgress
isMachEligible(dogClasses): boolean
```

**MACH Progress Logic**:
- Each MACH requires exactly 750 points + 20 Double Qs
- `completeMachs = Math.min(floor(totalPoints/750), floor(totalDoubleQs/20))`
- Progress toward next MACH resets every 750 points / 20 Double Qs
- Double Qs = Masters Standard + Jumpers qualifying runs on same date

## Important Development Notes

### Authentication Setup
- AWS Cognito User Pool configured for React app (no client secrets)
- JWT middleware with route-based protection
- Google OAuth fully operational in production

### Development Tools
- **SAM CLI**: Required for local Lambda development
- **Docker**: Required for SAM local containers
- **Node.js 22+**: Required for both client and server
- **Puppeteer MCP**: Browser automation for testing and screenshots

### Puppeteer MCP Setup Status
- **Installation**: `claude mcp add puppeteer -s user -- npx -y @modelcontextprotocol/server-puppeteer`
- **Status**: ✅ **FULLY FUNCTIONAL** - Tools working in Claude Code sessions
- **Available Tools**: `mcp__puppeteer__puppeteer_navigate`, `mcp__puppeteer__puppeteer_screenshot`, `mcp__puppeteer__puppeteer_click`, `mcp__puppeteer__puppeteer_fill`, `mcp__puppeteer__puppeteer_evaluate`, etc.
- **WSL Dependencies**: Required Chrome dependencies installed via `sudo apt install -y libnss3 libxss1 libxtst6 libxrandr2 libasound2t64 libpangocairo-1.0-0 libatk1.0-0 libcairo-gobject2 libgtk-3-0 libgdk-pixbuf2.0-0 libxcomposite1 libxcursor1 libxdamage1 libxi6 libdrm2`
- **Verified Functions**:
  - ✅ Navigate to localhost:5174 (Vite dev server)
  - ✅ Screenshot capture with visual output
  - ✅ Console logs access via MCP resource `console://logs`
- **Purpose**: Enable Claude to visually inspect and interact with the running app for UI testing and debugging

### Common Issues and Solutions
- Always run `npm ci` from workspace root to create proper symlinks
- Shared package must build before client/server
- Use environment-based table selection for dev/prod databases
- Test credentials available in `server/.env` for development
- **Vite cache issues**: Clear with `rm -rf client/node_modules/.vite` if modules fail to load
- **WSL network access**: Ensure Vite runs with `--host 0.0.0.0` for Windows browser access
- **Google OAuth**: Callback URL needs updating for WSL IP (`http://172.31.91.177:5174/auth/callback`)

When working on this codebase, maintain the established patterns for database operations, API routes, and shared type usage. Always test locally before deployment and ensure the build order is respected for workspace dependencies.

## File Structure Reference

```
MyAgilityQs/
├── client/           # React frontend
├── server/           # AWS Lambda API
├── shared/           # Shared TypeScript types and utilities
├── docs/             # Documentation
├── CLAUDE.md         # This file - LLM context
├── README.md         # Public-facing project overview
└── package.json      # Workspace configuration
```