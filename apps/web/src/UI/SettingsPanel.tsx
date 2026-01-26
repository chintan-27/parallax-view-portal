import { useState } from 'react';
import { useAppStore } from '@/store';

interface SettingsPanelProps {
  onClose: () => void;
}

type SettingsTab = 'calibration' | 'parallax';

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('calibration');
  const calibration = useAppStore((state) => state.calibration);
  const setCalibration = useAppStore((state) => state.setCalibration);
  const parallaxSettings = useAppStore((state) => state.parallaxSettings);
  const setParallaxSettings = useAppStore((state) => state.setParallaxSettings);
  const processedImage = useAppStore((state) => state.assets.processedImage);

  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '60px',
        left: '16px',
        width: '280px',
        backgroundColor: 'rgba(10, 10, 21, 0.95)',
        borderRadius: '12px',
        padding: '16px',
        zIndex: 200,
        border: '1px solid #333',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <h3 style={{ margin: 0, color: '#fff', fontSize: '14px', fontWeight: 600 }}>Settings</h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '4px',
          }}
        >
          ×
        </button>
      </div>

      {/* Tab Switcher */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '16px',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '6px',
          padding: '3px',
        }}
      >
        <TabButton
          label="Calibration"
          active={activeTab === 'calibration'}
          onClick={() => setActiveTab('calibration')}
        />
        <TabButton
          label="Parallax"
          active={activeTab === 'parallax'}
          onClick={() => setActiveTab('parallax')}
          badge={processedImage ? undefined : 'No Image'}
        />
      </div>

      {/* Calibration Tab */}
      {activeTab === 'calibration' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SliderControl
            label="Screen Width"
            value={calibration.screenWidthCm}
            min={20}
            max={80}
            step={1}
            unit="cm"
            onChange={(value) => setCalibration({ screenWidthCm: value })}
          />

          <SliderControl
            label="Viewing Distance"
            value={calibration.viewingDistanceCm}
            min={30}
            max={120}
            step={5}
            unit="cm"
            onChange={(value) => setCalibration({ viewingDistanceCm: value })}
          />

          <SliderControl
            label="IPD (Eye Distance)"
            value={calibration.ipdCm}
            min={5}
            max={8}
            step={0.1}
            unit="cm"
            onChange={(value) => setCalibration({ ipdCm: value })}
          />

          <SliderControl
            label="Smoothing"
            value={calibration.smoothingFactor}
            min={0.05}
            max={0.8}
            step={0.05}
            onChange={(value) => setCalibration({ smoothingFactor: value })}
            description="Lower = smoother, Higher = more responsive"
          />
        </div>
      )}

      {/* Parallax Tab */}
      {activeTab === 'parallax' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!processedImage ? (
            <div
              style={{
                padding: '16px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '6px',
                textAlign: 'center',
                color: '#888',
                fontSize: '12px',
              }}
            >
              Process an image with AI to enable parallax controls
            </div>
          ) : (
            <>
              <SliderControl
                label="Parallax Strength"
                value={parallaxSettings.parallaxStrength}
                min={0}
                max={0.2}
                step={0.01}
                onChange={(value) => setParallaxSettings({ parallaxStrength: value })}
                description="How much depth affects movement"
              />

              <SliderControl
                label="Depth Scale"
                value={parallaxSettings.depthScale}
                min={0.5}
                max={2}
                step={0.1}
                onChange={(value) => setParallaxSettings({ depthScale: value })}
                description="Multiplier for depth values"
              />

              <SliderControl
                label="Focus Distance"
                value={parallaxSettings.focusDistance}
                min={0}
                max={1}
                step={0.05}
                onChange={(value) => setParallaxSettings({ focusDistance: value })}
                description="Depth that stays stationary (0=near, 1=far)"
              />

              <SliderControl
                label="Edge Fade"
                value={parallaxSettings.edgeFade}
                min={0}
                max={0.2}
                step={0.01}
                onChange={(value) => setParallaxSettings({ edgeFade: value })}
                description="Smooth fade at image edges"
              />

              <SliderControl
                label="Depth Smoothing"
                value={parallaxSettings.depthSmoothing}
                min={0}
                max={0.5}
                step={0.05}
                onChange={(value) => setParallaxSettings({ depthSmoothing: value })}
                description="Blur depth map to reduce artifacts"
                disabled={parallaxSettings.renderMode === 'layered'}
              />

              {/* Render Mode Toggle */}
              <div style={{ marginTop: '8px' }}>
                <label style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px', display: 'block' }}>
                  Render Mode
                </label>
                <div
                  style={{
                    display: 'flex',
                    gap: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '6px',
                    padding: '3px',
                  }}
                >
                  <button
                    onClick={() => setParallaxSettings({ renderMode: 'single' })}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      backgroundColor:
                        parallaxSettings.renderMode === 'single'
                          ? 'rgba(99, 102, 241, 0.3)'
                          : 'transparent',
                      color: parallaxSettings.renderMode === 'single' ? '#fff' : '#888',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: parallaxSettings.renderMode === 'single' ? 500 : 400,
                    }}
                  >
                    Single Plane
                  </button>
                  <button
                    onClick={() => setParallaxSettings({ renderMode: 'layered' })}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      backgroundColor:
                        parallaxSettings.renderMode === 'layered'
                          ? 'rgba(99, 102, 241, 0.3)'
                          : 'transparent',
                      color: parallaxSettings.renderMode === 'layered' ? '#fff' : '#888',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: parallaxSettings.renderMode === 'layered' ? 500 : 400,
                    }}
                  >
                    Layered (MPI)
                  </button>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#666' }}>
                  Layered mode reduces stretching artifacts at depth edges
                </p>
              </div>

              {/* Layered Mode Settings */}
              {parallaxSettings.renderMode === 'layered' && (
                <>
                  <SliderControl
                    label="Number of Layers"
                    value={parallaxSettings.numLayers}
                    min={2}
                    max={4}
                    step={1}
                    onChange={(value) => setParallaxSettings({ numLayers: value })}
                    description="More layers = smoother but slower"
                  />

                  <SliderControl
                    label="Feather Width"
                    value={parallaxSettings.featherWidth}
                    min={0.02}
                    max={0.3}
                    step={0.02}
                    onChange={(value) => setParallaxSettings({ featherWidth: value })}
                    description="Soft edge between layers"
                  />

                  <SliderControl
                    label="Layer Spacing"
                    value={parallaxSettings.layerSpacing}
                    min={0.5}
                    max={5}
                    step={0.5}
                    onChange={(value) => setParallaxSettings({ layerSpacing: value })}
                    description="3D distance between layers"
                  />
                </>
              )}

              <div
                style={{
                  marginTop: '4px',
                  padding: '8px',
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: '#888',
                }}
              >
                <strong style={{ color: '#6366f1' }}>Current:</strong>{' '}
                {processedImage.inputType === 'object' ? 'Object' : 'Landscape'} image
              </div>
            </>
          )}
        </div>
      )}

      <div
        style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid #333',
        }}
      >
        <button
          onClick={handleFullscreen}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#6366f1',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {document.fullscreenElement ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        </button>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: '11px',
            color: '#666',
            textAlign: 'center',
          }}
        >
          Fullscreen recommended for best effect
        </p>
      </div>

      <div
        style={{
          marginTop: '12px',
          padding: '10px',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#888',
          lineHeight: 1.4,
        }}
      >
        <strong style={{ color: '#6366f1' }}>Tip:</strong> Measure your screen width with a ruler
        for accurate calibration. Sit at your normal viewing distance.
      </div>
    </div>
  );
}

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  description?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  description,
  disabled,
  onChange,
}: SliderControlProps) {
  return (
    <div style={{ opacity: disabled ? 0.5 : 1 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
        }}
      >
        <label style={{ fontSize: '12px', color: '#aaa' }}>{label}</label>
        <span style={{ fontSize: '12px', color: '#fff', fontWeight: 500 }}>
          {value.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0)}
          {unit && <span style={{ color: '#666', marginLeft: '2px' }}>{unit}</span>}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%',
          height: '4px',
          borderRadius: '2px',
          background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${((value - min) / (max - min)) * 100}%, #333 ${((value - min) / (max - min)) * 100}%, #333 100%)`,
          appearance: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      />
      {description && (
        <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#666' }}>{description}</p>
      )}
    </div>
  );
}

interface TabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
}

function TabButton({ label, active, onClick, badge }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '6px 10px',
        backgroundColor: active ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
        color: active ? '#fff' : '#888',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: active ? 500 : 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        transition: 'all 0.15s ease',
      }}
    >
      {label}
      {badge && (
        <span
          style={{
            fontSize: '9px',
            padding: '2px 4px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '3px',
            color: '#666',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
