interface TrackingStatusProps {
  isTracking: boolean;
  isLoading?: boolean;
}

export function TrackingStatus({ isTracking, isLoading }: TrackingStatusProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '8px',
        fontSize: '14px',
        color: '#fff',
        zIndex: 100,
      }}
    >
      <div
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: isLoading ? '#fbbf24' : isTracking ? '#22c55e' : '#ef4444',
          boxShadow: isTracking ? '0 0 8px #22c55e' : 'none',
        }}
      />
      <span>
        {isLoading ? 'Loading model...' : isTracking ? 'Tracking active' : 'No face detected'}
      </span>
    </div>
  );
}
