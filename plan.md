# Off-Axis "Window" Viewer + Smart 2.5D/3D Content Pipeline
Status: Phase 4 Complete
Scope: Desktop-first web app (Chrome/Safari/Edge), webcam required for head tracking.

## High-level goal
Create a head-tracked off-axis projection “window” viewer in the browser, then progressively add an input pipeline that can turn images (and later 360 video) into background scenes or object content with sane scaling and placement.

## Principles
- Phase 1 is frontend-only and ships a compelling head-tracked demo.
- AI/asset processing is introduced later via a backend.
- All later AI outputs must degrade gracefully to non-AI fallbacks.
- Desktop first; mobile optional later.

---

# Phase 0 — Repo + Baseline Engineering [COMPLETE]
**Goal:** Establish a clean foundation for fast iteration.

## Milestone 0.1 — Project skeleton
**Deliverables**
- Repo structure with `apps/web` (frontend) and `services/` placeholder for future backend.
- Tooling: TypeScript, Vite (or Next.js), three.js, eslint/prettier, simple CI checks.
- Environment docs: webcam permissions, https/local dev.

**Acceptance criteria**
- `pnpm dev` (or `npm run dev`) starts the web app.
- Static page renders a three.js canvas and a “webcam permission” prompt.

## Milestone 0.2 — Core architecture
**Deliverables**
- Module boundaries:
  - `FaceTracking/` (head pose provider)
  - `OffAxisCamera/` (projection math + camera update)
  - `Scene/` (box grid + sample object)
  - `UI/` (settings/calibration overlay)
- A simple app state store (Zustand or minimal context).

**Acceptance criteria**
- Build passes with strict TS.
- Hot reload works; lint passes.

---

# Phase 1 — Frontend-only Head-Tracked Off-Axis Viewer (No AI) [COMPLETE]
**Goal:** Recreate the "empty 3D box moves with face" effect + place a sample object.

## Milestone 1.1 — Webcam + face tracking integrated
**Deliverables**
- Webcam feed initialization
- Face tracking (MediaPipe FaceMesh or MediaPipe Tasks Vision FaceLandmarker)
- Extract:
  - face center (cx, cy)
  - eye landmarks distance in pixels (proxy for depth)
  - confidence score

**Acceptance criteria**
- User grants webcam permission and sees a “tracking active” indicator.
- Debug overlay can show face center and approximate depth value.
- Tracking robust enough at typical laptop distance.

## Milestone 1.2 — Off-axis projection camera
**Deliverables**
- Implement off-axis frustum update per frame:
  - Represent the screen plane at z=0 with known width/height.
  - Estimate viewer eye position (Ex, Ey, Ez) from tracking + calibration.
  - Update three.js camera projection matrix each frame.
- Add smoothing filters (EMA) for Ex/Ey/Ez and confidence gating.

**Acceptance criteria**
- When moving head left/right/up/down, the “room” appears stable behind screen.
- No extreme jitter; movement feels responsive.

## Milestone 1.3 — Calibration UI (minimal)
**Deliverables**
- Settings panel (bottom-left icon) with:
  - screen width (cm)
  - viewing distance baseline (cm) or “auto”
  - optional IPD default (6.3cm)
  - tracking smoothing slider
- “Fullscreen after calibrating” guidance.

**Acceptance criteria**
- Calibration values persist (localStorage).
- Changing calibration noticeably improves stability/scale.

## Milestone 1.4 — 3D box + sample object
**Deliverables**
- Render a wireframe/grid “3D box/room” (like the reference).
- Place a sample object inside:
  - start with simple box geometry
  - then support loading a sample GLB (optional)
- Basic lighting (ambient + key light).

**Acceptance criteria**
- Box is visible and stable under head movement.
- Sample object remains inside the box and feels “behind the screen.”
- Performance: stable ~60fps on a typical laptop.

## Milestone 1.5 — Packaging + demo readiness
**Deliverables**
- “Demo mode” toggle: hide debug overlays.
- Basic responsive layout (desktop only message otherwise).
- README: setup, calibration steps, known limitations.

**Acceptance criteria**
- A non-technical user can run it locally and experience the effect.

---

# Phase 2 — Frontend Inputs (No Backend Yet): Basic Asset Loading + Heuristics [COMPLETE]
**Goal:** Let users load assets manually (no AI), to validate rendering modes and scaling logic.

## Milestone 2.1 — Asset loader (local files)
**Deliverables**
- Upload panel for:
  - background image
  - 3D model (.glb/.gltf)
- Rendering modes:
  - Background image on back wall (simple)
  - Object model placed on “floor” plane

**Acceptance criteria**
- User can upload a GLB and it appears centered and scaled reasonably.

## Milestone 2.2 — Auto-scaling & grounding heuristics
**Deliverables**
- Compute bounding box for loaded model.
- Normalize:
  - center model at origin
  - set scale so it fits within a “safe volume” inside the room
  - ground it on y=0 plane
