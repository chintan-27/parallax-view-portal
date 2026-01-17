import { useEffect, useRef, useState } from 'react';

export interface UseWebcamResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  error: string | null;
  isLoading: boolean;
}

export function useWebcam(enabled: boolean): UseWebcamResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setStream(null);
      }
      return;
    }

    let mounted = true;

    const startWebcam = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        });

        if (!mounted) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        if (!mounted) return;

        if (err instanceof Error) {
          if (err.name === 'NotAllowedError') {
            setError('Camera permission denied. Please allow camera access to use face tracking.');
          } else if (err.name === 'NotFoundError') {
            setError('No camera found. Please connect a camera to use face tracking.');
          } else {
            setError(`Failed to access camera: ${err.message}`);
          }
        } else {
          setError('An unknown error occurred while accessing the camera.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    startWebcam();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [enabled]);

  // Update video element when stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return { videoRef, stream, error, isLoading };
}
