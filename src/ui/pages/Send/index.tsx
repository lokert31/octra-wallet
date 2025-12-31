import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@ui/components/common/Button';
import { Input } from '@ui/components/common/Input';
import { useWalletStore, useActiveAccount, useAccountBalance } from '@ui/store/wallet.store';
import { sendMessage } from '@shared/messaging';
import { MESSAGE_TYPES, OCTRA_CONFIG, FEE_TIERS, EXPLORER_URL } from '@shared/constants';
import { OctraKeyring } from '@core/crypto/keyring';

export default function Send() {
  const navigate = useNavigate();
  const activeAccount = useActiveAccount();
  const balance = useAccountBalance(activeAccount?.address || '');
  const { accounts, showToast, updateBalance, addPendingTransaction } = useWalletStore();

  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [feeTier, setFeeTier] = useState<keyof typeof FEE_TIERS>('LOW');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<{ to?: string; amount?: string }>({});

  // Account picker state
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');

  // Filter accounts (exclude active account, filter by search)
  const otherAccounts = accounts.filter((acc) => acc.index !== activeAccount?.index);
  const filteredAccounts = otherAccounts.filter((acc) =>
    accountSearch === '' ||
    acc.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
    acc.address.toLowerCase().includes(accountSearch.toLowerCase()) ||
    `account ${acc.index}`.includes(accountSearch.toLowerCase()) ||
    `#${acc.index}`.includes(accountSearch.toLowerCase())
  );

  const handleSelectAccount = (address: string) => {
    setTo(address);
    setShowAccountPicker(false);
    setAccountSearch('');
  };

  const fee = FEE_TIERS[feeTier].fee;
  const total = parseFloat(amount || '0') + fee;

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!to.trim()) {
      newErrors.to = 'Recipient address is required';
    } else if (!OctraKeyring.isValidAddress(to.trim())) {
      newErrors.to = 'Invalid Octra address';
    } else if (to.trim() === activeAccount?.address) {
      newErrors.to = 'Cannot send to yourself';
    }

    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      newErrors.amount = 'Enter a valid amount';
    } else if (amountNum + fee > parseFloat(balance)) {
      newErrors.amount = 'Insufficient balance';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleReview = () => {
    if (validate()) {
      setShowConfirm(true);
    }
  };

  const handleSend = async () => {
    if (!activeAccount) return;

    setLoading(true);
    try {
      const response = await sendMessage<
        { from: string; to: string; amount: number; accountIndex: number; feeTier: string },
        { txHash: string }
      >(MESSAGE_TYPES.SEND_TRANSACTION, {
        from: activeAccount.address,
        to: to.trim(),
        amount: parseFloat(amount),
        accountIndex: activeAccount.index,
        feeTier,
      });

      if (response.success && response.data) {
        const txHash = response.data.txHash;
        const shortHash = txHash ? `${txHash.slice(0, 8)}...${txHash.slice(-8)}` : '';

        // Add to pending transactions
        if (txHash) {
          addPendingTransaction({
            hash: txHash,
            from: activeAccount.address,
            to: to.trim(),
            amount: amount,
            timestamp: Date.now() / 1000,
          });
        }

        showToast('Transaction Sent!', 'success', {
          subMessage: `Processing on blockchain. Hash: ${shortHash}`,
          link: txHash ? `${EXPLORER_URL}/transactions/${txHash}` : undefined,
        });

        // Refresh balance
        const balanceResponse = await sendMessage<{ address: string }, { balance: string }>(
          MESSAGE_TYPES.GET_BALANCE,
          { address: activeAccount.address }
        );
        if (balanceResponse.success && balanceResponse.data) {
          updateBalance(activeAccount.address, balanceResponse.data.balance);
        }

        navigate('/dashboard');
      } else {
        showToast(response.error || 'Transaction failed', 'error');
        setShowConfirm(false);
      }
    } catch (error) {
      showToast('Failed to send transaction', 'error');
      setShowConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  const handleMax = () => {
    const maxAmount = Math.max(0, parseFloat(balance) - fee);
    setAmount(maxAmount.toFixed(6));
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 10)}...${addr.slice(-8)}`;

  // Confirmation screen
  if (showConfirm) {
    return (
      <div className="flex flex-col h-screen bg-bg-primary">
        {/* Header */}
        <header style={{ padding: '16px' }} className="flex items-center gap-4">
          <button onClick={() => !loading && setShowConfirm(false)} style={{ padding: '8px' }} className="hover:bg-bg-hover disabled:opacity-50" disabled={loading}>
            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold uppercase tracking-wider">Confirm Transaction</h1>
        </header>

        {/* Content */}
        <div style={{ padding: '0 16px' }} className="flex-1">
          {/* Amount box */}
          <div style={{ padding: '24px', marginBottom: '16px' }} className="bg-octra-blue text-center">
            <div className="text-3xl font-bold text-white">{parseFloat(amount).toFixed(6)}</div>
            <div className="text-white opacity-80">{OCTRA_CONFIG.TOKEN_SYMBOL}</div>
          </div>

          {/* Details */}
          <div style={{ padding: '16px' }} className="border border-border-primary space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-text-tertiary uppercase tracking-wider">From</span>
              <span className="font-mono text-text-secondary">{truncateAddress(activeAccount?.address || '')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-tertiary uppercase tracking-wider">To</span>
              <span className="font-mono text-text-secondary">{truncateAddress(to)}</span>
            </div>
            <div className="border-t border-border-primary" />
            <div className="flex justify-between text-sm">
              <span className="text-text-tertiary uppercase tracking-wider">Network Fee</span>
              <span className="text-text-secondary">{fee} {OCTRA_CONFIG.TOKEN_SYMBOL}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="uppercase tracking-wider">Total</span>
              <span>{total.toFixed(6)} {OCTRA_CONFIG.TOKEN_SYMBOL}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '16px', display: 'flex', gap: '12px' }}>
          <Button variant="secondary" onClick={() => setShowConfirm(false)} style={{ flex: 1 }}>
            CANCEL
          </Button>
          <Button onClick={handleSend} loading={loading} style={{ flex: 1 }}>
            CONFIRM
          </Button>
        </div>
      </div>
    );
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
        <h1 className="text-lg font-semibold uppercase tracking-wider">Send {OCTRA_CONFIG.TOKEN_SYMBOL}</h1>
      </header>

      {/* Form */}
      <div style={{ padding: '0 16px' }} className="flex-1 space-y-4">
        {/* Recipient with account picker */}
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Recipient Address
            </label>
            {otherAccounts.length > 0 && (
              <button
                onClick={() => setShowAccountPicker(!showAccountPicker)}
                className="text-xs text-octra-blue hover:underline uppercase tracking-wider"
              >
                MY ACCOUNTS
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="oct..."
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ padding: '14px' }}
              className={`flex-1 bg-bg-secondary border font-mono text-sm text-text-primary placeholder-text-tertiary focus:outline-none transition-colors ${
                errors.to ? 'border-accent-red' : 'border-border-primary focus:border-octra-blue'
              }`}
            />
          </div>
          {errors.to && <p className="text-xs text-accent-red mt-1">{errors.to}</p>}

          {/* Account picker dropdown */}
          {showAccountPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => { setShowAccountPicker(false); setAccountSearch(''); }} />
              <div className="absolute top-full left-0 right-0 mt-1 bg-bg-primary border border-border-primary z-20">
                {/* Search */}
                <div className="p-2 border-b border-border-primary">
                  <div className="relative">
                    <svg
                      style={{ width: '14px', height: '14px', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                      className="absolute text-text-tertiary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search by name, address, #number..."
                      value={accountSearch}
                      onChange={(e) => setAccountSearch(e.target.value)}
                      style={{ padding: '8px 10px 8px 32px' }}
                      className="w-full bg-bg-secondary border border-border-primary text-sm text-text-primary placeholder-text-tertiary focus:border-octra-blue focus:outline-none"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Account list */}
                <div className="max-h-40 overflow-y-auto">
                  {filteredAccounts.length > 0 ? (
                    filteredAccounts.map((acc) => (
                      <button
                        key={acc.index}
                        onClick={() => handleSelectAccount(acc.address)}
                        style={{ padding: '10px 12px' }}
                        className="w-full flex items-center gap-3 hover:bg-bg-hover transition-colors text-left"
                      >
                        <div style={{ width: '32px', height: '32px' }} className="bg-octra-blue flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {acc.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">
                            {acc.name} <span className="text-text-tertiary font-normal">#{acc.index}</span>
                          </div>
                          <div className="text-xs font-mono text-text-tertiary truncate">
                            {acc.address.slice(0, 12)}...{acc.address.slice(-8)}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center text-text-tertiary text-sm py-4">
                      No accounts found
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Amount</label>
            <button onClick={handleMax} className="text-xs text-octra-blue hover:underline uppercase tracking-wider">
              Max: {parseFloat(balance).toFixed(6)}
            </button>
          </div>
          <div className="relative">
            <Input
              type="number"
              placeholder="0.000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={errors.amount}
              step="0.000001"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">
              {OCTRA_CONFIG.TOKEN_SYMBOL}
            </span>
          </div>
        </div>

        {/* Fee selector */}
        <div>
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 block">
            Network Fee
          </label>
          <div className="space-y-2">
            {(Object.keys(FEE_TIERS) as Array<keyof typeof FEE_TIERS>).map((tier) => (
              <button
                key={tier}
                onClick={() => setFeeTier(tier)}
                style={{ padding: '14px' }}
                className={`w-full flex items-center justify-between border transition-colors ${
                  feeTier === tier
                    ? 'border-octra-blue bg-octra-blue/10'
                    : 'border-border-primary hover:border-octra-blue'
                }`}
              >
                <span className="text-sm font-semibold uppercase">{FEE_TIERS[tier].label}</span>
                <span className={`text-sm ${feeTier === tier ? 'text-octra-blue' : 'text-text-secondary'}`}>
                  {FEE_TIERS[tier].fee} OCT
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action */}
      <div style={{ padding: '16px' }}>
        <Button onClick={handleReview} className="w-full">
          REVIEW TRANSACTION
        </Button>
      </div>
    </div>
  );
}
