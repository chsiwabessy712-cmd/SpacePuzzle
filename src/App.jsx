import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrthographicCamera, Environment, Edges, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useSpring, animated } from '@react-spring/three';
import { useGameLogic } from './useGameLogic';
import { generateLevel } from './levelGenerator';
import { audioManager } from './audioManager';
import kinderImg from './assets/kinder.png';
import juniorImg from './assets/junior.png';
import coderImg from './assets/coder.png';
import heroImg from './assets/hero.png';
import './index.css';

// ----------------------------------------------------------------------------
// Components
// ----------------------------------------------------------------------------

const TypingText = ({ text }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    setDisplayedText('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayedText(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, 25);
    return () => clearInterval(interval);
  }, [text]);

  return <span>{displayedText}</span>;
};

const Island = ({ xStart, zStart, w, d }) => {
  const caps = [];
  for (let z = 0; z < d; z++) {
    for (let x = 0; x < w; x++) {
      caps.push(
        <mesh key={`${x}-${z}`} position={[xStart + x, -0.1, zStart + z]} receiveShadow castShadow>
          <boxGeometry args={[1, 0.2, 1]} />
          <meshStandardMaterial color="#8ab8e6" roughness={0.3} />
          <Edges color="#5a88c6" />
        </mesh>
      );
    }
  }
  
  const centerX = xStart + (w - 1) / 2;
  const centerZ = zStart + (d - 1) / 2;

  return (
    <group>
      {caps}
      <mesh position={[centerX, -0.7, centerZ]} receiveShadow>
        <boxGeometry args={[w, 1.0, d]} />
        <meshStandardMaterial color="#9c75c4" roughness={0.7} />
        <Edges color="#6b4c91" />
      </mesh>
    </group>
  );
};

const FloorButton = ({ position, isActive }) => (
  <group position={position}>
    <mesh position={[0, 0.05, 0]}>
      <boxGeometry args={[0.8, 0.1, 0.8]} />
      <meshStandardMaterial color={isActive ? '#666' : '#444'} />
    </mesh>
    <mesh position={[0, isActive ? 0.06 : 0.1, 0]}>
      <boxGeometry args={[0.6, 0.1, 0.6]} />
      <meshStandardMaterial 
        color={isActive ? '#ffff00' : '#ff3366'} 
        emissive={isActive ? '#ffff00' : '#000'}
        emissiveIntensity={isActive ? 0.8 : 0}
      />
    </mesh>
  </group>
);

const RaisedButton = ({ position, isActive }) => (
  <group position={position}>
    <mesh position={[0, 0.25, 0]} castShadow>
      <boxGeometry args={[0.9, 0.5, 0.9]} />
      <meshStandardMaterial color="#8ab8e6" />
      <Edges color="#5a88c6" />
    </mesh>
    <mesh position={[0, 0.55, 0]}>
      <boxGeometry args={[0.7, 0.1, 0.7]} />
      <meshStandardMaterial color={isActive ? '#666' : '#444'} />
    </mesh>
    <mesh position={[0, isActive ? 0.56 : 0.6, 0]}>
      <boxGeometry args={[0.5, 0.1, 0.5]} />
      <meshStandardMaterial 
        color={isActive ? '#ffff00' : '#ff3366'}
        emissive={isActive ? '#ffff00' : '#000'}
        emissiveIntensity={isActive ? 0.8 : 0}
      />
    </mesh>
  </group>
);

const StoneBlock = ({ x, z, isCarried, isRobotCarried, bounceState, isOnPodium, stackIndex = 0 }) => {
  const isPreBounce = bounceState && bounceState.phase === 'pre';
  const isJump = bounceState && bounceState.phase === 'jump';

  const targetX = isPreBounce ? bounceState.fromX : (bounceState ? bounceState.toX : x);
  const targetZ = isPreBounce ? bounceState.fromZ : (bounceState ? bounceState.toZ : z);

  const { position } = useSpring({
    position: [targetX, (isCarried || isRobotCarried) ? 1.2 + stackIndex * 0.8 : ((isOnPodium ? 1.25 : 0.4) + stackIndex * 0.8), targetZ],
    config: { mass: 1, tension: 120, friction: 20 }
  });

  const bounceRef = useRef();
  
  useFrame(() => {
     if (bounceState && bounceRef.current) {
        if (isPreBounce) {
           const elapsed = performance.now() - bounceState.startTime;
           const t = elapsed / 600; // 0 to 1 over 600ms
           if (t >= 0 && t <= 1) {
              // Two quick small bounces before the throw
              bounceRef.current.position.y = Math.abs(Math.sin(t * Math.PI * 2)) * 1.2;
           }
        } else if (isJump) {
           const elapsed = (performance.now() - bounceState.startTime) / 800; // 0 to 1 over 800ms
           if (elapsed >= 0 && elapsed <= 1) {
              bounceRef.current.position.y = 4 * 4 * elapsed * (1 - elapsed); // max height 4
           } else {
              bounceRef.current.position.y = 0;
           }
        }
     } else if (bounceRef.current) {
        bounceRef.current.position.y = 0;
     }
  });

  return (
    <animated.group position={position}>
      <group ref={bounceRef}>
        <mesh castShadow>
          <boxGeometry args={[0.8, 0.8, 0.8]} />
          <meshStandardMaterial color="#c0c0c0" metalness={0.3} roughness={0.5} />
          <Edges color="#ffffff" />
          <mesh position={[0, 0.405, 0]} rotation={[0, Math.PI/4, 0]}>
            <planeGeometry args={[1, 0.05]} />
            <meshStandardMaterial color="#777" />
          </mesh>
        </mesh>
      </group>
    </animated.group>
  );
};

const Trampoline = ({ position }) => {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 6) * 0.15;
      meshRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, 0.1, 0]} rotation={[0, -Math.PI/2, 0]}>
        <cylinderGeometry args={[0.4, 0.5, 0.1, 3]} />
        <meshStandardMaterial color="#ff8c00" roughness={0.2} />
        <Edges color="#ffffff" />
      </mesh>
      <mesh ref={meshRef} position={[0, 0.17, 0]} rotation={[0, -Math.PI/2, 0]}>
        <cylinderGeometry args={[0.3, 0.35, 0.05, 3]} />
        <meshStandardMaterial color="#3399ff" emissive="#1155aa" emissiveIntensity={0.5} roughness={0.1} />
      </mesh>
    </group>
  );
};

const Computer = ({ position }) => (
  <group position={position}>
    {/* Desk */}
    <mesh position={[0, 0.15, 0]} castShadow>
      <boxGeometry args={[0.7, 0.3, 0.5]} />
      <meshStandardMaterial color="#b87333" roughness={0.6} />
    </mesh>
    {/* Monitor */}
    <mesh position={[0, 0.5, -0.05]} castShadow>
      <boxGeometry args={[0.5, 0.35, 0.05]} />
      <meshStandardMaterial color="#222" />
    </mesh>
    {/* Screen */}
    <mesh position={[0, 0.52, -0.02]}>
      <planeGeometry args={[0.4, 0.25]} />
      <meshStandardMaterial color="#00ccff" emissive="#00ccff" emissiveIntensity={0.6} />
    </mesh>
    {/* Stand */}
    <mesh position={[0, 0.32, -0.05]}>
      <boxGeometry args={[0.08, 0.05, 0.08]} />
      <meshStandardMaterial color="#333" />
    </mesh>
    {/* Keyboard */}
    <mesh position={[0, 0.31, 0.12]}>
      <boxGeometry args={[0.35, 0.02, 0.15]} />
      <meshStandardMaterial color="#444" />
    </mesh>
  </group>
);

const ActiveArrow = () => {
  const arrowRef = useRef();
  useFrame((state) => {
    if (arrowRef.current) {
      arrowRef.current.position.y = 1.6 + Math.sin(state.clock.elapsedTime * 6) * 0.15;
    }
  });
  return (
    <group ref={arrowRef} position={[0, 1.6, 0]} scale={[1.8, 1.8, 1.8]}>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.2]} />
        <meshStandardMaterial color="#008800" emissive="#008800" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, 0.0, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.1, 0.2, 16]} />
        <meshStandardMaterial color="#008800" emissive="#008800" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
};

