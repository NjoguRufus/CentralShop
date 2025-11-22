/**
 * Global Barcode Scanner Component
 * Provides a floating button to access barcode scanner from anywhere
 */
import React, { useState } from 'react';
import { Camera, X } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import { toast } from 'react-toastify';

interface GlobalBarcodeScannerProps {
  onScan?: (barcode: string) => void;
}

const GlobalBarcodeScanner: React.FC<GlobalBarcodeScannerProps> = ({ onScan }) => {
  const [showScanner, setShowScanner] = useState(false);

  const handleScan = (barcode: string) => {
    if (onScan) {
      onScan(barcode);
    } else {
      // Default: dispatch custom event for pages to listen to
      window.dispatchEvent(new CustomEvent('barcode-scanned', { detail: { barcode } }));
      toast.success(`Barcode scanned: ${barcode}`);
    }
    setShowScanner(false);
  };

  return (
    <>
      {/* Floating Barcode Scanner Button */}
      <button
        onClick={() => setShowScanner(true)}
        className="fixed bottom-4 right-4 z-40 bg-[#4A90A4] hover:bg-[#3a7a8a] text-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
        title="Scan Barcode"
        aria-label="Scan Barcode"
      >
        <Camera className="w-5 h-5" />
      </button>

      {showScanner && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  );
};

export default GlobalBarcodeScanner;

