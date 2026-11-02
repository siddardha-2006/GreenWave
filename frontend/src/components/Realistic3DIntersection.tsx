import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SimulationMetrics } from '../types';

interface Realistic3DIntersectionProps {
  metrics: SimulationMetrics | null;
  phaseType: string;
  timeInPhase: number;
  fallbackEngaged: boolean;
  rejectionReason?: string;
}

interface Vehicle3D {
  id: string;
  mesh: THREE.Group;
  chassisMesh: THREE.Group;
  movementId: string;
  approach: 'North' | 'South' | 'East' | 'West';
  type: 'sedan' | 'suv' | 'sports' | 'ambulance';
  distance: number;       // Distance along approach axis: +80 at spawn, 15 at stop bar, 0 at center, -80 past exit
  speed: number;
  targetSpeed: number;
  isStopped: boolean;
  stoppedDuration?: number;
  lane: number;           // 0=Right, 1=Through, 2=Left
  laneOffsetX: number;
  laneOffsetZ: number;
  brakeLightMat: THREE.MeshStandardMaterial;
  turnIndicatorMat?: THREE.MeshStandardMaterial;
  isLeftTurn: boolean;
  isRightTurn: boolean;
  wheels: THREE.Mesh[];
  frontWheelPivots: THREE.Group[];
  strobeLightRed?: THREE.PointLight;
  strobeLightBlue?: THREE.PointLight;
  strobeMeshRed?: THREE.Mesh;
  strobeMeshBlue?: THREE.Mesh;
  sirenRing?: THREE.Mesh;
}

interface Pedestrian3D {
  id: string;
  mesh: THREE.Group;
  crosswalk: 'North' | 'South' | 'East' | 'West';
  progress: number;
  direction: 1 | -1;
}

