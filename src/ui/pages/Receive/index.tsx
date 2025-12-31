import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@ui/components/common/Button';
import { useWalletStore, useActiveAccount } from '@ui/store/wallet.store';
import { OCTRA_CONFIG, WALLET_CONFIG } from '@shared/constants';

export default function Receive() {
  const navigate = useNavigate();
  const activeAccount = useActiveAccount();
  const { showToast } = useWalletStore();

  const handleCopy = async () => {
    if (!activeAccount) return;

    try {
      await navigator.clipboard.writeText(activeAccount.address);
      showToast('Address copied to clipboard', 'success');

      // Auto-clear clipboard
      setTimeout(async () => {
        try {
          await navigator.clipboard.writeText('');
        } catch {}
      }, WALLET_CONFIG.CLIPBOARD_CLEAR_TIMEOUT * 1000);
    } catch {
      showToast('Failed to copy address', 'error');
    }
  };

  if (!activeAccount) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      {/* Header */}
      <header style={{ padding: '16px' }} className="flex items-center gap-4">
        <button onClick={() => navigate('/dashboard')} style={{ padding: '8px' }} className="hover:bg-bg-hover">
          <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold uppercase tracking-wider">Receive {OCTRA_CONFIG.TOKEN_SYMBOL}</h1>
      </header>

      {/* Content */}
      <div style={{ padding: '0 16px' }} className="flex-1 flex flex-col items-center justify-center">
        {/* QR Code */}
        <div style={{ padding: '16px', marginBottom: '16px' }} className="bg-white">
          <QRCodeSVG
            value={activeAccount.address}
            size={180}
            level="M"
            includeMargin={false}
          />
        </div>

        {/* Account name */}
        <h2 className="text-lg font-semibold mb-2">{activeAccount.name}</h2>

        {/* Address */}
        <div style={{ padding: '16px', width: '100%' }} className="bg-bg-secondary border border-border-primary">
          <p className="text-sm font-mono text-text-secondary text-center break-all leading-relaxed">
            {activeAccount.address}
          </p>
        </div>

        {/* Info */}
        <p className="text-sm text-text-tertiary text-center mt-4">
          Send only {OCTRA_CONFIG.TOKEN_SYMBOL} to this address.
          <br />
          Sending other assets may result in permanent loss.
        </p>
      </div>

      {/* Action */}
      <div style={{ padding: '16px' }}>
        <Button onClick={handleCopy} className="w-full">
          <svg style={{ width: '20px', height: '20px', marginRight: '8px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          COPY ADDRESS
        </Button>
      </div>
    </div>
  );
}
