import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore, useActiveAccount, useAccountBalance } from '@ui/store/wallet.store';
import { sendMessage } from '@shared/messaging';
import { MESSAGE_TYPES, OCTRA_CONFIG } from '@shared/constants';
import { Button } from '@ui/components/common/Button';
import { Input } from '@ui/components/common/Input';

type Mode = 'encrypt' | 'decrypt';

export default function EncryptBalance() {
  const navigate = useNavigate();
  const activeAccount = useActiveAccount();
  const publicBalance = useAccountBalance(activeAccount?.address || '');
  const { privateBalances, showToast, activeAccountIndex, updateBalance, updatePrivateBalance } = useWalletStore();

  const [mode, setMode] = useState<Mode>('encrypt');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const privateBalance = activeAccount ? privateBalances[activeAccount.address] || '0' : '0';
  const availableBalance = mode === 'encrypt' ? parseFloat(publicBalance) : parseFloat(privateBalance);

  const handleSubmit = async () => {
    setError('');

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Enter valid amount');
      return;
    }

    if (amountNum > availableBalance) {
      setError(`Insufficient ${mode === 'encrypt' ? 'public' : 'encrypted'} balance`);
      return;
    }

    if (!activeAccount) return;

    setLoading(true);

    try {
      const messageType = mode === 'encrypt' ? MESSAGE_TYPES.ENCRYPT_BALANCE : MESSAGE_TYPES.DECRYPT_BALANCE;
      const response = await sendMessage<
        { address: string; amount: number; accountIndex: number },
        { txHash: string }
      >(messageType, {
        address: activeAccount.address,
        amount: amountNum,
        accountIndex: activeAccountIndex,
      });

      if (response.success && response.data) {
        showToast(
          mode === 'encrypt' ? 'Balance encrypted!' : 'Balance decrypted!',
          'success',
          { subMessage: response.data.txHash ? `Hash: ${response.data.txHash.slice(0, 16)}...` : 'Success' }
        );

        // Refresh balances
        const balanceResponse = await sendMessage<{ address: string }, { balance: string }>(
          MESSAGE_TYPES.GET_BALANCE,
          { address: activeAccount.address }
        );
        if (balanceResponse.success && balanceResponse.data) {
          updateBalance(activeAccount.address, balanceResponse.data.balance);
        }

        const privateResponse = await sendMessage<
          { address: string; accountIndex: number },
          { decrypted_balance?: string }
        >(MESSAGE_TYPES.GET_PRIVATE_BALANCE, {
          address: activeAccount.address,
          accountIndex: activeAccountIndex,
        });
        if (privateResponse.success && privateResponse.data?.decrypted_balance) {
          updatePrivateBalance(activeAccount.address, privateResponse.data.decrypted_balance);
        }

        navigate('/dashboard');
      } else {
        setError(response.error || `${mode === 'encrypt' ? 'Encrypt' : 'Decrypt'} failed`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMax = () => {
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
          Encrypt / Decrypt
        </h1>
      </header>

      <div style={{ padding: '16px' }} className="flex-1 flex flex-col gap-4">
        {/* Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => { setMode('encrypt'); setAmount(''); setError(''); }}
            style={{ padding: '12px' }}
            className={`flex-1 text-sm font-semibold uppercase tracking-wider transition-colors ${
              mode === 'encrypt'
                ? 'bg-purple-600 text-white'
                : 'bg-bg-secondary border border-border-primary text-text-secondary hover:border-purple-500'
            }`}
          >
            Encrypt
          </button>
          <button
            onClick={() => { setMode('decrypt'); setAmount(''); setError(''); }}
            style={{ padding: '12px' }}
            className={`flex-1 text-sm font-semibold uppercase tracking-wider transition-colors ${
              mode === 'decrypt'
                ? 'bg-purple-600 text-white'
                : 'bg-bg-secondary border border-border-primary text-text-secondary hover:border-purple-500'
            }`}
          >
            Decrypt
          </button>
        </div>

        {/* Info */}
        <div style={{ padding: '12px' }} className="bg-purple-900/20 border border-purple-500/30">
          <div className="text-xs text-purple-400 uppercase tracking-wider mb-1">
            {mode === 'encrypt' ? 'Public Balance' : 'Encrypted Balance'}
          </div>
          <div className="text-lg font-bold text-purple-300">
            {availableBalance.toFixed(6)} {OCTRA_CONFIG.TOKEN_SYMBOL}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center">
            <svg style={{ width: '20px', height: '20px' }} className="text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>

        {/* Target */}
        <div style={{ padding: '12px' }} className="bg-bg-secondary border border-border-primary">
          <div className="text-xs text-text-tertiary uppercase tracking-wider mb-1">
            {mode === 'encrypt' ? 'To Encrypted Balance' : 'To Public Balance'}
          </div>
          <div className="text-lg font-bold text-text-primary">
            {mode === 'encrypt' ? parseFloat(privateBalance).toFixed(6) : parseFloat(publicBalance).toFixed(6)} {OCTRA_CONFIG.TOKEN_SYMBOL}
          </div>
        </div>

        {/* Amount */}
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm text-text-secondary">Amount</label>
            <button onClick={handleMax} className="text-xs text-purple-400 hover:text-purple-300 uppercase">
              MAX
            </button>
          </div>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            step="0.000001"
            min="0"
          />
        </div>

        {/* Description */}
        <div style={{ padding: '12px' }} className="bg-bg-secondary border border-border-primary text-sm text-text-secondary">
          <div className="flex items-start gap-2">
            <svg style={{ width: '16px', height: '16px', marginTop: '2px' }} className="text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              {mode === 'encrypt'
                ? 'Encrypt converts your public balance to encrypted private balance using FHE. Your funds become private and can be sent confidentially.'
                : 'Decrypt converts your encrypted balance back to public balance. Your funds become visible on the blockchain.'}
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

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={loading || !amount}
          loading={loading}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          {loading ? 'PROCESSING...' : mode === 'encrypt' ? 'ENCRYPT BALANCE' : 'DECRYPT BALANCE'}
        </Button>
      </div>
    </div>
  );
}
