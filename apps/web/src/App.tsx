import { useCallback, useEffect, useState } from 'react';
import { ThreeCanvas } from '@/Scene';
import {
  WebcamPrompt,
  TrackingStatus,
  DebugOverlay,
  SettingsPanel,
  SettingsButton,
  DesktopOnly,
} from '@/UI';
import { useWebcam } from '@/hooks/useWebcam';
import { useFaceTracking } from '@/FaceTracking';
import { useAppStore } from '@/store';

function App() {
  const webcamPermission = useAppStore((state) => state.webcamPermission);
  const setWebcamPermission = useAppStore((state) => state.setWebcamPermission);
  const showDebug = useAppStore((state) => state.ui.showDebug);
  const showSettings = useAppStore((state) => state.ui.showSettings);
  const setUI = useAppStore((state) => state.setUI);

  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const { stream, error, isLoading } = useWebcam(webcamPermission === 'granted');

  // Set up video element when stream is available
  useEffect(() => {
    if (stream && videoElement) {
      // eslint-disable-next-line react-hooks/immutability
      videoElement.srcObject = stream;
      videoElement.play().catch(console.error);
    }
  }, [stream, videoElement]);

  // Handle video element ref
  const videoRefCallback = useCallback((node: HTMLVideoElement | null) => {
    setVideoElement(node);
  }, []);

  // Handle video ready state
  const handleVideoCanPlay = useCallback(() => {
    setVideoReady(true);
    setIsModelLoading(true);
  }, []);

  // Face tracking
  const faceData = useFaceTracking({
    videoElement: videoReady ? videoElement : null,
    enabled: webcamPermission === 'granted' && videoReady,
  });

  // Update model loading state when face data starts coming in
  useEffect(() => {
    if (faceData !== null) {
      setIsModelLoading(false);
    }
  }, [faceData]);

  useEffect(() => {
    if (stream) {
      setWebcamPermission('granted');
    } else if (error) {
      setWebcamPermission('denied');
    }
  }, [stream, error, setWebcamPermission]);

  const handleRequestPermission = useCallback(() => {
    setWebcamPermission('granted');
  }, [setWebcamPermission]);

  const toggleSettings = useCallback(() => {
    setUI({ showSettings: !showSettings });
  }, [showSettings, setUI]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        setUI({ showDebug: !showDebug });
      }
      if (e.key === 's' || e.key === 'S') {
        setUI({ showSettings: !showSettings });
      }
      if (e.key === 'Escape' && showSettings) {
        setUI({ showSettings: false });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDebug, showSettings, setUI]);

  return (
    <DesktopOnly>
      <ThreeCanvas faceData={faceData} />

      {/* Hidden video element for face tracking */}
      <video
        ref={videoRefCallback}
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          width: '160px',
          height: '120px',
          objectFit: 'cover',
          borderRadius: '8px',
          opacity: showDebug ? 0.8 : 0,
          pointerEvents: 'none',
          transform: 'scaleX(-1)', // Mirror the video
          zIndex: showDebug ? 100 : -1,
        }}
        autoPlay
        playsInline
        muted
        onCanPlay={handleVideoCanPlay}
      />

      {webcamPermission === 'granted' && (
        <>
          <TrackingStatus isTracking={faceData !== null} isLoading={isModelLoading} />
          <SettingsButton onClick={toggleSettings} isOpen={showSettings} />
          {showSettings && <SettingsPanel onClose={() => setUI({ showSettings: false })} />}
        </>
      )}

      <DebugOverlay faceData={faceData} show={showDebug && webcamPermission === 'granted'} />

      <WebcamPrompt
        onRequestPermission={handleRequestPermission}
        error={error}
        isLoading={isLoading}
      />

      {/* Keyboard hints */}
      {webcamPermission === 'granted' && !showSettings && (
        <div
          style={{
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            padding: '6px 10px',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#666',
            zIndex: 50,
            display: 'flex',
            gap: '12px',
          }}
        >
          <span>
            <kbd style={{ color: '#888' }}>D</kbd> Debug
          </span>
          <span>
            <kbd style={{ color: '#888' }}>S</kbd> Settings
          </span>
        </div>
      )}
    </DesktopOnly>
  );
}

export default App;
