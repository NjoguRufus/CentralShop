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

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyPress = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.isContentEditable;
      
      // Skip barcode detection if user is typing in an input field
      // This prevents cash amounts and other inputs from being treated as barcodes
      if (isInputField) {
        // Clear any existing buffer and timeout when user is typing in input fields
        bufferRef.current = '';
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        return;
      }

      // Handle Enter key (end of barcode)
      if (event.key === 'Enter') {
        event.preventDefault();
        if (bufferRef.current.length > 0) {
          onBarcode(bufferRef.current.trim());
          bufferRef.current = '';
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
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        return;
      }

      // Add character to buffer
      if (event.key && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
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
  }, [enabled, onBarcode, timeout]);

  // No visual indicator - runs silently in background
  return null;
};

export default BarcodeListener;

