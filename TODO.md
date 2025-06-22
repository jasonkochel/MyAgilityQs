# MyAgilityQs TODO

## ✅ Recently Completed


## 🐛 Bugs & Issues

- Main Menu is slightly too tall - it "wiggles" on a phone browser whereas it should fit on one screen with no scrolling
- We do not need to show Login Success toast
- The "Track Qs Only" setting is still not sticking.  It remains false in the database even when I turn it on in the UI.  The UI does remember the "true" setting for the remainder of the session, but it does not stick
- Remove "Refresh Token (Debug)" button from Profile page
- Make it more obvious that you can Add To Home Page (install PWA)
- Update the checklists in this doc to reflect recent progress


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
