import type { FaceTrackingResult } from '@/FaceTracking';

interface DebugOverlayProps {
  faceData: FaceTrackingResult | null;
  show: boolean;
}

export function DebugOverlay({ faceData, show }: DebugOverlayProps) {
  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        padding: '12px 16px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: '8px',
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#fff',
        zIndex: 100,
        minWidth: '200px',
      }}
    >
      <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#6366f1' }}>
        Face Tracking Debug
      </div>
      {faceData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div>
            <span style={{ color: '#888' }}>Face Center: </span>
            <span>
              ({faceData.faceCenter.x.toFixed(3)}, {faceData.faceCenter.y.toFixed(3)})
            </span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Eye Distance: </span>
            <span>{faceData.eyeDistance.toFixed(4)}</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Confidence: </span>
            <span>{(faceData.confidence * 100).toFixed(0)}%</span>
          </div>
          <div style={{ marginTop: '4px', borderTop: '1px solid #333', paddingTop: '4px' }}>
            <span style={{ color: '#888' }}>Left Eye: </span>
            <span>
              ({faceData.leftEye.x.toFixed(3)}, {faceData.leftEye.y.toFixed(3)})
            </span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Right Eye: </span>
            <span>
              ({faceData.rightEye.x.toFixed(3)}, {faceData.rightEye.y.toFixed(3)})
            </span>
          </div>
          <DepthEstimate eyeDistance={faceData.eyeDistance} />
        </div>
      ) : (
        <div style={{ color: '#888' }}>No face detected</div>
      )}
    </div>
  );
}

function DepthEstimate({ eyeDistance }: { eyeDistance: number }) {
  // Rough depth estimate based on eye distance
  // Average IPD is ~6.3cm, typical webcam FOV gives us a rough conversion
  // This is a very rough approximation - proper calibration will improve this
  const estimatedDepthCm = eyeDistance > 0 ? (0.063 / eyeDistance) * 30 : 0;

  return (
    <div style={{ marginTop: '4px', borderTop: '1px solid #333', paddingTop: '4px' }}>
      <span style={{ color: '#888' }}>Est. Depth: </span>
      <span>{estimatedDepthCm.toFixed(0)} cm</span>
      <span style={{ color: '#666', fontSize: '10px' }}> (rough)</span>
    </div>
  );
}
