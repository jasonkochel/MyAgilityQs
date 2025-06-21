# MyAgilityQs TODO

## ✅ Recently Completed

- [x] **Location autocomplete cache fix** - Fixed issue where new locations weren't appearing in autocomplete suggestions in Edit Runs modal
- [x] **View Runs responsive columns** - Show more columns (Result, Placement, Time, Location) on wider screens, with Result column only showing when tracking NQ runs
- [x] **Title Progress tracking system** - Complete implementation with current levels, advancement progress, and MACH tracking
- [x] **MACH Points entry** - User input field on Add Run form for Masters Standard/Jumpers
- [x] **Progress backend logic** - Fixed Double Q and MACH point calculation with correct AKC rules
- [x] **Cache management** - Improved efficiency with invalidateQueries instead of refetchQueries
- [x] **Multiple MACH support** - Progress toward MACH2+ once a dog earns its first MACH
- [x] **Profile page improvements** - Enhanced profile settings with better UI and functionality
- [x] **My Dogs page enhancements** - Improved dog management interface
- [x] **View Runs filtering** - Added new filtering capabilities and improved UI

## 🐛 Bugs & Issues

- No known issues at this time

## Next Up

- View Runs: Better filtering on more fields, but it has to stay clean and simple for the basic use case; perhaps a mode to view the data grouped by dog+class+level?

## ✨ Feature Ideas

- [ ] Photo management: Attach a photo of each dog
- [ ] Data export: CSV export for backup purposes

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
