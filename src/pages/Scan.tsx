import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import Button from '../components/UI/Button';
import { detectBarcode, cleanupBarcodeDetection } from '../utils/barcodeDetection';

/**
 * Barcode Scanner Page
 * Full-page scanner with redirect support after scanning
 */
const Scan: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectURL = searchParams.get('redirect');

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      cleanupBarcodeDetection();
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
    // Navigate back to redirect URL or POS
    if (redirectURL) {
      window.location.href = redirectURL;
    } else {
      navigate('/pos');
    }
  };

  const handleScanSuccess = (barcode: string) => {
    stopCamera();
    
    // Dispatch barcode scanned event
    window.dispatchEvent(new CustomEvent('barcode-scanned', { detail: { barcode } }));
    
    // Navigate back to redirect URL or POS
    if (redirectURL) {
      window.location.href = redirectURL;
    } else {
      navigate('/pos');
    }
  };

  // Automatic barcode detection (works in all browsers)
  useEffect(() => {
    if (!scanning || !videoRef.current || error) return;

    let animationFrameId: number;
    let isDetecting = true;
    let lastScanTime = 0;
    const SCAN_INTERVAL = 200; // Scan every 200ms to avoid overloading

    const scanForBarcode = async () => {
      if (!videoRef.current || !isDetecting || !scanning) return;

      const now = Date.now();
      if (now - lastScanTime < SCAN_INTERVAL) {
        if (isDetecting && scanning) {
          animationFrameId = requestAnimationFrame(scanForBarcode);
        }
        return;
      }

      lastScanTime = now;

      try {
        const barcode = await detectBarcode(videoRef.current);
        if (barcode) {
          isDetecting = false;
          handleScanSuccess(barcode);
          return;
        }
      } catch (err) {
        // Continue scanning on error
        console.error('Barcode detection error:', err);
      }

      if (isDetecting && scanning) {
        animationFrameId = requestAnimationFrame(scanForBarcode);
      }
    };

    // Start scanning
    scanForBarcode();

    return () => {
      isDetecting = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [scanning, error, redirectURL]);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="bg-black/80 backdrop-blur-sm border-b border-gray-800 p-4 flex items-center justify-between">
        <h1 className="text-white text-lg font-semibold">Scan Barcode</h1>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-white transition-colors p-2"
          aria-label="Close scanner"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Scanner View */}
      <div className="flex-1 flex items-center justify-center p-4">
        {error ? (
          <div className="text-center max-w-md">
            <p className="text-red-400 mb-4 text-lg">{error}</p>
            <Button onClick={handleClose}>Close</Button>
          </div>
        ) : (
          <div className="w-full max-w-2xl">
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-4 border-blue-500 rounded-lg w-64 h-32 shadow-lg"></div>
              </div>
            </div>
            <p className="text-gray-400 text-center mt-4 text-sm">
              Position the barcode within the frame
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Scan;

