import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { FaceTrackingResult } from '@/FaceTracking';
import {
  updateOffAxisProjection,
  faceTrackingToViewerPosition,
  PositionSmoother,
  type ViewerPosition,
} from '@/OffAxisCamera';
import { useAppStore } from '@/store';

interface ThreeCanvasProps {
  faceData: FaceTrackingResult | null;
}

export function ThreeCanvas({ faceData }: ThreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const smootherRef = useRef<PositionSmoother | null>(null);
  const faceDataRef = useRef<FaceTrackingResult | null>(null);

  const calibration = useAppStore((state) => state.calibration);

  // Update face data ref when it changes
  useEffect(() => {
    faceDataRef.current = faceData;
  }, [faceData]);

  // Update smoother alpha when calibration changes
  useEffect(() => {
    if (smootherRef.current) {
      smootherRef.current.setAlpha(calibration.smoothingFactor);
    }
  }, [calibration.smoothingFactor]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initialize smoother
    smootherRef.current = new PositionSmoother(calibration.smoothingFactor);

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a15);
    sceneRef.current = scene;

    // Camera setup - we'll update projection matrix each frame for off-axis
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 60); // Default position
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create the 3D box room
    createBoxRoom(scene);

    // Create sample objects inside the box
    createSampleObjects(scene);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 30);
    scene.add(directionalLight);

    // Animation loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Get current face data and calibration
      const currentFaceData = faceDataRef.current;
      const { screenWidthCm, viewingDistanceCm, ipdCm } = calibration;

      // Calculate screen height based on aspect ratio
      const aspectRatio = window.innerWidth / window.innerHeight;
      const screenHeightCm = screenWidthCm / aspectRatio;

      if (currentFaceData && smootherRef.current) {
        // Convert face tracking to viewer position
        const rawPosition = faceTrackingToViewerPosition(
          currentFaceData.faceCenter,
          currentFaceData.eyeDistance,
          screenWidthCm,
          screenHeightCm,
          ipdCm,
          viewingDistanceCm
        );

        // Apply smoothing
        const smoothedPosition = smootherRef.current.update(rawPosition);

        // Update off-axis projection
        updateOffAxisProjection(camera, smoothedPosition, {
          widthCm: screenWidthCm,
          heightCm: screenHeightCm,
        });
      } else {
        // Default center position when no face tracking
        const defaultPosition: ViewerPosition = { x: 0, y: 0, z: viewingDistanceCm };
        updateOffAxisProjection(camera, defaultPosition, {
          widthCm: screenWidthCm,
          heightCm: screenHeightCm,
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);

      container.removeChild(renderer.domElement);
      renderer.dispose();

      // Dispose of all geometries and materials
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((m) => m.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    };
  }, [calibration]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
      }}
    />
  );
}

/**
 * Creates a wireframe box room that represents the "window" effect
 */
function createBoxRoom(scene: THREE.Scene): void {
  const roomWidth = 40;
  const roomHeight = 30;
  const roomDepth = 50;

  // Create grid lines for the walls
  const gridMaterial = new THREE.LineBasicMaterial({ color: 0x3366ff, opacity: 0.5, transparent: true });
  const gridDivisions = 10;

  // Back wall grid (at z = -roomDepth)
  const backWallGrid = createGridPlane(roomWidth, roomHeight, gridDivisions, gridMaterial);
  backWallGrid.position.z = -roomDepth;
  scene.add(backWallGrid);

  // Floor grid (at y = -roomHeight/2)
  const floorGrid = createGridPlane(roomWidth, roomDepth, gridDivisions, gridMaterial);
  floorGrid.rotation.x = -Math.PI / 2;
  floorGrid.position.y = -roomHeight / 2;
  floorGrid.position.z = -roomDepth / 2;
  scene.add(floorGrid);

  // Ceiling grid (at y = roomHeight/2)
  const ceilingGrid = createGridPlane(roomWidth, roomDepth, gridDivisions, gridMaterial);
  ceilingGrid.rotation.x = Math.PI / 2;
  ceilingGrid.position.y = roomHeight / 2;
  ceilingGrid.position.z = -roomDepth / 2;
  scene.add(ceilingGrid);

  // Left wall grid (at x = -roomWidth/2)
  const leftWallGrid = createGridPlane(roomDepth, roomHeight, gridDivisions, gridMaterial);
  leftWallGrid.rotation.y = Math.PI / 2;
  leftWallGrid.position.x = -roomWidth / 2;
  leftWallGrid.position.z = -roomDepth / 2;
  scene.add(leftWallGrid);

  // Right wall grid (at x = roomWidth/2)
  const rightWallGrid = createGridPlane(roomDepth, roomHeight, gridDivisions, gridMaterial);
  rightWallGrid.rotation.y = -Math.PI / 2;
  rightWallGrid.position.x = roomWidth / 2;
  rightWallGrid.position.z = -roomDepth / 2;
  scene.add(rightWallGrid);

  // Add corner edges for stronger depth cues
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x6699ff });
  const edges = createBoxEdges(roomWidth, roomHeight, roomDepth, edgeMaterial);
  edges.position.z = -roomDepth / 2;
  scene.add(edges);
}

