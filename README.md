# Parallax View Portal

A head-tracked off-axis projection "window" viewer that creates a parallax depth effect where the 3D scene appears stable "behind the screen" as you move your head.

## Demo

Move your head left/right/up/down while looking at the screen - objects at different depths shift naturally, creating the illusion of looking through a window into a 3D space.

## Features

- **Real-time face tracking** using MediaPipe FaceLandmarker
- **Off-axis projection** for accurate window-like perspective
- **Smooth tracking** with configurable EMA filter
- **Calibration UI** for screen size, viewing distance, IPD
- **3D wireframe room** with sample objects at various depths
- **Desktop-only** (requires webcam)

## Quick Start

```bash
cd apps/web
pnpm install
pnpm dev
```

Open http://localhost:5173, allow camera access, and move your head to see the effect.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `D` | Toggle debug overlay |
| `S` | Toggle settings panel |
| `Esc` | Close settings |

## Calibration Tips

1. Measure your screen width with a ruler (in cm)
2. Sit at your normal viewing distance
3. Adjust settings for best effect
4. Use fullscreen mode for immersion

## Tech Stack

- **Framework**: Vite + React + TypeScript
- **3D Rendering**: Three.js
- **Face Tracking**: MediaPipe Tasks Vision
- **State**: Zustand (with localStorage persistence)

## Project Structure

```
apps/web/src/
├── FaceTracking/     # MediaPipe face landmark detection
├── OffAxisCamera/    # Off-axis projection math + smoothing
├── Scene/            # Three.js canvas + 3D room
├── UI/               # Settings, debug overlay, prompts
├── hooks/            # useWebcam
└── store/            # Zustand state management
```

## Development Status

### Completed
- [x] Phase 0: Project skeleton
- [x] Phase 1: Head-tracked off-axis viewer
  - [x] 1.1 Face tracking integration
  - [x] 1.2 Off-axis projection camera
  - [x] 1.3 Calibration UI
  - [x] 1.4 3D box + sample objects
  - [x] 1.5 Demo readiness

### Next Up
- [ ] Phase 2: Asset loading (GLB models, background images)

## License

MIT
