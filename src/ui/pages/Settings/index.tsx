import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@ui/components/common/Button';
import { Input } from '@ui/components/common/Input';
import { useWalletStore, useActiveAccount } from '@ui/store/wallet.store';
import { sendMessage } from '@shared/messaging';
import { MESSAGE_TYPES, GITHUB_REPO, AUTO_LOCK_OPTIONS, OCTRA_CONFIG } from '@shared/constants';

type Modal = 'none' | 'add' | 'import' | 'export' | 'password' | 'lock' | 'rename';
type ImportTab = 'key' | 'mnemonic';

export default function Settings() {
  const navigate = useNavigate();
  const activeAccount = useActiveAccount();
  const { accounts, setActiveAccountIndex, addAccount, removeAccount, renameAccount, setLocked, showToast } = useWalletStore();

  // Rename state
  const [renameAccountIndex, setRenameAccountIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Delete state
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  const [modal, setModal] = useState<Modal>('none');
  const [importTab, setImportTab] = useState<ImportTab>('key');
  const [accountName, setAccountName] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [exportedKey, setExportedKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Password state
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVerified, setPasswordVerified] = useState(false);

  // Auto-lock state
  const [autoLockTimeout, setAutoLockTimeout] = useState(15);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // RPC state
  const [rpcUrl, setRpcUrl] = useState<string>(OCTRA_CONFIG.RPC_URL);
  const [rpcInput, setRpcInput] = useState<string>('');
  const [showRpcEdit, setShowRpcEdit] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      // Load auto-lock
      const autoLockResponse = await sendMessage<void, number>(MESSAGE_TYPES.GET_AUTO_LOCK_TIMEOUT);
      if (autoLockResponse.success && autoLockResponse.data !== undefined) {
        setAutoLockTimeout(autoLockResponse.data);
      }

      // Load RPC URL
      const rpcResponse = await sendMessage<void, string>(MESSAGE_TYPES.GET_RPC_URL);
      if (rpcResponse.success && rpcResponse.data) {
        setRpcUrl(rpcResponse.data);
        setRpcInput(rpcResponse.data);
      }
    };
    loadSettings();
  }, []);

  const handleAutoLockChange = async (value: number) => {
    setAutoLockTimeout(value);
    await sendMessage<{ timeout: number }, void>(MESSAGE_TYPES.SET_AUTO_LOCK_TIMEOUT, { timeout: value });
    showToast(value === 0 ? 'Auto-lock disabled' : `Auto-lock: ${AUTO_LOCK_OPTIONS.find(o => o.value === value)?.label}`, 'success');
  };

  const handleSaveRpc = async () => {
    if (!rpcInput.trim()) return;

    try {
      await sendMessage<{ url: string }, void>(MESSAGE_TYPES.SET_RPC_URL, { url: rpcInput.trim() });
      setRpcUrl(rpcInput.trim());
      setShowRpcEdit(false);
      showToast('RPC URL saved', 'success');
    } catch {
      showToast('Failed to save RPC URL', 'error');
    }
  };

  const handleResetRpc = async () => {
    await sendMessage<{ url: string }, void>(MESSAGE_TYPES.SET_RPC_URL, { url: OCTRA_CONFIG.RPC_URL });
    setRpcUrl(OCTRA_CONFIG.RPC_URL);
    setRpcInput(OCTRA_CONFIG.RPC_URL);
    setShowRpcEdit(false);
    showToast('RPC URL reset to default', 'success');
  };

  const closeModal = () => {
    setModal('none');
    setAccountName('');
    setPrivateKey('');
    setMnemonic('');
    setExportedKey('');
    setError('');
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordVerified(false);
    setRenameAccountIndex(null);
    setRenameValue('');
  };

  const handleOpenRename = (index: number, currentName: string) => {
    setRenameAccountIndex(index);
    setRenameValue(currentName);
    setModal('rename');
  };

  const handleRenameAccount = () => {
    if (renameAccountIndex === null || !renameValue.trim()) return;

    const newName = renameValue.trim();
    const index = renameAccountIndex;

    // Instant UI update
    renameAccount(index, newName);
    showToast('Account renamed', 'success');
    closeModal();

    // Background sync (fire and forget)
    sendMessage<{ index: number; name: string }, void>(
      MESSAGE_TYPES.RENAME_ACCOUNT,
      { index, name: newName }
    );
  };

  const handleDeleteAccount = (index: number) => {
    if (accounts.length <= 1) {
      showToast('Cannot delete last account', 'error');
      return;
    }

    removeAccount(index);
    setDeletingIndex(null);
    sendMessage<{ index: number }, void>(MESSAGE_TYPES.REMOVE_ACCOUNT, { index });
    showToast('Account removed', 'success');
  };

  const handleSelectAccount = async (index: number) => {
    setActiveAccountIndex(index);
    await sendMessage<{ index: number }, void>(MESSAGE_TYPES.SET_ACTIVE_ACCOUNT, { index });
    showToast('Account switched', 'success');
  };

  const handleAddAccount = async () => {
    setLoading(true);
    try {
      const response = await sendMessage<
        { name?: string },
        { index: number; name: string; address: string; publicKey: string }
      >(MESSAGE_TYPES.ADD_ACCOUNT, {
        name: accountName || undefined,
      });

      if (response.success && response.data) {
        addAccount(response.data);
        showToast('Account created', 'success');
        closeModal();
      } else {
        showToast(response.error || 'Failed', 'error');
      }
    } catch {
      showToast('Failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImportAccount = async () => {
    setError('');

    if (importTab === 'key' && !privateKey.trim()) {
      setError('Private key required');
      return;
    }

    if (importTab === 'mnemonic' && !mnemonic.trim()) {
      setError('Mnemonic required');
      return;
    }

    setLoading(true);
    try {
      const payload = importTab === 'key'
        ? { privateKey: privateKey.trim(), name: accountName || undefined }
        : { mnemonic: mnemonic.trim(), name: accountName || undefined };

      const response = await sendMessage<
        { privateKey?: string; mnemonic?: string; name?: string },
        { index: number; name: string; address: string; publicKey: string }
      >(MESSAGE_TYPES.IMPORT_ACCOUNT, payload);

      if (response.success && response.data) {
        addAccount(response.data);
        showToast('Account imported', 'success');
        closeModal();
      } else {
        setError(response.error || 'Invalid format');
      }
    } catch {
      setError('Failed to import');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPassword = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await sendMessage<{ password: string }, boolean>(
        MESSAGE_TYPES.VERIFY_PASSWORD,
        { password }
      );

      if (response.success && response.data) {
        setPasswordVerified(true);
      } else {
        setError('Incorrect password');
      }
    } catch {
      setError('Failed to verify');
    } finally {
      setLoading(false);
    }
  };

  const handleExportKey = async () => {
    if (!activeAccount) return;
    if (!passwordVerified) return;

    setLoading(true);
    try {
      const response = await sendMessage<{ index: number }, string>(
        MESSAGE_TYPES.EXPORT_PRIVATE_KEY,
        { index: activeAccount.index }
      );

      if (response.success && response.data) {
        setExportedKey(response.data);
      } else {
        showToast('Failed', 'error');
      }
    } catch {
      showToast('Failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(exportedKey);
      showToast('Copied', 'success');
    } catch {
      showToast('Failed', 'error');
    }
  };

  const handleChangePassword = async () => {
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasLowercase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (!hasUppercase || !hasLowercase || !hasNumber) {
      setError('Password must contain uppercase, lowercase and numbers');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await sendMessage<{ oldPassword: string; newPassword: string }, void>(
        MESSAGE_TYPES.CHANGE_PASSWORD,
        { oldPassword: password, newPassword }
      );

      if (response.success) {
        showToast('Password changed', 'success');
        closeModal();
      } else {
        setError(response.error || 'Failed');
      }
    } catch {
      setError('Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLock = async () => {
    await sendMessage(MESSAGE_TYPES.LOCK_WALLET, {});
    setLocked(true);
    navigate('/unlock');
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 10)}...${addr.slice(-6)}`;
  };

  // Modal: Create Account
  if (modal === 'add') {
    return (
      <div className="flex flex-col h-screen bg-bg-primary">
        <header style={{ padding: '16px' }} className="flex items-center gap-4">
          <button onClick={closeModal} style={{ padding: '8px' }} className="hover:bg-bg-hover">
            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold uppercase tracking-wider">Create Account</h1>
        </header>

        <div style={{ padding: '0 16px' }} className="flex-1">
          <Input
            label="ACCOUNT NAME (OPTIONAL)"
            placeholder="My Account"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />
        </div>

        <div style={{ padding: '16px' }}>
          <Button onClick={handleAddAccount} loading={loading} className="w-full">
            CREATE ACCOUNT
          </Button>
        </div>
      </div>
    );
  }

  // Modal: Import Account
  if (modal === 'import') {
    return (
      <div className="flex flex-col h-screen bg-bg-primary">
        <header style={{ padding: '16px' }} className="flex items-center gap-4">
          <button onClick={closeModal} style={{ padding: '8px' }} className="hover:bg-bg-hover">
            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold uppercase tracking-wider">Import Account</h1>
        </header>

        <div style={{ margin: '0 16px 16px 16px', display: 'flex' }} className="border border-border-primary">
          <button
            onClick={() => { setImportTab('key'); setError(''); }}
            style={{ flex: 1, padding: '12px' }}
            className={`text-sm font-semibold uppercase tracking-wider transition-colors ${
              importTab === 'key' ? 'bg-octra-blue text-white' : 'hover:bg-bg-hover'
            }`}
          >
            Private Key
          </button>
          <button
            onClick={() => { setImportTab('mnemonic'); setError(''); }}
            style={{ flex: 1, padding: '12px' }}
            className={`text-sm font-semibold uppercase tracking-wider transition-colors ${
              importTab === 'mnemonic' ? 'bg-octra-blue text-white' : 'hover:bg-bg-hover'
            }`}
          >
            Mnemonic
          </button>
        </div>

        <div style={{ padding: '0 16px' }} className="flex-1 space-y-4 overflow-y-auto">
          <Input
            label="ACCOUNT NAME (OPTIONAL)"
            placeholder="Imported Account"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />

          {importTab === 'key' ? (
            <div>
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 block">
                Private Key (Base64 or Hex)
              </label>
              <textarea
                style={{ padding: '14px', minHeight: '100px' }}
                className={`w-full bg-bg-secondary border text-text-primary font-mono text-sm resize-none ${error ? 'border-accent-red' : 'border-border-primary focus:border-octra-blue'} outline-none`}
                placeholder="Paste private key"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 block">
                Mnemonic Phrase (12 or 24 words)
              </label>
              <textarea
                style={{ padding: '14px', minHeight: '100px' }}
                className={`w-full bg-bg-secondary border text-text-primary font-mono text-sm resize-none ${error ? 'border-accent-red' : 'border-border-primary focus:border-octra-blue'} outline-none`}
                placeholder="Enter mnemonic phrase"
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
              />
            </div>
          )}

          {error && <p className="text-sm text-accent-red">{error}</p>}
        </div>

        <div style={{ padding: '16px' }}>
          <Button onClick={handleImportAccount} loading={loading} className="w-full">
            IMPORT ACCOUNT
          </Button>
        </div>
      </div>
    );
  }

  // Modal: Export Key
  if (modal === 'export') {
    return (
      <div className="flex flex-col h-screen bg-bg-primary">
        <header style={{ padding: '16px' }} className="flex items-center gap-4">
          <button onClick={closeModal} style={{ padding: '8px' }} className="hover:bg-bg-hover">
            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold uppercase tracking-wider">Export Key</h1>
        </header>

        <div style={{ padding: '0 16px' }} className="flex-1">
          <div style={{ padding: '16px', marginBottom: '16px' }} className="border-2 border-accent-red">
            <div className="text-accent-red font-semibold uppercase text-sm mb-1">WARNING</div>
            <p className="text-sm text-text-secondary">
              Never share your private key. Anyone with it can steal your funds.
            </p>
          </div>

          {!passwordVerified && !exportedKey && (
            <div className="space-y-4">
              <Input
                label="ENTER PASSWORD"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={error}
              />
            </div>
          )}

          {exportedKey && (
            <div>
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 block">
                Private Key (Base64)
              </label>
              <div style={{ padding: '16px' }} className="bg-bg-secondary border border-border-primary">
                <p className="font-mono text-sm text-accent-red break-all">{exportedKey}</p>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '16px' }}>
          {!passwordVerified && !exportedKey ? (
            <Button onClick={handleVerifyPassword} loading={loading} className="w-full">
              VERIFY PASSWORD
            </Button>
          ) : !exportedKey ? (
            <Button onClick={handleExportKey} loading={loading} variant="danger" className="w-full">
              REVEAL PRIVATE KEY
            </Button>
          ) : (
            <Button onClick={handleCopyKey} className="w-full">
              COPY TO CLIPBOARD
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Modal: Change Password
  if (modal === 'password') {
    return (
      <div className="flex flex-col h-screen bg-bg-primary">
        <header style={{ padding: '16px' }} className="flex items-center gap-4">
          <button onClick={closeModal} style={{ padding: '8px' }} className="hover:bg-bg-hover">
            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold uppercase tracking-wider">Change Password</h1>
        </header>

        <div style={{ padding: '0 16px' }} className="flex-1 space-y-4">
          <Input
            label="CURRENT PASSWORD"
            type="password"
            placeholder="Enter current password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Input
            label="NEW PASSWORD"
            type="password"
            placeholder="Aa1... (8+ chars)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            hint="8+ chars with uppercase, lowercase & numbers"
          />

          <Input
            label="CONFIRM NEW PASSWORD"
            type="password"
            placeholder="Repeat new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {error && <p className="text-sm text-accent-red">{error}</p>}
        </div>

        <div style={{ padding: '16px' }}>
          <Button onClick={handleChangePassword} loading={loading} className="w-full">
            CHANGE PASSWORD
          </Button>
        </div>
      </div>
    );
  }

  // Modal: Rename Account
  if (modal === 'rename') {
    return (
      <div className="flex flex-col h-screen bg-bg-primary">
        <header style={{ padding: '16px' }} className="flex items-center gap-4">
          <button onClick={closeModal} style={{ padding: '8px' }} className="hover:bg-bg-hover">
            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold uppercase tracking-wider">Rename Account</h1>
        </header>

        <div style={{ padding: '0 16px' }} className="flex-1">
          <Input
            label="ACCOUNT NAME"
            placeholder="My Account"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameAccount();
              if (e.key === 'Escape') closeModal();
            }}
          />
        </div>

        <div style={{ padding: '16px' }}>
          <Button onClick={handleRenameAccount} loading={loading} className="w-full">
            SAVE
          </Button>
        </div>
      </div>
    );
  }

  // Main Settings
  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      <header style={{ padding: '16px' }} className="flex items-center gap-4">
        <button onClick={() => navigate('/dashboard')} style={{ padding: '8px' }} className="hover:bg-bg-hover">
          <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold uppercase tracking-wider">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Accounts Section */}
        <div style={{ padding: '0 16px 16px 16px' }}>
          {/* Header with buttons */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Accounts ({accounts.length})
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setModal('add')}
                className="text-xs font-semibold text-octra-blue hover:underline uppercase tracking-wider"
              >
                + CREATE
              </button>
              <span className="text-text-tertiary">|</span>
              <button
                onClick={() => setModal('import')}
                className="text-xs font-semibold text-octra-blue hover:underline uppercase tracking-wider"
              >
                + IMPORT
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <svg
              style={{ width: '16px', height: '16px', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
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
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '10px 12px 10px 36px' }}
              className="w-full bg-bg-secondary border border-border-primary text-sm text-text-primary placeholder-text-tertiary focus:border-octra-blue focus:outline-none"
            />
          </div>

          {/* Scrollable account list */}
          <div style={{ maxHeight: '140px' }} className="overflow-y-auto space-y-1">
            {accounts
              .filter((account) =>
                searchQuery === '' ||
                account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                account.address.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((account) => (
                <div
                  key={account.index}
                  style={{ padding: '8px 10px' }}
                  className={`w-full flex items-center gap-2 border transition-colors ${
                    account.index === activeAccount?.index
                      ? 'border-octra-blue bg-octra-blue/10'
                      : 'border-border-primary'
                  }`}
                >
                  <button
                    onClick={() => handleSelectAccount(account.index)}
                    className="flex items-center gap-2 flex-1 min-w-0"
                  >
                    <div style={{ width: '32px', height: '32px' }} className="bg-octra-blue flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {account.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-xs font-semibold truncate">{account.name}</div>
                      <div className="text-xs font-mono text-text-tertiary truncate">{truncateAddress(account.address)}</div>
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenRename(account.index, account.name); }}
                    className="p-1 hover:bg-bg-hover transition-colors flex-shrink-0"
                    title="Rename"
                  >
                    <svg style={{ width: '14px', height: '14px' }} className="text-text-tertiary hover:text-octra-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  {accounts.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingIndex(account.index); }}
                      className="p-1 hover:bg-bg-hover transition-colors flex-shrink-0"
                      title="Delete"
                    >
                      <svg style={{ width: '14px', height: '14px' }} className="text-text-tertiary hover:text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                  {account.index === activeAccount?.index && (
                    <svg className="w-4 h-4 text-octra-blue flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              ))}
            {accounts.filter((account) =>
              searchQuery === '' ||
              account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              account.address.toLowerCase().includes(searchQuery.toLowerCase())
            ).length === 0 && (
              <div className="text-center text-text-tertiary text-sm py-4">
                No accounts found
              </div>
            )}
          </div>
        </div>

        {/* Security Section */}
        <div style={{ padding: '0 16px 16px 16px' }}>
          <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
            Security
          </h2>
          <div className="space-y-2">
            {/* Auto-lock Setting */}
            <div
              style={{ padding: '16px' }}
              className="w-full border border-border-primary"
            >
              <div className="flex items-center gap-3 mb-3">
                <svg style={{ width: '20px', height: '20px' }} className="text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold text-sm uppercase tracking-wider">Auto-lock</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {AUTO_LOCK_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleAutoLockChange(option.value)}
                    style={{ padding: '8px 4px' }}
                    className={`text-xs font-semibold transition-colors ${
                      autoLockTimeout === option.value
                        ? 'bg-octra-blue text-white'
                        : 'bg-bg-secondary hover:bg-bg-hover text-text-secondary'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setModal('password')}
              style={{ padding: '16px' }}
              className="w-full flex items-center justify-between border border-border-primary hover:border-octra-blue transition-colors"
            >
              <div className="flex items-center gap-3">
                <svg style={{ width: '20px', height: '20px' }} className="text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="font-semibold text-sm uppercase tracking-wider">Change Password</span>
              </div>
              <svg style={{ width: '20px', height: '20px' }} className="text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              onClick={() => setModal('export')}
              style={{ padding: '16px' }}
              className="w-full flex items-center justify-between border border-border-primary hover:border-octra-blue transition-colors"
            >
              <div className="flex items-center gap-3">
                <svg style={{ width: '20px', height: '20px' }} className="text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span className="font-semibold text-sm uppercase tracking-wider">Export Private Key</span>
              </div>
              <svg style={{ width: '20px', height: '20px' }} className="text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              onClick={handleLock}
              style={{ padding: '16px' }}
              className="w-full flex items-center justify-between border border-border-primary hover:border-octra-blue transition-colors"
            >
              <div className="flex items-center gap-3">
                <svg style={{ width: '20px', height: '20px' }} className="text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="font-semibold text-sm uppercase tracking-wider">Lock Wallet</span>
              </div>
              <svg style={{ width: '20px', height: '20px' }} className="text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Network */}
        <div style={{ padding: '0 16px 16px 16px' }}>
          <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
            Network
          </h2>
          <div style={{ padding: '16px' }} className="border border-border-primary space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg style={{ width: '20px', height: '20px' }} className="text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <span className="font-semibold text-sm uppercase tracking-wider">RPC URL</span>
              </div>
              <button
                onClick={() => setShowRpcEdit(!showRpcEdit)}
                className="text-xs text-octra-blue hover:underline uppercase tracking-wider"
              >
                {showRpcEdit ? 'CANCEL' : 'EDIT'}
              </button>
            </div>

            {showRpcEdit ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={rpcInput}
                  onChange={(e) => setRpcInput(e.target.value)}
                  placeholder="https://..."
                  style={{ padding: '10px 12px' }}
                  className="w-full bg-bg-secondary border border-border-primary text-sm text-text-primary font-mono focus:border-octra-blue focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleResetRpc}
                    style={{ padding: '8px 12px' }}
                    className="text-xs font-semibold text-text-secondary hover:text-text-primary uppercase tracking-wider"
                  >
                    RESET
                  </button>
                  <button
                    onClick={handleSaveRpc}
                    style={{ padding: '8px 16px' }}
                    className="bg-octra-blue text-white text-xs font-semibold uppercase tracking-wider hover:bg-octra-blue-hover"
                  >
                    SAVE
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm font-mono text-text-tertiary break-all">
                {rpcUrl}
              </div>
            )}
          </div>
        </div>

        {/* About */}
        <div style={{ padding: '0 16px 16px 16px' }}>
          <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
            About
          </h2>
          <div style={{ padding: '16px' }} className="border border-border-primary space-y-3">
            <div>
              <div className="text-octra-blue font-bold uppercase tracking-wider">Octra Wallet</div>
              <div className="text-text-tertiary text-sm">v1.0.0</div>
            </div>
            <div className="text-xs text-text-tertiary">
              AES-256-GCM encryption with 2M PBKDF2 iterations
            </div>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-octra-blue hover:underline"
            >
              <svg style={{ width: '18px', height: '18px' }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingIndex !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div style={{ margin: '16px', padding: '20px' }} className="bg-bg-primary border border-border-primary max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-2">Delete Account?</h3>
            <p className="text-text-secondary text-sm mb-4">
              This will remove the account from your wallet. Make sure you have backed up the private key.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setDeletingIndex(null)}
                className="flex-1"
              >
                CANCEL
              </Button>
              <button
                onClick={() => handleDeleteAccount(deletingIndex)}
                style={{ padding: '12px' }}
                className="flex-1 bg-accent-red text-white font-semibold hover:bg-accent-red/80 transition-colors"
              >
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