/**
 * Creates a grid plane for walls/floor/ceiling
 */
function createGridPlane(
  width: number,
  height: number,
  divisions: number,
  material: THREE.LineBasicMaterial
): THREE.Group {
  const group = new THREE.Group();
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const stepX = width / divisions;
  const stepY = height / divisions;

  // Vertical lines
  for (let i = 0; i <= divisions; i++) {
    const x = -halfWidth + i * stepX;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, -halfHeight, 0),
      new THREE.Vector3(x, halfHeight, 0),
    ]);
    const line = new THREE.Line(geometry, material);
    group.add(line);
  }

  // Horizontal lines
  for (let i = 0; i <= divisions; i++) {
    const y = -halfHeight + i * stepY;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfWidth, y, 0),
      new THREE.Vector3(halfWidth, y, 0),
    ]);
    const line = new THREE.Line(geometry, material);
    group.add(line);
  }

  return group;
}

/**
 * Creates the corner edges of the box room
 */
function createBoxEdges(
  width: number,
  height: number,
  depth: number,
  material: THREE.LineBasicMaterial
): THREE.Group {
  const group = new THREE.Group();
  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;

  const corners = [
    // Back corners (depth edges)
    [
      [-hw, -hh, hd],
      [-hw, -hh, -hd],
    ],
    [
      [hw, -hh, hd],
      [hw, -hh, -hd],
    ],
    [
      [-hw, hh, hd],
      [-hw, hh, -hd],
    ],
    [
      [hw, hh, hd],
      [hw, hh, -hd],
    ],
    // Front frame
    [
      [-hw, -hh, hd],
      [hw, -hh, hd],
    ],
    [
      [-hw, hh, hd],
      [hw, hh, hd],
    ],
    [
      [-hw, -hh, hd],
      [-hw, hh, hd],
    ],
    [
      [hw, -hh, hd],
      [hw, hh, hd],
    ],
    // Back frame
    [
      [-hw, -hh, -hd],
      [hw, -hh, -hd],
    ],
    [
      [-hw, hh, -hd],
      [hw, hh, -hd],
    ],
    [
      [-hw, -hh, -hd],
      [-hw, hh, -hd],
    ],
    [
      [hw, -hh, -hd],
      [hw, hh, -hd],
    ],
  ];

  for (const [start, end] of corners) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(start[0], start[1], start[2]),
      new THREE.Vector3(end[0], end[1], end[2]),
    ]);
    const line = new THREE.Line(geometry, material);
    group.add(line);
  }

  return group;
}

/**
 * Creates sample objects to demonstrate the depth effect
 */
function createSampleObjects(scene: THREE.Scene): void {
  // Center cube - floating in the middle
  const cubeGeometry = new THREE.BoxGeometry(6, 6, 6);
  const cubeMaterial = new THREE.MeshStandardMaterial({
    color: 0x6366f1,
    metalness: 0.3,
    roughness: 0.4,
  });
  const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  cube.position.set(0, 0, -25);
  scene.add(cube);

  // Sphere on the left
  const sphereGeometry = new THREE.SphereGeometry(3, 32, 32);
  const sphereMaterial = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    metalness: 0.2,
    roughness: 0.6,
  });
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  sphere.position.set(-12, -8, -35);
  scene.add(sphere);

  // Torus on the right
  const torusGeometry = new THREE.TorusGeometry(3, 1, 16, 100);
  const torusMaterial = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.4,
    roughness: 0.3,
  });
  const torus = new THREE.Mesh(torusGeometry, torusMaterial);
  torus.position.set(12, 5, -40);
  torus.rotation.x = Math.PI / 4;
  scene.add(torus);

  // Small cubes scattered for depth reference
  const smallCubeGeometry = new THREE.BoxGeometry(2, 2, 2);
  const smallCubeMaterial = new THREE.MeshStandardMaterial({
    color: 0xec4899,
    metalness: 0.2,
    roughness: 0.5,
  });

  const positions = [
    { x: -8, y: 8, z: -15 },
    { x: 10, y: -5, z: -20 },
    { x: -5, y: -10, z: -45 },
    { x: 15, y: 10, z: -30 },
  ];

  for (const pos of positions) {
    const smallCube = new THREE.Mesh(smallCubeGeometry, smallCubeMaterial.clone());
    smallCube.position.set(pos.x, pos.y, pos.z);
    scene.add(smallCube);
  }
}
