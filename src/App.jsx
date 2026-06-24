import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrthographicCamera, Environment, Edges, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useSpring, animated } from '@react-spring/three';
import { useGameLogic } from './useGameLogic';
import './index.css';

// ----------------------------------------------------------------------------
// Components
// ----------------------------------------------------------------------------

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
    {/* Wire out */}
    <mesh position={[0.5, 0.02, 0]}>
      <boxGeometry args={[0.6, 0.04, 0.04]} />
      <meshStandardMaterial color={isActive ? '#ffff00' : '#333'} />
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

const StoneBlock = ({ x, z, isCarried }) => {
  const { position } = useSpring({
    position: [x, isCarried ? 1.2 : 0.4, z],
    config: { mass: 1, tension: 200, friction: 20 }
  });

  return (
    <animated.mesh position={position} castShadow>
      <boxGeometry args={[0.8, 0.8, 0.8]} />
      <meshStandardMaterial color="#c0c0c0" metalness={0.3} roughness={0.5} />
      <Edges color="#ffffff" />
      <mesh position={[0, 0.405, 0]} rotation={[0, Math.PI/4, 0]}>
        <planeGeometry args={[1, 0.05]} />
        <meshStandardMaterial color="#777" />
      </mesh>
    </animated.mesh>
  );
};

