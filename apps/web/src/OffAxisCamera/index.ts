import * as THREE from 'three';

export interface ScreenConfig {
  widthCm: number;
  heightCm: number;
}

export interface ViewerPosition {
  x: number; // cm, positive = right of screen center
  y: number; // cm, positive = above screen center
  z: number; // cm, positive = in front of screen (distance)
}

export interface OffAxisConfig {
  near: number;
  far: number;
}

const DEFAULT_CONFIG: OffAxisConfig = {
  near: 0.1,
  far: 1000,
};

/**
 * Updates the camera's projection matrix for off-axis projection.
 *
 * This creates a frustum that simulates looking through a "window" (the screen)
 * from an off-center viewer position. The result is that objects appear to be
 * "behind" the screen, creating a parallax depth effect.
 *
 * Coordinate system:
 * - Screen plane is at z = 0
 * - Viewer is at positive z (in front of screen)
 * - x positive = right, y positive = up
 *
 * @param camera - The three.js PerspectiveCamera to update
 * @param viewerPosition - The viewer's eye position in centimeters
 * @param screenConfig - The physical screen dimensions in centimeters
 * @param config - Near/far plane configuration
 */
export function updateOffAxisProjection(
  camera: THREE.PerspectiveCamera,
  viewerPosition: ViewerPosition,
  screenConfig: ScreenConfig,
  config: OffAxisConfig = DEFAULT_CONFIG
): void {
  const { x: Ex, y: Ey, z: Ez } = viewerPosition;
  const { widthCm, heightCm } = screenConfig;
  const { near, far } = config;

  // Prevent division by zero
  if (Ez <= 0) return;

  // Half dimensions of the screen
  const halfWidth = widthCm / 2;
  const halfHeight = heightCm / 2;

  // Calculate the asymmetric frustum edges at the near plane
  // Using similar triangles to project screen edges to near plane
  const nearOverEz = near / Ez;

  const left = (-halfWidth - Ex) * nearOverEz;
  const right = (halfWidth - Ex) * nearOverEz;
  const bottom = (-halfHeight - Ey) * nearOverEz;
  const top = (halfHeight - Ey) * nearOverEz;

  // Create the off-axis projection matrix
  camera.projectionMatrix.makePerspective(left, right, top, bottom, near, far);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

  // Position the camera at the viewer's position
  // Note: We scale from cm to scene units (assuming 1 unit = 1 cm)
  camera.position.set(Ex, Ey, Ez);

  // Camera looks toward the screen (negative z direction)
  camera.lookAt(Ex, Ey, 0);
}

/**
 * Exponential Moving Average (EMA) smoother for position data.
 * Reduces jitter while maintaining responsiveness.
 */
export class PositionSmoother {
  private smoothedPosition: ViewerPosition;
  private alpha: number;
  private initialized = false;

  /**
   * @param alpha - Smoothing factor (0-1). Lower = smoother but more lag.
   *                Typical values: 0.1-0.3 for smooth, 0.5-0.8 for responsive
   */
  constructor(alpha = 0.3) {
    this.alpha = alpha;
    this.smoothedPosition = { x: 0, y: 0, z: 60 };
  }

  /**
   * Update the smoothed position with a new sample.
   * @param newPosition - The new raw position from tracking
   * @returns The smoothed position
   */
  update(newPosition: ViewerPosition): ViewerPosition {
    if (!this.initialized) {
      this.smoothedPosition = { ...newPosition };
      this.initialized = true;
      return this.smoothedPosition;
    }

    // EMA formula: smoothed = alpha * new + (1 - alpha) * smoothed
    this.smoothedPosition = {
      x: this.alpha * newPosition.x + (1 - this.alpha) * this.smoothedPosition.x,
      y: this.alpha * newPosition.y + (1 - this.alpha) * this.smoothedPosition.y,
      z: this.alpha * newPosition.z + (1 - this.alpha) * this.smoothedPosition.z,
    };

    return this.smoothedPosition;
  }

  /**
   * Get the current smoothed position without updating.
   */
  get(): ViewerPosition {
    return this.smoothedPosition;
  }

  /**
   * Update the smoothing factor.
   */
  setAlpha(alpha: number): void {
    this.alpha = Math.max(0, Math.min(1, alpha));
  }

  /**
   * Reset the smoother state.
   */
  reset(): void {
    this.initialized = false;
    this.smoothedPosition = { x: 0, y: 0, z: 60 };
  }
}

/**
 * Convert face tracking data to viewer eye position in centimeters.
 *
 * @param faceCenter - Normalized face center (0-1, where 0.5 is center)
 * @param eyeDistance - Normalized distance between eyes
 * @param screenWidthCm - Physical screen width in cm
 * @param screenHeightCm - Physical screen height in cm
 * @param ipdCm - Interpupillary distance in cm (default 6.3cm)
 * @param baselineDistanceCm - Baseline viewing distance in cm (when eye distance matches expected)
 * @returns Viewer position in centimeters
 */
export function faceTrackingToViewerPosition(
  faceCenter: { x: number; y: number },
  eyeDistance: number,
  screenWidthCm: number,
  screenHeightCm: number,
  ipdCm = 6.3,
  baselineDistanceCm = 60
): ViewerPosition {
  // Convert normalized face center to offset from screen center
  // Note: Webcam x is mirrored (left in image = right in real world)
  // faceCenter.x = 0 means left edge of camera view
  // We flip x so moving right in real life = positive x
  const normalizedX = 0.5 - faceCenter.x; // Flip and center
  const normalizedY = 0.5 - faceCenter.y; // Center (y=0 is top in webcam)

  // Scale by estimated field of view
  // Assuming ~60 degree horizontal FOV for typical webcam
  // At baseline distance, the visible width is approximately 2 * tan(30°) * distance
  const estimatedFovFactor = 1.15; // tan(30°) ≈ 0.577, doubled ≈ 1.15

  // Estimate depth from eye distance
  // When closer, eyes appear further apart (larger eyeDistance)
  // baselineEyeDistance is the expected eye distance at baseline viewing distance
  // We estimate this based on IPD and approximate webcam FOV
  const baselineEyeDistance = ipdCm / (baselineDistanceCm * estimatedFovFactor);

  // Depth is inversely proportional to eye distance
  const z = eyeDistance > 0 ? (baselineEyeDistance / eyeDistance) * baselineDistanceCm : baselineDistanceCm;

  // Clamp depth to reasonable range
  const clampedZ = Math.max(30, Math.min(150, z));

  // Calculate x, y position based on face center offset
  // Scale by the current depth and FOV
  const visibleWidth = clampedZ * estimatedFovFactor;
  const visibleHeight = (visibleWidth * screenHeightCm) / screenWidthCm;

  const x = normalizedX * visibleWidth;
  const y = normalizedY * visibleHeight;

  return { x, y, z: clampedZ };
}
