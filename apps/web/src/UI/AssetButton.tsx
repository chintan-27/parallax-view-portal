interface AssetButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export function AssetButton({ onClick, isOpen }: AssetButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '60px',
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        backgroundColor: isOpen ? '#6366f1' : 'rgba(10, 10, 21, 0.9)',
        border: '1px solid #333',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        transition: 'background-color 0.2s',
      }}
      title="Load Assets (A)"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={isOpen ? '#fff' : '#888'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Folder with plus icon */}
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        <line x1="12" y1="11" x2="12" y2="17" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    </button>
  );
}
