import React, { createContext, useContext, useEffect, useState } from 'react';
import { notifications } from '@mantine/notifications';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type Platform = "ios" | "android" | "other";

interface PWAContextType {
  deferredPrompt: BeforeInstallPromptEvent | null;
  // True whenever we have something to offer the user — either the native
  // `beforeinstallprompt` event, or a mobile platform where we can show
  // manual "Add to Home Screen" instructions (iOS Safari, Android without
  // the deferred prompt yet, etc.).
  isInstallable: boolean;
  isInstalled: boolean;
  platform: Platform;
  promptInstall: () => Promise<void>;
  dismissPrompt: () => void;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const usePWA = () => {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
};

interface PWAProviderProps {
  children: React.ReactNode;
}

// Touch-primary device check — true for phones and tablets, false for desktops
// with a mouse (even touch-capable laptops typically still report `pointer: fine`
// because they have a trackpad/mouse as primary).
const isMobileDevice = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse) and (hover: none)").matches;

const detectPlatform = (): Platform => {
  if (typeof window === "undefined") return "other";
  const ua = window.navigator.userAgent;
  // iPadOS 13+ reports as Mac; check for touch to disambiguate.
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Mac") && "ontouchend" in window.document);
  if (isIOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
};

export const PWAProvider: React.FC<PWAProviderProps> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform] = useState<Platform>(() => detectPlatform());
  const [isMobile] = useState(() => isMobileDevice());

  useEffect(() => {
    // Check if already installed
    const checkIfInstalled = () => {
      const isRunningStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      const installed = isRunningStandalone || isIOSStandalone;
      setIsInstalled(installed);
      return installed;
    };

    if (checkIfInstalled()) {
      return; // Don't listen for install events if already installed
    }

    // Don't expose install UI on desktop — PWA installs are a mobile-first
    // feature here. Chrome on desktop also fires `beforeinstallprompt`, which
    // is why the button was showing up there before.
    if (!isMobile) {
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();

      // Save the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);

      notifications.show({
        title: 'App Installed!',
        message: 'MyAgilityQs has been added to your home screen',
        color: 'green',
      });
    };

    // Listen for the events
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isMobile]);

  const showManualInstructions = () => {
    const message =
      platform === "ios"
        ? 'Tap the Share button at the bottom of Safari, then choose "Add to Home Screen".'
        : platform === "android"
        ? 'Tap the menu (⋮) in your browser, then choose "Install app" or "Add to Home Screen".'
        : 'Look for "Add to Home Screen" or "Install" in your browser menu.';
    notifications.show({
      title: "Install MyAgilityQs",
      message,
      color: "blue",
      autoClose: 10000,
    });
  };

  const promptInstall = async () => {
    if (!deferredPrompt) {
      showManualInstructions();
      return;
    }

    try {
      await deferredPrompt.prompt();

      const { outcome } = await deferredPrompt.userChoice;

      // Clear the prompt since it can only be used once
      setDeferredPrompt(null);

      if (outcome === 'dismissed') {
        notifications.show({
          title: 'Installation Cancelled',
          message: 'You can install the app later from your browser menu',
          color: 'yellow',
        });
      }
    } catch {
      showManualInstructions();
    }
  };

  const dismissPrompt = () => {
    setDeferredPrompt(null);
  };

  const value: PWAContextType = {
    deferredPrompt,
    // On mobile we always offer install: either via the deferred prompt (if
    // Chrome decided to fire it) or via manual instructions otherwise. iOS
    // Safari never fires the event, so manual is the only option there.
    isInstallable: !isInstalled && (isMobile || !!deferredPrompt),
    isInstalled,
    platform,
    promptInstall,
    dismissPrompt,
  };

  return (
    <PWAContext.Provider value={value}>
      {children}
    </PWAContext.Provider>
  );
};

export default PWAProvider;
