
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import '../global.d';
import React, { useRef, useMemo, useState, useEffect, memo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Stars, Sparkles, PerspectiveCamera, Text, Trail, useTexture, useGLTF, Cloud, AdaptiveDpr, AdaptiveEvents, Html, useProgress, Line } from '@react-three/drei';
import useDeviceTilt from './useDeviceTilt';
import { useIsMobile, useIsTouch, useIsLowEnd, getMobileThreeSettings } from '../utils/useIsMobile';
import * as THREE from 'three';

// --- LOADING INDICATOR COMPONENT ---
const DroneLoader = () => {
    const { progress } = useProgress();
    return (
        <Html center>
            <div className="flex flex-col items-center justify-center gap-3">
                {/* Animated drone icon */}
                <div className="relative w-16 h-16">
                    <svg 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        className="w-full h-full text-nation-secondary animate-pulse"
                    >
                        <path 
                            d="M12 2L4 7v10l8 5 8-5V7l-8-5z" 
                            stroke="currentColor" 
                            strokeWidth="1.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    {/* Rotating propeller effect */}
                    <div className="absolute inset-0 border-2 border-nation-secondary/30 rounded-full animate-spin" style={{ animationDuration: '2s' }} />
                    <div className="absolute inset-2 border border-nation-secondary/20 rounded-full animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                </div>
                {/* Progress text */}
                <div className="text-center">
                    <p className="text-nation-secondary font-mono text-xs uppercase tracking-widest">
                        Loading Systems
                    </p>
                    <p className="text-white/60 font-mono text-[10px] mt-1">
                        {progress.toFixed(0)}%
                    </p>
                </div>
                {/* Progress bar */}
                <div className="w-24 h-0.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-nation-secondary transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </Html>
    );
};

// Extend JSX IntrinsicElements to allow R3F elements
// Declaration moved to types.ts to avoid duplication

// --- FLAT WORLD MAP (using drei Line for proper rendering) ---
const FlatWorldMap = ({ opacity = 0.15 }: { opacity?: number }) => {
    // Simple continent outlines as 2D shapes positioned behind the scene
    
    const continentPaths = useMemo(() => {
        const scale = 18;
        const yOffset = 0;
        
        // Continent outlines (x, y coordinates scaled)
        return {
            northAmerica: [
                [-0.55, 0.7], [-0.45, 0.78], [-0.3, 0.72], [-0.18, 0.62], [-0.12, 0.48],
                [-0.08, 0.32], [-0.18, 0.22], [-0.32, 0.18], [-0.48, 0.22], [-0.52, 0.28],
                [-0.58, 0.42], [-0.62, 0.52], [-0.58, 0.62], [-0.55, 0.7]
            ].map(([x, y]): [number, number, number] => [x * scale, y * scale + yOffset, 0]),
            
            southAmerica: [
                [-0.32, 0.12], [-0.22, 0.08], [-0.18, -0.02], [-0.2, -0.18], [-0.26, -0.38],
                [-0.32, -0.52], [-0.36, -0.58], [-0.38, -0.48], [-0.4, -0.28],
                [-0.38, -0.12], [-0.36, 0.02], [-0.32, 0.12]
            ].map(([x, y]): [number, number, number] => [x * scale, y * scale + yOffset, 0]),
            
            europe: [
                [-0.02, 0.72], [0.08, 0.7], [0.14, 0.62], [0.1, 0.52], [0.04, 0.46],
                [-0.04, 0.5], [-0.08, 0.56], [-0.06, 0.66], [-0.02, 0.72]
            ].map(([x, y]): [number, number, number] => [x * scale, y * scale + yOffset, 0]),
            
            africa: [
                [-0.02, 0.42], [0.08, 0.38], [0.14, 0.28], [0.16, 0.12], [0.14, -0.08],
                [0.08, -0.28], [0.04, -0.38], [-0.04, -0.32], [-0.08, -0.18],
                [-0.06, 0.02], [-0.02, 0.22], [-0.04, 0.38], [-0.02, 0.42]
            ].map(([x, y]): [number, number, number] => [x * scale, y * scale + yOffset, 0]),
            
            asia: [
                [0.12, 0.72], [0.28, 0.78], [0.48, 0.72], [0.58, 0.62], [0.62, 0.48],
                [0.58, 0.32], [0.48, 0.22], [0.38, 0.18], [0.28, 0.22], [0.18, 0.32],
                [0.14, 0.42], [0.1, 0.58], [0.12, 0.72]
            ].map(([x, y]): [number, number, number] => [x * scale, y * scale + yOffset, 0]),
            
            australia: [
                [0.52, -0.12], [0.6, -0.18], [0.62, -0.28], [0.58, -0.38],
                [0.5, -0.35], [0.46, -0.25], [0.48, -0.15], [0.52, -0.12]
            ].map(([x, y]): [number, number, number] => [x * scale, y * scale + yOffset, 0]),
        };
    }, []);

    // Grid lines for lat/long effect
    const gridLines = useMemo(() => {
        const latLines: [number, number, number][][] = [];
        const lonLines: [number, number, number][][] = [];
        
        // Latitude lines
        for (let y = -0.6; y <= 0.6; y += 0.3) {
            latLines.push([[-14, y * 18, 0], [14, y * 18, 0]]);
        }
        // Longitude lines
        for (let x = -0.6; x <= 0.6; x += 0.3) {
            lonLines.push([[x * 22, -12, 0], [x * 22, 15, 0]]);
        }
        
        return { latLines, lonLines };
    }, []);

    return (
        <group position={[0, 0, -25]}>
            {/* Continent outlines */}
            {Object.values(continentPaths).map((points, idx) => (
                <Line
                    key={`continent-${idx}`}
                    points={points}
                    color="#ffffff"
                    lineWidth={1}
                    transparent
                    opacity={opacity}
                />
            ))}
            
            {/* Grid lines */}
            {gridLines.latLines.map((points, i) => (
                <Line
                    key={`lat-${i}`}
                    points={points}
                    color="#ffffff"
                    lineWidth={0.5}
                    transparent
                    opacity={opacity * 0.4}
                />
            ))}
            {gridLines.lonLines.map((points, i) => (
                <Line
                    key={`lon-${i}`}
                    points={points}
                    color="#ffffff"
                    lineWidth={0.5}
                    transparent
                    opacity={opacity * 0.4}
                />
            ))}
        </group>
    );
};

