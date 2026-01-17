import { useAppStore } from '@/store';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const calibration = useAppStore((state) => state.calibration);
  const setCalibration = useAppStore((state) => state.setCalibration);

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
          marginBottom: '16px',
        }}
      >
        <h3 style={{ margin: 0, color: '#fff', fontSize: '14px', fontWeight: 600 }}>
          Calibration Settings
        </h3>
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
  onChange,
}: SliderControlProps) {
  return (
    <div>
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
          {value.toFixed(step < 1 ? 1 : 0)}
          {unit && <span style={{ color: '#666', marginLeft: '2px' }}>{unit}</span>}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%',
          height: '4px',
          borderRadius: '2px',
          background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${((value - min) / (max - min)) * 100}%, #333 ${((value - min) / (max - min)) * 100}%, #333 100%)`,
          appearance: 'none',
          cursor: 'pointer',
        }}
      />
      {description && (
        <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#666' }}>{description}</p>
      )}
    </div>
  );
}
