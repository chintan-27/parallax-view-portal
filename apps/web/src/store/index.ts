import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CalibrationState {
  screenWidthCm: number;
  viewingDistanceCm: number;
  ipdCm: number;
  smoothingFactor: number;
}

export interface TrackingState {
  isTracking: boolean;
  confidence: number;
  eyePosition: { x: number; y: number; z: number } | null;
}

export interface UIState {
  showSettings: boolean;
  showDebug: boolean;
}

export interface AppState {
  calibration: CalibrationState;
  tracking: TrackingState;
  ui: UIState;
  webcamPermission: 'pending' | 'granted' | 'denied';
  setCalibration: (calibration: Partial<CalibrationState>) => void;
  setTracking: (tracking: Partial<TrackingState>) => void;
  setUI: (ui: Partial<UIState>) => void;
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
      tracking: {
        isTracking: false,
        confidence: 0,
        eyePosition: null,
      },
      ui: {
        showSettings: false,
        showDebug: false,
      },
      webcamPermission: 'pending',
      setCalibration: (calibration) =>
        set((state) => ({
          calibration: { ...state.calibration, ...calibration },
        })),
      setTracking: (tracking) =>
        set((state) => ({
          tracking: { ...state.tracking, ...tracking },
        })),
      setUI: (ui) =>
        set((state) => ({
          ui: { ...state.ui, ...ui },
        })),
      setWebcamPermission: (permission) => set({ webcamPermission: permission }),
    }),
    {
      name: 'parallax-view-storage',
      partialize: (state) => ({ calibration: state.calibration }),
    }
  )
);
