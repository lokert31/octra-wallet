import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@ui/components/common/Button';
import { Input } from '@ui/components/common/Input';
import { useWalletStore } from '@ui/store/wallet.store';
import { sendMessage } from '@shared/messaging';
import { MESSAGE_TYPES } from '@shared/constants';

interface ImportedWallet {
  index: number;
  name: string;
  address: string;
  publicKey: string;
}

type Step = 'password' | 'import' | 'result';
type ImportTab = 'key' | 'mnemonic';

export default function ImportWallet() {
  const navigate = useNavigate();
  const { setInitialized, setLocked, setAccounts, showToast } = useWalletStore();

  const [step, setStep] = useState<Step>('password');
  const [activeTab, setActiveTab] = useState<ImportTab>('key');
  const [loading, setLoading] = useState(false);
  const [importedWallet, setImportedWallet] = useState<ImportedWallet | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Password state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  // Import state
  const [privateKey, setPrivateKey] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [showSecret, setShowSecret] = useState(false);

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

  const handleContinueToImport = () => {
    if (validatePassword()) {
      setStep('import');
    }
  };

  const handleImport = async () => {
    setError('');

    if (activeTab === 'key' && !privateKey.trim()) {
      setError('Private key is required');
      return;
    }

    if (activeTab === 'mnemonic' && !mnemonic.trim()) {
      setError('Mnemonic phrase is required');
      return;
    }

    setLoading(true);
    try {
      // Include password for vault encryption
      const payload = activeTab === 'key'
        ? { privateKey: privateKey.trim(), password }
        : { mnemonic: mnemonic.trim(), password };

      const response = await sendMessage<
        { privateKey?: string; mnemonic?: string; password: string },
        ImportedWallet
      >(MESSAGE_TYPES.IMPORT_WALLET, payload);

      if (response.success && response.data) {
        setImportedWallet(response.data);
        setInitialized(true);
        setLocked(false);
        setAccounts([response.data]);
        setStep('result');
      } else {
        setError(response.error || 'Invalid key format');
      }
    } catch {
      setError('Failed to import wallet');
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
          <Button onClick={handleContinueToImport} className="w-full">
            CONTINUE
          </Button>
        </div>
      </div>
    );
  }

  // Step 2: Import Wallet
  if (step === 'import') {
    return (
      <div className="flex flex-col h-screen bg-bg-primary">
        <header style={{ padding: '16px' }} className="flex items-center gap-4">
          <button onClick={() => setStep('password')} style={{ padding: '8px' }} className="hover:bg-bg-hover">
            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold uppercase tracking-wider">Import Wallet</h1>
        </header>

        <div style={{ padding: '0 16px' }} className="flex-1 flex flex-col">
          {/* Tabs */}
          <div style={{ marginBottom: '16px' }} className="flex border border-border-primary">
            <button
              onClick={() => { setActiveTab('key'); setError(''); }}
              style={{ padding: '12px' }}
              className={`flex-1 text-sm font-semibold uppercase tracking-wider transition-colors ${
                activeTab === 'key' ? 'bg-octra-blue text-white' : 'hover:bg-bg-hover'
              }`}
            >
              Private Key
            </button>
            <button
              onClick={() => { setActiveTab('mnemonic'); setError(''); }}
              style={{ padding: '12px' }}
              className={`flex-1 text-sm font-semibold uppercase tracking-wider transition-colors ${
                activeTab === 'mnemonic' ? 'bg-octra-blue text-white' : 'hover:bg-bg-hover'
              }`}
            >
              Mnemonic
            </button>
          </div>

          {/* Warning */}
          <div style={{ padding: '16px', marginBottom: '16px' }} className="border-2 border-accent-yellow">
            <div className="text-accent-yellow font-semibold uppercase text-sm mb-1">Warning</div>
            <p className="text-sm text-text-secondary">
              Never share your private key or mnemonic. Anyone with access can control your funds.
            </p>
          </div>

          {/* Form */}
          {activeTab === 'key' ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Private Key (Base64 or Hex)
                </label>
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-xs text-octra-blue hover:underline uppercase tracking-wider"
                >
                  {showSecret ? 'HIDE' : 'SHOW'}
                </button>
              </div>
              <div className="relative">
                <textarea
                  style={{
                    padding: '14px',
                    WebkitTextSecurity: showSecret ? 'none' : 'disc',
                  } as React.CSSProperties}
                  className={`w-full bg-bg-secondary border h-24 resize-none font-mono text-sm text-text-primary placeholder-text-tertiary focus:outline-none transition-colors ${
                    error ? 'border-accent-red' : 'border-border-primary focus:border-octra-blue'
                  }`}
                  placeholder="Paste your private key"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Mnemonic Phrase (12 or 24 words)
                </label>
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-xs text-octra-blue hover:underline uppercase tracking-wider"
                >
                  {showSecret ? 'HIDE' : 'SHOW'}
                </button>
              </div>
              <div className="relative">
                <textarea
                  style={{
                    padding: '14px',
                    WebkitTextSecurity: showSecret ? 'none' : 'disc',
                  } as React.CSSProperties}
                  className={`w-full bg-bg-secondary border h-24 resize-none font-mono text-sm text-text-primary placeholder-text-tertiary focus:outline-none transition-colors ${
                    error ? 'border-accent-red' : 'border-border-primary focus:border-octra-blue'
                  }`}
                  placeholder="Enter your mnemonic phrase"
                  value={mnemonic}
                  onChange={(e) => setMnemonic(e.target.value)}
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-accent-red mt-2">{error}</p>}
        </div>

        <div style={{ padding: '16px' }}>
          <Button onClick={handleImport} loading={loading} className="w-full">
            IMPORT WALLET
          </Button>
        </div>
      </div>
    );
  }

  // Step 3: Show Result
  if (step === 'result' && importedWallet) {
    return (
      <div className="flex flex-col h-screen bg-bg-primary">
        <header style={{ padding: '16px' }} className="flex items-center gap-4">
          <h1 className="text-lg font-semibold uppercase tracking-wider">Wallet Imported</h1>
        </header>

        <div style={{ margin: '0 16px 16px 16px', padding: '16px' }} className="border-2 border-accent-green">
          <div className="text-accent-green font-semibold uppercase text-sm mb-1">SUCCESS</div>
          <p className="text-sm text-text-secondary">
            Your wallet has been imported successfully. You can now use it to send and receive funds.
          </p>
        </div>

        <div style={{ padding: '0 16px' }} className="flex-1 overflow-y-auto space-y-4">
          {/* Address */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Address</label>
              <button
                onClick={() => handleCopy(importedWallet.address, 'address')}
                className="text-xs text-octra-blue hover:underline uppercase tracking-wider"
              >
                {copied === 'address' ? 'COPIED!' : 'COPY'}
              </button>
            </div>
            <div style={{ padding: '14px' }} className="bg-bg-secondary border border-border-primary">
              <p className="font-mono text-sm text-accent-green break-all">{importedWallet.address}</p>
            </div>
          </div>

          {/* Public Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Public Key (Base64)</label>
              <button
                onClick={() => handleCopy(importedWallet.publicKey, 'publicKey')}
                className="text-xs text-octra-blue hover:underline uppercase tracking-wider"
              >
                {copied === 'publicKey' ? 'COPIED!' : 'COPY'}
              </button>
            </div>
            <div style={{ padding: '14px' }} className="bg-bg-secondary border border-border-primary">
              <p className="font-mono text-sm text-text-secondary break-all">{importedWallet.publicKey}</p>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          <Button onClick={handleContinue} className="w-full">
            CONTINUE TO DASHBOARD
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
