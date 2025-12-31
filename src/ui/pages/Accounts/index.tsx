import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore, useActiveAccount } from '@ui/store/wallet.store';
import { sendMessage } from '@shared/messaging';
import { MESSAGE_TYPES, OCTRA_CONFIG } from '@shared/constants';
import { Button } from '@ui/components/common/Button';
import { Input } from '@ui/components/common/Input';

type View = 'list' | 'add' | 'import-mnemonic' | 'import-key';

export default function Accounts() {
  const navigate = useNavigate();
  const activeAccount = useActiveAccount();
  const { accounts, setActiveAccountIndex, addAccount, removeAccount, renameAccount, updateBalance, balances, showToast } = useWalletStore();

  const [view, setView] = useState<View>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Import state
  const [privateKey, setPrivateKey] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [accountName, setAccountName] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [pasteSuccess, setPasteSuccess] = useState(false);

  // Rename state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  // Delete confirmation
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  // Fetch all balances on mount
  useEffect(() => {
    fetchAllBalances();
  }, []);

  const fetchAllBalances = async () => {
    await Promise.all(
      accounts.map(async (account) => {
        try {
          const response = await sendMessage<{ address: string }, { balance: string }>(
            MESSAGE_TYPES.GET_BALANCE,
            { address: account.address }
          );
          if (response.success && response.data) {
            updateBalance(account.address, response.data.balance);
          }
        } catch {}
      })
    );
  };

  const filteredAccounts = accounts.filter((acc) =>
    searchQuery === '' ||
    acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    acc.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `#${acc.index}`.includes(searchQuery.toLowerCase())
  );

  const handleSelectAccount = async (index: number) => {
    setActiveAccountIndex(index);
    await sendMessage<{ index: number }, void>(MESSAGE_TYPES.SET_ACTIVE_ACCOUNT, { index });
    navigate('/dashboard');
  };

  const handleCopyAddress = async (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      showToast('Address copied', 'success');
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  const handleStartRename = (index: number, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingIndex(index);
    setEditName(name);
  };

  const handleSaveRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingIndex === null || !editName.trim()) return;

    const newName = editName.trim();
    const index = editingIndex;

    // Instant UI update
    renameAccount(index, newName);
    setEditingIndex(null);
    setEditName('');

    // Background sync (fire and forget)
    sendMessage<{ index: number; name: string }, void>(
      MESSAGE_TYPES.RENAME_ACCOUNT,
      { index, name: newName }
    );
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingIndex(null);
    setEditName('');
  };

  const handleDeleteAccount = async (index: number) => {
    if (accounts.length <= 1) {
      showToast('Cannot delete last account', 'error');
      return;
    }

    removeAccount(index);
    setDeletingIndex(null);

    // Background sync
    sendMessage<{ index: number }, void>(MESSAGE_TYPES.REMOVE_ACCOUNT, { index });
    showToast('Account removed', 'success');
  };

  const handlePaste = async (type: 'key' | 'mnemonic') => {
    try {
      const text = await navigator.clipboard.readText();
      if (type === 'key') {
        setPrivateKey(text);
      } else {
        setMnemonic(text);
      }
      setPasteSuccess(true);
      setTimeout(() => setPasteSuccess(false), 2000);
    } catch {
      showToast('Failed to paste', 'error');
    }
  };

  const handleImport = async () => {
    const isKey = view === 'import-key';
    const value = isKey ? privateKey : mnemonic;

    if (!value.trim()) {
      showToast(isKey ? 'Private key required' : 'Mnemonic required', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = isKey
        ? { privateKey: value.trim(), name: accountName || undefined }
        : { mnemonic: value.trim(), name: accountName || undefined };

      const response = await sendMessage<
        { privateKey?: string; mnemonic?: string; name?: string },
        { index: number; name: string; address: string; publicKey: string }
      >(MESSAGE_TYPES.IMPORT_ACCOUNT, payload);

      if (response.success && response.data) {
        addAccount(response.data);
        showToast('Account imported', 'success');
        resetImportState();
        setView('list');
      } else {
        showToast(response.error || 'Invalid format', 'error');
      }
    } catch {
      showToast('Failed to import', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async () => {
    setLoading(true);
    try {
      const response = await sendMessage<
        { name?: string },
        { index: number; name: string; address: string; publicKey: string }
      >(MESSAGE_TYPES.ADD_ACCOUNT, { name: accountName || undefined });

      if (response.success && response.data) {
        addAccount(response.data);
        showToast('Account created', 'success');
        resetImportState();
        setView('list');
      } else {
        showToast(response.error || 'Failed', 'error');
      }
    } catch {
      showToast('Failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetImportState = () => {
    setPrivateKey('');
    setMnemonic('');
    setAccountName('');
    setShowSecret(false);
  };

  const formatBalance = (bal: string | undefined) => {
    if (!bal) return '0.00';
    const num = parseFloat(bal);
    if (isNaN(num)) return '0.00';
    if (num === 0) return '0.00';
    if (num < 0.01) return num.toFixed(6);
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;

  // Add Account Options View
  if (view === 'add') {
    return (
      <div className="flex flex-col h-screen bg-bg-primary">
        <header style={{ padding: '16px' }} className="flex items-center gap-4">
          <button onClick={() => setView('list')} style={{ padding: '8px' }} className="hover:bg-bg-hover">
            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold uppercase tracking-wider">Add Account</h1>
        </header>

        <div style={{ padding: '0 16px' }} className="flex-1 space-y-3">
          {/* Create New */}
          <button
            onClick={() => { resetImportState(); handleAddAccount(); }}
            style={{ padding: '16px' }}
            className="w-full flex items-center gap-4 border border-border-primary hover:border-octra-blue transition-colors"
          >
            <div style={{ width: '40px', height: '40px' }} className="bg-octra-blue/20 flex items-center justify-center">
              <svg style={{ width: '20px', height: '20px' }} className="text-octra-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="text-left">
              <div className="font-semibold">Create New Account</div>
              <div className="text-sm text-text-tertiary">Generate a new address</div>
            </div>
            <svg style={{ width: '20px', height: '20px' }} className="ml-auto text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Import Seed Phrase */}
          <button
            onClick={() => { resetImportState(); setView('import-mnemonic'); }}
            style={{ padding: '16px' }}
            className="w-full flex items-center gap-4 border border-border-primary hover:border-octra-blue transition-colors"
          >
            <div style={{ width: '40px', height: '40px' }} className="bg-bg-secondary flex items-center justify-center">
              <svg style={{ width: '20px', height: '20px' }} className="text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-left">
              <div className="font-semibold">Import Seed Phrase</div>
              <div className="text-sm text-text-tertiary">12 or 24 word mnemonic</div>
            </div>
            <svg style={{ width: '20px', height: '20px' }} className="ml-auto text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Import Private Key */}
          <button
            onClick={() => { resetImportState(); setView('import-key'); }}
            style={{ padding: '16px' }}
            className="w-full flex items-center gap-4 border border-border-primary hover:border-octra-blue transition-colors"
          >
            <div style={{ width: '40px', height: '40px' }} className="bg-bg-secondary flex items-center justify-center">
              <svg style={{ width: '20px', height: '20px' }} className="text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div className="text-left">
              <div className="font-semibold">Import Private Key</div>
              <div className="text-sm text-text-tertiary">Base64 or Hex format</div>
            </div>
            <svg style={{ width: '20px', height: '20px' }} className="ml-auto text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Import Mnemonic View
  if (view === 'import-mnemonic') {
    return (
      <div className="flex flex-col h-screen bg-bg-primary">
        <header style={{ padding: '16px' }} className="flex items-center gap-4">
          <button onClick={() => setView('add')} style={{ padding: '8px' }} className="hover:bg-bg-hover">
            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold uppercase tracking-wider">Import Seed Phrase</h1>
        </header>

        <div style={{ padding: '0 16px' }} className="flex-1 space-y-4">
          {/* Paste success notification */}
          {pasteSuccess && (
            <div style={{ padding: '10px 14px' }} className="bg-accent-green/20 border border-accent-green text-accent-green text-sm">
              Successfully pasted!
            </div>
          )}

          <Input
            label="ACCOUNT NAME (OPTIONAL)"
            placeholder="Imported Account"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Seed Phrase
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePaste('mnemonic')}
                  className="text-xs text-octra-blue hover:underline uppercase tracking-wider"
                >
                  PASTE
                </button>
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-xs text-octra-blue hover:underline uppercase tracking-wider"
                >
                  {showSecret ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>
            <textarea
              style={{
                padding: '14px',
                WebkitTextSecurity: showSecret ? 'none' : 'disc',
              } as React.CSSProperties}
              className="w-full bg-bg-secondary border border-border-primary h-28 resize-none font-mono text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-octra-blue"
              placeholder="Enter your 12 or 24 word seed phrase"
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
            />
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          <Button onClick={handleImport} loading={loading} className="w-full">
            IMPORT
          </Button>
        </div>
      </div>
    );
  }

  // Import Private Key View
  if (view === 'import-key') {
    return (
      <div className="flex flex-col h-screen bg-bg-primary">
        <header style={{ padding: '16px' }} className="flex items-center gap-4">
          <button onClick={() => setView('add')} style={{ padding: '8px' }} className="hover:bg-bg-hover">
            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold uppercase tracking-wider">Import Private Key</h1>
        </header>

        <div style={{ padding: '0 16px' }} className="flex-1 space-y-4">
          {/* Paste success notification */}
          {pasteSuccess && (
            <div style={{ padding: '10px 14px' }} className="bg-accent-green/20 border border-accent-green text-accent-green text-sm">
              Successfully pasted!
            </div>
          )}

          <Input
            label="ACCOUNT NAME (OPTIONAL)"
            placeholder="Imported Account"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Private Key
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePaste('key')}
                  className="text-xs text-octra-blue hover:underline uppercase tracking-wider"
                >
                  PASTE
                </button>
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-xs text-octra-blue hover:underline uppercase tracking-wider"
                >
                  {showSecret ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>
            <textarea
              style={{
                padding: '14px',
                WebkitTextSecurity: showSecret ? 'none' : 'disc',
              } as React.CSSProperties}
              className="w-full bg-bg-secondary border border-border-primary h-24 resize-none font-mono text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-octra-blue"
              placeholder="Base64 or Hex format"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
            />
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          <Button onClick={handleImport} loading={loading} className="w-full">
            IMPORT
          </Button>
        </div>
      </div>
    );
  }

  // Main Account List View
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
          <h1 className="text-lg font-semibold uppercase tracking-wider">Accounts</h1>
        </div>
        <button
          onClick={() => setView('add')}
          style={{ padding: '8px' }}
          className="hover:bg-bg-hover text-octra-blue"
        >
          <svg style={{ width: '24px', height: '24px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </header>

      {/* Active Account Highlight */}
      {activeAccount && (
        <div style={{ margin: '0 16px 16px 16px', padding: '16px' }} className="bg-octra-blue">
          <div className="flex items-center gap-3">
            <div style={{ width: '48px', height: '48px' }} className="bg-white/20 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {activeAccount.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold truncate">{activeAccount.name}</span>
                <span className="text-white font-bold text-lg ml-2 flex-shrink-0">
                  {formatBalance(balances[activeAccount.address])} <span className="text-sm font-normal opacity-80">{OCTRA_CONFIG.TOKEN_SYMBOL}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/70 font-mono text-sm truncate">{truncateAddress(activeAccount.address)}</span>
                <button
                  onClick={(e) => handleCopyAddress(activeAccount.address, e)}
                  className="text-white/70 hover:text-white flex-shrink-0"
                >
                  <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ padding: '0 16px', marginBottom: '12px' }} className="relative">
        <svg
          style={{ width: '16px', height: '16px', left: '28px', top: '50%', transform: 'translateY(-50%)' }}
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
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ padding: '12px 12px 12px 40px' }}
          className="w-full bg-bg-secondary border border-border-primary text-sm text-text-primary placeholder-text-tertiary focus:border-octra-blue focus:outline-none"
        />
      </div>

      {/* Account List */}
      <div style={{ padding: '0 16px' }} className="flex-1 overflow-y-auto space-y-2 pb-4">
        {filteredAccounts.map((account) => (
          <div
            key={account.index}
            onClick={() => handleSelectAccount(account.index)}
            style={{ padding: '14px' }}
            className={`flex items-center gap-3 border cursor-pointer transition-colors ${
              account.index === activeAccount?.index
                ? 'border-octra-blue bg-octra-blue/5'
                : 'border-border-primary hover:border-octra-blue'
            }`}
          >
            <div style={{ width: '40px', height: '40px' }} className="bg-octra-blue flex items-center justify-center text-white font-bold flex-shrink-0">
              {account.name.charAt(0).toUpperCase()}
            </div>

            {editingIndex === account.index ? (
              /* Edit mode - only input and save/cancel buttons */
              <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename(e as unknown as React.MouseEvent);
                    if (e.key === 'Escape') { setEditingIndex(null); setEditName(''); }
                  }}
                  style={{ padding: '6px 10px', maxWidth: '160px' }}
                  className="bg-bg-secondary border border-octra-blue text-sm focus:outline-none"
                  autoFocus
                />
                <button onClick={handleSaveRename} className="text-accent-green p-1">
                  <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button onClick={handleCancelRename} className="text-accent-red p-1">
                  <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              /* Normal view - two rows: name+balance, address */
              <div className="flex-1 min-w-0">
                {/* Row 1: Name + Balance */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-sm font-semibold truncate">{account.name}</span>
                    <button
                      onClick={(e) => handleStartRename(account.index, account.name, e)}
                      className="text-text-tertiary hover:text-octra-blue flex-shrink-0"
                    >
                      <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    {accounts.length > 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeletingIndex(account.index); }}
                        className="text-text-tertiary hover:text-accent-red flex-shrink-0"
                      >
                        <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <span className="text-sm font-semibold whitespace-nowrap">
                      {formatBalance(balances[account.address])} <span className="text-text-tertiary">{OCTRA_CONFIG.TOKEN_SYMBOL}</span>
                    </span>
                    {account.index === activeAccount?.index && (
                      <svg className="w-4 h-4 text-octra-blue" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
                {/* Row 2: Address */}
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono text-text-tertiary">{truncateAddress(account.address)}</span>
                  <button
                    onClick={(e) => handleCopyAddress(account.address, e)}
                    className="text-text-tertiary hover:text-octra-blue flex-shrink-0"
                  >
                    <svg style={{ width: '12px', height: '12px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {filteredAccounts.length === 0 && (
          <div className="text-center text-text-tertiary py-8">
            No accounts found
          </div>
        )}
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