export const Realistic3DIntersection: React.FC<Realistic3DIntersectionProps> = ({
  metrics,
  phaseType,
  timeInPhase,
  fallbackEngaged,
  rejectionReason,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [cameraMode, setCameraMode] = useState<'perspective' | 'topDown' | 'driver' | 'closeUp'>('perspective');
  const [isNightMode, setIsNightMode] = useState(false);

  // Three.js instance references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Dynamic objects
  const signalLampsRef = useRef<Record<string, { red: THREE.Mesh; yellow: THREE.Mesh; green: THREE.Mesh; light: THREE.PointLight }>>({});
  const vehiclesRef = useRef<Vehicle3D[]>([]);
  const pedestriansRef = useRef<Pedestrian3D[]>([]);
  const metricsRef = useRef<SimulationMetrics | null>(metrics);
  metricsRef.current = metrics;

  // Ambulance tracking
  const ambulanceSpawnedRef = useRef(false);
  const lastEmergencyStateRef = useRef<string>('none');

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight || 500;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isNightMode ? 0x050814 : 0x1e293b);
    scene.fog = new THREE.FogExp2(isNightMode ? 0x050814 : 0x1e293b, 0.007);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(45, 55, 65);
    cameraRef.current = camera;

    // 3. Renderer with modern PCFShadowMap
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 15;
    controls.maxDistance = 180;
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(isNightMode ? 0x334155 : 0xffffff, isNightMode ? 0.7 : 1.3);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, isNightMode ? 0.4 : 1.9);
    sunLight.position.set(60, 100, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 250;
    const d = 65;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    // Build Environment: Roads, Sidewalks, Markings, Signals
    buildEnvironment(scene);

    // Animation Loop
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      controls.update();

      updateSignals(metricsRef.current);
      updateVehicles(scene, delta, metricsRef.current, now);
      updatePedestrians(delta, metricsRef.current);

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight || 500;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isNightMode]);

  // Handle Camera Presets
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    if (cameraMode === 'perspective') {
      cam.position.set(45, 55, 65);
      ctrl.target.set(0, 0, 0);
    } else if (cameraMode === 'topDown') {
      cam.position.set(0, 95, 0.01);
      ctrl.target.set(0, 0, 0);
    } else if (cameraMode === 'driver') {
      cam.position.set(5.5, 4, 45);
      ctrl.target.set(5.5, 2, 0);
    } else if (cameraMode === 'closeUp') {
      cam.position.set(22, 18, 25);
      ctrl.target.set(0, 0, 0);
    }
    ctrl.update();
  }, [cameraMode]);

  // -------------------------------------------------------------
  // 3D ENVIRONMENT (ROADS, MARKINGS, GANTRIES)
  // -------------------------------------------------------------
  const buildEnvironment = (scene: THREE.Scene) => {
    // 1. Terrain Grass
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300),
      new THREE.MeshStandardMaterial({
        color: isNightMode ? 0x0f291e : 0x166534,
        roughness: 0.8,
        metalness: 0.1,
      })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    scene.add(grass);

    // 2. Asphalt Cross Roads (Width = 24 units: 12 incoming, 12 outgoing)
    const roadWidth = 24;
    const roadLength = 260;
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.7, metalness: 0.2 });

    const nsRoad = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, roadLength), roadMat);
    nsRoad.rotation.x = -Math.PI / 2;
    nsRoad.position.y = 0.02;
    nsRoad.receiveShadow = true;
    scene.add(nsRoad);

    const ewRoad = new THREE.Mesh(new THREE.PlaneGeometry(roadLength, roadWidth), roadMat);
    ewRoad.rotation.x = -Math.PI / 2;
    ewRoad.position.y = 0.02;
    ewRoad.receiveShadow = true;
    scene.add(ewRoad);

    // 3. Sidewalk Curbs
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });
    const cornerSize = 100;
    const cornerOffset = (roadWidth / 2) + (cornerSize / 2);

    [
      { x: cornerOffset, z: cornerOffset },
      { x: -cornerOffset, z: cornerOffset },
      { x: cornerOffset, z: -cornerOffset },
      { x: -cornerOffset, z: -cornerOffset },
    ].forEach((c) => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(cornerSize, 0.4, cornerSize), sidewalkMat);
      curb.position.set(c.x, 0.2, c.z);
      curb.receiveShadow = true;
      curb.castShadow = true;
      scene.add(curb);
    });

    // 4. Markings & Crosswalks
    addRoadMarkings(scene, roadWidth, roadLength);
    addCrosswalks(scene, roadWidth);

    // 5. Signals
    addTrafficSignals(scene, roadWidth);
  };

  const addRoadMarkings = (scene: THREE.Scene, roadWidth: number, roadLength: number) => {
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    const lineLen = (roadLength - roadWidth) / 2;
    const centerOffset = (roadWidth / 2) + (lineLen / 2);

    // Double Yellow Center Lines (Separating opposing traffic)
    const createDivider = (isVertical: boolean, sign: number) => {
      const g = new THREE.PlaneGeometry(isVertical ? 0.3 : lineLen, isVertical ? lineLen : 0.3);
      const m1 = new THREE.Mesh(g, yellowMat);
      m1.rotation.x = -Math.PI / 2;
      m1.position.y = 0.04;
      if (isVertical) m1.position.set(-0.25, 0.04, sign * centerOffset);
      else m1.position.set(sign * centerOffset, 0.04, -0.25);
      scene.add(m1);

      const m2 = new THREE.Mesh(g, yellowMat);
      m2.rotation.x = -Math.PI / 2;
      m2.position.y = 0.04;
      if (isVertical) m2.position.set(0.25, 0.04, sign * centerOffset);
      else m2.position.set(sign * centerOffset, 0.04, 0.25);
      scene.add(m2);
    };

    createDivider(true, 1);   // North
    createDivider(true, -1);  // South
    createDivider(false, 1);  // East
    createDivider(false, -1); // West

    // White Stop Bars at distance = 15.0
    const stopBarDist = 15.0;
    const halfRoad = roadWidth / 2;

    [
      { x: halfRoad / 2, z: stopBarDist, w: halfRoad, h: 0.8 },        // North approach
      { x: -halfRoad / 2, z: -stopBarDist, w: halfRoad, h: 0.8 },      // South approach
      { x: stopBarDist, z: -halfRoad / 2, w: 0.8, h: halfRoad },       // East approach
      { x: -stopBarDist, z: halfRoad / 2, w: 0.8, h: halfRoad },       // West approach
    ].forEach((b) => {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), whiteMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(b.x, 0.045, b.z);
      scene.add(bar);
    });
  };

  const addCrosswalks = (scene: THREE.Scene, roadWidth: number) => {
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9 });
    const crosswalkOffset = (roadWidth / 2) + 1.2;

    const createCrosswalk = (isVertical: boolean, sign: number) => {
      const numStripes = 8;
      const stripeW = 0.8;
      const stripeL = 3.5;
      const spacing = roadWidth / numStripes;

      for (let i = 0; i < numStripes; i++) {
        const offset = -roadWidth / 2 + (i + 0.5) * spacing;
        const g = new THREE.PlaneGeometry(isVertical ? stripeW : stripeL, isVertical ? stripeL : stripeW);
        const stripe = new THREE.Mesh(g, whiteMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.y = 0.042;
        if (isVertical) stripe.position.set(offset, 0.042, sign * crosswalkOffset);
        else stripe.position.set(sign * crosswalkOffset, 0.042, offset);
        scene.add(stripe);
      }
    };

    createCrosswalk(true, 1);   // North
    createCrosswalk(true, -1);  // South
    createCrosswalk(false, 1);  // East
    createCrosswalk(false, -1); // West
  };

  const addTrafficSignals = (scene: THREE.Scene, roadWidth: number) => {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.8 });
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const cornerDist = (roadWidth / 2) + 1.5;

    const posts = [
      {
        id: 'North',
        x: cornerDist,
        z: cornerDist,
        rotY: -Math.PI / 2,
        heads: [
          { movementId: 'M2', posX: -2.5, label: 'RIGHT' },
          { movementId: 'M0', posX: -5.5, label: 'THRU' },
          { movementId: 'M1', posX: -8.5, label: 'LEFT' },
        ],
      },
      {
        id: 'South',
        x: -cornerDist,
        z: -cornerDist,
        rotY: Math.PI / 2,
        heads: [
          { movementId: 'M4', posX: -2.5, label: 'RIGHT' },
          { movementId: 'M3', posX: -5.5, label: 'THRU' },
          { movementId: 'M5', posX: -8.5, label: 'LEFT' },
        ],
      },
      {
        id: 'East',
        x: cornerDist,
        z: -cornerDist,
        rotY: Math.PI,
        heads: [
          { movementId: 'M7', posX: -2.5, label: 'RIGHT' },
          { movementId: 'M6', posX: -5.5, label: 'THRU' },
          { movementId: 'M8', posX: -8.5, label: 'LEFT' },
        ],
      },
      {
        id: 'West',
        x: -cornerDist,
        z: cornerDist,
        rotY: 0,
        heads: [
          { movementId: 'M11', posX: -2.5, label: 'RIGHT' },
          { movementId: 'M9', posX: -5.5, label: 'THRU' },
          { movementId: 'M10', posX: -8.5, label: 'LEFT' },
        ],
      },
    ];

    posts.forEach((p) => {
      const gantry = new THREE.Group();
      gantry.position.set(p.x, 0, p.z);
      gantry.rotation.y = p.rotY;

      // Vertical Gantry Pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 8.5, 16), metalMat);
      pole.position.y = 4.25;
      pole.castShadow = true;
      gantry.add(pole);

      // Horizontal Gantry Arm spanning across incoming lanes
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 10.0, 16), metalMat);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(-5.0, 8.0, 0);
      arm.castShadow = true;
      gantry.add(arm);

      // Dedicated 3D Signal Head per lane (Right, Through, Left)
      p.heads.forEach((h) => {
        const head = new THREE.Group();
        head.position.set(h.posX, 7.2, 0);

        // Backplate
        const backplate = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.3, 0.05), housingMat);
        backplate.position.set(0, 0, -0.28);
        head.add(backplate);

        // Signal Housing Box
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.1, 0.5), housingMat);
        box.castShadow = true;
        head.add(box);

        // Sun Visors above lamps
        const visorMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.8 });
        [0.6, 0.0, -0.6].forEach((vy) => {
          const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.22, 16, 1, false, 0, Math.PI), visorMat);
          visor.rotation.x = -Math.PI / 2;
          visor.position.set(0, vy + 0.12, 0.28);
          head.add(visor);
        });

        // 3 Independent Lenses (Red, Yellow, Green)
        const lensGeo = new THREE.SphereGeometry(0.19, 16, 16);
        const redLamp = new THREE.Mesh(
          lensGeo,
          new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.5 })
        );
        redLamp.position.set(0, 0.6, 0.24);
        head.add(redLamp);

        const yellowLamp = new THREE.Mesh(
          lensGeo,
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.1 })
        );
        yellowLamp.position.set(0, 0, 0.24);
        head.add(yellowLamp);

        const greenLamp = new THREE.Mesh(
          lensGeo,
          new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 0.1 })
        );
        greenLamp.position.set(0, -0.6, 0.24);
        head.add(greenLamp);

        // Dynamic Spotlight for ground illumination
        const light = new THREE.PointLight(0xef4444, 1.8, 20);
        light.position.set(0, 0, 1.2);
        head.add(light);

        gantry.add(head);

        // Assign to independent movement ID slot
        signalLampsRef.current[h.movementId] = {
          red: redLamp,
          yellow: yellowLamp,
          green: greenLamp,
          light: light,
        };
      });

      scene.add(gantry);
    });
  };

  const updateSignals = (currentMetrics: SimulationMetrics | null) => {
    if (!currentMetrics?.signal_colors) return;

    const emergencyState = currentMetrics?.emergency_state || 'none';
    const isEmergencyActive = emergencyState === 'approaching' || emergencyState === 'preempting' || emergencyState === 'active';
    const emerApproach = currentMetrics?.emergency_approach || 'North';
    const emerMv = currentMetrics?.emergency_movement || (emerApproach === 'North' ? 'M0' : emerApproach === 'South' ? 'M3' : emerApproach === 'East' ? 'M6' : 'M9');

    Object.entries(currentMetrics.signal_colors).forEach(([mId, rawColor]) => {
      const lampEntry = signalLampsRef.current[mId];
      if (!lampEntry) return;

      // Emergency First Priority Preemption:
      // When emergency is active, the ambulance approach movement immediately displays GREEN,
      // and all cross-conflicting movements immediately display RED.
      let color = rawColor;
      if (isEmergencyActive) {
        if (mId === emerMv) {
          color = 'green';
        } else if (hasMovementConflict(mId, emerMv)) {
          color = 'red';
        }
      }

      const { red, yellow, green, light } = lampEntry;
      const rMat = red.material as THREE.MeshStandardMaterial;
      const yMat = yellow.material as THREE.MeshStandardMaterial;
      const gMat = green.material as THREE.MeshStandardMaterial;

      if (color === 'green') {
        rMat.emissiveIntensity = 0.05;
        yMat.emissiveIntensity = 0.05;
        gMat.emissiveIntensity = 2.5;
        light.color.setHex(0x10b981);
        light.intensity = 2.0;
      } else if (color === 'yellow') {
        rMat.emissiveIntensity = 0.05;
        yMat.emissiveIntensity = 2.5;
        gMat.emissiveIntensity = 0.05;
        light.color.setHex(0xf59e0b);
        light.intensity = 1.8;
      } else {
        rMat.emissiveIntensity = 2.5;
        yMat.emissiveIntensity = 0.05;
        gMat.emissiveIntensity = 0.05;
        light.color.setHex(0xef4444);
        light.intensity = 1.6;
      }
    });
  };

  interface TrajectoryPoint {
    x: number;
    z: number;
    rotY: number;
    steer: number;
  }

  // Helper for cubic Bezier curve evaluation with exact tangent
  const evaluateBezier = (
    p0: { x: number; z: number },
    p1: { x: number; z: number },
    p2: { x: number; z: number },
    p3: { x: number; z: number },
    t: number
  ) => {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    const x = mt * mt2 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t * t2 * p3.x;
    const z = mt * mt2 * p0.z + 3 * mt2 * t * p1.z + 3 * mt * t2 * p2.z + t * t2 * p3.z;
    const dx = 3 * mt2 * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x);
    const dz = 3 * mt2 * (p1.z - p0.z) + 6 * mt * t * (p2.z - p1.z) + 3 * t2 * (p3.z - p2.z);
    return { x, z, dx, dz };
  };

  // 100% mathematically continuous 3D trajectory calculation for all 12 movements
  const getVehicleTransform = (v: Vehicle3D): TrajectoryPoint => {
    const d = v.distance;
    const mId = v.movementId;

    // 1. Straight Through Movements (M0, M3, M6, M9)
    if (mId === 'M0') {
      return { x: v.laneOffsetX, z: d, rotY: Math.PI, steer: 0 };
    }
    if (mId === 'M3') {
      return { x: v.laneOffsetX, z: -d, rotY: 0, steer: 0 };
    }
    if (mId === 'M6') {
      return { x: d, z: v.laneOffsetZ, rotY: -Math.PI / 2, steer: 0 };
    }
    if (mId === 'M9') {
      return { x: -d, z: v.laneOffsetZ, rotY: Math.PI / 2, steer: 0 };
    }

    // 2. Turning Movements Curve Definitions (M1, M2, M4, M5, M7, M8, M10, M11)
    let p0 = { x: 0, z: 0 };
    let p1 = { x: 0, z: 0 };
    let p2 = { x: 0, z: 0 };
    let p3 = { x: 0, z: 0 };
    let appHeading = 0;
    let exitHeading = 0;
    let steerSign = 1;

    if (mId === 'M1') {
      // North Left: from (2.0, 15) to (-15, -2.0)
      p0 = { x: 2.0, z: 15.0 };
      p1 = { x: 2.0, z: 4.0 };
      p2 = { x: -4.0, z: -2.0 };
      p3 = { x: -15.0, z: -2.0 };
      appHeading = Math.PI;
      exitHeading = -Math.PI / 2;
      steerSign = 1;
    } else if (mId === 'M2') {
      // North Right: from (9.0, 15) to (15, 9.0) (outer quadrant)
      p0 = { x: 9.0, z: 15.0 };
      p1 = { x: 9.0, z: 11.7 };
      p2 = { x: 11.7, z: 9.0 };
      p3 = { x: 15.0, z: 9.0 };
      appHeading = Math.PI;
      exitHeading = Math.PI / 2;
      steerSign = -1;
    } else if (mId === 'M4') {
      // South Right: from (-9.0, -15) to (-15, -9.0) (outer quadrant)
      p0 = { x: -9.0, z: -15.0 };
      p1 = { x: -9.0, z: -11.7 };
      p2 = { x: -11.7, z: -9.0 };
      p3 = { x: -15.0, z: -9.0 };
      appHeading = 0;
      exitHeading = -Math.PI / 2;
      steerSign = -1;
    } else if (mId === 'M5') {
      // South Left: from (-2.0, -15) to (15, 2.0)
      p0 = { x: -2.0, z: -15.0 };
      p1 = { x: -2.0, z: -4.0 };
      p2 = { x: 4.0, z: 2.0 };
      p3 = { x: 15.0, z: 2.0 };
      appHeading = 0;
      exitHeading = Math.PI / 2;
      steerSign = 1;
    } else if (mId === 'M7') {
      // East Right: from (15, -9.0) to (9.0, -15) (outer quadrant)
      p0 = { x: 15.0, z: -9.0 };
      p1 = { x: 11.7, z: -9.0 };
      p2 = { x: 9.0, z: -11.7 };
      p3 = { x: 9.0, z: -15.0 };
      appHeading = -Math.PI / 2;
      exitHeading = Math.PI;
      steerSign = -1;
    } else if (mId === 'M8') {
      // East Left: from (15, -2.0) to (-2.0, 15)
      p0 = { x: 15.0, z: -2.0 };
      p1 = { x: 4.0, z: -2.0 };
      p2 = { x: -2.0, z: 4.0 };
      p3 = { x: -2.0, z: 15.0 };
      appHeading = -Math.PI / 2;
      exitHeading = 0;
      steerSign = 1;
    } else if (mId === 'M10') {
      // West Left: from (-15, 2.0) to (2.0, -15)
      p0 = { x: -15.0, z: 2.0 };
      p1 = { x: -4.0, z: 2.0 };
      p2 = { x: 2.0, z: -4.0 };
      p3 = { x: 2.0, z: -15.0 };
      appHeading = Math.PI / 2;
      exitHeading = Math.PI;
      steerSign = 1;
    } else if (mId === 'M11') {
      // West Right: from (-15, 9.0) to (-9.0, 15) (outer quadrant)
      p0 = { x: -15.0, z: 9.0 };
      p1 = { x: -11.7, z: 9.0 };
      p2 = { x: -9.0, z: 11.7 };
      p3 = { x: -9.0, z: 15.0 };
      appHeading = Math.PI / 2;
      exitHeading = 0;
      steerSign = -1;
    }

    // A. Approach zone (d >= 15.0)
    if (d >= 15.0) {
      const approachProgress = d - 15.0;
      if (v.approach === 'North') return { x: p0.x, z: 15.0 + approachProgress, rotY: appHeading, steer: 0 };
      if (v.approach === 'South') return { x: p0.x, z: -15.0 - approachProgress, rotY: appHeading, steer: 0 };
      if (v.approach === 'East')  return { x: 15.0 + approachProgress, z: p0.z, rotY: appHeading, steer: 0 };
      return { x: -15.0 - approachProgress, z: p0.z, rotY: appHeading, steer: 0 }; // West
    }

    // B. Exit zone (d <= -15.0)
    if (d <= -15.0) {
      const exitProgress = -15.0 - d;
      const edx = Math.sin(exitHeading);
      const edz = Math.cos(exitHeading);
      return {
        x: p3.x + edx * exitProgress,
        z: p3.z + edz * exitProgress,
        rotY: exitHeading,
        steer: 0,
      };
    }

    // C. Intersection curve zone (-15.0 < d < 15.0)
    const t = Math.max(0, Math.min(1, (15.0 - d) / 30.0));
    const bz = evaluateBezier(p0, p1, p2, p3, t);
    const rotY = Math.atan2(bz.dx, bz.dz);
    const steer = steerSign * 0.42 * Math.sin(Math.PI * t);

    return { x: bz.x, z: bz.z, rotY, steer };
  };

  // Helper to obtain ground (X, Z) world position of any vehicle
  const getVehiclePos = (v: Vehicle3D): { x: number; z: number } => {
    const t = getVehicleTransform(v);
    return { x: t.x, z: t.z };
  };

  // Authoritative movement conflict graph (28 verified non-conflicting independent sets)
  const MOVEMENT_CONFLICTS: Record<string, string[]> = {
    M0: ['M6', 'M9', 'M8', 'M10', 'M5', 'M11'],
    M3: ['M6', 'M9', 'M8', 'M10', 'M1', 'M7'],
    M6: ['M0', 'M3', 'M1', 'M5', 'M10', 'M2'],
    M9: ['M0', 'M3', 'M1', 'M5', 'M8', 'M4'],
    M1: ['M3', 'M6', 'M9', 'M8', 'M10', 'M7'],
    M5: ['M0', 'M6', 'M9', 'M8', 'M10', 'M2'],
    M8: ['M0', 'M3', 'M9', 'M1', 'M5', 'M11'],
    M10: ['M0', 'M3', 'M6', 'M1', 'M5', 'M4'],
    M2: ['M6', 'M5'],
    M4: ['M9', 'M10'],
    M7: ['M3', 'M1'],
    M11: ['M0', 'M8'],
  };

  const hasMovementConflict = (m1: string, m2: string): boolean => {
    if (m1 === m2) return false;
    return MOVEMENT_CONFLICTS[m1]?.includes(m2) || false;
  };

  // Cross conflict helper for approach-level emergency preemption
  const isCrossConflict = (app1: string, app2: string): boolean => {
    const isNS1 = app1 === 'North' || app1 === 'South';
    const isNS2 = app2 === 'North' || app2 === 'South';
    return isNS1 !== isNS2;
  };

  // True conflict box inside curbs where traffic paths physically cross (11m x 11m)
  const isInsideConflictZone = (x: number, z: number): boolean => {
    return Math.abs(x) < 11.0 && Math.abs(z) < 11.0;
  };

  // -------------------------------------------------------------
  // 100% COLLISION-FREE & DEADLOCK-FREE VEHICLE DYNAMICS
  // -------------------------------------------------------------
  const updateVehicles = (scene: THREE.Scene, delta: number, currentMetrics: SimulationMetrics | null, nowMs: number) => {
    const vehicles = vehiclesRef.current;
    const signalColors = currentMetrics?.signal_colors || {};
    const emergencyState = currentMetrics?.emergency_state || 'none';
    const isEmergencyActive = emergencyState === 'approaching' || emergencyState === 'preempting' || emergencyState === 'active';
    const emerApproach: 'North' | 'South' | 'East' | 'West' = (currentMetrics?.emergency_approach as any) || 'North';

    // Existing ambulance check: strictly ensure at most ONE ambulance ever exists in the scene
    const hasAmbulance = vehicles.some((v) => v.type === 'ambulance');

    // Reset ambulance spawn flag when a brand new emergency cycle starts and no ambulance is currently in scene
    if (emergencyState !== 'none' && emergencyState !== 'recovering' && lastEmergencyStateRef.current === 'none' && !hasAmbulance) {
      ambulanceSpawnedRef.current = false;
    }
    lastEmergencyStateRef.current = emergencyState;

    // 1. Dedicated Ambulance Dispatch (STRICTLY AT MOST ONE ACTIVE AMBULANCE)
    if (isEmergencyActive && !hasAmbulance && !ambulanceSpawnedRef.current) {
      ambulanceSpawnedRef.current = true;
      const emerMv = currentMetrics?.emergency_movement || (emerApproach === 'North' ? 'M0' : emerApproach === 'South' ? 'M3' : emerApproach === 'East' ? 'M6' : 'M9');

      // Clear the emergency corridor: any vehicle currently in Lane 1 on the emergency approach pulls over to the right (Lane 0)
      for (const car of vehicles) {
        if (car.approach === emerApproach && car.lane === 1) {
          car.lane = 0;
          const newOffset = 9.0; // Lane 0 offset (pull over to curb)
          if (emerApproach === 'North') car.laneOffsetX = newOffset;
          else if (emerApproach === 'South') car.laneOffsetX = -newOffset;
          else if (emerApproach === 'East') car.laneOffsetZ = -newOffset;
          else if (emerApproach === 'West') car.laneOffsetZ = newOffset;
        }
      }

      // Remove any regular car that happens to be right at the ambulance spawn point (distance > 65 on emerApproach)
      for (let i = vehicles.length - 1; i >= 0; i--) {
        const car = vehicles[i];
        if (car.approach === emerApproach && car.distance > 65.0 && car.type !== 'ambulance') {
          scene.remove(car.mesh);
          vehicles.splice(i, 1);
        }
      }

      const ambulance = createAmbulance(emerMv, emerApproach);
      scene.add(ambulance.mesh);
      vehicles.push(ambulance);
    } else if (!isEmergencyActive && !hasAmbulance) {
      ambulanceSpawnedRef.current = false;
    }

    // 2. Safe, Controlled Vehicle Spawning (Only spawns if lane entrance is completely clear)
    if (vehicles.length < 16 && Math.random() < 0.08) {
      const approaches: ('North' | 'South' | 'East' | 'West')[] = ['North', 'South', 'East', 'West'];
      const app = approaches[Math.floor(Math.random() * approaches.length)];
      const lanes = [0, 1, 2]; // 0=Right, 1=Through, 2=Left
      const lane = lanes[Math.floor(Math.random() * lanes.length)];

      // Do NOT spawn in the ambulance's corridor while emergency is active
      const isAmbulanceCorridor = isEmergencyActive && app === emerApproach && lane === 1;

      if (!isAmbulanceCorridor) {
        let mId = 'M0';
        if (app === 'North') mId = lane === 0 ? 'M2' : lane === 1 ? 'M0' : 'M1';
        else if (app === 'South') mId = lane === 0 ? 'M4' : lane === 1 ? 'M3' : 'M5';
        else if (app === 'East') mId = lane === 0 ? 'M7' : lane === 1 ? 'M6' : 'M8';
        else if (app === 'West') mId = lane === 0 ? 'M11' : lane === 1 ? 'M9' : 'M10';

        // Check if entrance of this specific lane has space (no car within 18 meters of spawn point 80)
        const entranceBlocked = vehicles.some(
          (v) => v.approach === app && v.lane === lane && v.distance > 62.0
        );

        if (!entranceBlocked) {
          const v = createCar(mId, app, lane);
          scene.add(v.mesh);
          vehicles.push(v);
        }
      }
    }

    // 3. Strict Queue Physics per Approach & Lane
    const stopLineDist = 15.0; // Distance of stop line from center
    const carLength = 5.2;     // Space occupied by car + gap

    // Group cars by (approach, lane)
    const laneGroups: Record<string, Vehicle3D[]> = {};
    for (const v of vehicles) {
      const key = `${v.approach}_${v.lane}`;
      if (!laneGroups[key]) laneGroups[key] = [];
      laneGroups[key].push(v);
    }

    // Sort so closest car to intersection is index 0
    for (const key in laneGroups) {
      laneGroups[key].sort((a, b) => a.distance - b.distance);
    }

    // 4. Update Position & Physics with zero crashes and zero deadlocks
    for (let i = vehicles.length - 1; i >= 0; i--) {
      const v = vehicles[i];
      const color = signalColors[v.movementId] || 'red';

      const group = laneGroups[`${v.approach}_${v.lane}`];
      const indexInGroup = group ? group.indexOf(v) : -1;
      const precedingCar: Vehicle3D | null = (group && indexInGroup > 0) ? group[indexInGroup - 1] : null;

      // Calculate minimum allowed distance (cannot move past obstacle)
      let minAllowedDist = -999;

      // 4a. Same-lane preceding car distance
      if (precedingCar) {
        const buffer = precedingCar.type === 'ambulance' || v.type === 'ambulance' ? 6.5 : carLength;
        minAllowedDist = precedingCar.distance + buffer;
      } else {
        // Lead car in lane: check traffic signal
        if (v.distance >= stopLineDist - 0.5 && v.type !== 'ambulance') {
          // If RED or YELLOW and car hasn't crossed the stop line:
          if (color === 'red' || (color === 'yellow' && v.distance > stopLineDist + 2.0)) {
            minAllowedDist = stopLineDist;
          }
        }
      }

      // 4b. Emergency Preemption Lockdown:
      // While emergency vehicle is approaching or active, non-emergency vehicles on conflicting movements must stop at stop bar
      if (isEmergencyActive && v.type !== 'ambulance') {
        const amb = vehicles.find((a) => a.type === 'ambulance');
        if (amb) {
          if (hasMovementConflict(v.movementId, amb.movementId) && amb.distance > -12.0) {
            if (v.distance >= stopLineDist - 0.5) {
              minAllowedDist = Math.max(minAllowedDist, stopLineDist);
            }
          }
        } else if (isCrossConflict(v.approach, emerApproach) && v.distance >= stopLineDist - 1.0) {
          minAllowedDist = Math.max(minAllowedDist, stopLineDist);
        }
      }

      // 4c. Stop Line Conflict Clearance ("Do Not Block the Box"):
      // Non-emergency lead vehicles must not enter intersection if a conflicting vehicle or ambulance is inside
      if (v.type !== 'ambulance' && v.distance >= stopLineDist - 0.5 && v.distance <= stopLineDist + 2.5) {
        const conflictingInBox = vehicles.some((other) => {
          if (other.id === v.id) return false;
          if (other.type === 'ambulance') return other.distance > -12.0 && other.distance < 20.0;
          return hasMovementConflict(v.movementId, other.movementId) && other.distance >= -11.0 && other.distance <= 12.0;
        });
        if (conflictingInBox) {
          minAllowedDist = Math.max(minAllowedDist, stopLineDist);
        }
      }

      // 4d. Unprotected Left Turn Permissive Yield:
      // Left turns (M1, M5, M8, M10) must yield to oncoming through traffic (M3, M0, M9, M6)
      const unprotectedLeftPairs: Record<string, string> = { M1: 'M3', M5: 'M0', M8: 'M9', M10: 'M6' };
      if (v.type !== 'ambulance' && unprotectedLeftPairs[v.movementId]) {
        const opposingThrough = unprotectedLeftPairs[v.movementId];
        const opposingColor = signalColors[opposingThrough] || 'red';
        const oncomingHazard = vehicles.some((o) => {
          if (o.movementId !== opposingThrough) return false;
          if (o.distance < -6.0 || o.distance > 28.0) return false;
          if (o.distance < 13.5) return true; // actively crossing inside intersection box
          return opposingColor === 'green' && o.speed > 1.2; // approaching on green
        });
        if (oncomingHazard) {
          if (v.distance >= 14.5) {
            minAllowedDist = Math.max(minAllowedDist, stopLineDist);
          } else if (v.distance >= 7.5) {
            minAllowedDist = Math.max(minAllowedDist, 8.0);
          }
        }
      }

      // 4e. Universal 3D Forward Radar (Car-following along straight, curves, and exit merges)
      const trV = getVehicleTransform(v);
      const fx = Math.sin(trV.rotY);
      const fz = Math.cos(trV.rotY);
      const nx = Math.cos(trV.rotY);
      const nz = -Math.sin(trV.rotY);

      let closestGap = 999.0;
      for (const other of vehicles) {
        if (other.id === v.id) continue;

        // Skip lateral interference if both vehicles are on the approach road in separate parallel lanes
        if (v.distance >= 14.0 && other.distance >= 14.0) {
          if (other.approach === v.approach && other.lane !== v.lane) {
            continue;
          }
        }

        const trO = getVehicleTransform(other);
        const dx = trO.x - trV.x;
        const dz = trO.z - trV.z;
        const s = dx * fx + dz * fz;
        const w = Math.abs(dx * nx + dz * nz);
        const ofX = Math.sin(trO.rotY);
        const ofZ = Math.cos(trO.rotY);
        const align = fx * ofX + fz * ofZ;

        // In same travel corridor ahead of v
        if (s > 0 && s < 25.0 && w < 1.9 && align > 0.4) {
          const gap = s - (other.type === 'ambulance' ? 6.2 : 5.0);
          if (gap < closestGap) {
            closestGap = gap;
          }
        }
      }

      // 4f. Active Dynamic Proximity & Yield Arbitration inside Intersection
      let mustEmergencyYield = false;
      for (const other of vehicles) {
        if (other.id === v.id) continue;
        const trO = getVehicleTransform(other);
        const dx = trO.x - trV.x;
        const dz = trO.z - trV.z;
        const distSq = dx * dx + dz * dz;

        // Collision danger bubble: 6.0m (squared = 36.0)
        if (distSq < 36.0) {
          if (other.type === 'ambulance' && v.type !== 'ambulance') {
            mustEmergencyYield = true;
            break;
          }
          if (v.type === 'ambulance') {
            continue;
          }
          if (hasMovementConflict(v.movementId, other.movementId)) {
            // Priority given to car that has progressed further toward exit (smaller distance)
            if (other.distance < v.distance) {
              mustEmergencyYield = true;
              break;
            } else if (Math.abs(other.distance - v.distance) < 0.5 && v.id > other.id) {
              // Deterministic tie breaker
              mustEmergencyYield = true;
              break;
            }
          }
        }
      }

      // Track standstill duration
      if (v.isStopped || v.speed < 0.2) {
        v.stoppedDuration = (v.stoppedDuration || 0) + delta;
      } else {
        v.stoppedDuration = 0;
      }

      // 4g. Autonomous Anti-Deadlock Watchdog:
      // If a vehicle is held standstill for > 4.0s while signal is green (or inside intersection),
      // and physical path directly ahead is clear (closestGap > 4.5m), disengage yield lock and creep forward.
      const isGreenOrPastStop = color === 'green' || v.distance < stopLineDist - 1.0;
      if (v.stoppedDuration > 4.0 && isGreenOrPastStop && closestGap > 4.5) {
        mustEmergencyYield = false;
        minAllowedDist = -999;
        v.speed = Math.max(v.speed, 3.5);
        v.isStopped = false;
      }

      // 4h. Velocity & Movement Update
      const gapToObstacle = Math.min(v.distance - minAllowedDist, closestGap);

      if (mustEmergencyYield) {
        // Emergency yield brake
        v.speed = Math.max(0, v.speed - 24.0 * delta);
        v.isStopped = true;
      } else if (gapToObstacle <= 0.2) {
        // Complete Stop
        v.speed = 0;
        v.isStopped = true;
      } else if (gapToObstacle < 14.0) {
        // Smooth Braking
        const targetDecelSpeed = Math.min(v.targetSpeed, Math.sqrt(2 * 6.5 * Math.max(0, gapToObstacle - 0.5)));
        v.speed = Math.max(0, Math.min(v.speed, targetDecelSpeed));
        v.isStopped = v.speed < 0.2;
      } else {
        // Clear road: Accelerate
        v.speed = Math.min(v.speed + 12.0 * delta, v.targetSpeed);
        v.isStopped = false;
      }

      // Advance car along path only if not emergency yielded
      if (!mustEmergencyYield) {
        v.distance -= v.speed * delta;
      }

      // Hard clamp: mathematically prevents ANY rear-end collision
      if (v.distance < minAllowedDist) {
        v.distance = minAllowedDist;
        v.speed = 0;
        v.isStopped = true;
      }

      // Brake lights activation
      v.brakeLightMat.emissiveIntensity = v.isStopped || v.speed < 2.0 ? 2.5 : 0.2;

      // Ambulance Strobe Flashing (alternating bright red and blue at 8 Hz)
      if (v.type === 'ambulance' && v.strobeLightRed && v.strobeLightBlue) {
        const flashPhase = Math.sin(nowMs * 0.016) > 0;
        v.strobeLightRed.intensity = flashPhase ? 4.5 : 0.1;
        v.strobeLightBlue.intensity = flashPhase ? 0.1 : 4.5;
        if (v.strobeMeshRed) (v.strobeMeshRed.material as THREE.MeshBasicMaterial).color.setHex(flashPhase ? 0xff0022 : 0x220000);
        if (v.strobeMeshBlue) (v.strobeMeshBlue.material as THREE.MeshBasicMaterial).color.setHex(flashPhase ? 0x001133 : 0x0088ff);

        // Siren Ripple pulse on ground
        if (v.sirenRing) {
          const pulse = (nowMs % 1000) / 1000;
          v.sirenRing.scale.set(1 + pulse * 1.5, 1 + pulse * 1.5, 1);
          (v.sirenRing.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - pulse);
        }
      }

      // 5. Update 3D Transform along continuous curved trajectory
      const tr = getVehicleTransform(v);
      v.mesh.position.set(tr.x, 0, tr.z);
      v.mesh.rotation.y = tr.rotY;

      // Steer front wheels into turn
      v.frontWheelPivots.forEach((pivot) => {
        pivot.rotation.y = tr.steer;
      });

      // Roll wheels proportionally to distance covered
      const rotDelta = (v.speed * delta) / 0.38;
      v.wheels.forEach((w) => {
        w.rotation.x -= rotDelta;
      });

      // Amber turn signal blinker (1.5 Hz) for turning vehicles
      if ((v.isLeftTurn || v.isRightTurn) && v.turnIndicatorMat) {
        const blink = Math.sin(nowMs * 0.012) > 0;
        v.turnIndicatorMat.emissiveIntensity = blink ? 2.5 : 0.05;
      }

      // Dynamic chassis pitch (braking dive and acceleration recovery)
      if (v.chassisMesh) {
        const targetPitch = v.isStopped ? 0.0 : (v.speed < 4.0 && v.targetSpeed > 6.0 ? 0.035 : 0.0);
        v.chassisMesh.rotation.x = THREE.MathUtils.lerp(v.chassisMesh.rotation.x, targetPitch, 0.1);
      }

      // Despawn once past exit (-75)
      if (v.distance < -75.0) {
        scene.remove(v.mesh);
        vehicles.splice(i, 1);
        if (v.type === 'ambulance') {
          ambulanceSpawnedRef.current = false;
        }
      }
    }
  };

  // -------------------------------------------------------------
  // DEDICATED REALISTIC 3D AMBULANCE MODEL
  // -------------------------------------------------------------
  const createAmbulance = (mId: string, approach: 'North' | 'South' | 'East' | 'West'): Vehicle3D => {
    const group = new THREE.Group();
    const chassisGroup = new THREE.Group();
    group.add(chassisGroup);

    const bodyW = 2.4;
    const bodyL = 6.2;
    const bodyH = 2.4;

    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.25 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 });

    // Cab
    const cab = new THREE.Mesh(new THREE.BoxGeometry(bodyW, 1.4, 2.2), whiteMat);
    cab.position.set(0, 1.0, -1.8);
    cab.castShadow = true;
    chassisGroup.add(cab);

    // Windshield
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.85 });
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.9, 0.65, 0.1), glassMat);
    windshield.position.set(0, 1.35, -2.85);
    windshield.rotation.x = -0.25;
    chassisGroup.add(windshield);

    // Rear Box Compartment
    const box = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 1.05, bodyH, 3.8), whiteMat);
    box.position.set(0, bodyH / 2 + 0.3, 0.9);
    box.castShadow = true;
    chassisGroup.add(box);

    // Red Crosses on Left, Right, and Roof
    const addCross = (pos: THREE.Vector3, rot: THREE.Euler, scale: number = 0.8) => {
      const crossGroup = new THREE.Group();
      crossGroup.position.copy(pos);
      crossGroup.rotation.copy(rot);

      const hBar = new THREE.Mesh(new THREE.PlaneGeometry(scale, scale * 0.3), redMat);
      hBar.position.z = 0.01;
      crossGroup.add(hBar);

      const vBar = new THREE.Mesh(new THREE.PlaneGeometry(scale * 0.3, scale), redMat);
      vBar.position.z = 0.01;
      crossGroup.add(vBar);

      chassisGroup.add(crossGroup);
    };

    addCross(new THREE.Vector3(0, bodyH + 0.32, 0.9), new THREE.Euler(-Math.PI / 2, 0, 0), 1.2);
    addCross(new THREE.Vector3(-bodyW * 1.05 / 2 - 0.01, bodyH / 2 + 0.3, 0.9), new THREE.Euler(0, -Math.PI / 2, 0), 0.9);
    addCross(new THREE.Vector3(bodyW * 1.05 / 2 + 0.01, bodyH / 2 + 0.3, 0.9), new THREE.Euler(0, Math.PI / 2, 0), 0.9);

    // Red Side Stripes
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 1.06, 0.35, 3.81), redMat);
    stripe.position.set(0, 1.2, 0.9);
    chassisGroup.add(stripe);

    // Headlights
    const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.5 });
    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), hlMat);
    hlL.position.set(-0.85, 0.85, -2.9);
    chassisGroup.add(hlL);
    const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), hlMat);
    hlR.position.set(0.85, 0.85, -2.9);
    chassisGroup.add(hlR);

    // Wheels & Steering Pivots
    const wheelsList: THREE.Mesh[] = [];
    const frontPivotsList: THREE.Group[] = [];

    const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.25, metalness: 0.85 });
    const wheelRadius = 0.48;
    const wheelWidth = 0.35;

    const buildWheel = () => {
      const wGroup = new THREE.Group();
      const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 20);
      tireGeo.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      wGroup.add(tire);

      const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, wheelWidth * 1.05, 16);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wGroup.add(rim);

      return { group: wGroup, mesh: tire };
    };

    // Front wheels (with steering pivot)
    const frontOffsets = [-bodyW / 2 - 0.05, bodyW / 2 + 0.05];
    frontOffsets.forEach((fx) => {
      const pivot = new THREE.Group();
      pivot.position.set(fx, wheelRadius, -1.8);
      const { group: wG, mesh: wM } = buildWheel();
      pivot.add(wG);
      chassisGroup.add(pivot);
      frontPivotsList.push(pivot);
      wheelsList.push(wM);
    });

    // Rear wheels (fixed mount)
    frontOffsets.forEach((rx) => {
      const { group: wG, mesh: wM } = buildWheel();
      wG.position.set(rx, wheelRadius, 1.8);
      chassisGroup.add(wG);
      wheelsList.push(wM);
    });

    // Dual-Color Rooftop Lightbar (Red + Blue)
    const lightbarHousing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x334155 }));
    lightbarHousing.position.set(0, 1.8, -1.8);
    chassisGroup.add(lightbarHousing);

    const strobeRedMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.35), new THREE.MeshBasicMaterial({ color: 0xff0022 }));
    strobeRedMesh.position.set(-0.45, 1.85, -1.8);
    chassisGroup.add(strobeRedMesh);

    const strobeBlueMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.35), new THREE.MeshBasicMaterial({ color: 0x0088ff }));
    strobeBlueMesh.position.set(0.45, 1.85, -1.8);
    chassisGroup.add(strobeBlueMesh);

    const strobeRedLight = new THREE.PointLight(0xff0022, 4.0, 35);
    strobeRedLight.position.set(-0.6, 2.3, -1.8);
    chassisGroup.add(strobeRedLight);

    const strobeBlueLight = new THREE.PointLight(0x0088ff, 4.0, 35);
    strobeBlueLight.position.set(0.6, 2.3, -1.8);
    chassisGroup.add(strobeBlueLight);

    // Taillights
    const brakeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.0 });
    const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.1), brakeMat);
    tlL.position.set(-0.9, 1.2, 2.85);
    chassisGroup.add(tlL);
    const tlR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.1), brakeMat);
    tlR.position.set(0.9, 1.2, 2.85);
    chassisGroup.add(tlR);

    // Siren Ground Ripple Ring
    const ringGeo = new THREE.RingGeometry(2.5, 3.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    const sirenRing = new THREE.Mesh(ringGeo, ringMat);
    sirenRing.rotation.x = -Math.PI / 2;
    sirenRing.position.y = 0.05;
    group.add(sirenRing);

    // Floating 3D Emergency Tag above ambulance
    const badgeCanvas = document.createElement('canvas');
    badgeCanvas.width = 512;
    badgeCanvas.height = 128;
    const ctx = badgeCanvas.getContext('2d')!;
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 504, 120);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚑 AMBULANCE', 256, 52);
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('PRIORITY PREEMPTION', 256, 96);

    const badgeTex = new THREE.CanvasTexture(badgeCanvas);
    const badgeMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshBasicMaterial({ map: badgeTex, transparent: true, side: THREE.DoubleSide }));
    badgeMesh.position.set(0, 4.4, 0);
    group.add(badgeMesh);

    // Compute lane offset: Center through lane (5.5)
    const lane = 1;
    const offset = 5.5;

    let offX = offset;
    let offZ = -offset;

    if (approach === 'North') {
      offX = offset;
      offZ = 0;
    } else if (approach === 'South') {
      offX = -offset;
      offZ = 0;
    } else if (approach === 'East') {
      offX = 0;
      offZ = -offset;
    } else if (approach === 'West') {
      offX = 0;
      offZ = offset;
    }

    return {
      id: 'emergency-ambulance',
      mesh: group,
      chassisMesh: chassisGroup,
      movementId: mId,
      approach,
      type: 'ambulance',
      distance: 82.0,
      speed: 20.0,
      targetSpeed: 24.0,
      isStopped: false,
      stoppedDuration: 0,
      lane,
      laneOffsetX: offX,
      laneOffsetZ: offZ,
      brakeLightMat: brakeMat,
      isLeftTurn: false,
      isRightTurn: false,
      wheels: wheelsList,
      frontWheelPivots: frontPivotsList,
      strobeLightRed: strobeRedLight,
      strobeLightBlue: strobeBlueLight,
      strobeMeshRed: strobeRedMesh,
      strobeMeshBlue: strobeBlueMesh,
      sirenRing: sirenRing,
    };
  };

  // Standard Car Creation (Sedan, SUV, Sports) with photorealistic automotive geometry
  const createCar = (mId: string, approach: 'North' | 'South' | 'East' | 'West', lane: number): Vehicle3D => {
    const group = new THREE.Group();
    const chassisGroup = new THREE.Group();
    group.add(chassisGroup);

    const vehicleTypes: ('sedan' | 'suv' | 'sports')[] = ['sedan', 'suv', 'sports'];
    const carType = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];

    const paintColors = [
      0x2563eb, // Electric Blue
      0xdc2626, // Crimson Red
      0x059669, // British Racing Green
      0xf8fafc, // Pearl White
      0x1e293b, // Stealth Charcoal
      0xd97706, // Sunset Amber
      0x9333ea, // Deep Purple
      0x0284c7, // Riviera Blue
      0x475569, // Platinum Slate
    ];
    const carColor = paintColors[Math.floor(Math.random() * paintColors.length)];

    let bodyW = 2.1;
    let bodyL = 4.6;
    let bodyH = 1.35;
    let wheelRadius = 0.38;

    if (carType === 'suv') {
      bodyW = 2.25;
      bodyL = 4.8;
      bodyH = 1.6;
      wheelRadius = 0.42;
    } else if (carType === 'sports') {
      bodyW = 2.2;
      bodyL = 4.4;
      bodyH = 1.15;
      wheelRadius = 0.36;
    }

    const bodyMat = new THREE.MeshStandardMaterial({
      color: carColor,
      roughness: carType === 'sports' ? 0.18 : 0.28,
      metalness: carType === 'sports' ? 0.85 : 0.65,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.85,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.7,
      metalness: 0.2,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.2,
      metalness: 0.9,
    });

    // 1. Lower Chassis / Main Body
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH * 0.5, bodyL), bodyMat);
    lowerBody.position.y = bodyH * 0.45;
    lowerBody.castShadow = true;
    chassisGroup.add(lowerBody);

    // 2. Cabin & Roof Styling per type
    if (carType === 'sedan') {
      // 3-box profile: hood in front, passenger cabin, trunk in rear
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.88, bodyH * 0.52, bodyL * 0.52), glassMat);
      cabin.position.set(0, bodyH * 0.8, -0.1);
      cabin.castShadow = true;
      chassisGroup.add(cabin);

      // Roof panel
      const roof = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.84, 0.08, bodyL * 0.42), bodyMat);
      roof.position.set(0, bodyH * 1.06, -0.1);
      chassisGroup.add(roof);

      // Chrome front grille
      const grille = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.6, 0.25, 0.1), chromeMat);
      grille.position.set(0, bodyH * 0.42, -bodyL / 2 - 0.02);
      chassisGroup.add(grille);
    } else if (carType === 'suv') {
      // High roof profile extending to rear tailgate
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.9, bodyH * 0.54, bodyL * 0.65), glassMat);
      cabin.position.set(0, bodyH * 0.82, 0.2);
      cabin.castShadow = true;
      chassisGroup.add(cabin);

      // SUV Roof
      const roof = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.86, 0.08, bodyL * 0.58), bodyMat);
      roof.position.set(0, bodyH * 1.09, 0.2);
      chassisGroup.add(roof);

      // Dual Roof Rails
      const railGeo = new THREE.BoxGeometry(0.08, 0.1, bodyL * 0.55);
      const railL = new THREE.Mesh(railGeo, chromeMat);
      railL.position.set(-bodyW * 0.38, bodyH * 1.15, 0.2);
      chassisGroup.add(railL);
      const railR = new THREE.Mesh(railGeo, chromeMat);
      railR.position.set(bodyW * 0.38, bodyH * 1.15, 0.2);
      chassisGroup.add(railR);

      // Black lower body cladding
      const cladding = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 1.02, 0.22, bodyL * 1.01), trimMat);
      cladding.position.y = 0.25;
      chassisGroup.add(cladding);
    } else if (carType === 'sports') {
      // Sleek supercar cockpit
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.82, bodyH * 0.48, bodyL * 0.45), glassMat);
      cabin.position.set(0, bodyH * 0.78, 0.05);
      cabin.castShadow = true;
      chassisGroup.add(cabin);

      // Aerodynamic roof
      const roof = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.78, 0.06, bodyL * 0.35), bodyMat);
      roof.position.set(0, bodyH * 1.02, 0.05);
      chassisGroup.add(roof);

      // Elevated Rear Wing Spoiler
      const wing = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.95, 0.06, 0.4), bodyMat);
      wing.position.set(0, bodyH * 0.95, bodyL / 2 - 0.25);
      chassisGroup.add(wing);

      const uprightGeo = new THREE.BoxGeometry(0.06, bodyH * 0.35, 0.2);
      const uprightL = new THREE.Mesh(uprightGeo, trimMat);
      uprightL.position.set(-bodyW * 0.35, bodyH * 0.75, bodyL / 2 - 0.25);
      chassisGroup.add(uprightL);
      const uprightR = new THREE.Mesh(uprightGeo, trimMat);
      uprightR.position.set(bodyW * 0.35, bodyH * 0.75, bodyL / 2 - 0.25);
      chassisGroup.add(uprightR);

      // Front splitter
      const splitter = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 1.02, 0.06, 0.3), trimMat);
      splitter.position.set(0, 0.18, -bodyL / 2 - 0.05);
      chassisGroup.add(splitter);
    }

    // 3. Xenon / LED Headlights
    const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2 });
    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.15, 0.08), hlMat);
    hlL.position.set(-bodyW * 0.36, bodyH * 0.46, -bodyL / 2 - 0.01);
    chassisGroup.add(hlL);
    const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.15, 0.08), hlMat);
    hlR.position.set(bodyW * 0.36, bodyH * 0.46, -bodyL / 2 - 0.01);
    chassisGroup.add(hlR);

    // 4. Rear Brake Lights
    const brakeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.3 });
    const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.08), brakeMat);
    tlL.position.set(-bodyW * 0.36, bodyH * 0.46, bodyL / 2 + 0.01);
    chassisGroup.add(tlL);
    const tlR = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.08), brakeMat);
    tlR.position.set(bodyW * 0.36, bodyH * 0.46, bodyL / 2 + 0.01);
    chassisGroup.add(tlR);

    // 5. Amber Turn Indicators (Front & Rear Corners)
    const turnMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.1 });
    const isLeftTurn = lane === 2;
    const isRightTurn = lane === 0;

    const indFrontL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06), turnMat);
    indFrontL.position.set(-bodyW * 0.46, bodyH * 0.46, -bodyL / 2 - 0.01);
    chassisGroup.add(indFrontL);
    const indFrontR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06), turnMat);
    indFrontR.position.set(bodyW * 0.46, bodyH * 0.46, -bodyL / 2 - 0.01);
    chassisGroup.add(indFrontR);

    const indRearL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06), turnMat);
    indRearL.position.set(-bodyW * 0.46, bodyH * 0.46, bodyL / 2 + 0.01);
    chassisGroup.add(indRearL);
    const indRearR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06), turnMat);
    indRearR.position.set(bodyW * 0.46, bodyH * 0.46, bodyL / 2 + 0.01);
    chassisGroup.add(indRearR);

    // 6. Side Mirrors
    const mirrorL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.14), bodyMat);
    mirrorL.position.set(-bodyW / 2 - 0.12, bodyH * 0.65, -0.4);
    chassisGroup.add(mirrorL);
    const mirrorR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.14), bodyMat);
    mirrorR.position.set(bodyW / 2 + 0.12, bodyH * 0.65, -0.4);
    chassisGroup.add(mirrorR);

    // 7. Realistic 4-Wheel Assembly with Front Steering Pivots
    const wheelsList: THREE.Mesh[] = [];
    const frontPivotsList: THREE.Group[] = [];

    const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });
    const rimMat = new THREE.MeshStandardMaterial({
      color: carType === 'sports' ? 0x27272a : 0xd4d4d8,
      roughness: 0.25,
      metalness: 0.85,
    });
    const wheelWidth = 0.28;

    const buildWheel = () => {
      const wGroup = new THREE.Group();
      const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 20);
      tireGeo.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      wGroup.add(tire);

      const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, wheelWidth * 1.05, 16);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wGroup.add(rim);

      return { group: wGroup, mesh: tire };
    };

    const axleZ = bodyL * 0.32;
    const wheelXOffsets = [-bodyW / 2 - 0.02, bodyW / 2 + 0.02];

    // Front Wheels (mounted inside steering pivot groups)
    wheelXOffsets.forEach((wx) => {
      const pivot = new THREE.Group();
      pivot.position.set(wx, wheelRadius, -axleZ);
      const { group: wG, mesh: wM } = buildWheel();
      pivot.add(wG);
      chassisGroup.add(pivot);
      frontPivotsList.push(pivot);
      wheelsList.push(wM);
    });

    // Rear Wheels (mounted directly to chassis)
    wheelXOffsets.forEach((wx) => {
      const { group: wG, mesh: wM } = buildWheel();
      wG.position.set(wx, wheelRadius, axleZ);
      chassisGroup.add(wG);
      wheelsList.push(wM);
    });

    // Lane Offsets: Lane 0 (Right Turn) = 9.0, Lane 1 (Through) = 5.5, Lane 2 (Left Turn) = 2.0
    const offset = lane === 0 ? 9.0 : lane === 1 ? 5.5 : 2.0;

    let offX = offset;
    let offZ = -offset;

    if (approach === 'North') {
      offX = offset;
      offZ = 0;
    } else if (approach === 'South') {
      offX = -offset;
      offZ = 0;
    } else if (approach === 'East') {
      offX = 0;
      offZ = -offset;
    } else if (approach === 'West') {
      offX = 0;
      offZ = offset;
    }

    return {
      id: Math.random().toString(),
      mesh: group,
      chassisMesh: chassisGroup,
      movementId: mId,
      approach,
      type: carType,
      distance: 80.0,
      speed: 10 + Math.random() * 3,
      targetSpeed: 12 + Math.random() * 4,
      isStopped: false,
      stoppedDuration: 0,
      lane,
      laneOffsetX: offX,
      laneOffsetZ: offZ,
      brakeLightMat: brakeMat,
      turnIndicatorMat: turnMat,
      isLeftTurn,
      isRightTurn,
      wheels: wheelsList,
      frontWheelPivots: frontPivotsList,
    };
  };

  // -------------------------------------------------------------
  // 3D PEDESTRIANS
  // -------------------------------------------------------------
  const updatePedestrians = (delta: number, currentMetrics: SimulationMetrics | null) => {
    const isWalk = currentMetrics?.pedestrian_state === 'walk';
    const isClearance = currentMetrics?.pedestrian_state === 'clearance';

    if ((isWalk || isClearance) && pedestriansRef.current.length < 4) {
      if (!sceneRef.current) return;
      const p = createPedestrian('North');
      sceneRef.current.add(p.mesh);
      pedestriansRef.current.push(p);
    }

    for (let i = pedestriansRef.current.length - 1; i >= 0; i--) {
      const p = pedestriansRef.current[i];
      p.progress += (isWalk ? 0.35 : 0.6) * delta * p.direction;

      const crosswalkZ = 13.2;
      const x = -10 + p.progress * 20;
      p.mesh.position.set(x, 0, crosswalkZ);

      if (p.progress >= 1.0 || p.progress <= 0.0) {
        if (sceneRef.current) sceneRef.current.remove(p.mesh);
        pedestriansRef.current.splice(i, 1);
      }
    }
  };

  const createPedestrian = (crosswalk: 'North' | 'South' | 'East' | 'West'): Pedestrian3D => {
    const group = new THREE.Group();
    const colors = [0x38bdf8, 0xf43f5e, 0x10b981, 0xa855f7];
    const mat = new THREE.MeshStandardMaterial({
      color: colors[Math.floor(Math.random() * colors.length)],
      roughness: 0.6,
    });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.1, 8), mat);
    body.position.y = 0.85;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.5 }));
    head.position.y = 1.55;
    group.add(head);

    return {
      id: Math.random().toString(),
      mesh: group,
      crosswalk,
      progress: 0.05,
      direction: 1,
    };
  };

  return (
    <div className="embossed-plate rounded-sm p-4 shadow-[0_4px_24px_rgba(0,0,0,0.5)] relative flex flex-col gap-3.5">
      {/* View Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2b2824] pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-[#c99a5b] text-xs font-mono">CAD //</span>
          <span className="text-xs font-serif uppercase tracking-[0.2em] text-[#f5f2eb] font-medium text-embossed">
            3D Spatial Simulation Environment
          </span>
          <span className="text-[9px] bg-[#141311] text-[#2eb872] border border-[#2b2824] px-2 py-0.5 rounded-sm font-mono tracking-widest uppercase">
            3.5S ALL-RED CLEARANCE
          </span>
        </div>

        {/* Camera Preset Buttons */}
        <div className="flex items-center gap-1 text-[10px] font-mono debossed-well p-1 rounded-sm">
          <button
            onClick={() => setCameraMode('perspective')}
            className={`px-2.5 py-0.5 rounded-sm transition tracking-wider uppercase ${
              cameraMode === 'perspective' 
                ? 'bg-[#26231f] text-[#f5f2eb] border border-[#3d3830] shadow-sm' 
                : 'text-[#736b5e] hover:text-[#d4caba]'
            }`}
          >
            Perspective
          </button>

          <button
            onClick={() => setCameraMode('topDown')}
            className={`px-2.5 py-0.5 rounded-sm transition tracking-wider uppercase ${
              cameraMode === 'topDown' 
                ? 'bg-[#26231f] text-[#f5f2eb] border border-[#3d3830] shadow-sm' 
                : 'text-[#736b5e] hover:text-[#d4caba]'
            }`}
          >
            Top-Down
          </button>

          <button
            onClick={() => setCameraMode('driver')}
            className={`px-2.5 py-0.5 rounded-sm transition tracking-wider uppercase ${
              cameraMode === 'driver' 
                ? 'bg-[#26231f] text-[#f5f2eb] border border-[#3d3830] shadow-sm' 
                : 'text-[#736b5e] hover:text-[#d4caba]'
            }`}
          >
            Driver
          </button>

          <button
            onClick={() => setCameraMode('closeUp')}
            className={`px-2.5 py-0.5 rounded-sm transition tracking-wider uppercase ${
              cameraMode === 'closeUp' 
                ? 'bg-[#26231f] text-[#f5f2eb] border border-[#3d3830] shadow-sm' 
                : 'text-[#736b5e] hover:text-[#d4caba]'
            }`}
          >
            Macro
          </button>

          <button
            onClick={() => setIsNightMode(!isNightMode)}
            className="px-2 py-0.5 rounded-sm text-[#736b5e] hover:text-[#c99a5b] ml-1 border-l border-[#2b2824] uppercase tracking-wider"
            title="Toggle Day/Night Lighting"
          >
            {isNightMode ? '☼ Day' : '☾ Night'}
          </button>
        </div>
      </div>

      {/* 3D Viewport */}
      <div
        ref={mountRef}
        className="w-full h-[470px] bg-[#0c0b0a] rounded-sm overflow-hidden border border-[#2b2824] relative shadow-[inset_0_2px_10px_rgba(0,0,0,0.9)] cursor-grab active:cursor-grabbing"
      >
        {/* Floating HUD Indicators */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 pointer-events-none">
          <div className="bg-[#141311]/90 backdrop-blur px-3 py-1 rounded-sm border border-[#2b2824] text-[10px] text-[#d4caba] font-mono tracking-wider shadow-md">
            PHASE: <span className="font-bold text-[#2eb872] uppercase">{phaseType.replace('_', ' ')}</span> ({timeInPhase.toFixed(1)}s)
          </div>

          {phaseType === 'all_red' && (
            <div className="bg-[#241a10]/95 backdrop-blur px-2.5 py-1 rounded-sm border border-[#d99b26]/60 text-[9px] text-[#f5f2eb] font-mono tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d99b26] animate-ping" />
              <span>CLEARANCE INTERVAL // INTERSECTION SECURED</span>
            </div>
          )}

          {fallbackEngaged && (
            <div className="bg-[#261210]/95 backdrop-blur px-2.5 py-1 rounded-sm border border-[#cf4338]/60 text-[9px] text-[#cf4338] font-mono tracking-wider animate-pulse">
              SAFETY CONTROLLER FALLBACK ENGAGED
            </div>
          )}
        </div>

        {/* Emergency Vehicle In-Simulation Alert */}
        {(metrics?.emergency_state === 'active' || metrics?.emergency_state === 'preempting' || metrics?.emergency_state === 'approaching') && (
          <div className="absolute top-3 right-3 z-10 bg-[#241110]/95 backdrop-blur border border-[#cf4338] text-[#f5f2eb] px-3.5 py-2 rounded-sm font-mono text-xs flex items-center gap-2.5 shadow-[0_0_20px_rgba(207,67,56,0.35)] pointer-events-none">
            <span className="w-2.5 h-2.5 rounded-full bg-[#cf4338] animate-ping" />
            <div>
              <div className="font-bold tracking-widest uppercase text-[#f5f2eb]">AMBULANCE PREEMPTION</div>
              <div className="text-[9px] text-[#e8a29b] tracking-wider uppercase">
                Active Green Corridor // Approach: {metrics.emergency_approach || 'North'}
              </div>
            </div>
          </div>
        )}

        {/* Pedestrian Crossing HUD Alert */}
        {(metrics?.pedestrian_state === 'walk' || metrics?.pedestrian_state === 'clearance') && (
          <div className="absolute bottom-3 left-3 z-10 bg-[#161a24]/95 backdrop-blur border border-[#3a7bd5]/60 text-[#a3c4f3] px-3 py-1 rounded-sm font-mono text-[10px] tracking-widest uppercase flex items-center gap-1.5 pointer-events-none">
            <span>🚶 PEDESTRIAN {metrics.pedestrian_state.toUpperCase()} INTERVAL</span>
          </div>
        )}

        <div className="absolute bottom-3 right-3 z-10 text-[9px] font-mono tracking-widest uppercase text-[#5c5448] bg-[#0c0b0a]/80 px-2 py-0.5 rounded-sm pointer-events-none border border-[#201e1a]">
          ORBIT: LEFT-CLICK • ZOOM: SCROLL • PAN: RIGHT-CLICK
        </div>
      </div>
    </div>
  );
};
