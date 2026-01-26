import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export interface LoadedAsset {
  id: string;
  name: string;
  object: THREE.Group;
  boundingBox: THREE.Box3;
  originalScale: number;
}

export interface LoadProgress {
  loaded: number;
  total: number;
  percent: number;
}

// Singleton loaders
let gltfLoader: GLTFLoader | null = null;
let textureLoader: THREE.TextureLoader | null = null;

function getGLTFLoader(): GLTFLoader {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader();

    // Set up DRACO decoder for compressed models
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    gltfLoader.setDRACOLoader(dracoLoader);
  }
  return gltfLoader;
}

function getTextureLoader(): THREE.TextureLoader {
  if (!textureLoader) {
    textureLoader = new THREE.TextureLoader();
  }
  return textureLoader;
}

/**
 * Load a GLB/GLTF model from a File object
 */
export async function loadModelFromFile(
  file: File,
  onProgress?: (progress: LoadProgress) => void
): Promise<LoadedAsset> {
  const loader = getGLTFLoader();
  const url = URL.createObjectURL(file);

  try {
    const gltf = await new Promise<GLTF>((resolve, reject) => {
      loader.load(
        url,
        resolve,
        (event) => {
          if (onProgress && event.lengthComputable) {
            onProgress({
              loaded: event.loaded,
              total: event.total,
              percent: (event.loaded / event.total) * 100,
            });
          }
        },
        reject
      );
    });

    const model = gltf.scene;
    const id = crypto.randomUUID();

    // Compute bounding box
    const boundingBox = new THREE.Box3().setFromObject(model);

    // Calculate original scale (size of the model)
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    const maxDimension = Math.max(size.x, size.y, size.z);

    return {
      id,
      name: file.name.replace(/\.(glb|gltf)$/i, ''),
      object: model,
      boundingBox,
      originalScale: maxDimension,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Load an image as a texture for background
 */
export async function loadBackgroundImage(
  file: File,
  onProgress?: (progress: LoadProgress) => void
): Promise<{ id: string; name: string; url: string; texture: THREE.Texture }> {
  const loader = getTextureLoader();
  const url = URL.createObjectURL(file);

  try {
    const texture = await new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(
        url,
        (tex) => {
          if (onProgress) {
            onProgress({ loaded: 100, total: 100, percent: 100 });
          }
          resolve(tex);
        },
        (event) => {
          if (onProgress && event.lengthComputable) {
            onProgress({
              loaded: event.loaded,
              total: event.total,
              percent: (event.loaded / event.total) * 100,
            });
          }
        },
        reject
      );
    });

    // Configure texture for best quality
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    return {
      id: crypto.randomUUID(),
      name: file.name,
      url, // Keep the URL for the background
      texture,
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/**
 * Auto-scale and ground a model to fit within a safe volume
 * This implements the heuristics from Milestone 2.2
 */
export function autoScaleAndGround(
  model: THREE.Group,
  boundingBox: THREE.Box3,
  safeVolume: { width: number; height: number; depth: number } = { width: 30, height: 25, depth: 40 }
): { scale: number; position: { x: number; y: number; z: number } } {
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  boundingBox.getSize(size);
  boundingBox.getCenter(center);

  // Calculate scale to fit within safe volume
  const scaleX = safeVolume.width / size.x;
  const scaleY = safeVolume.height / size.y;
  const scaleZ = safeVolume.depth / size.z;
  const scale = Math.min(scaleX, scaleY, scaleZ, 1); // Don't upscale, only downscale

  // Apply scale to model
  model.scale.setScalar(scale);

  // Recompute bounding box after scaling
  const scaledBox = new THREE.Box3().setFromObject(model);
  const scaledCenter = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);

  // Ground the model: place bottom of bounding box at y = floor level
  const floorY = -15; // Same as room floor in ThreeCanvas
  const bottomY = scaledBox.min.y;
  const yOffset = floorY - bottomY;

  // Center horizontally, place at mid-depth
  const position = {
    x: -scaledCenter.x,
    y: yOffset,
    z: -25, // Mid-depth in the room
  };

  model.position.set(position.x, position.y, position.z);

  return { scale, position };
}

/**
 * Validate file type for model uploads
 */
export function isValidModelFile(file: File): boolean {
  const validExtensions = ['.glb', '.gltf'];
  const fileName = file.name.toLowerCase();
  return validExtensions.some((ext) => fileName.endsWith(ext));
}

/**
 * Validate file type for image uploads
 */
export function isValidImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  return validTypes.includes(file.type);
}
