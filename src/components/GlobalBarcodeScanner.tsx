/**
 * Global Barcode Scanner Component
 * Provides a floating button to access barcode scanner from anywhere
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera } from 'lucide-react';

interface GlobalBarcodeScannerProps {
  onScan?: (barcode: string) => void;
}

const GlobalBarcodeScanner: React.FC<GlobalBarcodeScannerProps> = ({ onScan }) => {
  const navigate = useNavigate();

  const handleScanClick = () => {
    const currentURL = window.location.href;
    navigate(`/scan?redirect=${encodeURIComponent(currentURL)}`);
  };

  return (
    <>
      {/* Floating Barcode Scanner Button */}
      <button
        onClick={handleScanClick}
        className="fixed bottom-4 right-4 z-40 bg-[#4A90A4] hover:bg-[#3a7a8a] text-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
        title="Scan Barcode"
        aria-label="Scan Barcode"
      >
        <Camera className="w-5 h-5" />
      </button>
    </>
  );
};

export default GlobalBarcodeScanner;

