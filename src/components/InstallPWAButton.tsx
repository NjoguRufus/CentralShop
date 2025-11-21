/**
 * Install PWA Button Component
 * Handles PWA installation prompt for mobile and desktop
 */
import React, { useState, useEffect } from 'react';
import Button from './UI/Button';
import Modal from './Modal';
import { Download, Check, Monitor, Smartphone, X } from 'lucide-react';
import { toast } from 'react-toastify';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPWAButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect if running on desktop
    const checkDesktop = () => {
      const isDesktopOS = /Windows|MacOS|Linux/.test(navigator.platform) || 
                         (navigator.userAgent.includes('Windows') || 
                          navigator.userAgent.includes('Mac') || 
                          navigator.userAgent.includes('Linux'));
      setIsDesktop(isDesktopOS);
      
      // Detect mobile
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(isMobileDevice);
    };
    checkDesktop();

    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for beforeinstallprompt event (mobile PWA)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      toast.success('App installed successfully!');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = () => {
    // Show modal with install options
    setShowInstallModal(true);
  };

  const handleMobileInstall = async () => {
    setShowInstallModal(false);
    
    // Use PWA install prompt if available
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          setIsInstalled(true);
          toast.success('Installing app...');
        }
        setDeferredPrompt(null);
      } catch (error) {
        console.error('Install error:', error);
        toast.error('Failed to install app');
      }
    } else {
      // Fallback: Download APK (if available)
      // For now, show instructions
      toast.info('Please use your browser\'s install option or download the APK from the releases page.', { autoClose: 5000 });
    }
  };

  const handleDesktopInstall = async () => {
    setShowInstallModal(false);
    
    // Use PWA install prompt for desktop
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          setIsInstalled(true);
          toast.success('Installing app...');
        }
        setDeferredPrompt(null);
      } catch (error) {
        console.error('Install error:', error);
        toast.error('Failed to install app');
      }
    } else {
      // Show instructions for manual install
      toast.info(
        'Please use your browser\'s install option. In Chrome/Edge, look for the install icon in the address bar.',
        { autoClose: 6000 }
      );
    }
  };

  if (isInstalled) {
    return (
      <Button disabled variant="outline" className="cursor-not-allowed">
        <Check className="w-4 h-4 mr-2" />
        Installed
      </Button>
    );
  }

  // Always show install button (unless already installed)
  return (
    <>
      <Button onClick={handleInstallClick}>
        <Download className="w-4 h-4 mr-2" />
        Install App
      </Button>

      <Modal
        open={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        title="Install Central Shop POS"
      >
        <div className="space-y-3 p-3 md:p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Choose your platform to install the app:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Mobile/APK Option */}
            <button
              onClick={handleMobileInstall}
              className="flex flex-col items-center justify-center p-3 md:p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-[#4A90A4] hover:bg-[#4A90A4]/5 dark:hover:bg-[#4A90A4]/10 transition-all"
            >
              <Smartphone className="w-8 h-8 md:w-10 md:h-10 text-[#4A90A4] mb-2" />
              <h3 className="text-sm md:text-base font-semibold text-gray-900 dark:text-white mb-1">
                Mobile App (APK)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Install on Android devices
              </p>
            </button>

            {/* Desktop/EXE Option */}
            <button
              onClick={handleDesktopInstall}
              className="flex flex-col items-center justify-center p-3 md:p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-[#4A90A4] hover:bg-[#4A90A4]/5 dark:hover:bg-[#4A90A4]/10 transition-all"
            >
              <Monitor className="w-8 h-8 md:w-10 md:h-10 text-[#4A90A4] mb-2" />
              <h3 className="text-sm md:text-base font-semibold text-gray-900 dark:text-white mb-1">
                Desktop App
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Install on Windows, macOS, or Linux
              </p>
            </button>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {isMobile 
                ? 'Tap "Mobile App" to install via PWA'
                : 'Click "Desktop App" to install as a PWA on your computer'
              }
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default InstallPWAButton;

