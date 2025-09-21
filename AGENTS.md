# Repository Guidelines

## Project Structure & Module Organization
- Monorepo using npm workspaces: `client/` (React app), `server/` (AWS Lambda API), `shared/` (types/utils).
- Docs live in `docs/` (development, deployment, OAuth, S3, PWA). CI lives in `.github/workflows/`.
- Public assets under `client/public/`; build outputs to `client/dist/`, `server/dist/`, `shared/dist/`.

## Build, Test, and Development Commands
- `npm run dev` — Runs frontend (Vite) and backend (SAM local) together.
- `npm run build` — Builds `shared` then `client` then `server`.
- `npm run test` — Runs client tests (Vitest).
- `npm run type-check` — TypeScript check across all workspaces.
- `npm run lint` — ESLint for `client` and `server`.
- `npm run deploy` — Build and deploy via AWS SAM. See `docs/deployment.md`.
- Workspace-specific: `npm run <script> --workspace=client|server|shared` (e.g., `npm run dev --workspace=server`).

## Coding Style & Naming Conventions
- Language: TypeScript (strict). Indentation: 2 spaces.
- React components: PascalCase files (e.g., `EditDogPage.tsx`, `RunDetailsModal.tsx`). Hooks: `useX` camelCase in `client/src/hooks/`.
- Utilities: camelCase in `client/src/utils/` and `shared/src/`; prefer named exports for libs/utils.
- Linting: ESLint (see `client/eslint.config.js`). Fix issues before PRs (`npm run lint`).

## Testing Guidelines
- Framework: Vitest + Testing Library (client). Tests live under `client/src/test/` and use `*.test.ts(x)`.
- Run: `npm run test` (root) or `npm run test --workspace=client`.
- Write tests for new UI, hooks, and utils. Keep tests deterministic; mock network calls.

## Commit & Pull Request Guidelines
- Commits: present tense, concise, scoped prefix when useful (e.g., `client: add PWA install button`, `server: validate auth`).
- PRs: clear description, link issues, list changes, include screenshots/GIFs for UI, and note any env or migration steps.
- Before opening: run `npm run type-check`, `npm run lint`, `npm run test`, and confirm `npm run build` succeeds.

## Security & Configuration
- Do not commit secrets. Use `.env.local` files (examples: `client/.env.example`, `server/.env.example`).
- Node 22+ required. For deploys, ensure AWS CLI/SAM configured. See `docs/` for S3, OAuth, and deployment specifics.

## Agent-Specific Notes
- Respect workspace boundaries and scripts. Prefer minimal, focused changes and update docs when behavior changes.
