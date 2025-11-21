/**
 * Keyboard Shortcuts Hook
 * Provides global keyboard shortcuts for desktop PWA
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when user is typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      shortcuts.forEach((shortcut) => {
        const ctrlMatch = shortcut.ctrlKey ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && shiftMatch && keyMatch) {
          event.preventDefault();
          shortcut.action();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts]);
}

/**
 * Default keyboard shortcuts for the app
 */
export function useAppKeyboardShortcuts() {
  const navigate = useNavigate();

  useKeyboardShortcuts([
    {
      key: 'k',
      ctrlKey: true,
      action: () => {
        // Quick search - can be implemented later
        console.log('Quick search (Ctrl+K)');
      },
      description: 'Quick search'
    },
    {
      key: 'n',
      ctrlKey: true,
      action: () => {
        navigate('/pos');
      },
      description: 'New sale'
    },
    {
      key: 'p',
      ctrlKey: true,
      action: () => {
        // Print current page/receipt
        window.print();
      },
      description: 'Print'
    },
    {
      key: 's',
      ctrlKey: true,
      action: () => {
        // Save - can be implemented per page
        console.log('Save (Ctrl+S)');
      },
      description: 'Save'
    },
    {
      key: 'd',
      ctrlKey: true,
      action: () => {
        navigate('/dashboard');
      },
      description: 'Go to dashboard'
    },
    {
      key: 'i',
      ctrlKey: true,
      action: () => {
        navigate('/inventory');
      },
      description: 'Go to inventory'
    },
    {
      key: 'o',
      ctrlKey: true,
      action: () => {
        navigate('/orders');
      },
      description: 'Go to orders'
    }
  ]);
}

