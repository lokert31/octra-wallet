import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore, useActiveAccount } from '@ui/store/wallet.store';
import { sendMessage } from '@shared/messaging';
import { MESSAGE_TYPES, OCTRA_CONFIG, EXPLORER_URL } from '@shared/constants';
import type { PendingTransfer } from '@shared/types';
import { Button } from '@ui/components/common/Button';
import { Spinner } from '@ui/components/common/Spinner';

export default function PendingTransfers() {
  const navigate = useNavigate();
  const activeAccount = useActiveAccount();
  const { showToast, activeAccountIndex, pendingPrivateTransfers, setPendingPrivateTransfers } = useWalletStore();

  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    if (activeAccount) {
      fetchPendingTransfers();
    }
  }, [activeAccount?.address]);

  const fetchPendingTransfers = async () => {
    if (!activeAccount) return;

    setLoading(true);
    try {
      const response = await sendMessage<{ address: string }, PendingTransfer[]>(
        MESSAGE_TYPES.GET_PENDING_TRANSFERS,
        { address: activeAccount.address }
      );

      if (response.success && response.data) {
        setPendingPrivateTransfers(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch pending transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (transferId: string) => {
    setClaiming(transferId);

    try {
      const response = await sendMessage<
        { transferId: string; accountIndex: number },
        { txHash: string }
      >(MESSAGE_TYPES.CLAIM_PRIVATE_TRANSFER, {
        transferId,
        accountIndex: activeAccountIndex,
      });

      if (response.success && response.data) {
        showToast('Transfer claimed!', 'success', {
          subMessage: `Hash: ${response.data.txHash.slice(0, 16)}...`,
          link: `${EXPLORER_URL}/tx/${response.data.txHash}`,
        });
        // Refresh list
        fetchPendingTransfers();
      } else {
        showToast(response.error || 'Claim failed', 'error');
      }
    } catch (error) {
      showToast('Claim failed', 'error');
    } finally {
      setClaiming(null);
    }
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0.00';
    return num.toFixed(6);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      {/* Header */}
      <header style={{ padding: '16px' }} className="flex items-center gap-4 border-b border-border-primary">
        <button onClick={() => navigate(-1)} className="text-text-secondary hover:text-text-primary">
          <svg style={{ width: '24px', height: '24px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold uppercase tracking-wider flex items-center gap-2">
          <svg style={{ width: '20px', height: '20px' }} className="text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Pending Transfers
        </h1>
        <button
          onClick={fetchPendingTransfers}
          className="ml-auto text-text-secondary hover:text-text-primary"
        >
          <svg style={{ width: '20px', height: '20px' }} className={loading ? 'animate-spin' : ''} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </header>

      <div style={{ padding: '16px' }} className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : pendingPrivateTransfers.length === 0 ? (
          <div className="text-center py-12">
            <svg style={{ width: '48px', height: '48px' }} className="mx-auto text-text-tertiary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-text-tertiary">No pending transfers</p>
            <p className="text-text-tertiary text-sm mt-1">Private transfers you receive will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingPrivateTransfers.map((transfer) => (
              <div
                key={transfer.id}
                style={{ padding: '14px' }}
                className="bg-bg-secondary border border-purple-500/30"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-xs text-purple-400 uppercase tracking-wider mb-1">From</div>
                    <div className="font-mono text-sm text-text-secondary">
                      {truncateAddress(transfer.from)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-purple-300">
                      +{formatAmount(transfer.amount)} {OCTRA_CONFIG.TOKEN_SYMBOL}
                    </div>
                    <div className="text-xs text-text-tertiary">
                      {formatDate(transfer.timestamp)}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => handleClaim(transfer.id)}
                  disabled={claiming === transfer.id}
                  loading={claiming === transfer.id}
                  className="w-full mt-3 bg-purple-600 hover:bg-purple-700"
                  size="sm"
                >
                  {claiming === transfer.id ? 'CLAIMING...' : 'CLAIM'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
