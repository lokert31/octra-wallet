import { useEffect } from 'react';
import { useWalletStore } from '@ui/store/wallet.store';
import { UI_CONFIG } from '@shared/constants';

export function Toast() {
  const { toast, hideToast } = useWalletStore();

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(hideToast, UI_CONFIG.TOAST_DURATION);
      return () => clearTimeout(timer);
    }
  }, [toast, hideToast]);

  if (!toast) return null;

  const bgClasses = {
    success: 'bg-accent-green',
    error: 'bg-accent-red',
    info: 'bg-octra-blue',
  };

  const icons = {
    success: (
      <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        right: '16px',
        padding: '14px 16px',
        zIndex: 100,
      }}
      className={`${bgClasses[toast.type]} text-white flex items-start gap-3 shadow-lg`}
    >
      <span className="flex-shrink-0 mt-0.5">{icons[toast.type]}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{toast.message}</div>
        {toast.subMessage && (
          <div className="text-xs opacity-90 mt-1">{toast.subMessage}</div>
        )}
        {toast.link && (
          <a
            href={toast.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs underline opacity-90 hover:opacity-100 mt-1 inline-block"
          >
            View in Explorer
          </a>
        )}
      </div>
      <button
        onClick={hideToast}
        className="flex-shrink-0 opacity-70 hover:opacity-100"
      >
        <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
