import { useCallback, useEffect, useState } from 'react';
import { ThreeCanvas } from '@/Scene';
import { WebcamPrompt, TrackingStatus, DebugOverlay } from '@/UI';
import { useWebcam } from '@/hooks/useWebcam';
import { useFaceTracking } from '@/FaceTracking';
import { useAppStore } from '@/store';

function App() {
  const webcamPermission = useAppStore((state) => state.webcamPermission);
  const setWebcamPermission = useAppStore((state) => state.setWebcamPermission);
  const showDebug = useAppStore((state) => state.ui.showDebug);
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

  // Toggle debug overlay with 'D' key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        setUI({ showDebug: !showDebug });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDebug, setUI]);

  return (
    <>
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
        <TrackingStatus isTracking={faceData !== null} isLoading={isModelLoading} />
      )}

      <DebugOverlay faceData={faceData} show={showDebug && webcamPermission === 'granted'} />

      <WebcamPrompt
        onRequestPermission={handleRequestPermission}
        error={error}
        isLoading={isLoading}
      />

      {/* Keyboard hint */}
      {webcamPermission === 'granted' && (
        <div
          style={{
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            padding: '4px 8px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#888',
            zIndex: 50,
          }}
        >
          Press D to toggle debug
        </div>
      )}
    </>
  );
}

export default App;
