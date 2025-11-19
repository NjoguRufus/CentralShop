/**
 * Install PWA Button Component
 * Handles PWA installation prompt
 */
import React, { useState, useEffect } from 'react';
import Button from './UI/Button';
import { Download, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPWAButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for user response
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setIsInstalled(true);
    } else {
      console.log('User dismissed the install prompt');
    }

    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <Button disabled variant="outline" className="cursor-not-allowed">
        <Check className="w-4 h-4 mr-2" />
        Installed
      </Button>
    );
  }

  if (!deferredPrompt) {
    return null; // Don't show button if prompt is not available
  }

  return (
    <Button onClick={handleInstallClick}>
      <Download className="w-4 h-4 mr-2" />
      Install App
    </Button>
  );
};

export default InstallPWAButton;

