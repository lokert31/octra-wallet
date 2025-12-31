import { useNavigate } from 'react-router-dom';
import { useActiveAccount } from '@ui/store/wallet.store';

export function AccountSelector() {
  const navigate = useNavigate();
  const activeAccount = useActiveAccount();

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  if (!activeAccount) return null;

  return (
    <button
      onClick={() => navigate('/accounts')}
      style={{ padding: '10px 14px', gap: '12px' }}
      className="flex items-center border border-border-primary hover:border-octra-blue transition-colors"
    >
      {/* Avatar */}
      <div style={{ width: '40px', height: '40px', fontSize: '16px' }} className="bg-octra-blue flex items-center justify-center text-white font-bold">
        {activeAccount.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex flex-col items-start">
        <span style={{ fontSize: '15px' }} className="font-semibold">{activeAccount.name}</span>
        <span className="text-xs font-mono text-text-tertiary">
          {truncateAddress(activeAccount.address)}
        </span>
      </div>
      <svg
        className="w-5 h-5 text-text-tertiary"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
