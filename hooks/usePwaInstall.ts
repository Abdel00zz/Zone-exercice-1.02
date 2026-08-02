import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const isStandalone = () => {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone;
};

/** Expose le prompt d'installation natif sans le déclencher automatiquement. */
export const usePwaInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const handleInstallReady = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    const handleDisplayMode = () => setInstalled(isStandalone());

    window.addEventListener('beforeinstallprompt', handleInstallReady);
    window.addEventListener('appinstalled', handleInstalled);
    displayMode.addEventListener?.('change', handleDisplayMode);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallReady);
      window.removeEventListener('appinstalled', handleInstalled);
      displayMode.removeEventListener?.('change', handleDisplayMode);
    };
  }, []);

  const requestInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === 'accepted') setInstalled(true);
    return true;
  }, [deferredPrompt]);

  return {
    installed,
    nativePromptAvailable: deferredPrompt !== null,
    requestInstall,
  };
};

