/**
 * Cross-browser barcode detection utility
 * Uses BarcodeDetector API when available (Chrome/Edge), falls back to ZXing for all browsers
 */

import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

let zxingReader: BrowserMultiFormatReader | null = null;

/**
 * Initialize ZXing reader (lazy initialization)
 */
function getZXingReader(): BrowserMultiFormatReader {
  if (!zxingReader) {
    zxingReader = new BrowserMultiFormatReader();
  }
  return zxingReader;
}

/**
 * Detect barcode from video element using BarcodeDetector API (Chrome/Edge only)
 */
export async function detectBarcodeWithBarcodeDetector(
  videoElement: HTMLVideoElement
): Promise<string | null> {
  if (!('BarcodeDetector' in window)) {
    return null;
  }

  try {
    const barcodeDetector = new (window as any).BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
    });

    const barcodes = await barcodeDetector.detect(videoElement);
    if (barcodes.length > 0 && barcodes[0].rawValue) {
      return barcodes[0].rawValue;
    }
  } catch (error) {
    console.error('BarcodeDetector error:', error);
  }

  return null;
}

/**
 * Detect barcode from video element using ZXing (works in all browsers)
 */
export async function detectBarcodeWithZXing(
  videoElement: HTMLVideoElement
): Promise<string | null> {
  try {
    const reader = getZXingReader();
    
    // Check if video is ready
    if (!videoElement.videoWidth || !videoElement.videoHeight) {
      return null;
    }

    // Create a canvas to capture video frame
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!context) {
      return null;
    }

    // Set canvas dimensions to match video
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Decode barcode from canvas
    const result = await reader.decodeFromCanvas(canvas);
    
    if (result && result.getText()) {
      return result.getText();
    }
  } catch (error) {
    // NotFoundException is expected when no barcode is found
    if (!(error instanceof NotFoundException)) {
      // Only log non-expected errors
      if (error instanceof Error && !error.message.includes('No MultiFormat Readers')) {
        console.error('ZXing detection error:', error);
      }
    }
  }

  return null;
}

/**
 * Detect barcode from video element (tries BarcodeDetector first, then ZXing)
 */
export async function detectBarcode(videoElement: HTMLVideoElement): Promise<string | null> {
  // Try BarcodeDetector API first (faster, Chrome/Edge only)
  const barcodeDetectorResult = await detectBarcodeWithBarcodeDetector(videoElement);
  if (barcodeDetectorResult) {
    return barcodeDetectorResult;
  }

  // Fallback to ZXing (works in all browsers)
  return await detectBarcodeWithZXing(videoElement);
}

/**
 * Cleanup ZXing reader resources
 */
export function cleanupBarcodeDetection(): void {
  if (zxingReader) {
    try {
      zxingReader.reset();
    } catch (error) {
      console.error('Error cleaning up ZXing reader:', error);
    }
  }
}

