/**
 * Parallax Plane - Renders an image with depth-based parallax effect.
 *
 * Uses a depth map to offset UV coordinates based on viewer position,
 * creating a convincing depth illusion without actual 3D geometry.
 *
 * Phase 4 enhancements:
 * - Edge clamping with smooth falloff
 * - Depth smoothing for stable parallax
 * - Focus distance control
 * - Edge fade to prevent hard cutoffs
 */

import * as THREE from 'three';

// Vertex shader - passes through position and UVs
const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Enhanced fragment shader with smoothing and edge handling
const fragmentShader = `
  uniform sampler2D colorMap;
  uniform sampler2D depthMap;
  uniform sampler2D maskMap;
  uniform bool hasMask;
  uniform vec2 viewerOffset;  // Normalized viewer offset from center (-1 to 1)
  uniform float parallaxStrength;
  uniform float depthScale;
  uniform float focusDistance;  // Depth value that stays stationary (0-1)
  uniform float edgeFade;       // How much to fade at edges (0-1)
  uniform float depthSmoothing; // Blur radius for depth sampling (0-1)
  uniform vec2 texelSize;       // 1.0 / texture resolution

  varying vec2 vUv;

  // Sample depth with optional smoothing (box blur)
  float sampleDepthSmooth(vec2 uv) {
    if (depthSmoothing <= 0.0) {
      return texture2D(depthMap, uv).r;
    }

    float depth = 0.0;
    float radius = depthSmoothing * 5.0; // Convert to pixel radius
    vec2 offset = texelSize * radius;

    // 9-tap box blur for smoothing
    depth += texture2D(depthMap, uv + vec2(-offset.x, -offset.y)).r;
    depth += texture2D(depthMap, uv + vec2(0.0, -offset.y)).r;
    depth += texture2D(depthMap, uv + vec2(offset.x, -offset.y)).r;
    depth += texture2D(depthMap, uv + vec2(-offset.x, 0.0)).r;
    depth += texture2D(depthMap, uv).r;
    depth += texture2D(depthMap, uv + vec2(offset.x, 0.0)).r;
    depth += texture2D(depthMap, uv + vec2(-offset.x, offset.y)).r;
    depth += texture2D(depthMap, uv + vec2(0.0, offset.y)).r;
    depth += texture2D(depthMap, uv + vec2(offset.x, offset.y)).r;

    return depth / 9.0;
  }

  // Smooth edge falloff function
  float edgeFalloff(vec2 uv) {
    if (edgeFade <= 0.0) return 1.0;

    vec2 fade = smoothstep(vec2(0.0), vec2(edgeFade), uv) *
                smoothstep(vec2(0.0), vec2(edgeFade), vec2(1.0) - uv);
    return fade.x * fade.y;
  }

  void main() {
    // Sample depth with smoothing
    float depth = sampleDepthSmooth(vUv);

    // Apply focus distance - depth relative to focus point
    // Depths at focusDistance stay still, others move
    float relativeDepth = depth - focusDistance;

    // Calculate parallax offset based on relative depth and viewer position
    vec2 offset = viewerOffset * relativeDepth * parallaxStrength * depthScale;

    // Apply offset to UV coordinates
    vec2 parallaxUv = vUv - offset;

    // Calculate edge fade for smooth borders
    float fade = edgeFalloff(parallaxUv);

    // Clamp UVs to prevent sampling outside texture
    parallaxUv = clamp(parallaxUv, 0.001, 0.999);

    // Sample color with parallax offset
    vec4 color = texture2D(colorMap, parallaxUv);

    // Apply edge fade
    color.a *= fade;

    // Apply mask if available (for object cutouts)
    if (hasMask) {
      float mask = texture2D(maskMap, parallaxUv).r;
      color.a *= mask;
    }

    gl_FragColor = color;
  }
`;

export interface ParallaxPlaneOptions {
  colorTexture: THREE.Texture;
  depthTexture: THREE.Texture;
  maskTexture?: THREE.Texture;
  width?: number;
  height?: number;
  parallaxStrength?: number;
  depthScale?: number;
  focusDistance?: number;
  edgeFade?: number;
  depthSmoothing?: number;
}

export interface ParallaxSettings {
  parallaxStrength: number;
  depthScale: number;
  focusDistance: number;
  edgeFade: number;
  depthSmoothing: number;
}

export class ParallaxPlane extends THREE.Mesh {
  private uniforms: {
    colorMap: { value: THREE.Texture };
    depthMap: { value: THREE.Texture };
    maskMap: { value: THREE.Texture | null };
    hasMask: { value: boolean };
    viewerOffset: { value: THREE.Vector2 };
    parallaxStrength: { value: number };
    depthScale: { value: number };
    focusDistance: { value: number };
    edgeFade: { value: number };
    depthSmoothing: { value: number };
    texelSize: { value: THREE.Vector2 };
  };

