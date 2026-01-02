import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore, useActiveAccount } from '@ui/store/wallet.store';
import { sendMessage } from '@shared/messaging';
import { MESSAGE_TYPES, OCTRA_CONFIG, UI_CONFIG, NETWORKS, type NetworkId } from '@shared/constants';
import type { PendingTransfer } from '@shared/types';
import { AccountSelector } from '@ui/components/wallet/AccountSelector';
import { Spinner } from '@ui/components/common/Spinner';

export default function Dashboard() {
  const navigate = useNavigate();
  const activeAccount = useActiveAccount();
  const { balances, updateBalance, privateBalances, updatePrivateBalance, pendingPrivateTransfers, setPendingPrivateTransfers, showToast, network, setNetwork, activeAccountIndex } = useWalletStore();
  const [isHidden, setIsHidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showPrivate, setShowPrivate] = useState(false);

  const balance = activeAccount ? balances[activeAccount.address] : undefined;
  const privateBalance = activeAccount ? privateBalances[activeAccount.address] : undefined;
  const pendingCount = pendingPrivateTransfers.length;

  // Load network on mount
  useEffect(() => {
    loadNetwork();
  }, []);

  const loadNetwork = async () => {
    const response = await sendMessage<void, NetworkId>(MESSAGE_TYPES.GET_NETWORK);
    if (response.success && response.data) {
      setNetwork(response.data);
    }
  };

  const toggleNetwork = async () => {
    const newNetwork: NetworkId = network === 'mainnet' ? 'testnet' : 'mainnet';
    const response = await sendMessage<{ networkId: NetworkId }, void>(
      MESSAGE_TYPES.SET_NETWORK,
      { networkId: newNetwork }
    );
    if (response.success) {
      setNetwork(newNetwork);
      showToast(`Switched to ${NETWORKS[newNetwork].name}`, 'success');
      // Refresh balance for new network
      fetchBalance();
    }
  };

  useEffect(() => {
    if (activeAccount) {
      fetchBalance();
      const interval = setInterval(fetchBalance, UI_CONFIG.BALANCE_REFRESH_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [activeAccount?.address]);

  const fetchBalance = async () => {
    if (!activeAccount) return;

    try {
      // Fetch public balance
      const response = await sendMessage<{ address: string }, { balance: string }>(
        MESSAGE_TYPES.GET_BALANCE,
        { address: activeAccount.address }
      );

      if (response.success && response.data) {
        updateBalance(activeAccount.address, response.data.balance);
      }

      // Fetch private balance
      const privateResponse = await sendMessage<
        { address: string; accountIndex: number },
        { decrypted_balance?: string; has_private_balance: boolean }
      >(MESSAGE_TYPES.GET_PRIVATE_BALANCE, {
        address: activeAccount.address,
        accountIndex: activeAccountIndex,
      });

      if (privateResponse.success && privateResponse.data?.decrypted_balance) {
        updatePrivateBalance(activeAccount.address, privateResponse.data.decrypted_balance);
      }

      // Fetch pending private transfers
      const pendingResponse = await sendMessage<{ address: string }, PendingTransfer[]>(
        MESSAGE_TYPES.GET_PENDING_TRANSFERS,
        { address: activeAccount.address }
      );

      if (pendingResponse.success && pendingResponse.data) {
        setPendingPrivateTransfers(pendingResponse.data);
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await fetchBalance();
    setRefreshing(false);
  };

  const handleCopyAddress = async () => {
    if (!activeAccount) return;

    try {
      await navigator.clipboard.writeText(activeAccount.address);
      showToast('Address copied', 'success');
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  const formatBalance = (bal: string | undefined) => {
    if (bal === undefined) return '—.——';
    const num = parseFloat(bal);
    if (isNaN(num)) return '—.——';
    if (num === 0) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 10)}...${addr.slice(-6)}`;
  };

  if (!activeAccount) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      {/* Header with account selector and settings */}
      <header style={{ padding: '16px 16px 12px 16px' }} className="flex items-center justify-between">
        <AccountSelector />
        <button
          onClick={() => navigate('/settings')}
          style={{ padding: '10px' }}
          className="hover:bg-bg-hover transition-colors"
        >
          {/* Gear icon */}
          <svg style={{ width: '26px', height: '26px' }} className="text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      {/* Balance Section - with margins */}
      <div style={{ margin: '8px 16px 0 16px', padding: '20px' }} className="bg-octra-blue">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPrivate(false)}
              className={`text-sm uppercase tracking-wider transition-colors ${!showPrivate ? 'text-white' : 'text-white/50 hover:text-white/70'}`}
            >
              Public
            </button>
            <span className="text-white/30">|</span>
            <button
              onClick={() => setShowPrivate(true)}
              className={`text-sm uppercase tracking-wider transition-colors ${showPrivate ? 'text-white' : 'text-white/50 hover:text-white/70'}`}
            >
              Private
            </button>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-white/70 hover:text-white disabled:opacity-50 transition-colors"
            title="Refresh balance"
          >
            <svg
              style={{ width: '18px', height: '18px' }}
              className={refreshing ? 'animate-spin' : ''}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        <div className="text-4xl font-bold text-white">
          {isHidden ? '••••••' : formatBalance(showPrivate ? privateBalance : balance)} <span className="text-lg">{OCTRA_CONFIG.TOKEN_SYMBOL}</span>
        </div>
        {showPrivate && (
          <div className="text-xs text-white/60 mt-1 flex items-center gap-1">
            <svg style={{ width: '12px', height: '12px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Encrypted balance
          </div>
        )}
      </div>

      {/* Pending transfers banner */}
      {pendingCount > 0 && (
        <button
          onClick={() => navigate('/pending-transfers')}
          style={{ margin: '8px 16px 0 16px', padding: '12px' }}
          className="w-auto bg-purple-600/20 border border-purple-500/50 flex items-center justify-between hover:bg-purple-600/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg style={{ width: '18px', height: '18px' }} className="text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-purple-300">
              {pendingCount} pending transfer{pendingCount > 1 ? 's' : ''} to claim
            </span>
          </div>
          <svg style={{ width: '16px', height: '16px' }} className="text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Address row */}
      <div style={{ padding: '12px 16px' }}>
        {/* Address with buttons in one row */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
          {/* Address display */}
          <div
            style={{ padding: '12px 14px', flex: 1, minWidth: 0 }}
            className="bg-bg-secondary border border-border-primary font-mono text-text-secondary text-sm truncate"
          >
            {isHidden ? '••••••••••...••••••' : truncateAddress(activeAccount.address)}
          </div>

          {/* Hide/Show button */}
          <button
            onClick={() => setIsHidden(!isHidden)}
            style={{ padding: '12px', width: '48px' }}
            className="bg-bg-secondary border border-border-primary hover:border-octra-blue transition-colors flex items-center justify-center flex-shrink-0"
            title={isHidden ? 'Show' : 'Hide'}
          >
            {isHidden ? (
              <svg style={{ width: '20px', height: '20px' }} className="text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg style={{ width: '20px', height: '20px' }} className="text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>

          {/* Copy button */}
          <button
            onClick={handleCopyAddress}
            style={{ padding: '12px', width: '48px' }}
            className="bg-octra-blue hover:bg-octra-blue-hover transition-colors text-white flex items-center justify-center flex-shrink-0"
            title="Copy address"
          >
            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Action Buttons - rectangular with margins */}
      <div style={{ padding: '8px 16px', display: 'flex', gap: '8px' }}>
        <button
          onClick={() => navigate('/send')}
          style={{ flex: 1, padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
          className="bg-octra-blue hover:bg-octra-blue-hover transition-colors text-white font-semibold text-xs uppercase tracking-wider"
        >
          <svg style={{ width: '22px', height: '22px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M7 11l5-5m0 0l5 5m-5-5v12" />
          </svg>
          SEND
        </button>

        <button
          onClick={() => navigate('/send-private')}
          style={{ flex: 1, padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
          className="bg-purple-600 hover:bg-purple-700 transition-colors text-white font-semibold text-xs uppercase tracking-wider"
        >
          <svg style={{ width: '22px', height: '22px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          PRIVATE
        </button>

        <button
          onClick={() => navigate('/receive')}
          style={{ flex: 1, padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
          className="bg-octra-blue hover:bg-octra-blue-hover transition-colors text-white font-semibold text-xs uppercase tracking-wider"
        >
          <svg style={{ width: '22px', height: '22px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M17 13l-5 5m0 0l-5-5m5 5V6" />
          </svg>
          RECEIVE
        </button>

        <button
          onClick={() => navigate('/history')}
          style={{ flex: 1, padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
          className="bg-octra-blue hover:bg-octra-blue-hover transition-colors text-white font-semibold text-xs uppercase tracking-wider"
        >
          <svg style={{ width: '22px', height: '22px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          HISTORY
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Network indicator - clickable to toggle */}
      <button
        onClick={toggleNetwork}
        style={{ padding: '16px' }}
        className="w-full border-t border-border-primary hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center justify-center gap-2">
          <div className={`w-2 h-2 rounded-full ${network === 'mainnet' ? 'bg-accent-green' : 'bg-yellow-500'}`} />
          <span className="text-xs text-text-tertiary uppercase tracking-wider">
            {NETWORKS[network]?.name || 'Mainnet'}
          </span>
          <svg style={{ width: '12px', height: '12px' }} className="text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        </div>
      </button>
    </div>
  );
}