- Provide a “scale override” slider.

**Acceptance criteria**
- Most GLBs fit without clipping or looking absurdly large/small.

## Milestone 2.3 — 360 video as *asset-building input* (not runtime playback)
**Deliverables**
- UI placeholder: “Import 360 video (for processing)”
- Frontend collects file + metadata and stores it locally (no processing yet)
- Define the backend contract that will later accept 360 video.

**Acceptance criteria**
- 360 video upload is stored and ready for future backend submission.
- No runtime 360 playback required.

---

# Phase 3 — Backend v1: AI/Compute for "Smart" Conversion (Images → Assets) [COMPLETE]
**Goal:** Introduce backend to process inputs into assets for the Phase 1/2 viewer.

## Milestone 3.1 — Backend scaffolding [COMPLETE]
**Deliverables**
- `services/api` (Node/Fastify or Python/FastAPI)
- Job queue abstraction (even if single-process at first)
- Storage strategy (local disk in dev, S3-compatible later)
- Endpoints:
  - `POST /jobs` create job
  - `GET /jobs/:id` status
  - `GET /assets/:id` fetch outputs

**Acceptance criteria**
- Frontend can submit an image and poll job status.

## Milestone 3.2 — Router: classify input type (object vs landscape) [COMPLETE]
**Deliverables**
- “Input router” service that outputs:
  - `{type: object|landscape, bbox?, mask?}`
- Start simple:
  - use a vision model/API for classification
  - optionally use segmentation model for mask

**Acceptance criteria**
- Given “shoe photo” → object
- Given “landscape” → landscape
- Store results with job output metadata.

## Milestone 3.3 — Object pipeline v1: 2.5D object (recommended MVP) [COMPLETE]
**Deliverables**
- Generate:
  - subject cutout (mask + RGBA)
  - depth map (grayscale)
  - optional cleaned/inpainted background behind object
- Output format:
  - `object_color.png`
  - `object_depth.png`
  - `object_mask.png` (optional)
  - `meta.json` (scale hints, depth normalization)

**Acceptance criteria**
- Viewer can load outputs and render a convincing parallax object.

## Milestone 3.4 — Landscape pipeline v1: depth background [COMPLETE]
**Deliverables**
- Generate depth for landscape image
- Output:
  - `bg_color.jpg`
  - `bg_depth.png`
  - `meta.json` (depth min/max, parallax strength suggestion)

**Acceptance criteria**
- Viewer renders background plane or multi-layer background with subtle parallax.

---

# Phase 4 — Rendering Upgrades in Viewer (Uses Backend Outputs) [COMPLETE]
**Goal:** Make AI outputs look great and stable.

## Milestone 4.1 — Parallax shader mode (RGB + depth) [COMPLETE]
**Deliverables**
- Fullscreen quad or plane shader that uses depth to warp UVs based on viewer offset.
- Controls:
  - parallax strength
  - depth smoothing
  - edge clamp

**Acceptance criteria**
- AI depth assets produce a stable parallax effect without obvious tearing in typical scenes.

## Milestone 4.2 — Layered depth (MPI-lite) for fewer artifacts [COMPLETE]
**Deliverables**
- Convert depth+color into 2–4 depth slices (either in backend or frontend).
- Render slices as stacked planes.

**Acceptance criteria**
- Reduced stretching around foreground silhouettes.

---

# Phase 5 — 360 Video Processing to Build Models/Scenes (Backend)
**Goal:** Use 360 video as input to build a scene representation that the viewer can display.

## Milestone 5.1 — 360 ingest + keyframe extraction
**Deliverables**
- Backend accepts 360 video upload
- Extract keyframes + metadata
- Output “preview” assets for the viewer

**Acceptance criteria**
- Upload completes and yields a set of keyframes viewable in the frontend.

## Milestone 5.2 — Scene reconstruction (choose one)
**Options**
- Gaussian splats reconstruction (best visual, heavier)
- NeRF / mesh reconstruction
- Multi-plane panoramic environment

**Acceptance criteria**
- Viewer can load the reconstructed asset and display it in the off-axis window.

---

# Non-goals (for now)
- Mobile support
- Real-time video depth estimation in-browser
- Perfect metric depth calibration across all devices
- Full “single photo to clean mesh” as the default (can be a later “beta” path)

---

# Risks & mitigations
- **Jitter / unstable tracking:** add smoothing + confidence gating, allow manual calibration, clamp extremes.
- **Weird scale:** normalize to safe volume; use bounding boxes; provide a scale override.
- **AI depth artifacts:** start with depth-parallax MVP, then add layered depth/inpainting.
- **Backend complexity:** start with single worker + local storage, then evolve.

---

# Definition of Done for Phase 1 (must hit)
- Head-tracked off-axis frustum works.
- 3D box grid stable and convincing.
- Sample object displayed and feels behind screen.
- Calibration UI exists and persists settings.
- Runs smoothly on desktop and is demo-ready.
