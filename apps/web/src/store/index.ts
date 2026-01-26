import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type * as THREE from 'three';

export interface CalibrationState {
  screenWidthCm: number;
  viewingDistanceCm: number;
  ipdCm: number;
  smoothingFactor: number;
}

export interface ParallaxSettings {
  parallaxStrength: number;
  depthScale: number;
  focusDistance: number;
  edgeFade: number;
  depthSmoothing: number;
  renderMode: 'single' | 'layered';
  numLayers: number;
  featherWidth: number;
  layerSpacing: number;
}

export interface TrackingState {
  isTracking: boolean;
  confidence: number;
  eyePosition: { x: number; y: number; z: number } | null;
}

export interface UIState {
  showSettings: boolean;
  showDebug: boolean;
  showAssetPanel: boolean;
}

export interface LoadedModel {
  id: string;
  name: string;
  object: THREE.Group;
  scale: number;
  position: { x: number; y: number; z: number };
}

export interface BackgroundImage {
  id: string;
  name: string;
  url: string;
  texture: THREE.Texture | null;
}

export interface Video360 {
  id: string;
  name: string;
  file: File;
  size: number;
  duration?: number;
  status: 'pending' | 'ready_for_processing';
}

export interface ProcessedImage {
  id: string;
  jobId: string;
  name: string;
  inputType: 'object' | 'landscape' | 'unknown';
  colorTexture: THREE.Texture;
  depthTexture: THREE.Texture;
  maskTexture?: THREE.Texture;
  width: number;
  height: number;
}

export interface AssetState {
  models: LoadedModel[];
  backgroundImage: BackgroundImage | null;
  processedImage: ProcessedImage | null;
  video360: Video360 | null;
  isLoading: boolean;
  loadingProgress: number;
  processingStatus: string | null;
  error: string | null;
}

export interface AppState {
  calibration: CalibrationState;
  parallaxSettings: ParallaxSettings;
  tracking: TrackingState;
  ui: UIState;
  assets: AssetState;
  webcamPermission: 'pending' | 'granted' | 'denied';
  setCalibration: (calibration: Partial<CalibrationState>) => void;
  setParallaxSettings: (settings: Partial<ParallaxSettings>) => void;
  setTracking: (tracking: Partial<TrackingState>) => void;
  setUI: (ui: Partial<UIState>) => void;
  setAssets: (assets: Partial<AssetState>) => void;
  addModel: (model: LoadedModel) => void;
  removeModel: (id: string) => void;
  updateModelTransform: (id: string, transform: Partial<Pick<LoadedModel, 'scale' | 'position'>>) => void;
  setBackgroundImage: (image: BackgroundImage | null) => void;
  setProcessedImage: (image: ProcessedImage | null) => void;
  setVideo360: (video: Video360 | null) => void;
  setWebcamPermission: (permission: 'pending' | 'granted' | 'denied') => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      calibration: {
        screenWidthCm: 34,
        viewingDistanceCm: 60,
        ipdCm: 6.3,
        smoothingFactor: 0.3,
      },
      parallaxSettings: {
        parallaxStrength: 0.06,
        depthScale: 1.0,
        focusDistance: 0.5,
        edgeFade: 0.05,
        depthSmoothing: 0.2,
        renderMode: 'single',
        numLayers: 3,
        featherWidth: 0.1,
        layerSpacing: 2.0,
      },
      tracking: {
        isTracking: false,
        confidence: 0,
        eyePosition: null,
      },
      ui: {
        showSettings: false,
        showDebug: false,
        showAssetPanel: false,
      },
      assets: {
        models: [],
        backgroundImage: null,
        processedImage: null,
        video360: null,
        isLoading: false,
        loadingProgress: 0,
        processingStatus: null,
        error: null,
      },
      webcamPermission: 'pending',
      setCalibration: (calibration) =>
        set((state) => ({
          calibration: { ...state.calibration, ...calibration },
        })),
      setParallaxSettings: (settings) =>
        set((state) => ({
          parallaxSettings: { ...state.parallaxSettings, ...settings },
        })),
      setTracking: (tracking) =>
        set((state) => ({
          tracking: { ...state.tracking, ...tracking },
        })),
      setUI: (ui) =>
        set((state) => ({
          ui: { ...state.ui, ...ui },
        })),
      setAssets: (assets) =>
        set((state) => ({
          assets: { ...state.assets, ...assets },
        })),
      addModel: (model) =>
        set((state) => ({
          assets: { ...state.assets, models: [...state.assets.models, model] },
        })),
      removeModel: (id) =>
        set((state) => ({
          assets: {
            ...state.assets,
            models: state.assets.models.filter((m) => m.id !== id),
          },
        })),
      updateModelTransform: (id, transform) =>
        set((state) => ({
          assets: {
            ...state.assets,
            models: state.assets.models.map((m) =>
              m.id === id
                ? {
                    ...m,
                    ...(transform.scale !== undefined && { scale: transform.scale }),
                    ...(transform.position !== undefined && { position: transform.position }),
                  }
                : m
            ),
          },
        })),
      setBackgroundImage: (image) =>
        set((state) => ({
          assets: { ...state.assets, backgroundImage: image },
        })),
      setProcessedImage: (image) =>
        set((state) => ({
          assets: { ...state.assets, processedImage: image },
        })),
      setVideo360: (video) =>
        set((state) => ({
          assets: { ...state.assets, video360: video },
        })),
      setWebcamPermission: (permission) => set({ webcamPermission: permission }),
    }),
    {
      name: 'parallax-view-storage',
      partialize: (state) => ({
        calibration: state.calibration,
        parallaxSettings: state.parallaxSettings,
      }),
    }
  )
);