// --- SHOOTING STAR COMPONENT ---
const ShootingStar = ({ delay = 0 }) => {
    const ref = useRef<THREE.Mesh>(null);
    const trailRef = useRef<THREE.Mesh>(null);
    const [active, setActive] = useState(false);
    const startPos = useRef({ x: 0, y: 0, z: 0 });
    const direction = useRef({ x: 0, y: 0 });
    
    useFrame((state) => {
        const time = state.clock.getElapsedTime();
        
        // Trigger shooting star periodically
        if (!active && Math.sin(time * 0.3 + delay) > 0.99) {
            setActive(true);
            startPos.current = {
                x: (Math.random() - 0.5) * 60 + 20,
                y: Math.random() * 20 + 15,
                z: -Math.random() * 30 - 10
            };
            direction.current = {
                x: -0.8 - Math.random() * 0.4,
                y: -0.3 - Math.random() * 0.2
            };
        }
        
        if (active && ref.current) {
            ref.current.position.x += direction.current.x * 0.8;
            ref.current.position.y += direction.current.y * 0.8;
            
            // Reset when off screen
            if (ref.current.position.y < -10 || ref.current.position.x < -40) {
                setActive(false);
            }
        }
    });
    
    if (!active) return null;
    
    return (
        <group>
            <mesh ref={ref} position={[startPos.current.x, startPos.current.y, startPos.current.z]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshBasicMaterial color="#ffffff" />
            </mesh>
            {/* Trail effect */}
            <mesh position={[startPos.current.x + 1, startPos.current.y + 0.3, startPos.current.z]}>
                <planeGeometry args={[3, 0.05]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
};

// --- SHOOTING STARS GROUP (with mobile optimization) ---
const ShootingStars = ({ isMobile = false }: { isMobile?: boolean }) => {
    // Reduce shooting stars on mobile to improve performance
    const delays = isMobile ? [0, 5, 10] : [0, 2, 4, 6, 8, 10];
    return (
        <group>
            {delays.map((delay, i) => (
                <ShootingStar key={i} delay={delay} />
            ))}
        </group>
    );
};

// --- ATMOSPHERIC CLOUDS ---
const AtmosphericClouds = () => {
    return (
        <group>
            <Cloud
                position={[-15, 8, -20]}
                speed={0.2}
                opacity={0.15}
                width={20}
                depth={5}
                segments={20}
            />
            <Cloud
                position={[18, 10, -25]}
                speed={0.15}
                opacity={0.1}
                width={15}
                depth={4}
                segments={15}
            />
            <Cloud
                position={[0, 12, -30]}
                speed={0.1}
                opacity={0.08}
                width={25}
                depth={6}
                segments={20}
            />
            <Cloud
                position={[-20, 6, -15]}
                speed={0.25}
                opacity={0.12}
                width={12}
                depth={3}
                segments={12}
            />
            <Cloud
                position={[25, 7, -18]}
                speed={0.18}
                opacity={0.1}
                width={18}
                depth={4}
                segments={16}
            />
        </group>
    );
};

// --- REALISTIC RC PLANE MODEL (Cessna Style) ---
const RealisticPlane = ({ scale = 1 }) => {
  const propRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if(propRef.current) propRef.current.rotation.z += delta * 20;
  });

  return (
    <group scale={scale} rotation={[0, -Math.PI/2, 0]}>
      {/* --- FUSELAGE --- */}
      <group>
        {/* Main Body - using multiple cylinders to taper */}
        <mesh position={[0, 0, 0.5]} rotation={[0, 0, Math.PI/2]}>
           <cylinderGeometry args={[0.65, 0.5, 2.5, 16]} />
           <meshStandardMaterial color="#f0f0f0" roughness={0.3} metalness={0.1} />
        </mesh>
        
        {/* Tail Cone */}
        <mesh position={[-2.2, 0, 0.55]} rotation={[0, 0, Math.PI/2]}>
           <cylinderGeometry args={[0.5, 0.2, 2.0, 16]} />
           <meshStandardMaterial color="#f0f0f0" roughness={0.3} metalness={0.1} />
        </mesh>
        
        {/* Nose Cowling */}
        <mesh position={[1.5, 0, 0.5]} rotation={[0, 0, Math.PI/2]}>
           <cylinderGeometry args={[0.45, 0.65, 0.6, 16]} />
           <meshStandardMaterial color="#f0f0f0" roughness={0.3} metalness={0.1} />
        </mesh>
      </group>

      {/* --- COCKPIT --- */}
      <group position={[0.2, 0.35, 0.5]}>
         {/* Windshield */}
         <mesh position={[0.4, 0.1, 0]} rotation={[0, 0, -0.4]}>
             <boxGeometry args={[0.8, 0.05, 1.0]} />
             <meshPhysicalMaterial color="#111" roughness={0.1} metalness={0.9} transparent opacity={0.7} />
         </mesh>
          {/* Side Windows */}
          <mesh position={[-0.2, 0, 0]}>
             <boxGeometry args={[1.2, 0.5, 0.9]} />
             <meshStandardMaterial color="#222" roughness={0.2} />
          </mesh>
      </group>

      {/* --- WINGS (High Wing) --- */}
      <group position={[0.3, 0.55, 0.5]}>
         {/* Center Wing Section */}
         <mesh>
             <boxGeometry args={[1.6, 0.15, 6.0]} />
             <meshStandardMaterial color="#ffffff" roughness={0.4} />
         </mesh>
         
         {/* Wing Tips (Blue Stripes) */}
         <mesh position={[0, 0.01, 2.5]}>
             <boxGeometry args={[1.61, 0.16, 1.0]} />
             <meshStandardMaterial color="#3B82F6" />
         </mesh>
         <mesh position={[0, 0.01, -2.5]}>
             <boxGeometry args={[1.61, 0.16, 1.0]} />
             <meshStandardMaterial color="#3B82F6" />
         </mesh>

         {/* Wing Struts */}
         <mesh position={[0, -0.6, 1.5]} rotation={[0.4, 0, 0]}>
             <cylinderGeometry args={[0.03, 0.03, 1.8]} />
             <meshStandardMaterial color="#ccc" metalness={0.5} />
         </mesh>
         <mesh position={[0, -0.6, -1.5]} rotation={[-0.4, 0, 0]}>
             <cylinderGeometry args={[0.03, 0.03, 1.8]} />
             <meshStandardMaterial color="#ccc" metalness={0.5} />
         </mesh>
      </group>

      {/* --- TAIL SECTION --- */}
      <group position={[-3.0, 0.2, 0.5]}>
         {/* Vertical Stabilizer */}
         <mesh position={[0, 0.6, 0]}>
             <boxGeometry args={[0.8, 1.4, 0.1]} />
             <meshStandardMaterial color="#3B82F6" />
         </mesh>
         {/* Rudder */}
         <mesh position={[-0.4, 0.6, 0]}>
              <boxGeometry args={[0.3, 1.4, 0.08]} />
              <meshStandardMaterial color="#2563EB" />
         </mesh>

         {/* Horizontal Stabilizer */}
         <mesh position={[-0.2, 0, 0]}>
             <boxGeometry args={[0.6, 0.1, 2.4]} />
             <meshStandardMaterial color="#ffffff" />
         </mesh>
         {/* Elevators */}
         <mesh position={[-0.5, 0, 0]}>
              <boxGeometry args={[0.3, 0.08, 2.4]} />
              <meshStandardMaterial color="#ddd" />
         </mesh>
      </group>

      {/* --- PROPELLER --- */}
      <group position={[1.85, 0, 0.5]} ref={propRef}>
          {/* Spinner */}
          <mesh rotation={[0, 0, -Math.PI/2]}>
              <coneGeometry args={[0.15, 0.4, 32]} />
              <meshStandardMaterial color="#333" roughness={0.2} metalness={0.5} />
          </mesh>
          {/* Blades */}
          <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.05, 2.8, 0.15]} />
              <meshStandardMaterial color="#111" />
          </mesh>
          <mesh position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
              <boxGeometry args={[0.05, 2.8, 0.15]} />
              <meshStandardMaterial color="#111" />
          </mesh>
      </group>

      {/* --- LANDING GEAR (Tricycle) --- */}
      <group>
          {/* Main Gear (Leaf Spring) */}
          <mesh position={[0.2, -0.6, 0.5]}>
              <boxGeometry args={[0.2, 0.1, 2.2]} />
              <meshStandardMaterial color="#333" />
          </mesh>
          
          {/* Main Wheels */}
          <group position={[0.2, -0.8, 1.6]}>
              <mesh rotation={[Math.PI/2, 0, 0]}>
                  <cylinderGeometry args={[0.25, 0.25, 0.15, 32]} />
                  <meshStandardMaterial color="#111" roughness={0.9} />
              </mesh>
              <mesh rotation={[Math.PI/2, 0, 0]}>
                  <cylinderGeometry args={[0.12, 0.12, 0.16, 32]} />
                  <meshStandardMaterial color="#888" metalness={0.6} />
              </mesh>
          </group>
          <group position={[0.2, -0.8, -0.6]}>
              <mesh rotation={[Math.PI/2, 0, 0]}>
                  <cylinderGeometry args={[0.25, 0.25, 0.15, 32]} />
                  <meshStandardMaterial color="#111" roughness={0.9} />
              </mesh>
               <mesh rotation={[Math.PI/2, 0, 0]}>
                  <cylinderGeometry args={[0.12, 0.12, 0.16, 32]} />
                  <meshStandardMaterial color="#888" metalness={0.6} />
              </mesh>
          </group>

          {/* Nose Gear */}
          <group position={[1.3, -0.6, 0.5]}>
               <mesh rotation={[0, 0, 0.2]}>
                   <cylinderGeometry args={[0.05, 0.05, 0.6]} />
                   <meshStandardMaterial color="#ccc" metalness={0.6} />
               </mesh>
               <group position={[0.1, -0.3, 0]}>
                   <mesh rotation={[Math.PI/2, 0, 0]}>
                       <cylinderGeometry args={[0.2, 0.2, 0.12, 32]} />
                       <meshStandardMaterial color="#111" roughness={0.9} />
                   </mesh>
                   <mesh rotation={[Math.PI/2, 0, 0]}>
                       <cylinderGeometry args={[0.1, 0.1, 0.13, 32]} />
                       <meshStandardMaterial color="#888" metalness={0.6} />
                   </mesh>
               </group>
          </group>
      </group>
    </group>
  )
}

