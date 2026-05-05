# CLAUDE.md

Project-specific guidance for AI-assisted development on MyAgilityQs.

## Project Overview

MyAgilityQs is an AKC dog-agility tracking app. Serverless monorepo:
- **client/** — React 19 + TypeScript + Mantine + Vite
- **server/** — AWS Lambda + TypeScript (esbuild bundle), Middy middleware, single Lambda handles all routes
- **shared/** — Common types and runtime helpers
- **template.yaml / template.local.yaml** — SAM templates (prod uses Lambda Function URL; local uses HttpApi)

## Development Environment

- **OS**: Windows 11 with Git Bash (no WSL)
- **Path conventions** (see global `~/.claude/CLAUDE.md` for full rules): Bash uses `/c/Users/...`, file tools use `C:/Users/...` with forward slashes
- **Node 22+**, **Docker Desktop** (for SAM local), **SAM CLI** (Windows installer at `C:\Program Files\Amazon\AWSSAMCLI\bin\`)
- **Deployment** is **GitHub Actions on push to main** — do NOT deploy locally unless explicitly asked

## Collaboration Rules

- **Don't run `npm run dev` yourself** — the user keeps Vite running in a separate terminal. Build/typecheck commands are fine to run.
- **Don't perform git operations** unless explicitly asked. The user reviews changes before committing.

## Quick Commands (run from repo root)

```bash
npm install              # workspace symlinks
npm run build            # builds shared, client, server in dependency order
npm run lint             # ESLint across client + server
npm run type-check       # tsc across all three packages
npm run sam:local        # local SAM Lambda on http://localhost:3001 (used by `dev:server`)
npm run dev              # concurrent: dev:client (Vite) + sam:local (SAM Lambda)
```

Workspace-targeted: `npm run <script> --workspace=client|server|shared`.

See [docs/development.md](docs/development.md) for the full local-backend setup, including the test database options and the `tools/progtest.mjs` integration testing CLI.

## Production

- **App**: https://myagilityqs.com
- **API**: https://vep645bkmqblgemzy72psyrsju0mjgma.lambda-url.us-east-1.on.aws/
- **DynamoDB table**: `MyAgilityQs` (single table, single environment — there is no `-Dev` table despite the env-based naming in the template)
- **Cognito User Pool**: `us-east-1_808uxrU8E` (`MyAgilityQs-Users`); App Client used by server: `7qaajum3pc6ehvkbhidjvmrjmq`
- **CloudFront Distribution**: `EFPF6DBPT9OEI`
- **Stack**: `my-agility-qs`

See [docs/deployment.md](docs/deployment.md) for full AWS resource inventory.

## Architecture

### Database (DynamoDB single-table)

- **PK**/**SK** + **GSI1PK**/**GSI1SK**
- Patterns:
  - `USER#${userId}` / `PROFILE`
  - `DOG#${dogId}` / `PROFILE`
  - `USER#${userId}` / `RUN#${timestamp}#${runId}` (with GSI1 keyed by `DOG#${dogId}`)
  - `USER#${userId}` / `DOG#${dogId}` (user-dog link)
- Files: `server/src/database/{client,dogs,runs,users,progress}.ts`

### API (Lambda + Middy)

- `server/src/index.ts` — Lambda handler, Middy middleware stack
- `server/src/router.ts` — routes; `ExtendedRoute.allowAnonymous: true` opts a route out of JWT auth
- `server/src/middleware/jwtAuth.ts` — JWT verification via `aws-jwt-verify`; attaches `event.user = { userId, email, username, cognitoSub }`
- `server/src/middleware/sentryContext.ts` — adds Sentry context; **filters 4xx out of capture** (expected client errors don't trip alerts)
- All event accesses use **API Gateway v2 shape** (`event.requestContext.http.method`, `event.rawPath`) — matches Lambda Function URL delivery in prod and `HttpApi` events in local SAM

### Shared types

`shared/src/types.ts` is the canonical type source: `User`, `Dog`, `Run`, `BaselineCounts`, `DogProgress`, all DTOs, and the `CompetitionClass` / `CompetitionLevel` unions. Runtime helpers (`isPremierClass`, `normalizeClassName`) also live there.

**Vite CJS limitation:** Vite can't resolve shared package runtime functions through CJS re-exports cleanly, so `isPremierClass` and a small map are duplicated in `client/src/lib/constants.ts` as a workaround.

### Client

- `App.tsx` — routing (Wouter), `ProtectedRoute` wraps authenticated pages
- `contexts/AuthContext.tsx` — JWT token lifecycle (sessionStorage for access/id tokens, localStorage for refresh)
- `lib/api.ts` — ky-based HTTP client with auth header injection + 401 → redirect-to-login
- TanStack Query for server state, React Context for auth, Mantine for UI

## Domain Logic — Read Carefully

### Class names: canonical short form

After the class-name normalization migration, all stored data uses canonical
short form: `Standard`, `Jumpers`, `FAST`, `T2B`, `Premier Std`, `Premier JWW`.
The `normalizeClassName(name)` helper in shared still tolerates legacy long
forms (`Time 2 Beat`, `Premier Standard`, `Premier Jumpers`) as defensive
belt-and-suspenders, but no current data uses them.

### Level progression rules

Defined in `server/src/utils/progressionRules.ts`:
- **Standard / Jumpers / FAST**: Novice → Open → Excellent → Masters, 3 Qs to advance each level. Then Masters titles accrue (MX 10, MXB 25, MXS 50, MXG 100 / MXJ-MJG / MXF-MFG).
- **T2B**: cumulative across all levels, 15 Qs per title (T2B, T2B2, T2B3...)
- **Premier Std / Premier JWW**: no level progression; uses `Masters` as a sentinel level. Title tiers: PAD/PJD (25 Qs + 5 top-25%), PADB/PJDB (50+10), PADS/PJDS (75+15), PADG/PJDG (100+20), PADC/PJDC (125+25). All cumulative.

### Baseline counts (Phase 2 feature)

Lets users seed prior Q totals without back-entering every historical run.
Schema on `Dog.baseline?`:

```ts
{
  perClass?: { [class]: { level?, qs?, top25? } },
  machPoints?: number,
  doubleQs?: number
}
```

- `level` is required for Std/Jmp/FAST when `qs > 0`; ignored for T2B/Premier
- `qs` at non-Masters: counts toward level advancement (3 to next)
- `qs` at Masters: counts toward MX/MXJ/MXF title tiers
- `dog.classes[].level` is **derived/cached**, not user-entered. The forms toggle classes only; level is computed by the rules engine from runs + baseline. `routes/dogs.ts` recomputes via `recalculateDogLevels` whenever baseline changes.

`computeDogLevel(runs, class, baseline?)` in `progressionRules.ts` is the engine entry point. It treats `baseline.level` as the floor (skips rules below it) and adds `baseline.qs` to the count for that level's rule.

### MACH progress

- 750 MACH points + 20 Double Qs = 1 MACH; resets per MACH (so MACH2 needs another 750 + 20).
- `completeMachs = min(floor(totalPoints/750), floor(totalDoubleQs/20))`.
- Double Qs = same-day Masters Standard + Masters Jumpers Q pairs.
- Baseline `machPoints` and `doubleQs` are dog-level fields; they add directly to the totals.

### Calculation files

- `server/src/utils/progressCalculations.ts` — all pure calc functions, baseline-aware
- `server/src/database/progress.ts` — orchestrator that fetches runs and threads baseline into the calcs
- `client/src/pages/TitleProgressPage.tsx` — renders the API response unchanged

## Other Features

- **Auto-progression** fires on qualifying-run creation (`server/src/database/runs.ts:checkAndUpdateDogLevel`). Baseline is threaded into the engine so a baselined Masters dog stays Masters.
- **Track Qs Only** preference (`User.trackQsOnly`) hides Q/NQ controls and NQ rows.
- **Hard delete** on dogs cascades to all the dog's runs.
- **Email verification** uses Cognito `SignUpCommand` + `ConfirmSignUpCommand`. New users go through `/confirm-signup`.
- **Password reset** via `ForgotPasswordCommand` + `ConfirmForgotPasswordCommand` → `/forgot-password` → `/reset-password`.
- **Sentry**: client + server. Server filters 4xx; client uses centralized helpers in `lib/sentry.ts`.

## Build Order Note

Shared must build first; client and server depend on it via npm workspace symlinks. `npm run build` at root handles this in the right order.

## File Structure Reference

```
MyAgilityQs/
├── client/                    # React frontend
├── server/                    # AWS Lambda API
├── shared/                    # Shared TS types + runtime helpers
├── docs/                      # Public-facing docs
│   ├── development.md         # Local dev, SAM local, test DB options, progtest
│   ├── deployment.md          # AWS resources, CI/CD, monitoring
│   ├── oauth-setup.md         # One-time Google OAuth + Cognito setup
│   └── AWS_S3_SETUP.md        # S3/CORS reference (automated by template.yaml)
├── tools/
│   ├── progtest.mjs           # Interactive integration-testing CLI
│   └── scripts/               # One-off migration scripts (e.g. normalize-class-names)
├── template.yaml              # Production SAM (Lambda Function URL)
├── template.local.yaml        # Local SAM (HttpApi for `sam local start-api`)
├── samconfig.toml             # SAM deploy config (used by GitHub Actions)
├── README.md                  # Public overview
└── CLAUDE.md                  # This file
```

## Persisted Plan

A multi-phase productization plan lives in
`~/.claude/projects/C--Users-Jason-code-MyAgilityQs/memory/productization_plan.md`
(loaded automatically as project memory). Phases 1 and 2 are done; Phase 3
(onboarding wizard) and Phase 4 (account deletion, data export, ToS/Privacy
pages) are pending.
