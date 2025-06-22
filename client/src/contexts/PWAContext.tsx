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

interface PWAContextType {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstallable: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<void>;
  dismissPrompt: () => void;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

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

export const PWAProvider: React.FC<PWAProviderProps> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    console.log('[PWAProvider] Setting up PWA event listeners...');

    // Check if already installed
    const checkIfInstalled = () => {
      const isRunningStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      const installed = isRunningStandalone || isIOSStandalone;
      setIsInstalled(installed);
      console.log('[PWAProvider] Install status:', { isRunningStandalone, isIOSStandalone, installed });
      return installed;
    };

    if (checkIfInstalled()) {
      return; // Don't listen for install events if already installed
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('[PWAProvider] beforeinstallprompt event caught!', e);
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      
      // Save the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      console.log('[PWAProvider] App was installed');
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
      console.log('[PWAProvider] Cleaning up PWA event listeners');
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) {
      // Fallback for when no browser prompt is available
      notifications.show({
        title: 'Install MyAgilityQs',
        message: 'Look for "Add to Home Screen" in your browser menu (⋮) or address bar',
        color: 'blue',
        autoClose: 8000,
      });
      return;
    }

    try {
      console.log('[PWAProvider] Triggering install prompt...');
      await deferredPrompt.prompt();
      
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWAProvider] Install prompt result:', outcome);
      
      // Clear the prompt since it can only be used once
      setDeferredPrompt(null);
      
      if (outcome === 'dismissed') {
        notifications.show({
          title: 'Installation Cancelled',
          message: 'You can install the app later from your browser menu',
          color: 'yellow',
        });
      }
    } catch (error) {
      console.error('[PWAProvider] Error showing install prompt:', error);
      // Fallback to manual instructions
      notifications.show({
        title: 'Install MyAgilityQs',
        message: 'Look for "Add to Home Screen" in your browser menu (⋮) or address bar',
        color: 'blue',
        autoClose: 8000,
      });
    }
  };

  const dismissPrompt = () => {
    setDeferredPrompt(null);
  };

  const value: PWAContextType = {
    deferredPrompt,
    isInstallable: !!deferredPrompt,
    isInstalled,
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