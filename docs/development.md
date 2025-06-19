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
# Required tools
node --version    # Should be 22+
docker --version  # Required for SAM local
sam --version     # AWS SAM CLI
```

### First-Time Setup

```bash
# 1. Clone and install dependencies
git clone <repo-url>
cd MyAgilityQs
npm install       # Creates workspace symlinks

# 2. Build shared dependencies
npm run build     # Builds shared package first

# 3. Start development servers
npm run dev       # Starts both client and server
```

**What happens during `npm run dev`:**
1. Builds shared package
2. Starts SAM local server (Lambda simulation)
3. Starts Vite dev server with HMR
4. Connects to live AWS DynamoDB

### Development Workflow

**Daily Development:**
```bash
# Start everything
npm run dev

# Client changes: Hot reload automatically
# Server changes: 
npm run build     # Rebuild, SAM picks up changes
```

**Testing:**
```bash
# Client tests
cd client && npm test

# Server validation
cd server && npm run type-check

# Full build test
npm run build
```

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

## Deployment Architecture

### AWS Resources

- **Lambda Function**: Single function with all routes
- **API Gateway**: HTTP API (not REST) for cost optimization
- **DynamoDB**: On-demand billing, single table
- **Cognito**: User Pool with Google federated identity

### Environment Management

```bash
# Environment Variables (Lambda)
FRONTEND_URL=https://your-domain.com
TABLE_NAME=MyAgilityQs
COGNITO_USER_POOL_ID=us-east-1_808uxrU8E
NODE_ENV=production
```

### CI/CD Pipeline

**GitHub Actions**: Build, test, and deploy
- Client: Build static assets
- Server: SAM deploy to AWS
- Shared: Build before client/server

## Troubleshooting

### Common Issues

**Port 3001 in use:**
```bash
# Kill existing SAM processes
pkill -f sam
# Or use different port
sam local start-api --port 3002
```

**Workspace dependency issues:**
```bash
# Always install from root
rm -rf node_modules */node_modules
npm install
```

**DynamoDB permissions:**
```bash
# Check AWS credentials
aws sts get-caller-identity
# Verify IAM permissions for DynamoDB
```

**Docker not running:**
```bash
# Start Docker Desktop
docker ps  # Should not error
```

### Debug Mode

**SAM Debug:**
```bash
sam local start-api --debug
```

**Client Debug:**
```bash
cd client
npm run dev -- --debug
```

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