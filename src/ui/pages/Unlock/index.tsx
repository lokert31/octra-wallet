import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@ui/components/common/Button';
import { Input } from '@ui/components/common/Input';
import { useWalletStore } from '@ui/store/wallet.store';
import { sendMessage } from '@shared/messaging';
import { MESSAGE_TYPES } from '@shared/constants';
import type { Account } from '@shared/types';

export default function Unlock() {
  const navigate = useNavigate();
  const { setLocked, setAccounts, setActiveAccountIndex, showToast, loadPendingTransactions } = useWalletStore();

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleUnlock = async () => {
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await sendMessage<{ password: string }, Account[]>(
        MESSAGE_TYPES.UNLOCK_WALLET,
        { password }
      );

      if (response.success && response.data) {
        setAccounts(response.data);
        setLocked(false);

        // Load saved active account
        const activeResponse = await sendMessage<void, number>(MESSAGE_TYPES.GET_ACTIVE_ACCOUNT);
        if (activeResponse.success && activeResponse.data !== undefined) {
          setActiveAccountIndex(activeResponse.data);
        }

        // Load pending transactions from storage
        await loadPendingTransactions();

        navigate('/dashboard');
      } else {
        setError(response.error || 'Invalid password');
      }
    } catch {
      setError('Failed to unlock wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleUnlock();
    }
  };

  const handleReset = async () => {
    await sendMessage(MESSAGE_TYPES.RESET_WALLET, {});
    showToast('Wallet reset', 'success');
    navigate('/welcome');
  };

  // Forgot Password Modal
  if (showForgotModal) {
    return (
      <div className="flex flex-col h-screen bg-octra-blue">
        <div style={{ margin: '24px', marginTop: '48px' }} className="flex-1 flex flex-col bg-white rounded-2xl">
          {/* Icon */}
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <div style={{ width: '80px', height: '80px', marginBottom: '24px' }} className="bg-gray-100 rounded-full flex items-center justify-center">
              <svg style={{ width: '40px', height: '40px' }} className="text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                <text x="12" y="12" textAnchor="middle" fontSize="8" fill="currentColor">?</text>
              </svg>
            </div>

            <h2 style={{ fontSize: '24px', marginBottom: '16px' }} className="font-bold text-gray-900">
              Forgot Password
            </h2>

            <p style={{ lineHeight: '1.6' }} className="text-center text-gray-500">
              Octra Wallet doesn't store your password and can't help you retrieve it. Reset your wallet to set up a new one.
            </p>
          </div>

          {/* Actions */}
          <div style={{ padding: '24px' }} className="space-y-3">
            <Button onClick={handleReset} className="w-full">
              BEGIN RESET PROCESS
            </Button>
            <button
              onClick={() => setShowForgotModal(false)}
              className="w-full py-3 text-gray-500 hover:text-gray-700 font-semibold transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main Unlock Screen
  return (
    <div className="flex flex-col h-screen bg-bg-primary relative">
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-bg-primary z-50 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-octra-blue border-t-transparent rounded-full animate-spin" />
          <div className="text-lg font-semibold uppercase tracking-wider">Unlocking...</div>
          <div className="text-sm text-text-tertiary">Decrypting wallet</div>
        </div>
      )}

      {/* Header with Logo */}
      <div style={{ padding: '48px 24px 24px 24px' }} className="text-center">
        {/* Logo */}
        <div style={{ width: '72px', height: '72px', margin: '0 auto 20px', borderRadius: '16px' }} className="bg-octra-blue flex items-center justify-center">
          <svg style={{ width: '40px', height: '40px' }} className="text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        {/* Wallet Name */}
        <h1 style={{ fontSize: '28px', marginBottom: '8px' }} className="font-bold text-text-primary">
          Octra Wallet
        </h1>

        {/* Tagline */}
        <p className="text-text-secondary">
          Secure FHE Blockchain Wallet
        </p>
      </div>

      {/* Password Form */}
      <div style={{ padding: '24px' }} className="flex-1 flex flex-col justify-center">
        <div className="space-y-4">
          <Input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={handleKeyPress}
            error={error}
          />

          <Button onClick={handleUnlock} loading={loading} className="w-full">
            UNLOCK
          </Button>
        </div>
      </div>

      {/* Forgot Password */}
      <div style={{ padding: '24px' }} className="text-center">
        <button
          onClick={() => setShowForgotModal(true)}
          className="text-octra-blue hover:underline font-medium transition-colors"
        >
          Forgot password?
        </button>
      </div>
    </div>
  );
}