const RobotCharacter = ({ x, z, isFalling, isActive }) => {
  const { position } = useSpring({
    position: [x, isFalling ? -10 : 0, z],
    config: isFalling ? { mass: 2, tension: 120, friction: 14 } : { mass: 1, tension: 180, friction: 20 }
  });

  const bobRef = useRef();
  useFrame((state) => {
    if (bobRef.current) {
      bobRef.current.position.y = Math.sin(state.clock.elapsedTime * 3) * 0.03;
    }
  });

  return (
    <animated.group position={position}>
      {isActive && <ActiveArrow />}
      <group ref={bobRef}>
        {/* Body */}
        <mesh position={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[0.4, 0.35, 0.3]} />
          <meshStandardMaterial color="#ffa500" metalness={0.4} roughness={0.3} />
          <Edges color="#cc8400" />
        </mesh>
        {/* Head */}
        <mesh position={[0, 0.6, 0]} castShadow>
          <boxGeometry args={[0.35, 0.25, 0.28]} />
          <meshStandardMaterial color="#ffcc00" metalness={0.3} roughness={0.3} />
          <Edges color="#cc9900" />
        </mesh>
        {/* Eyes */}
        <mesh position={[-0.08, 0.63, 0.14]}>
          <sphereGeometry args={[0.04]} />
          <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[0.08, 0.63, 0.14]}>
          <sphereGeometry args={[0.04]} />
          <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={0.8} />
        </mesh>
        {/* Antenna */}
        <mesh position={[0, 0.78, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.12, 8]} />
          <meshStandardMaterial color="#888" />
        </mesh>
        <mesh position={[0, 0.85, 0]}>
          <sphereGeometry args={[0.04]} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.6} />
        </mesh>
        {/* Arms */}
        <mesh position={[-0.28, 0.3, 0]} castShadow>
          <boxGeometry args={[0.1, 0.25, 0.1]} />
          <meshStandardMaterial color="#ffa500" metalness={0.4} roughness={0.3} />
        </mesh>
        <mesh position={[0.28, 0.3, 0]} castShadow>
          <boxGeometry args={[0.1, 0.25, 0.1]} />
          <meshStandardMaterial color="#ffa500" metalness={0.4} roughness={0.3} />
        </mesh>
        {/* Legs */}
        <mesh position={[-0.1, 0.08, 0]}>
          <boxGeometry args={[0.12, 0.16, 0.12]} />
          <meshStandardMaterial color="#666" />
        </mesh>
        <mesh position={[0.1, 0.08, 0]}>
          <boxGeometry args={[0.12, 0.16, 0.12]} />
          <meshStandardMaterial color="#666" />
        </mesh>
      </group>
    </animated.group>
  );
};