const Bridge = ({ position, width = 1, isOpen }) => {
  const { posY } = useSpring({
    posY: isOpen ? -0.1 : -0.8,
    config: { mass: 2, tension: 120, friction: 20 }
  });

  return (
    <animated.group position-x={position[0]} position-y={posY} position-z={position[2]}>
      {/* Rails */}
      <mesh position={[0, 0, -width/2]} castShadow>
        <boxGeometry args={[2.5, 0.15, 0.15]} />
        <meshStandardMaterial color={isOpen ? '#555' : '#333'} />
      </mesh>
      <mesh position={[0, 0, width/2]} castShadow>
        <boxGeometry args={[2.5, 0.15, 0.15]} />
        <meshStandardMaterial color={isOpen ? '#555' : '#333'} />
      </mesh>
      {/* Floor planks (only visible when open) */}
      {isOpen && (
        <>
          <mesh position={[-0.5, 0.08, 0]}>
            <boxGeometry args={[0.8, 0.08, width]} />
            <meshStandardMaterial color="#8ab8e6" roughness={0.3} />
            <Edges color="#5a88c6" />
          </mesh>
          <mesh position={[0.5, 0.08, 0]}>
            <boxGeometry args={[0.8, 0.08, width]} />
            <meshStandardMaterial color="#8ab8e6" roughness={0.3} />
            <Edges color="#5a88c6" />
          </mesh>
        </>
      )}
      {/* Joints */}
      <mesh position={[-1, 0, -width/2]}>
        <boxGeometry args={[0.25, 0.25, 0.25]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      <mesh position={[1, 0, -width/2]}>
        <boxGeometry args={[0.25, 0.25, 0.25]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      <mesh position={[-1, 0, width/2]}>
        <boxGeometry args={[0.25, 0.25, 0.25]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      <mesh position={[1, 0, width/2]}>
        <boxGeometry args={[0.25, 0.25, 0.25]} />
        <meshStandardMaterial color="#555" />
      </mesh>
    </animated.group>
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

const Character = ({ x, z, dx, dz, isFalling, isVictory, showPrompt, isCarrying, nearbyPodium, isAtPortal, canFinish }) => {
  let targetRotation = 0;
  if (dx === -1 && dz === 0) targetRotation = -Math.PI / 2;
  else if (dx === 1 && dz === 0) targetRotation = Math.PI / 2;
  else if (dx === 0 && dz === 1) targetRotation = 0;
  else if (dx === 0 && dz === -1) targetRotation = Math.PI;

  const { position, rotation } = useSpring({
    position: [x, isFalling ? -15 : 0, z],
    rotation: [0, targetRotation, 0],
    config: { mass: 1, tension: 200, friction: 20 }
  });

  const danceRef = useRef();
  useFrame((state, delta) => {
    if (isVictory && danceRef.current) {
      danceRef.current.rotation.y += delta * 15;
      danceRef.current.position.y = Math.abs(Math.sin(state.clock.elapsedTime * 15)) * 0.5;
    } else if (danceRef.current) {
      danceRef.current.rotation.y = 0;
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

      {/* Notification Bubble */}
      {!isVictory && (showPrompt || isCarrying || (isAtPortal && canFinish)) && (
        <Html position={[0, 1.5, 0]} center sprite scale={1.5} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(0,0,0,0.85)',
            border: (isCarrying || (isAtPortal && canFinish)) ? '2px solid #00ff88' : '2px solid #00f3ff',
            borderRadius: '12px',
            padding: '8px 18px',
            color: (isCarrying || (isAtPortal && canFinish)) ? '#00ff88' : '#00f3ff',
            fontFamily: 'monospace',
            fontSize: '16px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            textShadow: (isCarrying || (isAtPortal && canFinish)) ? '0 0 6px #00ff88' : '0 0 6px #00f3ff',
          }}>
            {isAtPortal && canFinish ? '✨ Press SPACE to finish' : (isCarrying ? (nearbyPodium ? '🪨 Press SPACE to place on button' : '🪨 Press SPACE to drop') : '⬜ Press SPACE to carry')}
          </div>
        </Html>
      )}

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
  );
};

const CameraController = ({ isVictory, targetPos }) => {
  useFrame((state) => {
    if (isVictory) {
      state.camera.zoom = THREE.MathUtils.lerp(state.camera.zoom, 180, 0.05);
      state.camera.position.lerp(new THREE.Vector3(targetPos.x + 8, 8, targetPos.z + 8), 0.05);
      state.camera.lookAt(targetPos.x, 0.5, targetPos.z);
    } else {
      state.camera.zoom = THREE.MathUtils.lerp(state.camera.zoom, 65, 0.05);
      state.camera.position.lerp(new THREE.Vector3(50, 50, 50), 0.05);
      state.camera.lookAt(8, 0, 2);
    }
    state.camera.updateProjectionMatrix();
  });
  return null;
};

// ----------------------------------------------------------------------------
// Main Application
// ----------------------------------------------------------------------------

function App() {
  const { pos, dir, gameState, stones, carriedStoneId, nearbyStoneId, nearbyPodium, openBridges, isAtPortal } = useGameLogic();

  // Check if a stone is on a specific tile (for button active states)
  const stoneOnTile = (bx, bz) => stones.some(s => s.x === bx && s.z === bz && s.id !== carriedStoneId);

  return (
    <>
      {/* HUD Placeholder */}
      <div className="ui-layer" style={{ pointerEvents: 'none', position: 'absolute', zIndex: 10, width: '100%', height: '100%' }}>
        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', padding: '20px' }}>
          <div className="stat-box" style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid #00f3ff', padding: '10px 20px', borderRadius: '8px', color: 'white', fontSize: '1.2rem' }}>Menu</div>
          <h1 style={{ margin: 0, textShadow: '0 0 10px #00f3ff', color: '#00f3ff', fontSize: '2rem', letterSpacing: '2px', textTransform: 'uppercase' }}>PUZZLE ARENA</h1>
          <div className="stat-box" style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid #00f3ff', padding: '10px 20px', borderRadius: '8px', color: 'white', fontSize: '1.2rem' }}>Level: 1</div>
        </div>
        <div style={{ position: 'absolute', bottom: '20px', width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.8)' }}>
          Use W A S D or Arrow Keys to Move
        </div>
        {gameState === 'FALLING' && (
          <div className="overlay lost" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.8)', padding: '40px', borderRadius: '20px' }}>
            <h2 style={{ color: '#ff0055', textShadow: '0 0 20px #ff0055', margin: 0, fontSize: '3rem' }}>GAME OVER</h2>
          </div>
        )}
      </div>

      {/* 3D Scene */}
      <Canvas shadows style={{ background: 'transparent', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        <OrthographicCamera 
          makeDefault 
          position={[50, 50, 50]} 
          zoom={65} 
          near={-500} 
          far={500} 
        />
        <CameraController isVictory={gameState === 'VICTORY'} targetPos={pos} />
        
        <ambientLight intensity={0.6} />
        <directionalLight 
          position={[20, 30, 10]} 
          castShadow 
          intensity={1.2} 
          shadow-mapSize={[2048, 2048]} 
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <Environment preset="city" />

        {/* --- ISLAND 1 (Left) --- */}
        <Island xStart={0} zStart={0} w={6} d={5} />
        <FloorButton position={[3, 0, 2]} isActive={openBridges.bridge1} />
        {/* Wire from button to bridge */}
        <mesh position={[4.5, -0.05, 2]}>
          <boxGeometry args={[2.5, 0.05, 0.1]} />
          <meshStandardMaterial color={openBridges.bridge1 ? '#ffff00' : '#333'} />
        </mesh>

        {/* BRIDGE 1 */}
        <Bridge position={[6.5, -0.2, 2]} width={1.5} isOpen={openBridges.bridge1} />

        {/* --- ISLAND 2 (Middle) --- */}
        <Island xStart={8} zStart={0} w={5} d={5} />
        <FloorButton position={[10, 0, 2]} isActive={stoneOnTile(10, 2)} />
        <RaisedButton position={[8, 0, 4]} isActive={stoneOnTile(8, 4)} />
        <RaisedButton position={[12, 0, 0]} isActive={stoneOnTile(12, 0)} />
        
        {/* Wires from corner buttons to center bridge */}
        {/* Bottom-left wire: (8,4) → right along z=4 edge, then up */}
        <mesh position={[10, -0.05, 4]}>
          <boxGeometry args={[4, 0.05, 0.1]} />
          <meshStandardMaterial color={openBridges.bridge2 ? '#ffff00' : '#333'} />
        </mesh>
        <mesh position={[12, -0.05, 3]}>
          <boxGeometry args={[0.1, 0.05, 2]} />
          <meshStandardMaterial color={openBridges.bridge2 ? '#ffff00' : '#333'} />
        </mesh>
        {/* Top-right wire: (12,0) → down to center */}
        <mesh position={[12, -0.05, 1]}>
          <boxGeometry args={[0.1, 0.05, 2]} />
          <meshStandardMaterial color={openBridges.bridge2 ? '#ffff00' : '#333'} />
        </mesh>
        {/* Center merge wire to bridge */}
        <mesh position={[12.5, -0.05, 2]}>
          <boxGeometry args={[1, 0.05, 0.1]} />
          <meshStandardMaterial color={openBridges.bridge2 ? '#ffff00' : '#333'} />
        </mesh>

        {/* BRIDGE 2 (single center) */}
        <Bridge position={[13.5, -0.2, 2]} width={1.5} isOpen={openBridges.bridge2} />

        {/* --- ISLAND 3 (Right) --- */}
        <Island xStart={15} zStart={0} w={4} d={4} />
        <Portal position={[16.5, 0, 1.5]} isActive={openBridges.bridge2} />

        {/* Dynamic Stone Blocks */}
        {stones.map(stone => (
          <StoneBlock key={stone.id} x={stone.x} z={stone.z} isCarried={stone.id === carriedStoneId} />
        ))}

        {/* Player Character */}
        <Character
          x={pos.x} z={pos.z}
          dx={dir.dx} dz={dir.dz}
          isFalling={gameState === 'FALLING'}
          isVictory={gameState === 'VICTORY'}
          showPrompt={!!nearbyStoneId || !!nearbyPodium}
          isCarrying={!!carriedStoneId}
          nearbyPodium={nearbyPodium}
          isAtPortal={isAtPortal}
          canFinish={openBridges.bridge2}
        />

      </Canvas>
    </>
  );
}

export default App;
