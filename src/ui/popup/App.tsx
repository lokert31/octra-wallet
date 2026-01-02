import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useWalletStore } from '@ui/store/wallet.store';
import { sendMessage } from '@shared/messaging';
import { MESSAGE_TYPES } from '@shared/constants';

// Pages
import Welcome from '@ui/pages/Welcome';
import CreateWallet from '@ui/pages/Welcome/CreateWallet';
import ImportWallet from '@ui/pages/Welcome/ImportWallet';
import Unlock from '@ui/pages/Unlock';
import Dashboard from '@ui/pages/Dashboard';
import Send from '@ui/pages/Send';
import SendPrivate from '@ui/pages/SendPrivate';
import PendingTransfers from '@ui/pages/PendingTransfers';
import Receive from '@ui/pages/Receive';
import History from '@ui/pages/History';
import Settings from '@ui/pages/Settings';
import Accounts from '@ui/pages/Accounts';

// Components
import { Toast } from '@ui/components/common/Toast';
import { Spinner } from '@ui/components/common/Spinner';

function App() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { isInitialized, isLocked, setInitialized, setLocked, setAccounts, setActiveAccountIndex, loadPendingTransactions } = useWalletStore();

  useEffect(() => {
    checkWalletStatus();
  }, []);

  const checkWalletStatus = async () => {
    try {
      const response = await sendMessage<void, { isInitialized: boolean; isLocked: boolean }>(
        MESSAGE_TYPES.GET_LOCK_STATUS
      );

      if (response.success && response.data) {
        setInitialized(response.data.isInitialized);
        setLocked(response.data.isLocked);

        if (!response.data.isInitialized) {
          navigate('/welcome');
        } else if (response.data.isLocked) {
          // Wallet exists but locked - need password
          navigate('/unlock');
        } else {
          // Wallet unlocked - fetch accounts, active account, and pending transactions
          const [accountsResponse, activeAccountResponse] = await Promise.all([
            sendMessage<void, unknown[]>(MESSAGE_TYPES.GET_ACCOUNTS),
            sendMessage<void, number>(MESSAGE_TYPES.GET_ACTIVE_ACCOUNT),
          ]);

          if (accountsResponse.success && accountsResponse.data) {
            setAccounts(accountsResponse.data as never[]);
          }

          if (activeAccountResponse.success && activeAccountResponse.data !== undefined) {
            setActiveAccountIndex(activeAccountResponse.data);
          }

          // Load pending transactions from storage
          await loadPendingTransactions();

          navigate('/dashboard');
        }
      }
    } catch (error) {
      console.error('Failed to check wallet status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <Routes>
        {/* Onboarding */}
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/create" element={<CreateWallet />} />
        <Route path="/import" element={<ImportWallet />} />
        <Route path="/unlock" element={<Unlock />} />

        {/* Main */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/send" element={<Send />} />
        <Route path="/send-private" element={<SendPrivate />} />
        <Route path="/pending-transfers" element={<PendingTransfers />} />
        <Route path="/receive" element={<Receive />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />

        {/* Default redirect */}
        <Route
          path="*"
          element={<Navigate to={!isInitialized ? '/welcome' : (isLocked ? '/unlock' : '/dashboard')} />}
        />
      </Routes>

      <Toast />
    </div>
  );
}

export default App;