// --- HERO SCENE: SKY DOMINION (Realistic Drone) ---

const TacticalFloor = () => {
    const groupRef = useRef<THREE.Group>(null);
    
    useFrame((state, delta) => {
        if (groupRef.current) {
            // Slowly move the layered grids to create an infinite-scroll illusion
            groupRef.current.position.z += delta * 6;
            // Wrap around to keep the effect seamless
            if (groupRef.current.position.z > 30) {
                groupRef.current.position.z = 0;
            }
        }
    });

    return (
        // place the floor below the drone for perspective
        <group ref={groupRef} position={[0, -1.5, -10]}>
            {/* Large faint primary grid for depth - white */}
            <gridHelper args={[200, 60, '#ffffff', '#111111']} />

            {/* Mid-layer grid for mid-distance detail - white */}
            <gridHelper args={[200, 30, '#aaaaaa', '#000000']} position={[0, 0.02, 0]} />

            {/* A subtle ground plane to give contrast/fade (uses fog for natural fade) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                <planeGeometry args={[400, 400]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.12} side={THREE.DoubleSide} />
            </mesh>
        </group>
    )
}

const RealisticDrone = ({ tilt, isMobile, scale = 0.65 }: { tilt?: any; isMobile?: boolean; scale?: number }) => {
    const { mouse } = useThree();
    const groupRef = useRef<THREE.Group>(null);
    const propellersRef = useRef<THREE.Object3D[]>([]);
    const { scene } = useGLTF('/uploads-files-3193264-drone+2+model.glb');

    // Apply custom materials and find propellers
    useMemo(() => {
        propellersRef.current = [];
        scene.traverse((child: any) => {
            if (child.isMesh) {
                const name = child.name?.toLowerCase() || '';
                
                // Detect propeller/rotor parts by name and give them standout material
                if (name.includes('prop') || name.includes('rotor') || name.includes('blade') || name.includes('fan')) {
                    propellersRef.current.push(child);
                    // Make propellers stand out with cyan/gold accent
                    child.material = new THREE.MeshStandardMaterial({
                        color: '#00D4FF',
                        roughness: 0.2,
                        metalness: 0.9,
                        emissive: '#00A0CC',
                        emissiveIntensity: 0.3,
                        transparent: true,
                        opacity: 0.85,
                    });
                    return;
                }
                
                // Create themed materials based on original material properties
                const originalColor = child.material?.color?.getHex?.() || 0x888888;
                
                // Dark parts - deep blue-black carbon
                if (originalColor < 0x444444) {
                    child.material = new THREE.MeshStandardMaterial({
                        color: '#1a1e24',
                        roughness: 0.4,
                        metalness: 0.6,
                    });
                } 
                // Light parts - subtle blue steel
                else if (originalColor > 0xaaaaaa) {
                    child.material = new THREE.MeshStandardMaterial({
                        color: '#3a4550',
                        roughness: 0.3,
                        metalness: 0.8,
                    });
                }
                // Mid-tones - muted blue-gold accent
                else {
                    child.material = new THREE.MeshStandardMaterial({
                        color: '#5a6a7a',
                        roughness: 0.35,
                        metalness: 0.85,
                        emissive: '#2a3a4a',
                        emissiveIntensity: 0.05,
                    });
                }
            }
        });
        
        // If no propellers found by name, try to find them by position (typically at corners)
        if (propellersRef.current.length === 0) {
            scene.traverse((child: any) => {
                if (child.isMesh) {
                    const pos = child.position;
                    // Propellers are usually at the extremities
                    if (Math.abs(pos.x) > 0.3 || Math.abs(pos.z) > 0.3) {
                        propellersRef.current.push(child);
                        // Apply standout material to position-detected propellers
                        child.material = new THREE.MeshStandardMaterial({
                            color: '#00D4FF',
                            roughness: 0.2,
                            metalness: 0.9,
                            emissive: '#00A0CC',
                            emissiveIntensity: 0.3,
                            transparent: true,
                            opacity: 0.85,
                        });
                    }
                }
            });
        }
    }, [scene]);

    useFrame((state, delta) => {
        if (groupRef.current) {
            const time = state.clock.getElapsedTime();
            
            // Subtle Hovering Physics
            groupRef.current.position.y = Math.sin(time * 1.5) * 0.15;

            // Interactive Tilt (Lagged for weight feel)
            let targetRoll = -mouse.x * 0.4; 
            let targetPitch = mouse.y * 0.3;
            let targetYaw = -mouse.x * 0.2;

            // If on mobile and tilt is available & enabled, prefer tilt values
            if (isMobile && tilt && tilt.enabled) {
                // tilt.gamma -> left (-) / right (+), tilt.beta -> front/back
                const gamma = typeof tilt.gamma === 'number' ? tilt.gamma : 0; // [-1,1]
                const beta = typeof tilt.beta === 'number' ? tilt.beta : 0;   // [-1,1]

                targetRoll = gamma * 0.35;      // roll more responsive
                targetPitch = beta * 0.25;      // gentle pitch
                targetYaw = gamma * 0.15;       // small yaw
            }

            // Smoothly interpolate rotations
            groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, targetRoll, delta * 2);
            groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetPitch, delta * 2);
            groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetYaw, delta * 1.5);
        }
        
        // Spin propellers
        propellersRef.current.forEach((prop, i) => {
            if (prop) {
                const speed = 25 + Math.sin(state.clock.getElapsedTime() * 10 + i) * 2;
                prop.rotation.y += delta * speed * (i % 2 === 0 ? 1 : -1);
            }
        });
    });

    return (
        <group ref={groupRef} scale={scale}>
            <primitive object={scene} />
            {/* Add accent lights */}
            <pointLight position={[0, -0.5, 0.5]} intensity={2} color="#00F0FF" distance={2} />
            <pointLight position={[0, -0.5, -0.5]} intensity={2} color="#FF3333" distance={2} />
        </group>
    );
};