  constructor(options: ParallaxPlaneOptions) {
    const {
      colorTexture,
      depthTexture,
      maskTexture,
      width = 40,
      height = 30,
      parallaxStrength = 0.05,
      depthScale = 1.0,
      focusDistance = 0.5,
      edgeFade = 0.05,
      depthSmoothing = 0.2,
    } = options;

    // Create geometry
    const geometry = new THREE.PlaneGeometry(width, height);

    // Calculate texel size for blur
    const image = colorTexture.image as HTMLImageElement | undefined;
    const texWidth = image?.width || 1024;
    const texHeight = image?.height || 1024;

    // Create uniforms
    const uniforms = {
      colorMap: { value: colorTexture },
      depthMap: { value: depthTexture },
      maskMap: { value: maskTexture || null },
      hasMask: { value: !!maskTexture },
      viewerOffset: { value: new THREE.Vector2(0, 0) },
      parallaxStrength: { value: parallaxStrength },
      depthScale: { value: depthScale },
      focusDistance: { value: focusDistance },
      edgeFade: { value: edgeFade },
      depthSmoothing: { value: depthSmoothing },
      texelSize: { value: new THREE.Vector2(1.0 / texWidth, 1.0 / texHeight) },
    };

    // Create shader material
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true, // Always transparent for edge fade
      side: THREE.FrontSide,
    });

    super(geometry, material);
    this.uniforms = uniforms;
  }

  /**
   * Update the viewer offset for parallax effect.
   * @param x Horizontal offset (-1 to 1, left to right)
   * @param y Vertical offset (-1 to 1, bottom to top)
   */
  updateViewerOffset(x: number, y: number): void {
    this.uniforms.viewerOffset.value.set(x, y);
  }

  /**
   * Set parallax strength (how much depth affects movement).
   */
  setParallaxStrength(strength: number): void {
    this.uniforms.parallaxStrength.value = strength;
  }

  /**
   * Set depth scale (multiplier for depth values).
   */
  setDepthScale(scale: number): void {
    this.uniforms.depthScale.value = scale;
  }

  /**
   * Set focus distance (depth value that stays stationary, 0-1).
   */
  setFocusDistance(distance: number): void {
    this.uniforms.focusDistance.value = distance;
  }

  /**
   * Set edge fade amount (0-1, higher = more fade at edges).
   */
  setEdgeFade(fade: number): void {
    this.uniforms.edgeFade.value = fade;
  }

  /**
   * Set depth smoothing amount (0-1, higher = more blur).
   */
  setDepthSmoothing(smoothing: number): void {
    this.uniforms.depthSmoothing.value = smoothing;
  }

  /**
   * Apply all parallax settings at once.
   */
  applySettings(settings: Partial<ParallaxSettings>): void {
    if (settings.parallaxStrength !== undefined) {
      this.uniforms.parallaxStrength.value = settings.parallaxStrength;
    }
    if (settings.depthScale !== undefined) {
      this.uniforms.depthScale.value = settings.depthScale;
    }
    if (settings.focusDistance !== undefined) {
      this.uniforms.focusDistance.value = settings.focusDistance;
    }
    if (settings.edgeFade !== undefined) {
      this.uniforms.edgeFade.value = settings.edgeFade;
    }
    if (settings.depthSmoothing !== undefined) {
      this.uniforms.depthSmoothing.value = settings.depthSmoothing;
    }
  }

  /**
   * Get current parallax settings.
   */
  getSettings(): ParallaxSettings {
    return {
      parallaxStrength: this.uniforms.parallaxStrength.value,
      depthScale: this.uniforms.depthScale.value,
      focusDistance: this.uniforms.focusDistance.value,
      edgeFade: this.uniforms.edgeFade.value,
      depthSmoothing: this.uniforms.depthSmoothing.value,
    };
  }

  /**
   * Update textures.
   */
  updateTextures(
    colorTexture?: THREE.Texture,
    depthTexture?: THREE.Texture,
    maskTexture?: THREE.Texture
  ): void {
    if (colorTexture) {
      this.uniforms.colorMap.value = colorTexture;
      // Update texel size
      const image = colorTexture.image as HTMLImageElement | undefined;
      const texWidth = image?.width || 1024;
      const texHeight = image?.height || 1024;
      this.uniforms.texelSize.value.set(1.0 / texWidth, 1.0 / texHeight);
    }
    if (depthTexture) {
      this.uniforms.depthMap.value = depthTexture;
    }
    if (maskTexture !== undefined) {
      this.uniforms.maskMap.value = maskTexture;
      this.uniforms.hasMask.value = !!maskTexture;
    }
  }

  /**
   * Dispose of resources.
   */
  dispose(): void {
    this.geometry.dispose();
    (this.material as THREE.ShaderMaterial).dispose();
  }
}

/**
 * Create a parallax plane from processed image assets.
 */
export function createParallaxPlane(
  colorTexture: THREE.Texture,
  depthTexture: THREE.Texture,
  maskTexture?: THREE.Texture,
  options?: {
    width?: number;
    height?: number;
    parallaxStrength?: number;
    focusDistance?: number;
    edgeFade?: number;
    depthSmoothing?: number;
    position?: { x: number; y: number; z: number };
  }
): ParallaxPlane {
  const plane = new ParallaxPlane({
    colorTexture,
    depthTexture,
    maskTexture,
    width: options?.width ?? 40,
    height: options?.height ?? 30,
    parallaxStrength: options?.parallaxStrength ?? 0.05,
    focusDistance: options?.focusDistance ?? 0.5,
    edgeFade: options?.edgeFade ?? 0.05,
    depthSmoothing: options?.depthSmoothing ?? 0.2,
  });

  if (options?.position) {
    plane.position.set(options.position.x, options.position.y, options.position.z);
  }

  return plane;
}

/**
 * Default parallax settings for different content types.
 */
export const DEFAULT_PARALLAX_SETTINGS = {
  object: {
    parallaxStrength: 0.08,
    depthScale: 1.0,
    focusDistance: 0.5,
    edgeFade: 0.1,
    depthSmoothing: 0.15,
  } as ParallaxSettings,
  landscape: {
    parallaxStrength: 0.04,
    depthScale: 1.0,
    focusDistance: 0.3,
    edgeFade: 0.02,
    depthSmoothing: 0.25,
  } as ParallaxSettings,
};
