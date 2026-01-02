import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let scanner: Html5Qrcode | null = null;

    const requestCameraPermission = async (): Promise<boolean> => {
      try {
        // Explicitly request camera permission
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        // Stop the stream immediately - we just needed to trigger permission prompt
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (err) {
        console.error('Camera permission error:', err);
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setPermissionDenied(true);
            setError('Camera access denied. Please allow camera access in your browser settings.');
          } else if (err.name === 'NotFoundError') {
            setError('No camera found on this device.');
          } else {
            setError(`Camera error: ${err.message}`);
          }
        }
        return false;
      }
    };

    const startScanner = async () => {
      // First request permission
      const hasPermission = await requestCameraPermission();
      if (!hasPermission || !mountedRef.current) {
        setIsStarting(false);
        return;
      }

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
              // Stop scanner before calling onScan
              if (scanner?.isScanning) {
                scanner.stop().then(() => {
                  onScan(decodedText);
                }).catch(console.error);
              } else {
                onScan(decodedText);
              }
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
        console.error('Scanner error:', err);
        if (mountedRef.current) {
          if (err instanceof Error) {
            if (err.message.includes('Permission')) {
              setPermissionDenied(true);
              setError('Camera access denied. Please allow camera access.');
            } else {
              setError(err.message);
            }
          } else {
            setError('Failed to start camera scanner.');
          }
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

  const handleRetry = () => {
    setError(null);
    setPermissionDenied(false);
    setIsStarting(true);
    // Reload the component
    window.location.reload();
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
        {isStarting && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-white text-center">
              <div className="w-8 h-8 border-2 border-octra-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm uppercase tracking-wider">Requesting camera access...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-center p-6 max-w-sm">
              <svg style={{ width: '48px', height: '48px' }} className="mx-auto mb-4 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {permissionDenied ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                )}
              </svg>
              <p className="text-white text-sm mb-4">{error}</p>
              {permissionDenied && (
                <p className="text-white/60 text-xs mb-4">
                  To use the QR scanner, please enable camera access for this extension in your browser settings.
                </p>
              )}
              <div className="flex gap-2 justify-center">
                {!permissionDenied && (
                  <button
                    onClick={handleRetry}
                    style={{ padding: '12px 24px' }}
                    className="bg-octra-blue text-white text-sm uppercase tracking-wider hover:bg-octra-blue/90 transition-colors"
                  >
                    Retry
                  </button>
                )}
                <button
                  onClick={handleClose}
                  style={{ padding: '12px 24px' }}
                  className="bg-bg-secondary text-white text-sm uppercase tracking-wider hover:bg-bg-hover transition-colors border border-border-primary"
                >
                  Close
                </button>
              </div>
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
