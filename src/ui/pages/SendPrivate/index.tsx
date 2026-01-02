import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore, useActiveAccount } from '@ui/store/wallet.store';
import { sendMessage } from '@shared/messaging';
import { MESSAGE_TYPES, OCTRA_CONFIG, EXPLORER_URL } from '@shared/constants';
import { OctraKeyring } from '@core/crypto/keyring';
import { Button } from '@ui/components/common/Button';
import { Input } from '@ui/components/common/Input';

export default function SendPrivate() {
  const navigate = useNavigate();
  const activeAccount = useActiveAccount();
  const { privateBalances, showToast, activeAccountIndex } = useWalletStore();

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const privateBalance = activeAccount ? privateBalances[activeAccount.address] : '0';
  const availableBalance = parseFloat(privateBalance || '0');

  const handleSend = async () => {
    setError('');

    // Validate recipient
    if (!recipient.trim()) {
      setError('Enter recipient address');
      return;
    }

    if (!OctraKeyring.isValidAddress(recipient.trim())) {
      setError('Invalid recipient address');
      return;
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Enter valid amount');
      return;
    }

    if (amountNum > availableBalance) {
      setError('Insufficient private balance');
      return;
    }

    setSending(true);

    try {
      const response = await sendMessage<
        { from: string; to: string; amount: number; accountIndex: number },
        { txHash: string }
      >(MESSAGE_TYPES.SEND_PRIVATE_TRANSFER, {
        from: activeAccount!.address,
        to: recipient.trim(),
        amount: amountNum,
        accountIndex: activeAccountIndex,
      });

      if (response.success && response.data) {
        showToast('Private transfer sent!', 'success', {
          subMessage: `Hash: ${response.data.txHash.slice(0, 16)}...`,
          link: `${EXPLORER_URL}/tx/${response.data.txHash}`,
        });
        navigate('/');
      } else {
        setError(response.error || 'Transfer failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setSending(false);
    }
  };

  const handleMaxAmount = () => {
    setAmount(availableBalance.toString());
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Private Transfer
        </h1>
      </header>

      <div style={{ padding: '16px' }} className="flex-1 flex flex-col gap-4">
        {/* Private Balance Info */}
        <div style={{ padding: '12px' }} className="bg-purple-900/20 border border-purple-500/30">
          <div className="text-xs text-purple-400 uppercase tracking-wider mb-1">Available Private Balance</div>
          <div className="text-lg font-bold text-purple-300">
            {availableBalance.toFixed(6)} {OCTRA_CONFIG.TOKEN_SYMBOL}
          </div>
        </div>

        {/* Recipient */}
        <div>
          <label className="block text-sm text-text-secondary mb-2">Recipient Address</label>
          <Input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="oct..."
            className="font-mono"
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm text-text-secondary mb-2">Amount</label>
          <div className="relative">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.000001"
              min="0"
            />
            <button
              onClick={handleMaxAmount}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-purple-400 hover:text-purple-300 uppercase"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Info */}
        <div style={{ padding: '12px' }} className="bg-bg-secondary border border-border-primary text-sm text-text-secondary">
          <div className="flex items-start gap-2">
            <svg style={{ width: '16px', height: '16px', marginTop: '2px' }} className="text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Private transfers are encrypted. The recipient will need to claim the transfer to receive the funds.
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '12px' }} className="bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm">
            {error}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={sending || !recipient || !amount}
          loading={sending}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          {sending ? 'SENDING...' : 'SEND PRIVATE TRANSFER'}
        </Button>
      </div>
    </div>
  );
}
