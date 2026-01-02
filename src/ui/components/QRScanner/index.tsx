import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let scanner: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            if (mountedRef.current) {
              onScan(decodedText);
            }
          },
          () => {
            // QR not found - ignore
          }
        );

        if (mountedRef.current) {
          setIsStarting(false);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to access camera. Please allow camera permissions.'
          );
          setIsStarting(false);
        }
      }
    };

    startScanner();

    return () => {
      mountedRef.current = false;
      if (scanner?.isScanning) {
        scanner.stop().catch(console.error);
      }
    };
  }, [onScan]);

  const handleClose = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop().catch(console.error);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <header style={{ padding: '16px' }} className="flex items-center gap-4 bg-bg-primary">
        <button onClick={handleClose} style={{ padding: '8px' }} className="hover:bg-bg-hover">
          <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold uppercase tracking-wider">Scan QR Code</h1>
      </header>

      {/* Scanner area */}
      <div className="flex-1 flex items-center justify-center relative">
        {isStarting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-white text-center">
              <div className="w-8 h-8 border-2 border-octra-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm uppercase tracking-wider">Starting camera...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-center p-6">
              <svg style={{ width: '48px', height: '48px' }} className="mx-auto mb-4 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-white text-sm mb-4">{error}</p>
              <button
                onClick={handleClose}
                style={{ padding: '12px 24px' }}
                className="bg-octra-blue text-white text-sm uppercase tracking-wider hover:bg-octra-blue/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        <div id="qr-reader" className="w-full max-w-sm" />

        {/* Scan overlay */}
        {!error && !isStarting && (
          <div className="absolute bottom-8 left-0 right-0 text-center">
            <p className="text-white text-sm uppercase tracking-wider opacity-80">
              Position QR code within the frame
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
