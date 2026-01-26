/**
 * Layered Depth Plane (MPI-lite) - Renders image with multiple depth layers.
 *
 * Converts a single depth map into 2-4 depth slices rendered as stacked planes.
 * This reduces stretching artifacts at depth discontinuities compared to
 * single-plane parallax.
 *
 * Each layer:
 * - Shows pixels within a specific depth range
 * - Has transparency for out-of-range pixels
 * - Is positioned at the center of its depth range
 */

import * as THREE from 'three';

// Vertex shader - simple pass-through
const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader for a single depth layer
const fragmentShader = `
  uniform sampler2D colorMap;
  uniform sampler2D depthMap;
  uniform sampler2D maskMap;
  uniform bool hasMask;
  uniform vec2 viewerOffset;
  uniform float parallaxStrength;
  uniform float depthScale;
  uniform float depthMin;       // Minimum depth for this layer (0-1)
  uniform float depthMax;       // Maximum depth for this layer (0-1)
  uniform float featherWidth;   // Soft edge width for layer blending
  uniform float edgeFade;
  uniform vec2 texelSize;

  varying vec2 vUv;

  // Smooth edge falloff function
  float edgeFalloff(vec2 uv) {
    if (edgeFade <= 0.0) return 1.0;
    vec2 fade = smoothstep(vec2(0.0), vec2(edgeFade), uv) *
                smoothstep(vec2(0.0), vec2(edgeFade), vec2(1.0) - uv);
    return fade.x * fade.y;
  }

  void main() {
    // Sample depth at original UV
    float depth = texture2D(depthMap, vUv).r;

    // Calculate layer alpha based on depth range with soft edges
    float layerCenter = (depthMin + depthMax) * 0.5;
    float layerHalfWidth = (depthMax - depthMin) * 0.5;

    // Soft transition at layer boundaries
    float inLayer = 1.0 - smoothstep(layerHalfWidth - featherWidth, layerHalfWidth + featherWidth, abs(depth - layerCenter));

    if (inLayer < 0.001) {
      discard;
    }

    // Calculate parallax offset based on depth relative to layer center
    float relativeDepth = depth - layerCenter;
    vec2 offset = viewerOffset * relativeDepth * parallaxStrength * depthScale;

    // Apply offset to UV coordinates
    vec2 parallaxUv = vUv - offset;

    // Calculate edge fade
    float fade = edgeFalloff(parallaxUv);

    // Clamp UVs to prevent sampling outside texture
    parallaxUv = clamp(parallaxUv, 0.001, 0.999);

    // Sample color with parallax offset
    vec4 color = texture2D(colorMap, parallaxUv);

    // Apply layer alpha and edge fade
    color.a *= inLayer * fade;

    // Apply mask if available
    if (hasMask) {
      float mask = texture2D(maskMap, parallaxUv).r;
      color.a *= mask;
    }

    gl_FragColor = color;
  }
`;

export interface LayerConfig {
  depthMin: number;
  depthMax: number;
  zOffset: number; // World-space z offset from base position
}

export interface LayeredDepthOptions {
  colorTexture: THREE.Texture;
  depthTexture: THREE.Texture;
  maskTexture?: THREE.Texture;
  width?: number;
  height?: number;
  numLayers?: number; // 2-4 layers
  parallaxStrength?: number;
  depthScale?: number;
  edgeFade?: number;
  featherWidth?: number; // Soft edge between layers
  layerSpacing?: number; // World-space distance between layers
}

export interface LayeredDepthSettings {
  parallaxStrength: number;
  depthScale: number;
  edgeFade: number;
  featherWidth: number;
  layerSpacing: number;
}

/**
 * LayeredDepthPlane renders an image with multiple depth layers for reduced artifacts.
 */
export class LayeredDepthPlane extends THREE.Group {
  private layers: THREE.Mesh[] = [];
  private uniforms: Array<{
    colorMap: { value: THREE.Texture };
    depthMap: { value: THREE.Texture };
    maskMap: { value: THREE.Texture | null };
    hasMask: { value: boolean };
    viewerOffset: { value: THREE.Vector2 };
    parallaxStrength: { value: number };
    depthScale: { value: number };
    depthMin: { value: number };
    depthMax: { value: number };
    featherWidth: { value: number };
    edgeFade: { value: number };
    texelSize: { value: THREE.Vector2 };
  }> = [];

  private layerConfigs: LayerConfig[] = [];
  private settings: LayeredDepthSettings;

  constructor(options: LayeredDepthOptions) {
    super();

    const {
      colorTexture,
      depthTexture,
      maskTexture,
      width = 40,
      height = 30,
      numLayers = 3,
      parallaxStrength = 0.06,
      depthScale = 1.0,
      edgeFade = 0.05,
      featherWidth = 0.1,
      layerSpacing = 2.0,
    } = options;

    this.settings = {
      parallaxStrength,
      depthScale,
      edgeFade,
      featherWidth,
      layerSpacing,
    };

    // Calculate layer configurations
    const clampedLayers = Math.max(2, Math.min(4, numLayers));
    this.layerConfigs = this.calculateLayerConfigs(clampedLayers, layerSpacing);

    // Calculate texel size
    const image = colorTexture.image as HTMLImageElement | undefined;
    const texWidth = image?.width || 1024;
    const texHeight = image?.height || 1024;

    // Create geometry (shared by all layers)
    const geometry = new THREE.PlaneGeometry(width, height);

    // Create a layer for each depth range
    for (let i = 0; i < this.layerConfigs.length; i++) {
      const config = this.layerConfigs[i];

      const uniforms = {
        colorMap: { value: colorTexture },
        depthMap: { value: depthTexture },
        maskMap: { value: maskTexture || null },
        hasMask: { value: !!maskTexture },
        viewerOffset: { value: new THREE.Vector2(0, 0) },
        parallaxStrength: { value: parallaxStrength },
        depthScale: { value: depthScale },
        depthMin: { value: config.depthMin },
        depthMax: { value: config.depthMax },
        featherWidth: { value: featherWidth },
        edgeFade: { value: edgeFade },
        texelSize: { value: new THREE.Vector2(1.0 / texWidth, 1.0 / texHeight) },
      };

      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false, // Prevent z-fighting
        side: THREE.FrontSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = config.zOffset;
      mesh.renderOrder = i; // Render back to front

      this.layers.push(mesh);
      this.uniforms.push(uniforms);
      this.add(mesh);
    }
  }

