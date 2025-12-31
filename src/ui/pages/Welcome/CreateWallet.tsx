import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@ui/components/common/Button';
import { Input } from '@ui/components/common/Input';
import { useWalletStore } from '@ui/store/wallet.store';
import { sendMessage } from '@shared/messaging';
import { MESSAGE_TYPES } from '@shared/constants';

interface CreatedWallet {
  index: number;
  name: string;
  address: string;
  publicKey: string;
  privateKey: string;
  mnemonic: string;
}

type Step = 'password' | 'create' | 'result' | 'confirm';

export default function CreateWallet() {
  const navigate = useNavigate();
  const { setInitialized, setLocked, setAccounts, showToast } = useWalletStore();

  const [step, setStep] = useState<Step>('password');
  const [loading, setLoading] = useState(false);
  const [createdWallet, setCreatedWallet] = useState<CreatedWallet | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [confirmCountdown, setConfirmCountdown] = useState(0);

  // Password state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const validatePassword = (): boolean => {
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasNumber) {
      setError('Password must contain uppercase, lowercase and numbers');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleContinueToCreate = () => {
    if (validatePassword()) {
      setStep('create');
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      // Create wallet with password (password encrypts the vault)
      const response = await sendMessage<{ password: string }, CreatedWallet>(
        MESSAGE_TYPES.CREATE_WALLET,
        { password }
      );

      if (response.success && response.data) {
        setCreatedWallet(response.data);
        setInitialized(true);
        setLocked(false);
        setAccounts([{
          index: response.data.index,
          name: response.data.name,
          address: response.data.address,
          publicKey: response.data.publicKey,
        }]);
        setStep('result');
      } else {
        showToast(response.error || 'Failed to create wallet', 'error');
      }
    } catch {
      showToast('Failed to create wallet', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  const handleConfirmSaved = () => {
    setStep('confirm');
    setConfirmCountdown(3);

    // Countdown from 3 to 0
    const interval = setInterval(() => {
      setConfirmCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleContinue = () => {
    navigate('/dashboard');
  };

  // Step 1: Set Password
  if (step === 'password') {
    return (
      <div className="flex flex-col h-screen bg-bg-primary">
        <header style={{ padding: '16px' }} className="flex items-center gap-4">
          <button onClick={() => navigate('/welcome')} style={{ padding: '8px' }} className="hover:bg-bg-hover">
            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold uppercase tracking-wider">Set Password</h1>
        </header>

        <div style={{ padding: '0 16px' }} className="flex-1">
          <div style={{ padding: '20px', marginBottom: '16px' }} className="bg-octra-blue">
            <div className="text-xl font-bold mb-1 text-white">SECURE YOUR WALLET</div>
            <div className="text-sm opacity-80 text-white">Create a strong password to protect your wallet</div>
          </div>

          <div className="space-y-4">
            <Input
              label="PASSWORD"
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Input
              label="CONFIRM PASSWORD"
              type="password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            {error && <p className="text-sm text-accent-red">{error}</p>}

            <div style={{ padding: '16px' }} className="border border-border-primary">
              <div className="flex items-start gap-3">
                <svg style={{ width: '24px', height: '24px' }} className="text-octra-blue flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-sm uppercase tracking-wider mb-1">Password Protection</h3>
                  <p className="text-sm text-text-secondary">
                    Your password is required to export private keys and perform sensitive operations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          <Button onClick={handleContinueToCreate} className="w-full">
            CONTINUE
          </Button>
        </div>
      </div>
    );
  }

  // Step 2: Create Wallet
  if (step === 'create') {
    return (
      <div className="flex flex-col h-screen bg-bg-primary">
        <header style={{ padding: '16px' }} className="flex items-center gap-4">
          <button onClick={() => setStep('password')} style={{ padding: '8px' }} className="hover:bg-bg-hover">
            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold uppercase tracking-wider">Create Wallet</h1>
        </header>

        <div style={{ padding: '0 16px' }} className="flex-1 flex flex-col">
          <div style={{ padding: '20px', marginBottom: '16px' }} className="bg-octra-blue">
            <div className="text-2xl font-bold mb-1 text-white">NEW WALLET</div>
            <div className="text-sm opacity-80 text-white">Generate a unique address with mnemonic</div>
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-3">
            <div style={{ padding: '16px' }} className="border border-border-primary">
              <div className="flex items-start gap-3">
                <svg style={{ width: '24px', height: '24px' }} className="text-octra-blue flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-sm uppercase tracking-wider mb-1">Your Keys, Your Crypto</h3>
                  <p className="text-sm text-text-secondary">
                    Private keys are stored locally on your device. Only you have access.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ padding: '16px' }} className="border border-border-primary">
              <div className="flex items-start gap-3">
                <svg style={{ width: '24px', height: '24px' }} className="text-octra-blue flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-sm uppercase tracking-wider mb-1">BIP39 Mnemonic</h3>
                  <p className="text-sm text-text-secondary">
                    12-word recovery phrase for easy backup and restore.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          <Button onClick={handleCreate} loading={loading} className="w-full">
            GENERATE WALLET
          </Button>
        </div>
      </div>
    );
  }

  // Step 3: Show Result
  if (step === 'result' && createdWallet) {
    return (
      <div className="flex flex-col h-screen bg-bg-primary">
        <header style={{ padding: '16px' }} className="flex items-center gap-4">
          <h1 className="text-lg font-semibold uppercase tracking-wider">Wallet Created</h1>
        </header>

        <div style={{ margin: '0 16px 16px 16px', padding: '16px' }} className="border-2 border-accent-red">
          <div className="text-accent-red font-semibold uppercase text-sm mb-1">IMPORTANT</div>
          <p className="text-sm text-text-secondary">
            Save your mnemonic and private key securely. Anyone with access can steal your funds. This is your only chance to save them!
          </p>
        </div>

        <div style={{ padding: '0 16px' }} className="flex-1 overflow-y-auto space-y-4">
          {/* Mnemonic */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-accent-yellow uppercase tracking-wider">Mnemonic Phrase (12 words)</label>
              <button
                onClick={() => handleCopy(createdWallet.mnemonic, 'mnemonic')}
                className="text-xs text-octra-blue hover:underline uppercase tracking-wider"
              >
                {copied === 'mnemonic' ? 'COPIED!' : 'COPY'}
              </button>
            </div>
            <div style={{ padding: '14px' }} className="bg-bg-secondary border border-accent-yellow">
              <p className="font-mono text-sm text-accent-yellow break-all">{createdWallet.mnemonic}</p>
            </div>
          </div>

          {/* Address */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Address</label>
              <button
                onClick={() => handleCopy(createdWallet.address, 'address')}
                className="text-xs text-octra-blue hover:underline uppercase tracking-wider"
              >
                {copied === 'address' ? 'COPIED!' : 'COPY'}
              </button>
            </div>
            <div style={{ padding: '14px' }} className="bg-bg-secondary border border-border-primary">
              <p className="font-mono text-sm text-accent-green break-all">{createdWallet.address}</p>
            </div>
          </div>

          {/* Public Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Public Key (Base64)</label>
              <button
                onClick={() => handleCopy(createdWallet.publicKey, 'publicKey')}
                className="text-xs text-octra-blue hover:underline uppercase tracking-wider"
              >
                {copied === 'publicKey' ? 'COPIED!' : 'COPY'}
              </button>
            </div>
            <div style={{ padding: '14px' }} className="bg-bg-secondary border border-border-primary">
              <p className="font-mono text-sm text-text-secondary break-all">{createdWallet.publicKey}</p>
            </div>
          </div>

          {/* Private Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-accent-red uppercase tracking-wider">Private Key (Base64)</label>
              <button
                onClick={() => handleCopy(createdWallet.privateKey, 'privateKey')}
                className="text-xs text-octra-blue hover:underline uppercase tracking-wider"
              >
                {copied === 'privateKey' ? 'COPIED!' : 'COPY'}
              </button>
            </div>
            <div style={{ padding: '14px' }} className="bg-bg-secondary border border-accent-red">
              <p className="font-mono text-sm text-accent-red break-all">{createdWallet.privateKey}</p>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          <Button onClick={handleConfirmSaved} className="w-full">
            I HAVE SAVED MY KEYS
          </Button>
        </div>
      </div>
    );
  }

  // Step 4: Confirm Saved
  if (step === 'confirm') {
    return (
      <div className="flex flex-col h-screen bg-bg-primary">
        <header style={{ padding: '16px' }} className="flex items-center gap-4">
          <h1 className="text-lg font-semibold uppercase tracking-wider">Confirm Backup</h1>
        </header>

        <div style={{ padding: '0 16px' }} className="flex-1 flex flex-col justify-center">
          <div style={{ padding: '24px', marginBottom: '24px' }} className="border-2 border-accent-yellow text-center">
            <svg style={{ width: '48px', height: '48px', margin: '0 auto 16px' }} className="text-accent-yellow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-accent-yellow font-bold uppercase text-lg mb-2">ARE YOU SURE?</div>
            <p className="text-sm text-text-secondary mb-4">
              Have you written down your mnemonic phrase and private key in a safe place? You will NOT be able to recover your wallet without them!
            </p>

            <label className="flex items-center justify-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="w-5 h-5 accent-octra-blue"
              />
              <span className="text-sm text-text-primary">
                I confirm I have saved my backup securely
              </span>
            </label>
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          <Button
            onClick={handleContinue}
            disabled={!confirmChecked || confirmCountdown > 0}
            className="w-full"
          >
            {confirmCountdown > 0 ? `WAIT ${confirmCountdown}s...` : 'CONTINUE TO DASHBOARD'}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
