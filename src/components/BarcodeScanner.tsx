/**
 * Barcode Scanner Component
 * Uses device camera to scan barcodes
 */
import React, { useRef, useEffect, useState } from 'react';
import { X, Camera } from 'lucide-react';
import Button from './UI/Button';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setScanning(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  // Try to use BarcodeDetector API if available (Chrome/Edge)
  useEffect(() => {
    if (!scanning || !videoRef.current || error) return;

    let animationFrameId: number;
    let isDetecting = true;

    const detectBarcode = async () => {
      try {
        // Check if BarcodeDetector API is available
        if ('BarcodeDetector' in window) {
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
          });

          const detect = async () => {
            if (!videoRef.current || !isDetecting || !scanning) return;

            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const barcode = barcodes[0].rawValue;
                if (barcode) {
                  isDetecting = false;
                  stopCamera();
                  onScan(barcode);
                  handleClose();
                  return;
                }
              }
            } catch (err) {
              // Continue scanning
            }

            if (isDetecting && scanning) {
              animationFrameId = requestAnimationFrame(detect);
            }
          };

          detect();
        } else {
          // Fallback: Show manual input option
          setError(null);
        }
      } catch (err) {
        console.error('Barcode detection error:', err);
      }
    };

    detectBarcode();

    return () => {
      isDetecting = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [scanning, error, onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-3 md:p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
            Scan Barcode
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error ? (
          <div className="text-center py-8">
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <Button onClick={handleClose}>Close</Button>
          </div>
        ) : (
          <>
            <div className="relative bg-black rounded-lg overflow-hidden mb-4" style={{ aspectRatio: '16/9' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-2 border-blue-500 rounded-lg w-64 h-32"></div>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
              {('BarcodeDetector' in window) 
                ? 'Position the barcode within the frame' 
                : 'Camera is active. For automatic scanning, use Chrome or Edge browser. You can also manually enter the barcode.'}
            </p>
            <Button onClick={handleClose} variant="secondary" className="w-full">
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default BarcodeScanner;

