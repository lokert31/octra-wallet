import { useNavigate } from 'react-router-dom';
import { Button } from '@ui/components/common/Button';

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      {/* Header with logo - blue ring */}
      <div style={{ padding: '20px', paddingLeft: '24px' }} className="flex items-center gap-3">
        <div style={{ width: '56px', height: '56px', borderWidth: '5px', borderStyle: 'solid', borderColor: '#0033FF', borderRadius: '50%' }}></div>
        <span className="text-xl font-bold tracking-wide">OCTRA</span>
      </div>

      {/* Blue accent box - with margins */}
      <div className="mx-4" style={{ marginTop: '20px' }}>
        <div className="accent-box">
          <div className="text-3xl font-bold mb-1">WALLET</div>
          <div className="text-sm opacity-80">Secure wallet for Octra Network</div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-4">
        <h2 className="text-xl font-bold mb-2 lowercase">
          octra is universal encrypted
          <br />
          compute for blockchain
        </h2>
        <p className="text-text-secondary text-sm">
          FHE Blockchain Technology
        </p>
      </div>

      {/* Action buttons - with margins like on website */}
      <div style={{ padding: '24px', paddingTop: '0' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Button onClick={() => navigate('/create')} className="flex-1 py-4">
            CREATE WALLET
          </Button>
          <Button onClick={() => navigate('/import')} className="flex-1 py-4">
            IMPORT WALLET
          </Button>
        </div>
      </div>
    </div>
  );
}
