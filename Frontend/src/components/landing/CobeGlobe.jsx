import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// ─── Geo to 3D Sphere conversion ──────────────────────────────────────────────
const latLonToVector3 = (lat, lon, radius) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
};

// ─── Major Global Hubs ────────────────────────────────────────────────────────
const CITIES = [
  { name: 'New York',  lat: 40.71,  lon: -74.01, color: '#FFC81E' },
  { name: 'London',    lat: 51.51,  lon: -0.13,  color: '#73A5CA' },
  { name: 'Tokyo',     lat: 35.68,  lon: 139.65, color: '#E87F24' },
  { name: 'Delhi',     lat: 28.61,  lon: 77.21,  color: '#FFC81E' },
  { name: 'Singapore', lat: 1.35,   lon: 103.82, color: '#E87F24' },
  { name: 'Sydney',    lat: -33.87, lon: 151.21, color: '#73A5CA' },
  { name: 'São Paulo', lat: -23.55, lon: -46.63, color: '#FFC81E' },
  { name: 'Dubai',     lat: 25.20,  lon: 55.27,  color: '#E87F24' },
  { name: 'San Fran',  lat: 37.78,  lon: -122.44,color: '#73A5CA' },
  { name: 'Paris',     lat: 48.85,  lon: 2.35,   color: '#FFC81E' },
];

const FLIGHT_ARCS = [
  [0, 1], // NY -> London
  [1, 3], // London -> Delhi
  [3, 4], // Delhi -> Singapore
  [4, 2], // Singapore -> Tokyo
  [2, 8], // Tokyo -> San Fran
  [8, 0], // San Fran -> NY
  [0, 6], // NY -> Sao Paulo
  [1, 7], // London -> Dubai
  [7, 3], // Dubai -> Delhi
  [4, 5], // Singapore -> Sydney
];

