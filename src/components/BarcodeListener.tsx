/**
 * Barcode Listener Component
 * Handles barcode scanner input
 */
import React, { useEffect, useRef, useState } from 'react';

interface BarcodeListenerProps {
  onBarcode: (code: string) => void;
  enabled?: boolean;
  timeout?: number; // Timeout in ms to detect end of barcode input
}

const BarcodeListener: React.FC<BarcodeListenerProps> = ({
  onBarcode,
  enabled = true,
  timeout = 100
}) => {
  const bufferRef = useRef<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Start scanning if not already
      if (!isScanning) {
        setIsScanning(true);
        bufferRef.current = '';
      }

      // Handle Enter key (end of barcode)
      if (event.key === 'Enter') {
        event.preventDefault();
        if (bufferRef.current.length > 0) {
          onBarcode(bufferRef.current.trim());
          bufferRef.current = '';
          setIsScanning(false);
        }
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        return;
      }

      // Handle Escape key (cancel)
      if (event.key === 'Escape') {
        bufferRef.current = '';
        setIsScanning(false);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        return;
      }

      // Add character to buffer
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        bufferRef.current += event.key;
      }

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set timeout to detect end of barcode input
      timeoutRef.current = setTimeout(() => {
        if (bufferRef.current.length > 0) {
          onBarcode(bufferRef.current.trim());
          bufferRef.current = '';
          setIsScanning(false);
        }
        timeoutRef.current = null;
      }, timeout);
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, onBarcode, timeout, isScanning]);

  // Visual indicator (optional)
  if (!isScanning) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-blue-500 text-white px-3 py-1 rounded shadow-lg text-sm">
      Scanning barcode...
    </div>
  );
};

export default BarcodeListener;

