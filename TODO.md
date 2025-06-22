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

- [ ] Add comprehensive error boundaries
- [ ] Implement offline support with sync
- [ ] Add more comprehensive testing
- [ ] Performance optimization for large datasets
- [ ] Add analytics/metrics tracking
- [x] **PWA Implementation** (Basic functionality completed):
  - [x] Web App Manifest (`client/public/manifest.json`) - app metadata, icons, display mode
  - [x] Service Worker (`client/public/sw.js`) - cache static assets and API responses
  - [x] Installation prompt - detect installability and show custom install button
  - [ ] Offline strategy - cache-first for assets, network-first for API with fallbacks
  - [ ] App shell architecture - cache core UI, lazy load content
  - [ ] Offline run entry - store pending runs locally, sync when connection returns

## 📱 UX Enhancements

- [ ] Better mobile navigation patterns
- [ ] Quick entry shortcuts/gestures
- [ ] Bulk operations (edit multiple runs)

## 🚀 Infrastructure

- [ ] Automated backups
- [ ] Monitoring and alerting
- [ ] **Custom Cognito Domain**: Add custom domain to Cognito so "Log in with Google" shows friendly URL instead of ugly Cognito domain

---

**How to use this file:**

- Add new items as you think of them
- Move completed items to a "✅ Recently Completed" section
- Use console/chat for breaking down tasks during active development
- Keep this file for high-level planning and ideas
