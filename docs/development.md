# Development Guide

This guide covers the development workflow, architecture decisions, and detailed setup for MyAgilityQs.

## Architecture Overview

MyAgilityQs uses a serverless monorepo architecture optimized for rapid development and AWS deployment.

### Project Structure

```
MyAgilityQs/
├── client/           # React frontend (Vite + TypeScript)
├── server/           # AWS Lambda API (TypeScript + SAM)
├── shared/           # Shared types and utilities
├── docs/             # Documentation
└── package.json      # Workspace configuration
```

### Tech Stack Decisions

**Why Serverless?**
- Pay-per-request pricing for personal projects
- Automatic scaling without infrastructure management
- Local development that matches production exactly

**Why Single-Table DynamoDB?**
- Cost-effective for small-scale applications
- Excellent performance for query patterns
- Simplified data model with strong consistency

**Why Monorepo?**
- Shared types between client/server
- Simplified dependency management
- Single command deployment

## Local Development Setup

### Prerequisites

```bash
node --version    # 22+
docker --version  # Docker Desktop running, required for SAM local
sam --version     # AWS SAM CLI (1.140+)
aws sts get-caller-identity   # AWS credentials configured
```

### First-Time Setup

```bash
git clone <repo-url>
cd MyAgilityQs
npm install       # workspace symlinks
npm run build     # builds shared, client, server in dependency order
```

### Two Modes for the Frontend

The Vite dev server can point at either the live production backend or your local
SAM Lambda. Pick based on what you're working on:

| Mode | When to use | API URL |
|---|---|---|
| **Live backend (default)** | UI-only changes | prod Lambda URL from `client/.env` |
| **Local SAM** | Server changes, integration testing | `http://localhost:3001` |

To switch the client to the local backend, create `client/.env.local` (gitignored):

```
VITE_API_URL=http://localhost:3001
```

Restart Vite to pick it up. Delete the file to switch back to prod.

### Daily Workflow

**UI-only iteration (live backend):**
```bash
npm run dev:client    # Vite dev server with HMR on http://localhost:5174
```

**Server iteration (local SAM Lambda):**
```bash
# Terminal 1
npm run sam:local     # builds shared+server, starts SAM local on port 3001

# Terminal 2
npm run dev:client    # with client/.env.local pointing at localhost:3001
```

**After server code changes:** rerun `npm run build:server` (or `npm run sam:local`
which builds first). SAM picks up the new bundle in `server/dist/`. With
`--warm-containers LAZY` (already enabled), only the first request after a build
pays the container init cost.

### Validation

```bash
npm run type-check    # tsc --noEmit across all three packages
npm run lint          # ESLint across client + server
npm run test          # Vitest unit tests (client only)
```

## Local Backend Testing

### Why a separate `template.local.yaml`?

The production `template.yaml` exposes the Lambda via a **Lambda Function URL**
(no API Gateway). `sam local start-api` requires an API Gateway event source, so
it can't serve routes from the prod template directly. `template.local.yaml`
wraps the same handler with a catch-all `HttpApi` proxy:

- `Type: HttpApi` → delivers **API Gateway v2** event shape
  (`event.requestContext.http.method`, `event.rawPath`), matching what Lambda
  Function URLs send in prod. Server code's V2 field accesses work unchanged.
- Runtime is pinned to `nodejs22.x` because SAM CLI 1.140 doesn't yet ship the
  `nodejs24.x` Lambda emulation image. Prod uses 24.x; functional behavior is
  identical for our code.
- Env vars are baked in (Cognito IDs, Sentry DSN — same values as
  `template.yaml`, none of which are secrets).

The `npm run sam:local` script chains the build steps and starts the API:

```bash
sam local start-api -t template.local.yaml --port 3001 --host 0.0.0.0 --warm-containers LAZY
```

### Integration testing with `progtest`

`tools/progtest.mjs` is an interactive CLI for end-to-end smoke testing of
progression logic. It creates a throwaway dog, lets you drive baselines and
runs through a menu, and cleans up afterward:

```bash
node tools/progtest.mjs                   # menu-driven REPL, defaults to live prod
node tools/progtest.mjs --server http://localhost:3001   # against local SAM
```

State (auth token + test dog id) persists in `.progtest-state.json` at the repo
root (gitignored), so you can quit and resume.

