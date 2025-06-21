# PWA Implementation Guide

## Goal
Enable users to "Add to Home Screen" on mobile devices for a native app-like experience. This focuses on installability rather than extensive offline capabilities.

## Priority Implementation Order

### Phase 1: Core PWA Requirements (Essential for "Add to Home Screen")

#### 1. Web App Manifest (`client/public/manifest.json`) - **HIGH PRIORITY**
```json
{
  "name": "MyAgilityQs - Agility Competition Tracker",
  "short_name": "MyAgilityQs",
  "description": "Track your dog's agility competition results and title progress",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#228be6",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icon-512.png", 
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable any"
    }
  ],
  "categories": ["sports", "utilities"],
  "lang": "en-US"
}
```

**Requirements:**
- Must be served from root (`/manifest.json`)
- Needs proper MIME type (`application/manifest+json`)
- Icons must be PNG format, sizes 192x192 and 512x512 minimum

#### 2. App Icons - **HIGH PRIORITY**
Create PWA-compliant icons in `client/public/`:
- `icon-192.png` (192x192)
- `icon-512.png` (512x512)
- `apple-touch-icon.png` (180x180 for iOS)
- `favicon.ico` (32x32)

**Design Notes:**
- Use dog/agility theme (jumping dog silhouette, agility equipment)
- Ensure icons work on various backgrounds (maskable)
- Test on both light and dark home screens

#### 3. HTML Meta Tags - **HIGH PRIORITY**
Update `client/index.html`:
```html
<!-- PWA Manifest -->
<link rel="manifest" href="/manifest.json">

<!-- iOS Safari -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="MyAgilityQs">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">

<!-- Android Chrome -->
<meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#228be6">

<!-- General -->
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
```

#### 4. HTTPS Requirement - **ALREADY MET**
✅ Production app already serves over HTTPS
✅ Development can use localhost (exempt from HTTPS requirement)

### Phase 2: Basic Service Worker (Minimal for Installability)

#### 5. Basic Service Worker (`client/public/sw.js`) - **MEDIUM PRIORITY**
Minimal implementation just to meet PWA requirements:
```javascript
// Basic service worker for PWA compliance
const CACHE_NAME = 'myagilityqs-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

// Minimal fetch handler (no caching for now)
self.addEventListener('fetch', (event) => {
  // Pass through to network
  event.respondWith(fetch(event.request));
});
```

#### 6. Service Worker Registration - **MEDIUM PRIORITY**
Add to `client/src/main.tsx`:
```typescript
// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
```

### Phase 3: Enhanced User Experience

#### 7. Install Prompt Component - **LOW PRIORITY**
Create custom "Add to Home Screen" button for better UX:
```typescript
// components/InstallPrompt.tsx
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstall(false);
    }
  };

  if (!showInstall) return null;

  return (
    <Button onClick={handleInstall}>
      📱 Add to Home Screen
    </Button>
  );
}
```

#### 8. PWA-Optimized Viewport - **LOW PRIORITY**
Enhance mobile experience:
- Prevent zoom on form inputs
- Optimize touch targets (44px minimum)
- Test app shell on various device sizes

### Phase 4: Optional Enhancements (Future)

#### 9. Minimal Offline Support - **FUTURE**
If desired later, cache only essential assets:
- App shell (HTML, CSS, JS)
- Critical icons and images
- No API caching (keep live data)

#### 10. Background Sync - **FUTURE**
For offline run entry (store locally, sync when online)

## Implementation Checklist

### Immediate Tasks (Phase 1)
- [ ] Create `client/public/manifest.json`
- [ ] Design and create app icons (192x192, 512x512, 180x180)
- [ ] Update `client/index.html` with meta tags
- [ ] Test installability on Chrome DevTools

### Validation Steps
- [ ] Chrome DevTools > Application > Manifest (no errors)
- [ ] Chrome DevTools > Lighthouse > PWA audit (installable)
- [ ] Test "Add to Home Screen" on Android Chrome
- [ ] Test "Add to Home Screen" on iOS Safari
- [ ] Verify icon appears correctly on home screen
- [ ] Verify app opens in standalone mode (no browser UI)

### Testing Devices/Browsers
- **Android**: Chrome, Samsung Internet
- **iOS**: Safari (primary), Chrome (limited PWA support)
- **Desktop**: Chrome, Edge (supports PWA installation)

## Technical Notes

### Vite Configuration
May need to ensure static files are properly served:
```typescript
// vite.config.ts
export default defineConfig({
  // Ensure manifest.json and sw.js are served correctly
  publicDir: 'public',
});
```

### Deployment Considerations
- Manifest and icons must be accessible from production domain
- Service worker must be served from same origin
- Test on actual production URL (not just localhost)

### Maintenance
- Update manifest version when making significant changes
- Test PWA compliance after major updates
- Monitor for browser compatibility changes

## Success Criteria

✅ **Primary Goal**: Users can successfully "Add to Home Screen" on mobile
✅ **User Experience**: App launches in standalone mode without browser UI
✅ **Visual**: App icon appears correctly on device home screen
✅ **Performance**: No degradation in app performance

This focused approach prioritizes the core PWA installability without over-engineering offline capabilities that may not be necessary for the primary use case of quick run entry at competitions.