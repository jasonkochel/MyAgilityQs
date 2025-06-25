# MyAgilityQs TODO

## ✅ Recently Completed

- ✅ **Fixed Main Menu height issue** - Reduced container padding (`py="xl"` → `py="md"`), stack gaps (`gap="xl"` → `gap="md"`), button heights (80px → 64px), and logout button margin (`mt="xl"` → `mt="md"`) to eliminate mobile browser wiggling
- ✅ **Removed Login Success toast** - Eliminated unnecessary "Welcome! Successfully signed in with Google" notification from OAuth callback
- ✅ **Removed "Refresh Token (Debug)" button** - Cleaned up Profile page by removing debug functionality and related imports
- ✅ **Enhanced PWA installation visibility** - Added service worker registration, created InstallPrompt component, and integrated PWA install options into Main Menu and Profile pages
- ✅ **Updated TODO.md checklists** - Reflected recent progress and completed items
- ✅ **Track Qs Only setting persistence** - Discovered that Google Auth was always resetting trackQsOnly to false; fixed.

## 🐛 Bugs & Issues


## ✨ Feature Ideas

- [ ] Photo management: Attach a photo of each dog
- [ ] Data export: CSV export for backup purposes

## 🔧 Technical Improvements

- [ ] **Sentry.io Error Tracking Integration** (Priority: High)
  - [x] **Client Setup**: ✅ COMPLETED
    - [x] Install `@sentry/react` and `@sentry/tracing` packages
    - [x] Initialize Sentry in `client/src/main.tsx` before React app starts
    - [x] Add Sentry environment variables to client build process (`.env` & `.env.example`)
    - [x] Integrate with existing ErrorBoundary component (`components/ErrorBoundary.tsx:28-37`)
    - [x] Add React Router integration for navigation breadcrumbs (`main.tsx:16-19`)
    - [x] Configure performance monitoring for Core Web Vitals (browser tracing + session replay)
    - [x] Add user context (email, userId) for better error tracking (`contexts/AuthContext.tsx`)
    - [x] **Configure source maps upload for production builds** - ✅ **COMPLETED**
      - **Added**: Sentry Vite plugin with production-only source map upload
      - **Enhancement**: Release tracking with commit info and timestamp-based versioning
      - **Environment Variables**: `VITE_SENTRY_ORG`, `VITE_SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `VITE_BUILD_TIMESTAMP`
      - **Versioning**: Continuous deployment with timestamp-based releases (`client-{timestamp}`)
  - [x] **Server Setup**: ✅ COMPLETED
    - [x] Install `@sentry/serverless` package for AWS Lambda
    - [x] Initialize Sentry in `server/src/index.ts` Lambda handler (`index.ts:15-19`)
    - [x] Add Sentry environment variables to SAM template (`template.yaml:274-276`)
    - [x] Integrate with existing Middy middleware stack (`index.ts:36`, `sentryContext.ts`)
    - [x] Add custom error contexts (userId, API endpoint, request details) (`utils/sentryHelpers.ts`)
    - [x] Configure Lambda-specific performance monitoring (traces + breadcrumbs)
  - [ ] **Shared Setup**:
    - [ ] Add Sentry types to shared package if needed
    - [ ] Create shared error context utilities
    - [ ] Add Sentry configuration to shared constants
  - [x] **Environment Configuration**: ✅ **COMPLETED**
    - [x] **Enhanced sampling rates** - Production: 10%, Development: 100%
    - [x] **Release tracking** - Automatic commit detection and versioning
    - [x] **Environment-specific tagging** - Client component tagging with version info
  - [x] **Integration Points**: ✅ **COMPLETED**
    - [x] **TanStack Query error handlers** - Comprehensive query/mutation error reporting with context
    - [x] **AWS Cognito auth errors** - Auth initialization, refresh, and login error tracking
    - [x] **API error tracking** - HTTP errors, network errors, and API response errors
    - [x] **Advanced error filtering** - Filters out network errors, React DevTools, and expected auth errors
    - [x] **Centralized error reporting** - ✅ **COMPLETED**
      - **Created**: `client/src/lib/sentry.ts` - Unified error reporting utilities
      - **Functions**: `reportError()`, `reportAuthError()`, `reportHttpError()`, `reportQueryError()`
      - **Benefits**: Consistent error context, reduced code duplication, better maintainability
      - **Refactored**: All `Sentry.captureException()` calls now use centralized utilities
  - [ ] **Testing & Deployment**:
    - [ ] Test error reporting in development environment
    - [ ] Verify source maps are working correctly
    - [ ] Test user context and breadcrumbs are captured
- [ ] Add comprehensive error boundaries
- [ ] Add more comprehensive testing
- [ ] Add analytics/metrics tracking
- [x] **PWA Implementation** (Basic functionality completed):
  - [x] Web App Manifest (`client/public/manifest.json`) - app metadata, icons, display mode
  - [x] Service Worker (`client/public/sw.js`) - cache static assets and API responses
  - [x] Installation prompt - detect installability and show custom install button

## 📱 UX Enhancements

- [ ] Better mobile navigation patterns

## 🚀 Infrastructure

- [ ] Automated backups
- [ ] Monitoring and alerting
- [x] **Custom Cognito Domain**: Add custom domain to Cognito so "Log in with Google" shows friendly URL instead of ugly Cognito domain

---

**How to use this file:**

- Add new items as you think of them
- Move completed items to a "✅ Recently Completed" section
- Use console/chat for breaking down tasks during active development
- Keep this file for high-level planning and ideas
