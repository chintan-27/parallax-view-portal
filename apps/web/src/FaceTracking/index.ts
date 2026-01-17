import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export interface FaceTrackingResult {
  faceCenter: { x: number; y: number };
  eyeDistance: number;
  confidence: number;
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
}

export interface UseFaceTrackingOptions {
  videoElement: HTMLVideoElement | null;
  enabled: boolean;
}

// MediaPipe landmark indices for eyes
// https://github.com/google/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png
const LEFT_EYE_CENTER = 468; // Left eye center (iris)
const RIGHT_EYE_CENTER = 473; // Right eye center (iris)
const NOSE_TIP = 1; // Nose tip for face center approximation

let faceLandmarkerInstance: FaceLandmarker | null = null;
let faceLandmarkerLoading = false;
const faceLandmarkerLoadPromise: { promise: Promise<FaceLandmarker> | null } = { promise: null };

async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (faceLandmarkerInstance) {
    return faceLandmarkerInstance;
  }

  if (faceLandmarkerLoadPromise.promise) {
    return faceLandmarkerLoadPromise.promise;
  }

  if (faceLandmarkerLoading) {
    // Wait for existing load
    return new Promise((resolve) => {
      const check = () => {
        if (faceLandmarkerInstance) {
          resolve(faceLandmarkerInstance);
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  faceLandmarkerLoading = true;

  faceLandmarkerLoadPromise.promise = (async () => {
    const filesetResolver = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });

    faceLandmarkerInstance = landmarker;
    faceLandmarkerLoading = false;
    return landmarker;
  })();

  return faceLandmarkerLoadPromise.promise;
}

export function useFaceTracking({
  videoElement,
  enabled,
}: UseFaceTrackingOptions): FaceTrackingResult | null {
  const [result, setResult] = useState<FaceTrackingResult | null>(null);
  const [isReady, setIsReady] = useState(false);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);

  // Initialize FaceLandmarker
  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    getFaceLandmarker()
      .then((landmarker) => {
        if (mounted) {
          landmarkerRef.current = landmarker;
          setIsReady(true);
        }
      })
      .catch((error) => {
        console.error('Failed to initialize FaceLandmarker:', error);
      });

    return () => {
      mounted = false;
    };
  }, [enabled]);

  // Start/stop processing loop
  useEffect(() => {
    if (!enabled || !isReady || !videoElement) {
      return;
    }

    const processFrame = () => {
      const landmarker = landmarkerRef.current;

      if (!landmarker || !videoElement || !enabled) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Only process if video time has changed
      if (videoElement.readyState >= 2 && videoElement.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = videoElement.currentTime;

        try {
          const results = landmarker.detectForVideo(videoElement, performance.now());

          if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const landmarks = results.faceLandmarks[0];

            // Get eye centers (use iris landmarks if available, fallback to eye corners)
            const leftEye = landmarks[LEFT_EYE_CENTER] || landmarks[33];
            const rightEye = landmarks[RIGHT_EYE_CENTER] || landmarks[263];
            const noseTip = landmarks[NOSE_TIP];

            // Calculate face center (use nose tip as proxy)
            const faceCenter = {
              x: noseTip.x,
              y: noseTip.y,
            };

            // Calculate eye distance in normalized coordinates
            const eyeDistance = Math.sqrt(
              Math.pow(rightEye.x - leftEye.x, 2) + Math.pow(rightEye.y - leftEye.y, 2)
            );

            // Confidence based on detection (MediaPipe doesn't expose per-landmark confidence easily)
            // We use a simple heuristic: if we got landmarks, confidence is high
            const confidence = 0.9;

            setResult({
              faceCenter,
              eyeDistance,
              confidence,
              leftEye: { x: leftEye.x, y: leftEye.y },
              rightEye: { x: rightEye.x, y: rightEye.y },
            });
          } else {
            setResult(null);
          }
        } catch (error) {
          console.error('Face detection error:', error);
        }
      }

      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    animationFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [enabled, isReady, videoElement]);

  // Return null when not enabled, otherwise return the tracked result
  return enabled ? result : null;
}

export { getFaceLandmarker };