Typical use: pick `Create test dog` → `Set per-class baseline` → `Add run` (it
prints status and any level-progression after each run) → `Cleanup` when done.

### Test Database Options

By default, the local Lambda hits the **real production** `MyAgilityQs` DynamoDB
table (env var `DYNAMODB_TABLE_NAME` in `template.local.yaml`). For one-off
integration tests via `progtest`, this is fine — the tool deletes its test dog
on exit. For heavier iteration on server code, consider one of these isolation
options:

| Option | Isolation | Setup cost | Notes |
|---|---|---|---|
| **1. Prod DDB + cleanup discipline** (current) | none | zero | Fine for short integration tests with `progtest`'s built-in cleanup. Risk: abandoned data, accidentally corrupting your own dogs/runs. |
| **2. Real DDB, separate `MyAgilityQs-Dev` table** | per-table | ~5 min | The prod template already creates `${Suffix}` → `-Dev` for non-production environments. Run `sam deploy --parameter-overrides Environment=development --stack-name my-agility-qs-dev` once, then point `template.local.yaml`'s `DYNAMODB_TABLE_NAME` at the new table. Real DDB semantics, ~$0/mo at this scale. |
| **3. DynamoDB Local in Docker** ⭐ recommended for active server dev | full | ~30 min one-time | Run `amazon/dynamodb-local` on port 8000, init script creates the table + GSI1, `server/src/database/client.ts` honors a `DYNAMODB_ENDPOINT_URL` env var, `template.local.yaml` sets it to `http://host.docker.internal:8000`. Fully offline, instant reset (`docker rm`), free. Cognito still hits prod. |
| **4. LocalStack** | full | hours | Mocks DynamoDB + Cognito + S3. Cognito mock has fidelity gaps (token signing, OAuth flows). Overkill unless you also want offline auth. |

**Recommendation:** stay on Option 1 for casual testing; switch to Option 3
(DynamoDB Local) when iterating heavily on server code, as a small Docker
container plus 4 file changes gives you full data isolation with instant reset
and no AWS charges. Option 2 is the right choice if you want real DDB
behavior across multiple machines or want to share dev state with others.

### Common Local-Backend Pitfalls

- **First request after `sam:local` startup is slow** — initial container init
  takes ~30s. Subsequent requests reuse the warm container (`LAZY` mode).
- **Server code changes need a rebuild** — `sam local` mounts `server/dist/`
  read-only into the container. After editing `server/src/`, rerun
  `npm run build:server` (or restart `npm run sam:local`).
- **Token expiry mid-session** — Cognito idTokens last ~1 hour. The `progtest`
  menu has a `Re-login` option for when calls start returning 401.
- **Port 3001 in use** — usually a previous SAM that didn't shut down cleanly.
  On Windows: `Get-NetTCPConnection -LocalPort 3001 | Stop-Process -Id $_.OwningProcess -Force`.

## Database Architecture

### DynamoDB Single-Table Design

**Table**: `MyAgilityQs` (prod) / `MyAgilityQs-Dev` (dev)

**Primary Keys:**
- `PK` (Partition Key): Entity identifier
- `SK` (Sort Key): Entity type + timestamp

**Global Secondary Index:**
- `GSI1PK` / `GSI1SK`: Cross-entity queries

### Entity Patterns

```typescript
// User Profile
PK: USER#abc123
SK: PROFILE

// Dog Profile  
PK: DOG#dog456
SK: PROFILE

// User-Dog Relationship
PK: USER#abc123
SK: DOG#dog456

// Run Record (stored under user)
PK: USER#abc123
SK: RUN#2025-06-19#run789
GSI1PK: DOG#dog456    // For dog-specific queries
GSI1SK: RUN#2025-06-19#run789

// Progress Tracking
PK: PROGRESS#abc123
SK: DOG#dog456
```

### Query Patterns

```typescript
// All runs for user (chronological)
query({
  PK: "USER#abc123",
  SK: { beginsWith: "RUN#" }
})

// All runs for dog (using GSI)
query({
  IndexName: "GSI1",
  GSI1PK: "DOG#dog456",
  GSI1SK: { beginsWith: "RUN#" }
})

// User's dogs
query({
  PK: "USER#abc123", 
  SK: { beginsWith: "DOG#" }
})
```

## API Architecture