// ─── Draw Colorful High-Res World Map Texture ─────────────────────────────────
const createWorldTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // 1. Rich Azure / Sapphire Ocean Base
  const oceanGrad = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W);
  oceanGrad.addColorStop(0, '#103965');
  oceanGrad.addColorStop(0.5, '#0b294a');
  oceanGrad.addColorStop(1, '#06172a');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, W, H);

  // Helper to map lat/lon to canvas x/y
  const mapPt = (lat, lon) => ({
    x: ((lon + 180) / 360) * W,
    y: ((90 - lat) / 180) * H,
  });

  const drawPolygon = (pts, fillColor, strokeColor) => {
    if (pts.length < 3) return;
    ctx.beginPath();
    const first = mapPt(pts[0][0], pts[0][1]);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < pts.length; i++) {
      const p = mapPt(pts[i][0], pts[i][1]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  };

  // 2. Simplified Detailed World Continents
  // North America
  drawPolygon([
    [71, -165], [71, -130], [68, -95], [60, -75], [54, -55], [47, -53], [44, -65],
    [30, -81], [25, -80], [22, -97], [16, -93], [8, -78], [15, -84], [18, -104],
    [29, -114], [34, -120], [48, -125], [58, -136], [64, -166], [66, -168]
  ], '#22c55e', '#73A5CA');

  // South America
  drawPolygon([
    [12, -73], [10, -61], [5, -52], [-3, -37], [-8, -35], [-23, -42], [-34, -53],
    [-54, -67], [-55, -73], [-42, -73], [-18, -70], [-5, -81], [5, -77]
  ], '#16a34a', '#FFC81E');

  // Europe
  drawPolygon([
    [71, 28], [65, 30], [60, 40], [54, 38], [45, 35], [37, 26], [36, -5],
    [43, -9], [48, -4], [54, 9], [58, 6], [62, 5], [68, 14], [70, 20]
  ], '#34d399', '#73A5CA');

  // British Isles
  drawPolygon([[58, -7], [51, 1], [50, -5], [55, -6]], '#34d399', '#FFC81E');

  // Africa
  drawPolygon([
    [37, 10], [32, 32], [22, 37], [12, 51], [5, 48], [-4, 39], [-15, 40],
    [-26, 33], [-34, 19], [-34, 18], [-22, 14], [-12, 13], [5, 2], [5, -4],
    [15, -17], [28, -13], [35, -1]
  ], '#eab308', '#E87F24');

  // Asia
  drawPolygon([
    [75, 40], [72, 80], [70, 130], [70, 170], [60, 160], [50, 140], [40, 125],
    [30, 121], [22, 114], [10, 107], [2, 104], [13, 100], [22, 89], [15, 80],
    [8, 77], [22, 69], [25, 60], [29, 48], [40, 47], [42, 30], [50, 40],
    [55, 60], [65, 75]
  ], '#10b981', '#FFC81E');

  // Indian Subcontinent warmth overlay
  drawPolygon([[33, 75], [26, 88], [20, 85], [8, 77], [22, 69], [30, 70]], '#f59e0b', '#FFC81E');

  // Australia
  drawPolygon([
    [-11, 142], [-14, 136], [-12, 131], [-21, 114], [-32, 115], [-35, 118],
    [-35, 150], [-28, 153], [-19, 146]
  ], '#f59e0b', '#E87F24');

  // Japan
  drawPolygon([[45, 142], [43, 145], [35, 139], [32, 130], [38, 138]], '#38bdf8', '#FFC81E');

  // 3. Glowing Shelf Reefs & Coastal Halos
  ctx.strokeStyle = 'rgba(115, 165, 202, 0.45)';
  ctx.lineWidth = 1.5;
  for (let lat = -60; lat <= 60; lat += 30) {
    ctx.beginPath();
    const p1 = mapPt(lat, -180);
    ctx.moveTo(p1.x, p1.y);
    for (let lon = -180; lon <= 180; lon += 10) {
      const p = mapPt(lat, lon);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  for (let lon = -180; lon <= 180; lon += 45) {
    ctx.beginPath();
    const p1 = mapPt(90, lon);
    ctx.moveTo(p1.x, p1.y);
    const p2 = mapPt(-90, lon);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // 4. Subtle Shimmer Clouds / Atmospheric swirls
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  for (let i = 0; i < 40; i++) {
    const cx = Math.random() * W;
    const cy = Math.random() * H;
    const rw = 50 + Math.random() * 120;
    const rh = 10 + Math.random() * 25;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rw, rh, Math.random() * 0.4 - 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
};

// ─── Create 3D Arc between two points ─────────────────────────────────────────
const createCurvedArc = (v1, v2, globeRadius) => {
  const dist = v1.distanceTo(v2);
  const mid = v1.clone().add(v2).multiplyScalar(0.5);
  // Extrude mid-point outwards from center
  const altitude = globeRadius + Math.min(dist * 0.35, 1.2);
  mid.setLength(altitude);

  const curve = new THREE.QuadraticBezierCurve3(v1, mid, v2);
  const points = curve.getPoints(40);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: '#FFC81E',
    transparent: true,
    opacity: 0.55,
    linewidth: 1.5,
  });
  return new THREE.Line(geometry, material);
};

const Colorful3DGlobe = () => {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const isDraggingRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const rotVelocityRef = useRef({ x: 0.003, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = 600;
    const height = 600;

    // ── Scene, Camera, Renderer ───────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 5.2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Initial slight tilt
    globeGroup.rotation.x = 0.28;

    // ── 1. Main Colorful Earth Sphere ─────────────────────────────────────────
    const globeRadius = 1.95;
    const earthGeometry = new THREE.SphereGeometry(globeRadius, 64, 64);
    const earthTexture = createWorldTexture();

    const earthMaterial = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.65,
      metalness: 0.15,
      bumpScale: 0.05,
    });
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    globeGroup.add(earthMesh);

    // ── 2. Atmospheric Golden-Cyan Rim Corona (Fresnel Glow) ──────────────────
    const atmosphereGeometry = new THREE.SphereGeometry(globeRadius * 1.055, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.8);
          vec3 coronaColor = mix(vec3(0.91, 0.50, 0.14), vec3(1.0, 0.78, 0.12), intensity * 1.5);
          gl_FragColor = vec4(coronaColor, intensity * 0.75);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    globeGroup.add(atmosphereMesh);

    // ── 3. Glowing Data Flight Arcs ───────────────────────────────────────────
    const cityVectors = CITIES.map(c => latLonToVector3(c.lat, c.lon, globeRadius));
    const arcGroup = new THREE.Group();
    FLIGHT_ARCS.forEach(([idx1, idx2]) => {
      const v1 = cityVectors[idx1];
      const v2 = cityVectors[idx2];
      if (v1 && v2) {
        const line = createCurvedArc(v1, v2, globeRadius);
        arcGroup.add(line);
      }
    });
    globeGroup.add(arcGroup);

    // ── 4. Glowing 3D City Pins & Threat Radar Beacons ─────────────────────────
    const pulseRings = [];
    CITIES.forEach((city, i) => {
      const pos = cityVectors[i];
      const pinGroup = new THREE.Group();
      pinGroup.position.copy(pos);
      pinGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());

      // Glowing dot
      const dotGeo = new THREE.SphereGeometry(0.045, 16, 16);
      const dotMat = new THREE.MeshBasicMaterial({ color: city.color });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.position.y = 0.02;
      pinGroup.add(dotMesh);

      // Light beam shooting into sky
      const beamGeo = new THREE.CylinderGeometry(0.008, 0.002, 0.45, 8);
      const beamMat = new THREE.MeshBasicMaterial({
        color: city.color,
        transparent: true,
        opacity: 0.75,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = 0.22;
      pinGroup.add(beam);

      // Expanding wave ring
      const ringGeo = new THREE.RingGeometry(0.02, 0.07, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: city.color,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.01;
      pinGroup.add(ring);
      pulseRings.push({ ring, speed: 0.015 + (i % 3) * 0.005 });

      globeGroup.add(pinGroup);
    });

    // ── 5. Orbiting Golden Halo Ring ──────────────────────────────────────────
    const orbitGeo = new THREE.RingGeometry(globeRadius * 1.35, globeRadius * 1.365, 80);
    const orbitMat = new THREE.MeshBasicMaterial({
      color: '#E87F24',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const orbitRing = new THREE.Mesh(orbitGeo, orbitMat);
    orbitRing.rotation.x = Math.PI / 2.3;
    globeGroup.add(orbitRing);

    // ── 6. Ambient and Directional Sun Lighting ───────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight('#ffe8c2', 2.0);
    sunLight.position.set(5, 3, 4);
    scene.add(sunLight);

    const blueBackLight = new THREE.DirectionalLight('#73A5CA', 1.2);
    blueBackLight.position.set(-5, -2, -3);
    scene.add(blueBackLight);

    // ── Mouse / Drag Interaction ──────────────────────────────────────────────
    const onMouseDown = (e) => {
      isDraggingRef.current = true;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - prevMouseRef.current.x;
      const deltaY = e.clientY - prevMouseRef.current.y;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };

      rotVelocityRef.current = {
        x: deltaX * 0.005,
        y: deltaY * 0.005,
      };

      globeGroup.rotation.y += rotVelocityRef.current.x;
      globeGroup.rotation.x += rotVelocityRef.current.y;
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // ── Animation Loop ────────────────────────────────────────────────────────
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Idle smooth rotation with inertial decay
      if (!isDraggingRef.current) {
        globeGroup.rotation.y += 0.0035;
      }

      // Animate pulsing radar rings on major cities
      const t = clock.getElapsedTime();
      pulseRings.forEach(({ ring }, idx) => {
        const cycle = ((t * 1.5 + idx * 0.4) % 1);
        ring.scale.setScalar(1 + cycle * 2.8);
        ring.material.opacity = Math.max(0, 1 - cycle);
      });

      // Slowly rotate the orbit ring in opposite direction
      orbitRing.rotation.z += 0.002;

      renderer.render(scene, camera);
    };

    animate();

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animationFrameId);
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.dispose();
      earthGeometry.dispose();
      earthMaterial.dispose();
      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();
      container.replaceChildren();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: 600,
        height: 600,
        cursor: 'grab',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: 'drop-shadow(0 20px 50px rgba(232, 127, 36, 0.22))',
      }}
    />
  );
};

export default Colorful3DGlobe;
