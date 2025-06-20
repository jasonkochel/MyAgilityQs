# MyAgilityQs TODO

## ✅ Recently Completed

- [x] **Title Progress tracking system** - Complete implementation with current levels, advancement progress, and MACH tracking
- [x] **MACH Points entry** - User input field on Add Run form for Masters Standard/Jumpers
- [x] **Progress backend logic** - Fixed Double Q and MACH point calculation with correct AKC rules
- [x] **Cache management** - Improved efficiency with invalidateQueries instead of refetchQueries

## 🐛 Bugs & Issues

- No known issues at this time

## ✨ Feature Ideas

- [ ] Photo management: Attach a photo of each dog
- [ ] Data export: CSV export for backup purposes
- [ ] Support multiple MACHs, e.g. progress toward MACH2 once a dog earns its first MACH

## 🔧 Technical Improvements

- [ ] Add comprehensive error boundaries
- [ ] Implement offline support with sync
- [ ] Add more comprehensive testing
- [ ] Performance optimization for large datasets
- [ ] Add analytics/metrics tracking
- [ ] **PWA Implementation**:
  - [ ] Web App Manifest (`client/public/manifest.json`) - app metadata, icons, display mode
  - [ ] Service Worker (`client/public/sw.js`) - cache static assets and API responses
  - [ ] Installation prompt - detect installability and show custom install button
  - [ ] Offline strategy - cache-first for assets, network-first for API with fallbacks
  - [ ] App shell architecture - cache core UI, lazy load content
  - [ ] Offline run entry - store pending runs locally, sync when connection returns

## 📱 UX Enhancements

- [ ] Dark mode support
- [ ] Better mobile navigation patterns
- [ ] Quick entry shortcuts/gestures
- [ ] Advanced filtering and search
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