### Lambda Handler Pattern

**Single Function**: All routes handled by one Lambda with Middy middleware

```typescript
// server/src/index.ts
export const handler = middy()
  .use(httpRouter({ routes }))
  .use(jwtAuth({ userPoolId, region }))
  .use(cors())
  .use(httpJsonBodyParser())
  .use(httpErrorHandler())
```

### Route Protection

```typescript
// server/src/router.ts
interface ExtendedRoute extends Route {
  allowAnonymous?: boolean;
}

const routes: ExtendedRoute[] = [
  { method: 'POST', path: '/auth/login', handler: authHandlers.login, allowAnonymous: true },
  { method: 'GET', path: '/dogs', handler: dogHandlers.list }, // Protected by default
]
```

### JWT Middleware

**Conditional Authentication**: Routes are protected unless marked `allowAnonymous`

```typescript
// Middleware attaches user to event
event.user = {
  userId: string,
  email: string,
  username: string,
  cognitoSub: string
}
```

## Frontend Architecture

### State Management Strategy

**TanStack Query**: Server state management
- Automatic caching and invalidation
- Background refetching
- Optimistic updates for UI responsiveness

**React Context**: Authentication state
- JWT token management
- User profile data
- Auto-refresh handling

**Component State**: UI-specific state only

### Data Flow

```
User Action → API Call → TanStack Query → Component Update
             ↓
         JWT Auth → Lambda → DynamoDB
```

### Key Patterns

**API Client**: Centralized HTTP client with auth

```typescript
// client/src/lib/api.ts
const api = ky.create({
  prefixUrl: API_URL,
  hooks: {
    beforeRequest: [addAuthHeader],
    afterResponse: [handleTokenRefresh]
  }
})
```

**Cache Management**: Aggressive invalidation for real-time feel

```typescript
// After creating a run
queryClient.invalidateQueries(['runs'])
queryClient.invalidateQueries(['dogs'])  // For progress updates
```

## Authentication Architecture

### AWS Cognito + Google OAuth

**User Pool Configuration:**
- Email as username
- 90-day JWT expiration
- Google federated identity
- No client secrets (React app)

**OAuth Flow:**
1. User clicks "Continue with Google"
2. Redirect to Cognito Hosted UI
3. Google authentication
4. Redirect to `/auth/callback` with code
5. Exchange code for JWT tokens
6. Store tokens and redirect to app

**Account Linking**: Users identified by email across auth methods

### Security Considerations

- JWT tokens in sessionStorage (not localStorage)
- Refresh tokens in localStorage for persistence
- CORS protection on all endpoints
- Input validation on all API calls

## Key Features Implementation

### Auto-Level Progression

**Business Logic**: After 3 qualifying runs at current level, advance to next

```typescript
// server/src/database/runs.ts
async function checkLevelProgression(userId: string, dogId: string, 
                                   competitionClass: string, level: string) {
  // Count qualifying runs at current level
  // If >= 3, advance to next level
  // Update dog profile
  // Return progression metadata
}
```

**Client Integration**: Cache invalidation triggers UI updates

### Mobile Optimization

**Touch Targets**: Minimum 44px for all interactive elements
**Quick Entry**: Default values and smart form behavior
**Responsive**: Mobile-first design with progressive enhancement

## Deployment

See [deployment.md](deployment.md) for AWS resources, the GitHub Actions CI/CD
pipeline, environment variables, monitoring, and rollback procedures.

## Performance Considerations

### Database Optimization
- Single-table design minimizes cross-table joins
- GSI for efficient dog-specific queries
- Batch operations where possible

### Frontend Optimization
- Code splitting with React.lazy()
- Aggressive caching with TanStack Query
- Memoization for expensive calculations

### Lambda Optimization
- Single function reduces cold starts
- esbuild for fast compilation
- Minimal dependencies in bundle

## Contributing Guidelines

### Code Standards
- TypeScript strict mode
- ESLint + Prettier formatting
- Shared types via @my-agility-qs/shared
- Conventional commit messages

### Testing Strategy
- Unit tests for business logic
- Integration tests for API endpoints
- Component tests for UI
- Manual testing for OAuth flows

### Pull Request Process
1. Feature branch from main
2. Update CLAUDE.md if architecture changes
3. Test locally with full workflow
4. Update documentation as needed