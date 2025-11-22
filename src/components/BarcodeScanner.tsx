/**
 * Barcode Scanner Component
 * Uses device camera to scan barcodes - works across all browsers
 */
import React, { useRef, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/library';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    startScanning();
    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    try {
      setError(null);
      setScanning(true);

      // Initialize ZXing barcode reader
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      // Get available video input devices
      const videoInputDevices = await codeReader.listVideoInputDevices();
      
      // Prefer back camera (environment) on mobile devices
      let selectedDeviceId: string | undefined;
      if (videoInputDevices.length > 0) {
        // Try to find back camera
        const backCamera = videoInputDevices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment')
        );
        selectedDeviceId = backCamera?.deviceId || videoInputDevices[0].deviceId;
      }

      if (videoRef.current) {
        // Start decoding from video stream
        codeReader.decodeFromVideoDevice(
          selectedDeviceId,
          videoRef.current,
          (result, error) => {
            if (result) {
              const barcode = result.getText();
              if (barcode) {
                stopScanning();
                onScan(barcode);
                onClose();
              }
            }
            if (error && error.name !== 'NotFoundException') {
              // NotFoundException is normal when no barcode is detected
              console.debug('Barcode detection:', error.message);
            }
          }
        );
      }
    } catch (err) {
      console.error('Error starting barcode scanner:', err);
      setError('Unable to access camera. Please check permissions.');
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    setScanning(false);
  };

  const handleClose = () => {
    stopScanning();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Close button */}
          <button
            onClick={handleClose}
        className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-2 transition-all"
        aria-label="Close scanner"
          >
            <X className="w-6 h-6" />
          </button>

      {/* Camera container */}
      <div className="relative w-full h-full bg-black">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <p className="text-red-400 mb-4 text-lg">{error}</p>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
              muted
                className="w-full h-full object-cover"
              />
            {/* Scanning frame overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-blue-500 rounded-lg w-64 h-32 shadow-lg"></div>
              </div>
            {/* Instructions */}
            <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
              <p className="text-white bg-black bg-opacity-50 px-4 py-2 rounded-lg inline-block text-sm">
                Position the barcode within the frame
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BarcodeScanner;

