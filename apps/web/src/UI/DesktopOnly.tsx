import { useEffect, useState } from 'react';

export function DesktopOnly({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Check for mobile device via user agent and screen size
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'mobile', 'tablet'];
      const isMobileUA = mobileKeywords.some((keyword) => userAgent.includes(keyword));
      const isSmallScreen = window.innerWidth < 768;

      setIsMobile(isMobileUA || isSmallScreen);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a15',
          color: '#fff',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            marginBottom: '24px',
            borderRadius: '16px',
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6366f1"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
        <h1 style={{ margin: '0 0 12px', fontSize: '24px', fontWeight: 600 }}>
          Desktop Required
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: '16px',
            color: '#888',
            maxWidth: '320px',
            lineHeight: 1.5,
          }}
        >
          This head-tracked parallax experience requires a desktop or laptop computer with a webcam.
        </p>
        <div
          style={{
            marginTop: '32px',
            padding: '16px',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            borderRadius: '12px',
            fontSize: '14px',
            color: '#666',
          }}
        >
          <strong style={{ color: '#6366f1' }}>Best experience:</strong>
          <br />
          Chrome, Safari, or Edge on a desktop
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
