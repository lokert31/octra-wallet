import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore, useActiveAccount } from '@ui/store/wallet.store';
import { sendMessage } from '@shared/messaging';
import { MESSAGE_TYPES, OCTRA_CONFIG, EXPLORER_URL } from '@shared/constants';
import { Spinner } from '@ui/components/common/Spinner';

interface Transaction {
  hash: string;
  parsed_tx?: {
    from: string;
    to: string;
    amount: string;
    amount_raw?: string;
    timestamp: number;
    nonce: number;
  };
}

export default function History() {
  const navigate = useNavigate();
  const activeAccount = useActiveAccount();
  const { pendingTransactions, removePendingTransaction } = useWalletStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter pending transactions for current account
  const myPendingTxs = pendingTransactions.filter(
    (tx) => tx.from === activeAccount?.address || tx.to === activeAccount?.address
  );

  useEffect(() => {
    if (activeAccount) {
      fetchHistory();
    }
  }, [activeAccount?.address]);

  const fetchHistory = async (isRefresh = false) => {
    if (!activeAccount) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await sendMessage<{ address: string }, Transaction[]>(
        MESSAGE_TYPES.GET_TRANSACTION_HISTORY,
        { address: activeAccount.address }
      );

      if (response.success && response.data) {
        setTransactions(response.data);

        // Remove pending transactions that are now confirmed
        response.data.forEach((tx) => {
          if (pendingTransactions.some((p) => p.hash === tx.hash)) {
            removePendingTransaction(tx.hash);
          }
        });
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => fetchHistory(true);

  const formatAmount = (amountRaw: string | number) => {
    const amount = typeof amountRaw === 'string' ? parseInt(amountRaw) : amountRaw;
    return (amount / Math.pow(10, OCTRA_CONFIG.TOKEN_DECIMALS)).toFixed(6);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;

  const isIncoming = (tx: Transaction) => tx.parsed_tx?.to === activeAccount?.address;

  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      {/* Header */}
      <header style={{ padding: '16px' }} className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} style={{ padding: '8px' }} className="hover:bg-bg-hover">
            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold uppercase tracking-wider">Transaction History</h1>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{ padding: '8px' }}
          className="hover:bg-bg-hover disabled:opacity-50"
        >
          <svg
            style={{ width: '20px', height: '20px' }}
            className={refreshing ? 'animate-spin' : ''}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </header>

      {/* Content */}
      <div style={{ padding: '0 16px' }} className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner size="lg" />
          </div>
        ) : transactions.length === 0 && myPendingTxs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div style={{ width: '64px', height: '64px', marginBottom: '16px' }} className="bg-bg-secondary flex items-center justify-center">
              <svg style={{ width: '32px', height: '32px' }} className="text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-1">No Transactions</h3>
            <p className="text-text-tertiary text-sm">Your transaction history will appear here</p>
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {/* Pending transactions */}
            {myPendingTxs.map((tx) => (
              <a
                key={tx.hash}
                href={`${EXPLORER_URL}/transactions/${tx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: '14px' }}
                className="flex items-center justify-between bg-octra-blue/10 border border-octra-blue hover:bg-octra-blue/20 transition-colors block"
              >
                <div className="flex items-center gap-3">
                  <div
                    style={{ width: '40px', height: '40px' }}
                    className="flex items-center justify-center bg-octra-blue/20"
                  >
                    <div className="w-5 h-5 border-2 border-octra-blue border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-octra-blue">Pending</div>
                    <div className="text-xs text-text-tertiary">Processing...</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-semibold">
                    -{parseFloat(tx.amount).toFixed(6)} {OCTRA_CONFIG.TOKEN_SYMBOL}
                  </div>
                  <div className="text-xs font-mono text-text-tertiary">
                    {truncateAddress(tx.to)}
                  </div>
                </div>
              </a>
            ))}

            {/* Confirmed transactions */}
            {transactions.map((tx) => {
              const incoming = isIncoming(tx);
              const amount = tx.parsed_tx?.amount_raw || tx.parsed_tx?.amount || '0';

              return (
                <a
                  key={tx.hash}
                  href={`${EXPLORER_URL}/transactions/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ padding: '14px' }}
                  className="flex items-center justify-between bg-bg-secondary border border-border-primary hover:border-octra-blue transition-colors block"
                >
                  <div className="flex items-center gap-3">
                    <div
                      style={{ width: '40px', height: '40px' }}
                      className={`flex items-center justify-center ${
                        incoming ? 'bg-accent-green/10' : 'bg-accent-red/10'
                      }`}
                    >
                      <svg
                        style={{ width: '20px', height: '20px' }}
                        className={incoming ? 'text-accent-green' : 'text-accent-red'}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        {incoming ? (
                          <path d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                        ) : (
                          <path d="M7 11l5-5m0 0l5 5m-5-5v12" />
                        )}
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">
                        {incoming ? 'Received' : 'Sent'}
                      </div>
                      <div className="text-xs text-text-tertiary">
                        {tx.parsed_tx?.timestamp ? formatTime(tx.parsed_tx.timestamp) : 'Confirmed'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-sm font-semibold ${
                        incoming ? 'text-accent-green' : 'text-text-primary'
                      }`}
                    >
                      {incoming ? '+' : '-'}{formatAmount(amount)} {OCTRA_CONFIG.TOKEN_SYMBOL}
                    </div>
                    <div className="text-xs font-mono text-text-tertiary">
                      {incoming
                        ? truncateAddress(tx.parsed_tx?.from || '')
                        : truncateAddress(tx.parsed_tx?.to || '')}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