  /**
   * Calculate layer configurations for even depth distribution.
   */
  private calculateLayerConfigs(numLayers: number, layerSpacing: number): LayerConfig[] {
    const configs: LayerConfig[] = [];
    const depthStep = 1.0 / numLayers;

    for (let i = 0; i < numLayers; i++) {
      // Depth range (0 = far, 1 = near in typical depth maps)
      const depthMin = i * depthStep;
      const depthMax = (i + 1) * depthStep;

      // Z offset: back layers are further back, front layers are closer
      // Layer 0 (far depths) is at back, last layer (near depths) is at front
      const zOffset = (i - (numLayers - 1) / 2) * layerSpacing;

      configs.push({ depthMin, depthMax, zOffset });
    }

    return configs;
  }

  /**
   * Update the viewer offset for parallax effect.
   */
  updateViewerOffset(x: number, y: number): void {
    for (const uniform of this.uniforms) {
      uniform.viewerOffset.value.set(x, y);
    }
  }

  /**
   * Set parallax strength.
   */
  setParallaxStrength(strength: number): void {
    this.settings.parallaxStrength = strength;
    for (const uniform of this.uniforms) {
      uniform.parallaxStrength.value = strength;
    }
  }

  /**
   * Set depth scale.
   */
  setDepthScale(scale: number): void {
    this.settings.depthScale = scale;
    for (const uniform of this.uniforms) {
      uniform.depthScale.value = scale;
    }
  }

  /**
   * Set edge fade.
   */
  setEdgeFade(fade: number): void {
    this.settings.edgeFade = fade;
    for (const uniform of this.uniforms) {
      uniform.edgeFade.value = fade;
    }
  }

  /**
   * Set feather width (soft edge between layers).
   */
  setFeatherWidth(width: number): void {
    this.settings.featherWidth = width;
    for (const uniform of this.uniforms) {
      uniform.featherWidth.value = width;
    }
  }

  /**
   * Set layer spacing.
   */
  setLayerSpacing(spacing: number): void {
    this.settings.layerSpacing = spacing;
    // Recalculate layer positions
    const newConfigs = this.calculateLayerConfigs(this.layers.length, spacing);
    for (let i = 0; i < this.layers.length; i++) {
      this.layers[i].position.z = newConfigs[i].zOffset;
    }
    this.layerConfigs = newConfigs;
  }

  /**
   * Apply all settings at once.
   */
  applySettings(settings: Partial<LayeredDepthSettings>): void {
    if (settings.parallaxStrength !== undefined) {
      this.setParallaxStrength(settings.parallaxStrength);
    }
    if (settings.depthScale !== undefined) {
      this.setDepthScale(settings.depthScale);
    }
    if (settings.edgeFade !== undefined) {
      this.setEdgeFade(settings.edgeFade);
    }
    if (settings.featherWidth !== undefined) {
      this.setFeatherWidth(settings.featherWidth);
    }
    if (settings.layerSpacing !== undefined) {
      this.setLayerSpacing(settings.layerSpacing);
    }
  }

  /**
   * Get current settings.
   */
  getSettings(): LayeredDepthSettings {
    return { ...this.settings };
  }

  /**
   * Update textures.
   */
  updateTextures(
    colorTexture?: THREE.Texture,
    depthTexture?: THREE.Texture,
    maskTexture?: THREE.Texture
  ): void {
    for (const uniform of this.uniforms) {
      if (colorTexture) {
        uniform.colorMap.value = colorTexture;
        const image = colorTexture.image as HTMLImageElement | undefined;
        const texWidth = image?.width || 1024;
        const texHeight = image?.height || 1024;
        uniform.texelSize.value.set(1.0 / texWidth, 1.0 / texHeight);
      }
      if (depthTexture) {
        uniform.depthMap.value = depthTexture;
      }
      if (maskTexture !== undefined) {
        uniform.maskMap.value = maskTexture;
        uniform.hasMask.value = !!maskTexture;
      }
    }
  }

  /**
   * Dispose of resources.
   */
  dispose(): void {
    for (const layer of this.layers) {
      layer.geometry.dispose();
      (layer.material as THREE.ShaderMaterial).dispose();
    }
    this.layers = [];
    this.uniforms = [];
  }
}

/**
 * Default settings for layered depth rendering.
 */
export const DEFAULT_LAYERED_SETTINGS = {
  object: {
    parallaxStrength: 0.08,
    depthScale: 1.0,
    edgeFade: 0.1,
    featherWidth: 0.12,
    layerSpacing: 2.5,
  } as LayeredDepthSettings,
  landscape: {
    parallaxStrength: 0.04,
    depthScale: 1.0,
    edgeFade: 0.02,
    featherWidth: 0.08,
    layerSpacing: 3.0,
  } as LayeredDepthSettings,
};
