import { useAppStore } from '@/store';

interface WebcamPromptProps {
  onRequestPermission: () => void;
  error?: string | null;
  isLoading?: boolean;
}

export function WebcamPrompt({ onRequestPermission, error, isLoading }: WebcamPromptProps) {
  const webcamPermission = useAppStore((state) => state.webcamPermission);

  if (webcamPermission === 'granted') {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#1a1a2e',
          padding: '2rem',
          borderRadius: '12px',
          maxWidth: '400px',
          textAlign: 'center',
          border: '1px solid #333',
        }}
      >
        <h2 style={{ margin: '0 0 1rem', color: '#fff' }}>Camera Access Required</h2>
        <p style={{ margin: '0 0 1.5rem', color: '#aaa', lineHeight: 1.6 }}>
          This app uses your webcam for face tracking to create a parallax depth effect. Your camera
          feed is processed locally and never leaves your device.
        </p>

        {error && (
          <p
            style={{
              margin: '0 0 1rem',
              color: '#ef4444',
              fontSize: '0.9rem',
            }}
          >
            {error}
          </p>
        )}

        <button
          onClick={onRequestPermission}
          disabled={isLoading}
          style={{
            backgroundColor: '#6366f1',
            color: '#fff',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            fontSize: '1rem',
            cursor: isLoading ? 'wait' : 'pointer',
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? 'Requesting...' : 'Enable Camera'}
        </button>
      </div>
    </div>
  );
}