const WindEffect = ({ length, radius, isActive }) => {
  const groupRef = useRef();
  
  const lines = useMemo(() => {
    return Array.from({ length: 15 }).map(() => ({
      x: (Math.random() - 0.5) * length,
      y: (Math.random() - 0.5) * (radius * 1.2),
      z: (Math.random() - 0.5) * (radius * 1.2),
      speed: 3 + Math.random() * 3,
      length: 0.3 + Math.random() * 0.8
    }));
  }, [length, radius]);

  useFrame((state, delta) => {
    if (!isActive || !groupRef.current) return;
    const children = groupRef.current.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const data = lines[i];
      child.position.x += data.speed * delta;
      if (child.position.x > length / 2) {
        child.position.x = -length / 2;
      }
    }
  });

  if (!isActive) return null;

  return (
    <group ref={groupRef}>
      {lines.map((line, i) => (
        <mesh key={i} position={[line.x, line.y, line.z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.015, 0.015, line.length, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
};

const Bridge = ({ position, width, gap = 2, isOpen }) => {
  const { posY, emissiveIntensity } = useSpring({
    posY: isOpen ? 0 : -1.5,
    emissiveIntensity: isOpen ? 1 : 0,
    config: { mass: 1, tension: 150, friction: 15 }
  });

  const { portalScale } = useSpring({
    portalScale: isOpen ? 1 : 0,
    config: { mass: 1, tension: 200, friction: 15 },
    delay: isOpen ? 400 : 0
  });

  const length = gap + 1.0;
  const radius = 0.6; 
  const centerY = 0.6; // Center of the tube

  return (
    <group position-x={position[0]} position-y={0} position-z={position[2]}>
      
      {/* Portals (stationary, scaled in with delay so they don't clip through the ground from below) */}
      <animated.group scale={portalScale}>
        {/* Portal 1 (Start) */}
        <mesh position={[-length / 2, centerY, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[radius, 0.08, 16, 32]} />
          <meshStandardMaterial color={isOpen ? "#aaddff" : "#555"} emissive={isOpen ? "#aaddff" : "#000"} emissiveIntensity={isOpen ? 0.5 : 0} />
        </mesh>

        {/* Portal 2 (End) */}
        <mesh position={[length / 2, centerY, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[radius, 0.08, 16, 32]} />
          <meshStandardMaterial color={isOpen ? "#aaddff" : "#555"} emissive={isOpen ? "#aaddff" : "#000"} emissiveIntensity={isOpen ? 0.5 : 0} />
        </mesh>
      </animated.group>

      {/* Connecting Glass Tube (slides up) */}
      <animated.group position-y={posY}>
        {/* Wind Animation */}
        <group position={[0, centerY, 0]}>
          <WindEffect length={length} radius={radius} isActive={isOpen} />
        </group>

        <mesh position={[0, centerY, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[radius, radius, length, 32, 1, true]} />
          <meshStandardMaterial 
            color="#aaddff" 
            transparent 
            opacity={0.3} 
            roughness={0.1} 
            metalness={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Lamp inside the tube */}
        <animated.mesh position={[0, centerY + radius - 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, length, 8]} />
          <animated.meshStandardMaterial 
            color={isOpen ? "#ffff00" : "#555555"}
            emissive="#ffff00"
            emissiveIntensity={emissiveIntensity}
          />
        </animated.mesh>
      </animated.group>
    </group>
  );
};

const Portal = ({ position, isActive }) => (
  <group position={position}>
    <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[1.6, 1.6, 0.1, 32]} />
      <meshStandardMaterial color="#e0e0e0" />
    </mesh>
    <mesh position={[0, 0.1, 0]} castShadow>
      <cylinderGeometry args={[1.2, 1.2, 0.1, 32]} />
      <meshStandardMaterial color="#444" />
    </mesh>
    <mesh position={[0, 0.15, 0]}>
      <cylinderGeometry args={[0.7, 0.7, 0.1, 32]} />
      <meshStandardMaterial 
        color={isActive ? '#ffffaa' : '#555'} 
        emissive={isActive ? '#ffff00' : '#000'} 
        emissiveIntensity={isActive ? 0.8 : 0} 
      />
    </mesh>
    {[-1.3, 1.3].map(x => (
      <mesh key={`p-x-${x}`} position={[x, 0.1, 0]}>
        <sphereGeometry args={[0.1]} />
        <meshStandardMaterial color={isActive ? '#ffff00' : '#888'} emissive={isActive ? '#ffff00' : '#000'} emissiveIntensity={isActive ? 0.5 : 0} />
      </mesh>
    ))}
    {[-1.3, 1.3].map(z => (
      <mesh key={`p-z-${z}`} position={[0, 0.1, z]}>
        <sphereGeometry args={[0.1]} />
        <meshStandardMaterial color={isActive ? '#ffff00' : '#888'} emissive={isActive ? '#ffff00' : '#000'} emissiveIntensity={isActive ? 0.5 : 0} />
      </mesh>
    ))}
    {/* Portal Light Beam */}
    {isActive && (
      <mesh position={[0, 2.65, 0]}>
        <cylinderGeometry args={[1.5, 0.7, 5, 32, 1, true]} />
        <shaderMaterial
          transparent={true}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec2 vUv;
            void main() {
              float alpha = 1.0 - vUv.y;
              // Make it fade out even smoother
              alpha = pow(alpha, 1.5);
              vec3 color = vec3(1.0, 1.0, 0.6);
              gl_FragColor = vec4(color, alpha * 0.8);
            }
          `}
        />
      </mesh>
    )}
  </group>
);

const DizzyStars = () => {
  const starsRef = useRef();
  
  useFrame((state, delta) => {
    if (starsRef.current) {
      starsRef.current.rotation.y -= delta * 5;
      // Make the stars bob up and down slightly
      starsRef.current.position.y = 1.0 + Math.sin(state.clock.elapsedTime * 5) * 0.1;
    }
  });

  return (
    <group ref={starsRef}>
      {[0, 1, 2].map((i) => {
        const angle = (i / 3) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * 0.4, 0, Math.sin(angle) * 0.4]}>
            <octahedronGeometry args={[0.08, 0]} />
            <meshStandardMaterial color="#ffff00" emissive="#ddaa00" emissiveIntensity={0.8} />
          </mesh>
        );
      })}
    </group>
  );
};

const Character = ({ x, z, dx, dz, isFalling, isFlying, isPreFlying, isDizzy, isVictory, showPrompt, isCarrying, nearbyPodium, isAtPortal, canFinish, nearbyComputer }) => {
  let targetRotation = 0;
  if (dx === -1 && dz === 0) targetRotation = -Math.PI / 2;
  else if (dx === 1 && dz === 0) targetRotation = Math.PI / 2;
  else if (dx === 0 && dz === 1) targetRotation = 0;
  else if (dx === 0 && dz === -1) targetRotation = Math.PI;

  const { position, rotation, bodyRotation } = useSpring({
    position: [x, isFalling ? -15 : ((isFlying || isPreFlying) ? 0.6 : 0), z],
    rotation: [0, targetRotation, 0],
    bodyRotation: [(isFlying || isPreFlying) ? Math.PI / 2 : 0, 0, 0],
    config: isFlying ? { mass: 1, tension: 40, friction: 14 } : { mass: 1, tension: 200, friction: 20 }
  });

  const danceRef = useRef();
  useFrame((state, delta) => {
    if (isVictory && danceRef.current) {
      danceRef.current.rotation.y += delta * 15;
      danceRef.current.position.y = Math.abs(Math.sin(state.clock.elapsedTime * 15)) * 0.5;
    } else if (isDizzy && danceRef.current) {
      // Wobble around like a cartoon character
      danceRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 15) * 0.2;
      danceRef.current.rotation.x = Math.cos(state.clock.elapsedTime * 12) * 0.2;
      danceRef.current.position.y = 0;
    } else if (danceRef.current) {
      danceRef.current.rotation.y = 0;
      danceRef.current.rotation.z = 0;
      danceRef.current.position.y = 0;
    }
  });

  return (
    <animated.group position={position} rotation={rotation}>
      {/* Victory Notification */}
      {isVictory && (
        <Html position={[0, 2.5, 0]} center sprite scale={1.5} style={{ pointerEvents: 'none' }}>
           <div style={{ color: '#00ff88', fontSize: '28px', fontWeight: 'bold', textShadow: '0 0 15px #00ff88', letterSpacing: '4px' }}>
             VICTORY!
           </div>
        </Html>
      )}

      {/* Dizzy Stars */}
      {isDizzy && <DizzyStars />}

      {/* Notification Bubble */}
      {!isVictory && (showPrompt || isCarrying || (isAtPortal && canFinish) || nearbyComputer) && (
        <Html position={[0, 1.5, 0]} center sprite scale={1.5} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(0,0,0,0.85)',
            border: (isCarrying || (isAtPortal && canFinish)) ? '2px solid #00ff88' : (nearbyComputer ? '2px solid #ff8c00' : '2px solid #00f3ff'),
            borderRadius: '12px',
            padding: '8px 18px',
            color: (isCarrying || (isAtPortal && canFinish)) ? '#00ff88' : (nearbyComputer ? '#ff8c00' : '#00f3ff'),
            fontFamily: 'monospace',
            fontSize: '16px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            textShadow: (isCarrying || (isAtPortal && canFinish)) ? '0 0 6px #00ff88' : (nearbyComputer ? '0 0 6px #ff8c00' : '0 0 6px #00f3ff'),
          }}>
            {nearbyComputer ? '💻 Press SPACE to operate computer' : (isAtPortal && canFinish ? '✨ Press SPACE to finish' : (isCarrying ? (nearbyPodium ? '🪨 Press SPACE to place on button' : '🪨 Press SPACE to drop') : '⬜ Press SPACE to carry'))}
          </div>
        </Html>
      )}

      <animated.group rotation={bodyRotation}>
        <group ref={danceRef}>
        {/* Body */}
        <mesh position={[0, 0.25, 0]} castShadow>
          <capsuleGeometry args={[0.2, 0.1, 16, 16]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
        {/* Head */}
        <mesh position={[0, 0.55, 0]} castShadow>
          <sphereGeometry args={[0.22, 32, 32]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
        {/* Face (beige) */}
        <mesh position={[0, 0.55, 0.15]}>
          <sphereGeometry args={[0.18, 32, 32]} />
          <meshStandardMaterial color="#DEB887" />
        </mesh>
        {/* Ears */}
        <mesh position={[-0.2, 0.6, 0]} castShadow>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
        <mesh position={[0.2, 0.6, 0]} castShadow>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
        {/* Inner Ears */}
        <mesh position={[-0.22, 0.6, 0.05]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color="#DEB887" />
        </mesh>
        <mesh position={[0.22, 0.6, 0.05]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color="#DEB887" />
        </mesh>
        {/* Eyes */}
        <mesh position={[-0.08, 0.62, 0.3]}>
          <sphereGeometry args={[0.03]} />
          <meshStandardMaterial color="#000" />
        </mesh>
        <mesh position={[0.08, 0.62, 0.3]}>
          <sphereGeometry args={[0.03]} />
          <meshStandardMaterial color="#000" />
        </mesh>
        {/* Nose/Snout */}
        <mesh position={[0, 0.52, 0.32]}>
          <sphereGeometry args={[0.04]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
        {/* Tail */}
        <mesh position={[0, 0.2, -0.2]} rotation={[Math.PI/3, 0, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
      </group>
      </animated.group>
    </animated.group>
  );
};

const CameraController = ({ isVictory, targetPos, arenaCenter }) => {
  useFrame((state) => {
    if (isVictory) {
      state.camera.zoom = THREE.MathUtils.lerp(state.camera.zoom, 180, 0.05);
      state.camera.position.lerp(new THREE.Vector3(targetPos.x + 8, 8, targetPos.z + 8), 0.05);
      state.camera.lookAt(targetPos.x, 0.5, targetPos.z);
    } else {
      // Smoothly zoom based on the dynamically calculated arena zoom
      state.camera.zoom = THREE.MathUtils.lerp(state.camera.zoom, arenaCenter.zoom, 0.05);
      state.camera.position.lerp(new THREE.Vector3(arenaCenter.x + 50, 50, arenaCenter.z + 50), 0.05);
      state.camera.lookAt(arenaCenter.x, 0, arenaCenter.z);
    }
    state.camera.updateProjectionMatrix();
  });
  return null;
};

// ----------------------------------------------------------------------------
// Main Application
// ----------------------------------------------------------------------------

function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [menuPhase, setMenuPhase] = useState('main');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [masterVol, setMasterVol] = useState(audioManager.masterVolume);
  const [musicVol, setMusicVol] = useState(audioManager.musicVolume);
  const [sfxVol, setSfxVol] = useState(audioManager.sfxVolume);

  useEffect(() => {
    audioManager.setVolumes(masterVol, musicVol, sfxVol);
  }, [masterVol, musicVol, sfxVol]);

  const [isMuted, setIsMuted] = useState(() => audioManager.isMuted);

  const toggleMute = () => {
    setIsMuted(audioManager.toggleMute());
  };

  const [currentLevel, setCurrentLevel] = useState(() => {
    const saved = localStorage.getItem('puzzleArenaLevel');
    return saved ? parseInt(saved) : 1;
  });
  
  const [maxUnlockedLevel, setMaxUnlockedLevel] = useState(() => {
    const saved = localStorage.getItem('puzzleArenaMaxLevel');
    return saved ? parseInt(saved) : 1;
  });

  const [resetKey, setResetKey] = useState(0);

  const levelData = useMemo(() => generateLevel(currentLevel), [currentLevel, resetKey]);

  const handleRestart = () => {
    setResetKey(prev => prev + 1);
  };

  const MAX_LEVEL = 8;

  const handleVictory = () => {
    let nextLvl = currentLevel + 1;
    if (nextLvl > maxUnlockedLevel) {
      setMaxUnlockedLevel(nextLvl);
      localStorage.setItem('puzzleArenaMaxLevel', nextLvl.toString());
    }
    if (nextLvl > MAX_LEVEL) {
      nextLvl = 1;
    }
    setCurrentLevel(nextLvl);
    localStorage.setItem('puzzleArenaLevel', nextLvl.toString());
  };

  const {
    pos, dir, gameState, stones, bouncingStones, carriedStoneId,
    nearbyStoneId, nearbyPodium, openBridges, isAtPortal,
    nearbyComputer, codingMode, setCodingMode,
    robotPositions, activeRobotId, robotCommands, setRobotCommands,
    isRobotRunning, runRobotProgram, robotCarriedStones, fallingRobots,
    move, handleSpace,
    showGuidance, currentGuidance, guidanceStep, setGuidanceStep, guidanceData
  } = useGameLogic(levelData, handleVictory, handleRestart, currentLevel, gameStarted);

  const [targetPickerType, setTargetPickerType] = useState(null);
  const maxLines = 10;

  const arenaCenter = useMemo(() => {
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    levelData.islands.forEach(isl => {
      minX = Math.min(minX, isl.xStart);
      maxX = Math.max(maxX, isl.xStart + isl.w);
      minZ = Math.min(minZ, isl.zStart);
      maxZ = Math.max(maxZ, isl.zStart + isl.d);
    });
    
    // Calculate a dynamic zoom that fits the width/depth of the arena
    const width = maxX - minX;
    const depth = maxZ - minZ;
    // 1000 is a magic scale factor that generally fits orthographic units to screen pixels
    const targetZoom = Math.max(40, Math.min(80, 1300 / Math.max(10, Math.max(width, depth))));

    return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, zoom: targetZoom };
  }, [levelData]);

  const stoneOnTile = (bx, bz) => {
    const hasStone = stones.some(s => s.x === bx && s.z === bz && s.id !== carriedStoneId);
    const hasRobot = Object.values(robotPositions).some(rPos => rPos.x === bx && rPos.z === bz);
    return hasStone || hasRobot;
  };

  if (!gameStarted) {
    return (
      <>
        <div className="shining-stars"></div>
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'sans-serif', zIndex: 1000, pointerEvents: 'auto', userSelect: 'none'
        }}>
           {menuPhase === 'main' ? (
             <>
               {/* Reset Confirmation Modal */}
               {showResetConfirm && (
                 <div style={{
                   position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                   background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center',
                   zIndex: 2000
                 }}>
                   <div style={{
                     background: 'rgba(26, 26, 68, 0.95)', border: '2px solid #00f3ff', borderRadius: '16px', padding: 'clamp(20px, 5vw, 40px)',
                     display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px', width: '90%', maxWidth: '500px',
                     boxShadow: '0 0 30px rgba(0, 243, 255, 0.4)'
                   }}>
                     <h2 style={{ color: 'white', margin: 0, fontSize: '24px', textAlign: 'center', textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>
                       Are you sure you want to reset your progress?
                     </h2>
                     <div style={{ display: 'flex', gap: '20px' }}>
                       <button onClick={() => {
                         localStorage.removeItem('puzzleArenaLevel');
                         localStorage.removeItem('puzzleArenaMaxLevel');
                         setCurrentLevel(1);
                         setMaxUnlockedLevel(1);
                         setShowResetConfirm(false);
                         audioManager.init();
                       }} style={{
                         background: '#ff3366', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 40px',
                         fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 6px 0 #cc0044',
                         transition: 'transform 0.1s'
                       }} onMouseEnter={() => audioManager.playHoverSound()} onMouseDown={(e) => e.target.style.transform = 'translateY(6px)'} onMouseUp={(e) => e.target.style.transform = 'none'} onMouseLeave={(e) => e.target.style.transform = 'none'}>
                         Yes, Reset
                       </button>
                       <button onClick={() => setShowResetConfirm(false)} style={{
                         background: '#6b66d6', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 40px',
                         fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 6px 0 #4a45a3',
                         transition: 'transform 0.1s'
                       }} onMouseEnter={() => audioManager.playHoverSound()} onMouseDown={(e) => e.target.style.transform = 'translateY(6px)'} onMouseUp={(e) => e.target.style.transform = 'none'} onMouseLeave={(e) => e.target.style.transform = 'none'}>
                         Cancel
                       </button>
                     </div>
                   </div>
                 </div>
               )}

               {/* Settings Modal */}
               {showSettings && (
                 <div style={{
                   position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                   background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center',
                   zIndex: 2000
                 }}>
                   <div style={{
                      background: 'rgba(26, 26, 68, 0.95)', border: '2px solid #00f3ff', borderRadius: '16px', padding: 'clamp(20px, 5vw, 40px)',
                      display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '30px', width: '90%', maxWidth: '500px',
                      boxShadow: '0 0 30px rgba(0, 243, 255, 0.4)'
                    }}>
                     <h2 style={{ color: 'white', margin: 0, fontSize: '32px', textAlign: 'center', textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>
                       Settings
                     </h2>
                     
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>Master Volume</span>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                           <input type="range" min="0" max="1" step="0.05" value={masterVol} onChange={(e) => setMasterVol(parseFloat(e.target.value))} style={{ width: '150px', cursor: 'pointer' }} />
                           <span style={{ color: '#00f3ff', width: '45px', textAlign: 'right', fontWeight: 'bold' }}>{Math.round(masterVol * 100)}%</span>
                         </div>
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>Music Volume</span>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                           <input type="range" min="0" max="1" step="0.05" value={musicVol} onChange={(e) => setMusicVol(parseFloat(e.target.value))} style={{ width: '150px', cursor: 'pointer' }} />
                           <span style={{ color: '#00f3ff', width: '45px', textAlign: 'right', fontWeight: 'bold' }}>{Math.round(musicVol * 100)}%</span>
                         </div>
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>SFX Volume</span>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                           <input type="range" min="0" max="1" step="0.05" value={sfxVol} onChange={(e) => setSfxVol(parseFloat(e.target.value))} style={{ width: '150px', cursor: 'pointer' }} />
                           <span style={{ color: '#00f3ff', width: '45px', textAlign: 'right', fontWeight: 'bold' }}>{Math.round(sfxVol * 100)}%</span>
                         </div>
                       </div>
                     </div>

                     <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                       <button onClick={() => setShowSettings(false)} style={{
                         background: '#6b66d6', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 40px',
                         fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 6px 0 #4a45a3',
                         transition: 'transform 0.1s'
                       }} onMouseEnter={() => audioManager.playHoverSound()} onMouseDown={(e) => e.target.style.transform = 'translateY(6px)'} onMouseUp={(e) => e.target.style.transform = 'none'} onMouseLeave={(e) => e.target.style.transform = 'none'}>
                         Close
                       </button>
                     </div>
                   </div>
                 </div>
               )}
               
               {/* Floating Icons (using Emojis to simulate the characters in the reference) */}
               <div style={{ position: 'absolute', top: '15%', left: '15%', fontSize: '100px', filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))', animation: 'float 4s ease-in-out infinite' }}>🤖</div>
               <div style={{ position: 'absolute', top: '25%', right: '15%', fontSize: '100px', filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))', animation: 'float 3s ease-in-out infinite alternate' }}>🧊</div>
               
               {/* Bottom Right Characters */}
               <div style={{ position: 'absolute', bottom: '15%', right: '15%', display: 'flex', gap: '20px', fontSize: '100px', filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))', animation: 'float 5s ease-in-out infinite' }}>
                 🚀
               </div>

               {/* Left Bottom STEAM Banner */}
               <div style={{ 
                 position: 'absolute', bottom: 'clamp(10px, 5%, 15%)', left: 'clamp(10px, 5%, 10%)',
                 background: '#00d18b', border: 'clamp(4px, 1vw, 12px) solid #a9b5c9', borderRadius: 'clamp(20px, 3vw, 40px)',
                 padding: 'clamp(10px, 2vw, 15px) clamp(20px, 4vw, 40px)', color: 'white', display: 'flex', alignItems: 'center', gap: '15px',
                 boxShadow: '0 10px 30px rgba(0,0,0,0.5)', animation: 'float 6s ease-in-out infinite',
                 transformOrigin: 'bottom left', transform: 'scale(clamp(0.6, 1vw + 0.5, 1))'
               }}>
                 <div style={{ fontSize: '50px' }}>🎮</div>
                 <div style={{ display: 'flex', flexDirection: 'column', fontWeight: '900', fontSize: '32px', lineHeight: '1.1', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>
                   <span>The Lab</span>
                   <span>Indonesia</span>
                 </div>
                 {/* Decorator pipe top */}
                 <div style={{ position: 'absolute', top: '-40px', left: '40px', width: '24px', height: '40px', background: '#a9b5c9', borderRadius: '12px 12px 0 0' }}>
                   <div style={{ width: '100%', height: '10px', background: '#00f3ff', marginTop: '15px', boxShadow: '0 0 15px #00f3ff' }}></div>
                 </div>
                 {/* Decorator pipe bottom */}
                 <div style={{ position: 'absolute', bottom: '-24px', left: '120px', width: '50px', height: '24px', background: '#a9b5c9', borderRadius: '0 0 12px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                    <div style={{width: '8px', height: '12px', background: '#000', opacity: 0.2, borderRadius: '4px'}}></div>
                    <div style={{width: '8px', height: '12px', background: '#000', opacity: 0.2, borderRadius: '4px'}}></div>
                 </div>
               </div>

               {/* Title */}
               <div style={{ textAlign: 'center', marginBottom: '50px', position: 'relative' }}>
                 <h1 style={{ 
                   fontSize: 'clamp(3rem, 10vw, 6rem)', margin: 0, lineHeight: '0.9', color: 'white', 
                   fontStyle: 'italic', fontWeight: '900', transform: 'rotate(-5deg)',
                   WebkitTextStroke: 'clamp(2px, 1vw, 6px) #1a1a3a', letterSpacing: '4px',
                   fontFamily: 'Impact, sans-serif'
                 }}>
                   Monkey In<br/>The Space
                 </h1>
                 <div style={{ position: 'absolute', top: '-30px', right: '-40px', fontSize: '50px', transform: 'rotate(15deg)' }}>✨</div>
               </div>

               {/* Menu Box */}
               <div style={{ 
                 background: 'rgba(26, 26, 68, 0.95)', padding: 'clamp(20px, 5vw, 50px) clamp(40px, 10vw, 100px)', borderRadius: '16px', 
                 display: 'flex', flexDirection: 'column', gap: '30px', alignItems: 'center',
                 boxShadow: '0 15px 40px rgba(0,0,0,0.7)', border: '2px solid rgba(255,255,255,0.05)'
               }}>
                 <button onClick={() => { audioManager.init(); setMenuPhase('sub'); }} onMouseEnter={() => audioManager.playHoverSound()} className="menu-btn">START GAME</button>
                 <button onClick={() => setShowResetConfirm(true)} onMouseEnter={() => audioManager.playHoverSound()} className="menu-btn">RESET PROGRESS</button>
                 <button onClick={() => setShowSettings(true)} onMouseEnter={() => audioManager.playHoverSound()} className="menu-btn">SETTINGS</button>
               </div>
             </>
           ) : (
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px', zIndex: 10, width: '100%', padding: '0 20px' }}>
               <div style={{ display: 'flex', gap: '30px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                 {/* Card 1 */}
                 <div 
                   className="level-card"
                   onMouseEnter={() => audioManager.playHoverSound()}
                   onClick={() => setGameStarted(true)}
                   style={{
                     background: '#e4eef6', borderRadius: '24px', padding: '20px', width: '280px', height: '360px',
                     display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                     cursor: 'pointer'
                   }}
                 >
                   <div style={{ background: '#0b3a53', color: '#00f3ff', padding: '12px 20px', borderRadius: '16px', fontWeight: 'bold', width: '90%', textAlign: 'center', fontSize: '1.2rem' }}>
                     1. Kinder Level
                   </div>
                   <img src={kinderImg} alt="Kinder Level" style={{ height: '200px', objectFit: 'contain' }} />
                   <div style={{ background: '#9fa8c3', color: 'white', padding: '10px 20px', borderRadius: '16px', fontWeight: 'bold', width: '70%', textAlign: 'center', fontSize: '1.1rem' }}>
                     Completed :<br/>{Math.min(maxUnlockedLevel - 1, 8)} / 8
                   </div>
                 </div>

                 {/* Card 2 */}
                 <div 
                   style={{
                     background: '#d8dbdf', borderRadius: '24px', padding: '20px', width: '280px', height: '360px',
                     display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                     boxShadow: '0 10px 20px rgba(0,0,0,0.2)', cursor: 'not-allowed'
                   }}>
                   <div style={{ background: '#6c757d', color: '#ced4da', padding: '12px 20px', borderRadius: '16px', fontWeight: 'bold', width: '90%', textAlign: 'center', fontSize: '1.2rem' }}>
                     2. Junior Level
                   </div>
                   <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', width: '100%' }}>
                     <img src={juniorImg} alt="Junior Level" style={{ height: '100%', objectFit: 'contain', filter: 'grayscale(100%) opacity(50%)' }} />
                     <div style={{ position: 'absolute', fontSize: '60px', textShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>🔒</div>
                   </div>
                   <div style={{ background: '#adb5bd', color: '#e9ecef', padding: '10px 20px', borderRadius: '16px', fontWeight: 'bold', width: '70%', textAlign: 'center', fontSize: '1.1rem' }}>
                     Completed :<br/>0 / 8
                   </div>
                 </div>

                 {/* Card 3 */}
                 <div 
                   style={{
                     background: '#d8dbdf', borderRadius: '24px', padding: '20px', width: '280px', height: '360px',
                     display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                     boxShadow: '0 10px 20px rgba(0,0,0,0.2)', cursor: 'not-allowed'
                   }}>
                   <div style={{ background: '#6c757d', color: '#ced4da', padding: '12px 20px', borderRadius: '16px', fontWeight: 'bold', width: '90%', textAlign: 'center', fontSize: '1.2rem' }}>
                     3. Coder Level
                   </div>
                   <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', width: '100%' }}>
                     <img src={coderImg} alt="Coder Level" style={{ height: '100%', objectFit: 'contain', filter: 'grayscale(100%) opacity(50%)' }} />
                     <div style={{ position: 'absolute', fontSize: '60px', textShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>🔒</div>
                   </div>
                   <div style={{ background: '#adb5bd', color: '#e9ecef', padding: '10px 20px', borderRadius: '16px', fontWeight: 'bold', width: '70%', textAlign: 'center', fontSize: '1.1rem' }}>
                     Completed :<br/>0 / 8
                   </div>
                 </div>
               </div>

               <button 
                 onClick={() => setMenuPhase('main')}
                 onMouseEnter={() => audioManager.playHoverSound()}
                 className="back-btn"
               >
                 Back
               </button>
             </div>
           )}

           {/* Footer */}
           {menuPhase === 'main' && (
             <div style={{ position: 'absolute', bottom: '20px', textAlign: 'center', fontSize: '14px', color: 'white', fontWeight: 'bold', opacity: 0.8 }}>
               Beta Version<br/>Andarinyo 2024
             </div>
           )}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="ui-layer" style={{ pointerEvents: 'none', position: 'absolute', zIndex: 10, width: '100%', height: '100%' }}>
        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', padding: '20px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="stat-box" style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid #00f3ff', padding: '10px 20px', borderRadius: '8px', color: 'white', fontSize: '1.2rem', pointerEvents: 'auto' }}>
              <select 
                value={currentLevel} 
                onChange={e => {
                  const lvl = parseInt(e.target.value);
                  setCurrentLevel(lvl);
                  localStorage.setItem('puzzleArenaLevel', lvl.toString());
                }}
                style={{ background: 'transparent', color: 'white', border: 'none', outline: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map(l => (
                  <option key={l} value={l} style={{ color: 'black' }} disabled={l > maxUnlockedLevel}>
                    Level {l} {l > maxUnlockedLevel ? '🔒' : ''}
                  </option>
                ))}
              </select>
            </div>
            <button 
              onClick={handleRestart}
              style={{
                background: 'rgba(0,0,0,0.5)', border: '1px solid #00f3ff', padding: '10px 15px', borderRadius: '8px', color: 'white', fontSize: '1.2rem', cursor: 'pointer', pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
              title="Restart Level"
            >
              <span>🔄</span> Reset
            </button>
            <button 
              onClick={toggleMute}
              style={{
                background: 'rgba(0,0,0,0.5)', border: '1px solid #00f3ff', padding: '10px 15px', borderRadius: '8px', color: 'white', fontSize: '1.2rem', cursor: 'pointer', pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '50px'
              }}
              title={isMuted ? "Unmute Music" : "Mute Music"}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
          </div>
          <h1 style={{ margin: 0, textShadow: '0 0 10px #00f3ff', color: '#00f3ff', fontSize: '2rem', letterSpacing: '2px', textTransform: 'uppercase' }}>PUZZLE ARENA</h1>
          <div style={{ display: 'flex', gap: '10px', pointerEvents: 'auto' }}>
            {!codingMode && (
              <button 
                onClick={() => setGameStarted(false)}
                style={{
                  background: 'rgba(0,0,0,0.5)', border: '1px solid #ff3366', padding: '10px 15px', borderRadius: '8px', color: 'white', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                title="Back to Menu"
              >
                Back to Menu
              </button>
            )}
            <div className="stat-box" style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid #00f3ff', padding: '10px 20px', borderRadius: '8px', color: 'white', fontSize: '1.2rem' }}>Level: {currentLevel}</div>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: '20px', width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.8)' }}>
          Use W A S D or Arrow Keys to Move
        </div>

        {/* Game UI Layer - Left Compass and Action Button */}
        {!codingMode && (
          <div style={{ position: 'absolute', bottom: 'clamp(20px, 5vh, 60px)', left: 'clamp(20px, 5vw, 60px)', display: 'flex', alignItems: 'center', gap: 'clamp(15px, 2vw, 30px)', pointerEvents: 'none', transformOrigin: 'bottom left', transform: 'scale(clamp(0.7, 1vw + 0.5, 1))' }}>
            {/* The Compass */}
            <div style={{ width: '120px', height: '120px' }}>
              <div style={{
                position: 'relative', width: '100%', height: '100%',
                background: 'rgba(26,26,68,0.6)', border: '2px solid rgba(107,102,214,0.5)', borderRadius: '50%',
                boxShadow: '0 8px 20px rgba(0,0,0,0.6)'
              }}>
                {/* Center Cross */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', width: '90px', height: '1px', background: 'rgba(255,255,255,0.2)', transform: 'translate(-50%, -50%) rotate(45deg)' }}></div>
                <div style={{ position: 'absolute', top: '50%', left: '50%', width: '90px', height: '1px', background: 'rgba(255,255,255,0.2)', transform: 'translate(-50%, -50%) rotate(-45deg)' }}></div>
                
                {/* F (Top Left) */}
                <div style={{ position: 'absolute', top: '15px', left: '15px', color: '#ff3366', fontWeight: 'bold', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>F</span>
                  <span>↖</span>
                </div>
                {/* R (Top Right) */}
                <div style={{ position: 'absolute', top: '15px', right: '15px', color: '#ff3366', fontWeight: 'bold', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>R</span>
                  <span>↙</span>
                </div>
                {/* L (Bottom Left) */}
                <div style={{ position: 'absolute', bottom: '15px', left: '15px', color: '#ff3366', fontWeight: 'bold', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span>↗</span>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>L</span>
                </div>
                {/* B (Bottom Right) */}
                <div style={{ position: 'absolute', bottom: '15px', right: '15px', color: '#ff3366', fontWeight: 'bold', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span>↘</span>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>B</span>
                </div>
              </div>
            </div>

            {/* SPACE/ACTION */}
            <button 
              onClick={() => {
                if (showGuidance) {
                  setGuidanceStep(prev => prev + 1);
                } else {
                  audioManager.init(); handleSpace();
                }
              }}
              onMouseEnter={() => audioManager.playHoverSound()}
              style={{ width: '160px', padding: '12px', borderRadius: '16px', background: '#ff3366', border: 'none', color: 'white', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', transition: 'transform 0.1s', boxShadow: '0 4px 0 #cc0044', pointerEvents: 'auto' }}
              onMouseDown={(e) => e.target.style.transform = 'translateY(4px)'} onMouseUp={(e) => e.target.style.transform = 'none'} onMouseLeave={(e) => e.target.style.transform = 'none'}
            >
              PRESS TO ACT
            </button>
          </div>
        )}

        {/* Game UI Layer - Right Controller */}
        {!codingMode && (
          <div style={{ position: 'absolute', bottom: 'clamp(20px, 5vh, 40px)', right: 'clamp(20px, 5vw, 40px)', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'auto' }}>
            <div className="dpad-container">
              {/* UP */}
              <div 
                className="dpad-btn up"
                onClick={() => { audioManager.init(); move(-1, 0); }}
                onMouseEnter={() => audioManager.playHoverSound()}
              >
                <div className="dpad-chevron"></div>
              </div>
              
              {/* LEFT */}
              <div 
                className="dpad-btn left"
                onClick={() => { audioManager.init(); move(0, 1); }}
                onMouseEnter={() => audioManager.playHoverSound()}
              >
                <div className="dpad-chevron"></div>
              </div>
              
              {/* RIGHT */}
              <div 
                className="dpad-btn right"
                onClick={() => { audioManager.init(); move(0, -1); }}
                onMouseEnter={() => audioManager.playHoverSound()}
              >
                <div className="dpad-chevron"></div>
              </div>
              
              {/* DOWN */}
              <div 
                className="dpad-btn down"
                onClick={() => { audioManager.init(); move(1, 0); }}
                onMouseEnter={() => audioManager.playHoverSound()}
              >
                <div className="dpad-chevron"></div>
              </div>

              {/* Center Dot */}
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(107,102,214,0.3)', pointerEvents: 'none' }}></div>
            </div>
          </div>
        )}
        {gameState === 'FALLING' && (
          <div className="overlay lost" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.8)', padding: '40px', borderRadius: '20px' }}>
            <h2 style={{ color: '#ff0055', textShadow: '0 0 20px #ff0055', margin: 0, fontSize: '3rem' }}>GAME OVER</h2>
          </div>
        )}
      </div>

      {/* Guidance Popup */}
      {showGuidance && currentGuidance[guidanceStep] && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 30,
          background: 'rgba(0,0,0,0.5)', pointerEvents: 'auto'
        }}>
          <div className="guidance-popup">
            <div className="guidance-avatar-container">
              <div className="guidance-avatar">
                <img src={currentLevel <= 8 ? kinderImg : heroImg} alt="Atom" />
              </div>
              <div className="guidance-name">Atom</div>
            </div>
            <div className="guidance-content">
              <span className="guidance-icon">⚇</span>
              <span className="guidance-text">
                <TypingText text={currentGuidance[guidanceStep]} />
              </span>
            </div>
            <div className="guidance-footer">
              <div className="guidance-space-btn" onClick={() => setGuidanceStep(prev => prev + 1)}>space</div>
            </div>
          </div>
        </div>
      )}

      {/* Block Coding Overlay */}
      {codingMode && (
        <div style={{
          position: 'absolute', zIndex: 20, top: 0, left: 0, width: '100%', height: '100%',
          display: 'flex', pointerEvents: 'none'
        }}>
          {/* Left Area (Transparent over Game) */}
          <div style={{ flex: 1, position: 'relative' }}>
            {/* Top Right Close */}
            <button onClick={() => setCodingMode(false)} style={{
              position: 'absolute', top: '20px', right: '72px',
              background: '#20223d', color: 'white', border: 'none', borderRadius: '50%',
              width: '36px', height: '36px', fontSize: '16px', cursor: 'pointer', zIndex: 5, pointerEvents: 'auto'
            }}>✕</button>

            {/* Bottom Left Avatar */}
            <div style={{ position: 'absolute', bottom: '80px', left: '20px', width: '60px', height: '60px', borderRadius: '50%', background: '#5ae2a0', border: '4px solid #3a365f', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '30px', pointerEvents: 'auto' }}>
              🤖
            </div>

            {/* Bottom Bar */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, width: '100%', height: '60px', background: '#20223d', display: 'flex', alignItems: 'center', padding: '0 30px', gap: '30px', color: 'white', fontFamily: 'sans-serif', pointerEvents: 'auto'
            }}>
              {/* P leave terminal */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', opacity: 0.8 }} onClick={() => setCodingMode(false)}>
                <div style={{ background: 'white', color: '#20223d', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px' }}>P</div>
                <span style={{ fontSize: '15px', fontWeight: 'bold' }}>leave terminal</span>
              </div>
              {/* H hint */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', opacity: 0.8 }}>
                <div style={{ background: 'white', color: '#20223d', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px' }}>H</div>
                <span style={{ fontSize: '15px', fontWeight: 'bold' }}>hint</span>
              </div>
              {/* SPACE run code */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', opacity: 0.8 }} onClick={() => { if (robotCommands.length > 0 && !isRobotRunning) runRobotProgram(); }}>
                <div style={{ background: 'white', color: '#20223d', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px' }}>space</div>
                <span style={{ fontSize: '15px', fontWeight: 'bold' }}>run code</span>
              </div>
            </div>

            {/* Pick a command floating box */}
            <div style={{
              position: 'absolute', right: '20px', top: '80px', width: '220px', display: 'flex', flexDirection: 'column', gap: '15px', pointerEvents: 'auto'
            }}>
               <div style={{
                 background: '#3a365f', borderRadius: '24px', padding: '8px', textAlign: 'center', alignSelf: 'flex-end', width: '140px'
               }}>
                 <div style={{ fontSize: '24px' }}>🤖</div>
               </div>
               <div style={{
                 background: '#7e57c2', borderRadius: '12px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '12px'
               }}>
                 <div style={{ color: 'white', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Pick a command</div>
                  <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                     <div 
                       className="scratch-cmd"
                       draggable
                       onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ category: 'command', type: 'goto' }))}
                       style={{ opacity: robotCommands.length >= maxLines ? 0.5 : 1 }}
                     >
                       go to
                       <div className="scratch-hole-right" />
                     </div>
                     <div 
                       className="scratch-cmd"
                       draggable
                       onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ category: 'command', type: 'pickup' }))}
                       style={{ opacity: robotCommands.length >= maxLines ? 0.5 : 1 }}
                     >
                       pick up obj
                       <div className="scratch-hole-right" />
                     </div>
                     <div 
                       className="scratch-cmd"
                       draggable
                       onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ category: 'command', type: 'drop' }))}
                       style={{ opacity: robotCommands.length >= maxLines ? 0.5 : 1 }}
                     >
                       drop at
                       <div className="scratch-hole-right" />
                     </div>
                  </div>
                </div>

                <div style={{
                  background: '#7e57c2', borderRadius: '12px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '12px'
                }}>
                  <div style={{ color: 'white', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Pick a target</div>
                  <div className="target-list" style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto', paddingRight: '5px' }}>
                    {levelData.robotButtons?.map(rb => (
                      <div key={rb.id} className="scratch-target" draggable onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ category: 'target', targetId: rb.id, label: `Button ${rb.label}` }))} style={{ marginLeft: 12 }}>
                        <span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#ff3366', borderRadius: '50%', marginRight: '6px' }}></span>
                        "Button {rb.label}"
                      </div>
                    ))}
                    {(levelData.stones || []).map((item, i) => {
                      const currentStone = stones.find(s => s.id === item.id);
                      const cx = currentStone ? currentStone.x : item.x;
                      const cz = currentStone ? currentStone.z : item.z;
                      const isOnPodium = levelData.buttons.some(b => b.type === 'podium' && b.x === cx && b.z === cz);
                      if (isOnPodium) return null;
                      return (
                        <div key={item.id} className="scratch-target" draggable onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ category: 'target', targetId: item.id, label: `Stone ${i + 1}` }))} style={{ marginLeft: 12 }}>
                          <span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#e2e8f0', borderRadius: '2px', marginRight: '6px' }}></span>
                          "Stone {i + 1}"
                        </div>
                      );
                    })}
                    {(levelData.buttons?.filter(b => b.type === 'podium') || []).map((btn) => {
                      const hasStone = stones.some(s => s.x === btn.x && s.z === btn.z);
                      if (hasStone) return null;
                      return (
                        <div key={btn.id} className="scratch-target" draggable onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ category: 'target', targetId: btn.id, label: `Podium ${btn.label}` }))} style={{ marginLeft: 12 }}>
                          <span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#ff3366', borderRadius: '50%', marginRight: '6px' }}></span>
                          "Podium {btn.label}"
                        </div>
                      );
                    })}
                    {(levelData.trampolines || []).map((tramp, i) => (
                      <div key={tramp.id} className="scratch-target" draggable onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ category: 'target', targetId: tramp.id, label: `Trampoline ${i+1}` }))} style={{ marginLeft: 12 }}>
                        <span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#33ffaa', borderRadius: '50%', marginRight: '6px' }}></span>
                        "Trampoline {i+1}"
                      </div>
                    ))}
                  </div>
                </div>
            </div>
          </div>

          {/* Right Panel (Code Space) */}
          <div style={{
            flex: '0 0 340px', background: '#2c2b54', display: 'flex', flexDirection: 'column', padding: '40px', pointerEvents: 'auto'
          }}>
             {/* Lines indicator */}
             <div style={{
               alignSelf: 'center', background: '#20203d', padding: '10px 30px', borderRadius: '24px',
               color: 'white', fontWeight: 'bold', fontSize: '16px', marginBottom: '40px', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
             }}>
               {robotCommands.length} / {maxLines} lines
             </div>

             {/* Code Area */}
             <div 
               onDragOver={(e) => e.preventDefault()}
               onDrop={(e) => {
                 e.preventDefault();
                 try {
                   const data = JSON.parse(e.dataTransfer.getData('application/json'));
                   if (data.category === 'command') {
                     if (robotCommands.length < maxLines) {
                       const newCmd = { id: Date.now().toString() + Math.random(), type: data.type, targetId: null };
                       setRobotCommands([...robotCommands, newCmd]);
                     }
                   } else if (data.category === 'target') {
                     // Magnet system: snap to first incomplete command if dropped anywhere on canvas
                     const incompleteIndex = robotCommands.findIndex(c => c.targetId === null);
                     if (incompleteIndex !== -1) {
                       const newCmds = [...robotCommands];
                       newCmds[incompleteIndex].targetId = data.targetId;
                       newCmds[incompleteIndex].targetLabel = data.label;
                       setRobotCommands(newCmds);
                     }
                   }
                 } catch(err) {}
               }}
               style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', gap: '15px' }}
             >
               {robotCommands.length === 0 ? (
                 <div style={{
                   position: 'relative', width: '100%', padding: '40px 20px', textAlign: 'center',
                   color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', fontSize: '16px',
                   pointerEvents: 'none'
                 }}>
                   {/* Corners */}
                   <div style={{ position: 'absolute', top: 0, left: 0, width: '16px', height: '16px', borderTop: '3px solid rgba(255,255,255,0.3)', borderLeft: '3px solid rgba(255,255,255,0.3)', borderRadius: '4px 0 0 0' }} />
                   <div style={{ position: 'absolute', top: 0, right: 0, width: '16px', height: '16px', borderTop: '3px solid rgba(255,255,255,0.3)', borderRight: '3px solid rgba(255,255,255,0.3)', borderRadius: '0 4px 0 0' }} />
                   <div style={{ position: 'absolute', bottom: 0, left: 0, width: '16px', height: '16px', borderBottom: '3px solid rgba(255,255,255,0.3)', borderLeft: '3px solid rgba(255,255,255,0.3)', borderRadius: '0 0 0 4px' }} />
                   <div style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', borderBottom: '3px solid rgba(255,255,255,0.3)', borderRight: '3px solid rgba(255,255,255,0.3)', borderRadius: '0 0 4px 0' }} />
                   
                   drag code here
                 </div>
               ) : (
                 robotCommands.map((cmd, i) => {
                   let label = '';
                   let iconStyle = {};
                   let targetLabel = cmd.targetLabel || '?';
                   
                   const isComplete = cmd.targetId !== null;
                   const cmdText = cmd.type === 'goto' ? 'go to' : (cmd.type === 'pickup' ? 'pick up obj' : 'drop at');

                   return (
                     <div key={cmd.id || i} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                       <span style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', fontSize: '14px' }}>{i + 1}</span>
                       <div style={{ display: 'flex', alignItems: 'center' }}>
                         <div 
                           className="scratch-cmd"
                           draggable 
                           onDragStart={(e) => { e.dataTransfer.setData('application/json', JSON.stringify({ category: 'existing_command', id: cmd.id })); }}
                           style={{ borderRadius: isComplete ? '4px 0 0 4px' : '4px', zIndex: 1, paddingRight: isComplete ? '28px' : '24px', minWidth: '80px' }}
                         >
                           {cmdText}
                           {!isComplete && <div className="scratch-hole-right" />}
                         </div>
                         <div 
                           onDragOver={(e) => e.preventDefault()}
                           onDrop={(e) => {
                             e.preventDefault();
                             e.stopPropagation();
                             try {
                               const data = JSON.parse(e.dataTransfer.getData('application/json'));
                               if (data.category === 'target') {
                                 setRobotCommands(robotCommands.map(c => c.id === cmd.id ? { ...c, targetId: data.targetId, targetLabel: data.label } : c));
                               }
                             } catch(err) {}
                           }}
                           style={{ display: 'flex', alignItems: 'center' }}
                         >
                           {isComplete ? (
                             <div 
                               className="scratch-target" 
                               draggable 
                               onDragStart={(e) => {
                                 e.stopPropagation();
                                 e.dataTransfer.setData('application/json', JSON.stringify({ category: 'attached_target', commandId: cmd.id }));
                               }}
                             >
                               "{targetLabel}"
                             </div>
                           ) : (
                             <div style={{ marginLeft: '-4px', width: '60px', height: '44px', background: 'rgba(0,0,0,0.2)', border: '2px dashed rgba(255,255,255,0.3)', borderLeft: 'none', borderRadius: '0 4px 4px 0', zIndex: 0 }}></div>
                           )}
                         </div>
                       </div>
                     </div>
                   );
                 })
               )}
             </div>

             {/* Bottom Action Buttons */}
             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', marginTop: '20px' }}>
                {robotCommands.length > 0 && !isRobotRunning && (
                  <div 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      try {
                        const data = JSON.parse(e.dataTransfer.getData('application/json'));
                        if (data.category === 'existing_command') {
                          setRobotCommands(robotCommands.filter(c => c.id !== data.id));
                        }
                        if (data.category === 'attached_target') {
                          setRobotCommands(robotCommands.map(c => c.id === data.commandId ? { ...c, targetId: null } : c));
                        }
                      } catch(err) {}
                    }}
                    onClick={() => setRobotCommands([])}
                    title="Drag commands here to delete, or click to clear all"
                    style={{
                    background: '#ff6b81', color: 'white', border: 'none', borderRadius: '16px',
                    width: '60px', height: '60px', fontSize: '24px', cursor: 'pointer',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 0 #cc5566'
                  }}>
                    🗑️
                  </div>
                )}
                {(() => {
                   const allCommandsComplete = robotCommands.length > 0 && robotCommands.every(cmd => cmd.targetId !== null);
                   return (
                     <button onClick={() => {
                       if (allCommandsComplete && !isRobotRunning) runRobotProgram();
                     }} style={{
                       background: '#ffd32a', color: '#1a1a1a', border: 'none', borderRadius: '16px',
                       padding: '0 50px', fontSize: '20px', fontWeight: 'bold', cursor: allCommandsComplete ? 'pointer' : 'default',
                       boxShadow: allCommandsComplete && !isRobotRunning ? '0 4px 0 #ccaa22' : 'none',
                       opacity: allCommandsComplete ? 1 : 0.5, height: '60px'
                     }}>
                       {isRobotRunning ? 'Running...' : 'Run'}
                     </button>
                   );
                })()}
             </div>
          </div>
        </div>
      )}

      <Canvas shadows style={{ background: 'transparent', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        <OrthographicCamera makeDefault position={[50, 50, 50]} zoom={40} near={-500} far={500} />
        <CameraController isVictory={gameState === 'VICTORY'} targetPos={pos} arenaCenter={arenaCenter} />
        
        <ambientLight intensity={0.6} />
        <directionalLight position={[20, 30, 10]} castShadow intensity={1.2} shadow-mapSize={[2048, 2048]} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} />
        <Environment preset="city" />

        {/* Dynamic Scene Assembly */}
        {levelData.islands.map(isl => (
          <Island key={`isl-${isl.id}`} xStart={isl.xStart} zStart={isl.zStart} w={isl.w} d={isl.d} />
        ))}

        {levelData.buttons.map(btn => {
          const active = stoneOnTile(btn.x, btn.z);
          return (
            <group key={btn.id}>
              {btn.type === 'floor' ? (
                <FloorButton position={[btn.x, 0, btn.z]} isActive={active} />
              ) : (
                <RaisedButton position={[btn.x, 0, btn.z]} isActive={active} />
              )}
            </group>
          );
        })}

        {levelData.bridges.map(br => {
          // Center of bridge is br.x + br.gap / 2 - 0.5
          const cx = br.x + br.gap / 2 - 0.5;
          // Z needs to center the width
          const cz = br.z + br.width / 2 - 0.5;
          return (
            <Bridge 
              key={br.id} 
              position={[cx, -0.2, cz]} 
              width={br.width} 
              gap={br.gap}
              isOpen={openBridges[br.id]} 
            />
          );
        })}

        <Portal 
          position={[levelData.portal.x + 0.5, 0, levelData.portal.z + 0.5]} 
          isActive={levelData.bridges.length === 0 || openBridges[levelData.bridges[levelData.bridges.length - 1].id]} 
        />

        {levelData.trampolines?.map(tramp => (
          <Trampoline key={tramp.id} position={[tramp.x, 0, tramp.z]} />
        ))}

        {stones.map((stone, index) => {
          const isOnPodium = levelData.buttons.some(b => b.type === 'podium' && b.x === stone.x && b.z === stone.z);
          let stackIndex = 0;
          for (let i = 0; i < index; i++) {
            if (stones[i].x === stone.x && stones[i].z === stone.z && stones[i].id !== carriedStoneId && !Object.values(robotCarriedStones).includes(stones[i].id)) {
               stackIndex++;
            }
          }
          if (stone.id === carriedStoneId || Object.values(robotCarriedStones).includes(stone.id)) {
            stackIndex = 0;
          }
          return (
            <StoneBlock key={stone.id} x={stone.x} z={stone.z} isCarried={stone.id === carriedStoneId} isRobotCarried={Object.values(robotCarriedStones).includes(stone.id)} bounceState={bouncingStones[stone.id]} isOnPodium={isOnPodium} stackIndex={stackIndex} />
          );
        })}

        {levelData.computers && levelData.computers.map(comp => (
          <Computer key={comp.id} position={[comp.x, 0, comp.z]} />
        ))}

        {Object.entries(robotPositions).map(([id, rPos]) => (
          <RobotCharacter key={id} x={rPos.x} z={rPos.z} isFalling={fallingRobots[id]} isActive={codingMode && activeRobotId === id} />
        ))}

        <Character
          x={pos.x} z={pos.z}
          dx={dir.dx} dz={dir.dz}
          isFalling={gameState === 'FALLING'}
          isFlying={gameState === 'FLYING'}
          isPreFlying={gameState === 'PRE_FLYING'}
          isDizzy={gameState === 'DIZZY'}
          isVictory={gameState === 'VICTORY'}
          showPrompt={!!nearbyStoneId || !!nearbyPodium}
          isCarrying={!!carriedStoneId}
          nearbyPodium={nearbyPodium}
          isAtPortal={isAtPortal}
          canFinish={levelData.bridges.length === 0 || openBridges[levelData.bridges[levelData.bridges.length - 1].id]}
          nearbyComputer={nearbyComputer}
        />

        {codingMode && currentLevel >= 3 && (levelData.stones || []).map((item, i) => {
          const currentStone = stones.find(s => s.id === item.id);
          const cx = currentStone ? currentStone.x : item.x;
          const cz = currentStone ? currentStone.z : item.z;
          const isOnButton = levelData.buttons.some(b => b.x === cx && b.z === cz);
          if (isOnButton) return null;
          return (
            <Html key={`stone-label-${item.id}`} position={[cx + 0.5, 1.5, cz + 0.5]} center sprite style={{ pointerEvents: 'none' }}>
              <div style={{
                background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '4px 10px',
                borderRadius: '6px', fontSize: '14px', fontWeight: 'bold',
                whiteSpace: 'nowrap', border: '2px solid #e2e8f0',
                boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
              }}>
                Stone {i + 1}
              </div>
            </Html>
          );
        })}

        {codingMode && currentLevel >= 3 && (levelData.buttons?.filter(b => b.type === 'podium') || []).map((btn) => {
          const hasStone = stones.some(s => s.x === btn.x && s.z === btn.z);
          if (hasStone) return null;
          return (
            <Html key={`podium-label-${btn.id}`} position={[btn.x + 0.5, 1.5, btn.z + 0.5]} center sprite style={{ pointerEvents: 'none' }}>
              <div style={{
                background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '4px 10px',
                borderRadius: '6px', fontSize: '14px', fontWeight: 'bold',
                whiteSpace: 'nowrap', border: '2px solid #ff3366',
                boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
              }}>
                Podium {btn.label}
              </div>
            </Html>
          );
        })}

        {codingMode && currentLevel >= 3 && levelData.robotButtons?.map((rb) => (
          <Html key={`goto-label-${rb.id}`} position={[rb.x + 0.5, 1.5, rb.z + 0.5]} center sprite style={{ pointerEvents: 'none' }}>
            <div style={{
              background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '4px 10px',
              borderRadius: '6px', fontSize: '14px', fontWeight: 'bold',
              whiteSpace: 'nowrap', border: '2px solid #ff3366',
              boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
            }}>
              Button {rb.label}
            </div>
          </Html>
        ))}

        {codingMode && currentLevel >= 3 && levelData.trampolines?.map((tramp, i) => (
          <Html key={`trampoline-label-${tramp.id}`} position={[tramp.x + 0.5, 1.5, tramp.z + 0.5]} center sprite style={{ pointerEvents: 'none' }}>
            <div style={{
              background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '4px 10px',
              borderRadius: '6px', fontSize: '14px', fontWeight: 'bold',
              whiteSpace: 'nowrap', border: '2px solid #20e060',
              boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
            }}>
              Trampoline {i + 1}
            </div>
          </Html>
        ))}
      </Canvas>
    </>
  );
}

export default App;