// Preload the model for better performance
useGLTF.preload('/uploads-files-3193264-drone+2+model.glb');

export const HeroScene: React.FC = memo(() => {
    // Use custom hooks for better device detection
    const isMobileHook = useIsMobile();
    const isTouch = useIsTouch();
    const isLowEnd = useIsLowEnd();
    
    // Use device tilt hook to enable phone tilt interactions
    const tilt = useDeviceTilt({ smoothing: 0.12 });
    
    // Legacy detection for immediate SSR-safe checks
    const isMobile = typeof window !== 'undefined' && (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') || isMobileHook);
    const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 640;

    // Get optimized Three.js settings based on device
    const threeSettings = useMemo(() => getMobileThreeSettings(isLowEnd, isMobile), [isLowEnd, isMobile]);

    // Camera adjustments for mobile - closer and higher FOV for better visibility
    const cameraPos = isSmallScreen ? [0, 1.5, 4.5] : isMobile ? [0, 1.8, 5] : [0, 2, 6];
    const cameraFov = isSmallScreen ? 58 : isMobile ? 52 : 40;
    
    // Drone scale - larger on mobile for better visibility
    const droneScale = isSmallScreen ? 0.55 : isMobile ? 0.6 : 0.65;
    const droneYPos = isSmallScreen ? 0.7 : 0.9;
    
    // Calculate DPR based on device capabilities
    const dprRange: [number, number] = isLowEnd 
        ? [0.5, 0.75] 
        : isSmallScreen 
            ? [0.7, 0.9] 
            : isMobile 
                ? [0.8, 1] 
                : [1, 1.5];
    
    // Star count based on device
    const starCount = isLowEnd ? 300 : isMobile ? 600 : 1000;
    
    // Sparkle count based on device
    const sparkleCount = isLowEnd ? 15 : isMobile ? 30 : 50;

    return (
        <div className="absolute inset-0 z-0 touch-none">
            <Canvas
                dpr={dprRange}
                gl={{ 
                    powerPreference: isLowEnd ? 'low-power' : 'high-performance', 
                    antialias: !isMobile && !isLowEnd, 
                    stencil: false, 
                    depth: true,
                    // Reduce precision on mobile to improve performance
                    precision: isMobile ? 'mediump' : 'highp',
                }}
                performance={{ min: isLowEnd ? 0.3 : 0.5 }}
                style={{ touchAction: 'none' }}
                // Limit frame rate on low-end devices
                frameloop={isLowEnd ? 'demand' : 'always'}
            >
                <AdaptiveDpr pixelated />
                <AdaptiveEvents />
                <PerspectiveCamera makeDefault position={cameraPos as any} fov={cameraFov} />
                <fog attach="fog" args={['#050505', 5, isLowEnd ? 30 : 50]} />
        
                {/* Optimized Lighting - fewer lights on mobile, no shadows */}
                <ambientLight intensity={isMobile ? 2.5 : 2} />
                <directionalLight position={[10, 10, 10]} intensity={isMobile ? 2 : 3} color="#ffffff" />
                {/* Skip secondary lights on low-end devices */}
                {!isLowEnd && (
                    <>
                        <pointLight position={[-5, 0, -5]} intensity={1.5} color="#D4AF37" />
                        <pointLight position={[0, 2, 4]} intensity={2} color="#ffffff" />
                    </>
                )}

                {/* Environment - reduced counts on mobile */}
                <Stars radius={100} depth={50} count={starCount} factor={4} saturation={0} fade speed={1} />

                {/* Shooting Stars Effect - reduced on mobile */}
                {!isLowEnd && <ShootingStars isMobile={isMobile} />}
        
                {/* Interactive Realistic Drone */}
                <Suspense fallback={<DroneLoader />}>
                    <group position={[0, droneYPos, 0]}>
                        <RealisticDrone tilt={tilt} isMobile={isMobile} scale={droneScale} />
                    </group>
                </Suspense>

                {/* Particles simulating cruising speed - reduced on mobile */}
                <Sparkles count={sparkleCount} scale={20} size={2} speed={1} opacity={0.3} color="#ffffff" position={[0, 0, -5]} />
            </Canvas>

            {/* Tilt permission prompt for iOS if required - improved touch target */}
            {isMobile && tilt.permissionRequired && !tilt.enabled && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-4 sm:bottom-6 z-50 px-4 w-full max-w-xs">
                    <button
                        onClick={() => { tilt.requestPermission(); }}
                        className="w-full px-4 py-3 bg-nation-secondary/90 text-white rounded-full font-display text-[11px] sm:text-xs uppercase tracking-widest shadow-lg backdrop-blur-sm border border-white/20 active:scale-95 transition-transform min-h-[48px] flex items-center justify-center"
                    >
                        <span className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                            Enable Tilt Control
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
});


// --- HANGAR SCENE: REALISTIC PLANE MODEL (with mobile optimization) ---

export const HangarScene: React.FC = memo(() => {
  const isMobile = useIsMobile();
  const isLowEnd = useIsLowEnd();
  
  // Reduced counts for mobile
  const sparkleCount = isLowEnd ? 5 : isMobile ? 10 : 20;
  const starCount = isLowEnd ? 100 : isMobile ? 200 : 300;
  const dprRange: [number, number] = isLowEnd ? [0.5, 0.75] : isMobile ? [0.8, 1] : [1, 1.5];
  
  return (
    <div className="w-full h-full absolute inset-0 bg-nation-black">
      <Canvas
        camera={{ position: [5, 3, 6], fov: isMobile ? 45 : 40 }}
        dpr={dprRange}
        gl={{ 
            powerPreference: isLowEnd ? 'low-power' : 'high-performance', 
            antialias: !isMobile, 
            stencil: false, 
            depth: true,
            precision: isMobile ? 'mediump' : 'highp',
        }}
        performance={{ min: isLowEnd ? 0.3 : 0.5 }}
        frameloop={isLowEnd ? 'demand' : 'always'}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <fog attach="fog" args={['#020204', 5, isLowEnd ? 25 : 35]} />
        
        {/* Optimized Lighting - fewer on mobile */}
        <ambientLight intensity={isMobile ? 1.5 : 1.2} />
        <directionalLight position={[10, 10, 5]} intensity={2} color="#ffffff" />
        {!isLowEnd && (
            <pointLight position={[-8, 8, 5]} intensity={2} color="#00F0FF" />
        )}
        
        <Float rotationIntensity={0.2} floatIntensity={0.3} speed={1}>
             <Suspense fallback={<DroneLoader />}>
                 <group rotation={[0.1, Math.PI / 6, 0]} scale={isMobile ? 0.6 : 0.7}>
                     <RealisticPlane scale={1} />
                 </group>
             </Suspense>
        </Float>
        
        {/* Background Elements - reduced on mobile */}
        <Sparkles count={sparkleCount} scale={10} size={4} speed={0.3} opacity={0.3} color="#ffffff" />
        <Stars radius={100} depth={50} count={starCount} factor={3} saturation={0} fade speed={0.2} />
      </Canvas>
    </div>
  );
})

// --- RC PLANE MODEL (loaded from public folder) ---
const RCPlaneModel = ({ scale = 1 }: { scale?: number }) => {
    const groupRef = useRef<THREE.Group>(null);
    const { scene } = useGLTF('/RC.glb');

    // Clone the scene and keep original materials for realistic look
    const clonedScene = useMemo(() => {
        const clone = scene.clone();
        
        // Just enhance the existing materials slightly
        clone.traverse((child: any) => {
            if (child.isMesh && child.material) {
                // Keep original material but enhance it
                const origMat = child.material;
                child.material = new THREE.MeshStandardMaterial({
                    color: origMat.color || '#cccccc',
                    map: origMat.map || null,
                    roughness: 0.5,
                    metalness: 0.3,
                });
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        return clone;
    }, [scene]);

    // Gentle floating animation
    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y = state.clock.elapsedTime * 0.12;
            groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
            groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.3) * 0.015;
        }
    });

    return (
        <group ref={groupRef} scale={scale} rotation={[0.15, 0, 0]}>
            <primitive object={clonedScene} />
        </group>
    );
};

// Preload the RC plane model
useGLTF.preload('/RC.glb');

// --- RC PLANE SCENE (keeps export name for compatibility, with mobile optimization) ---
export const CombatJetScene: React.FC = memo(() => {
  const isMobile = useIsMobile();
  const isLowEnd = useIsLowEnd();
  
  // Reduced sparkle count for mobile
  const sparkleCount = isLowEnd ? 10 : isMobile ? 20 : 40;
  const dprRange: [number, number] = isLowEnd ? [0.5, 0.75] : isMobile ? [0.8, 1] : [1, 1.5];
  
  return (
    <div className="w-full h-full absolute inset-0 bg-transparent">
      <Canvas
        camera={{ position: [0, 0.5, isMobile ? 9 : 8], fov: isMobile ? 50 : 45 }}
        dpr={dprRange}
        gl={{ 
            powerPreference: isLowEnd ? 'low-power' : 'high-performance', 
            antialias: !isMobile && !isLowEnd, 
            stencil: false, 
            depth: true, 
            alpha: true,
            precision: isMobile ? 'mediump' : 'highp',
        }}
        performance={{ min: isLowEnd ? 0.3 : 0.5 }}
        frameloop={isLowEnd ? 'demand' : 'always'}
      >
        {/* Transparent background to match section */}
        
        {/* Realistic lighting setup - simplified on mobile */}
        <ambientLight intensity={isMobile ? 0.8 : 0.6} />
        <directionalLight position={[5, 8, 5]} intensity={2} color="#ffffff" />
        {!isLowEnd && (
            <>
                <directionalLight position={[-4, 4, -3]} intensity={1} color="#94a3b8" />
                <pointLight position={[0, 2, -5]} intensity={1.5} color="#ffffff" />
                <pointLight position={[0, -3, 3]} intensity={0.6} color="#ffeedd" />
            </>
        )}

        <Suspense fallback={<DroneLoader />}>
          <Float rotationIntensity={0.1} floatIntensity={0.2} speed={1.5}>
            <group position={[0, -0.3, 0]}> 
              <RCPlaneModel scale={isMobile ? 0.05 : 0.055} />
            </group>
          </Float>
        </Suspense>

        <Sparkles count={sparkleCount} scale={18} size={1.5} speed={0.2} opacity={0.15} color="#ffffff" />
      </Canvas>
    </div>
  );
})