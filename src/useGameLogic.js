import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { audioManager } from './audioManager';

const START_POS = { x: 1, z: 2 };

const INITIAL_STONES = [
  { id: 'stone1', x: 2, z: 1 },
  { id: 'stone2', x: 10, z: 3 },
];

// Raised button (podium) positions - character can't step on these
const PODIUM_BUTTONS = [
  { x: 8, z: 4 },   // Island 2 bottom-left corner
  { x: 12, z: 0 },  // Island 2 top-right corner
];

// Bridge tiles that become walkable when the bridge is open
const BRIDGE_TILES = {
  bridge1: [
    { x: 6, z: 2 }, { x: 7, z: 2 },
  ],
  bridge2: [
    { x: 13, z: 2 }, { x: 14, z: 2 },
  ],
};

const isBaseTileValid = (x, z) => {
  if (x >= 0 && x <= 5 && z >= 0 && z <= 4) return true;
  if (x >= 8 && x <= 12 && z >= 0 && z <= 4) return true;
  if (x >= 15 && x <= 18 && z >= 0 && z <= 3) return true;
  return false;
};

const isPodium = (x, z) => {
  return PODIUM_BUTTONS.some(p => p.x === x && p.z === z);
};

export const useGameLogic = () => {
  const [pos, setPos] = useState(START_POS);
  const [dir, setDir] = useState({ dx: 1, dz: 0 });
  const [gameState, setGameState] = useState('PLAYING');
  const [stones, setStones] = useState(INITIAL_STONES);
  const [carriedStoneId, setCarriedStoneId] = useState(null);

  // Determine which bridges are open
  const openBridges = useMemo(() => {
    const stoneOnTile = (bx, bz) => stones.some(s => s.x === bx && s.z === bz && s.id !== carriedStoneId);
    
    // Bridge 1: opens if stone on floor btn1 (3,2) OR floor btn2 (10,2)
    const bridge1 = stoneOnTile(3, 2) || stoneOnTile(10, 2);
    
    // Bridge 2: opens if stones on BOTH podium buttons
    const bridge2 = stoneOnTile(8, 4) && stoneOnTile(12, 0);
    
    return { bridge1, bridge2 };
  }, [stones, carriedStoneId]);

  // Check if a tile is valid (base tiles + open bridge tiles)
  const isValidTile = useCallback((x, z) => {
    if (isBaseTileValid(x, z)) return true;
    for (const [bridgeId, tiles] of Object.entries(BRIDGE_TILES)) {
      if (openBridges[bridgeId]) {
        if (tiles.some(t => t.x === x && t.z === z)) return true;
      }
    }
    return false;
  }, [openBridges]);

  // Find nearby podium that doesn't already have a stone on it
  const nearbyPodium = useMemo(() => {
    if (!carriedStoneId) return null;
    for (const p of PODIUM_BUTTONS) {
      const dx = Math.abs(p.x - pos.x);
      const dz = Math.abs(p.z - pos.z);
      if ((dx === 1 && dz === 0) || (dx === 0 && dz === 1)) {
        // Check no stone already there
        const occupied = stones.some(s => s.x === p.x && s.z === p.z && s.id !== carriedStoneId);
        if (!occupied) return p;
      }
    }
    return null;
  }, [pos, stones, carriedStoneId]);

  // Check if monkey is adjacent to any stone
  const nearbyStoneId = useMemo(() => {
    if (carriedStoneId) return null;
    for (const stone of stones) {
      const dx = Math.abs(stone.x - pos.x);
      const dz = Math.abs(stone.z - pos.z);
      if ((dx === 1 && dz === 0) || (dx === 0 && dz === 1)) {
        return stone.id;
      }
    }
    return null;
  }, [pos, stones, carriedStoneId]);

  const isStoneAt = useCallback((x, z) => {
    return stones.some(s => s.x === x && s.z === z && s.id !== carriedStoneId);
  }, [stones, carriedStoneId]);

  // Determine if monkey is on one of the portal tiles
  const isAtPortal = useMemo(() => {
    return (pos.x === 16 || pos.x === 17) && (pos.z === 1 || pos.z === 2);
  }, [pos]);

  const move = useCallback((dx, dz) => {
    if (gameState !== 'PLAYING') return;

    setDir({ dx, dz });
    
    setPos(prev => {
      const nextX = prev.x + dx;
      const nextZ = prev.z + dz;
      
      // Block movement into stone tiles
      if (isStoneAt(nextX, nextZ)) return prev;
      
      // Block movement onto podium buttons
      if (isPodium(nextX, nextZ)) return prev;

      if (!isValidTile(nextX, nextZ)) {
        setGameState('FALLING');
        setTimeout(() => {
          setPos(START_POS);
          setDir({ dx: 1, dz: 0 });
          setStones(INITIAL_STONES);
          setCarriedStoneId(null);
          setGameState('PLAYING');
        }, 1000);
      }

      // If carrying a stone, update its position to follow the monkey
      if (carriedStoneId) {
        setStones(prev => prev.map(s =>
          s.id === carriedStoneId ? { ...s, x: nextX, z: nextZ } : s
        ));
      }

      audioManager.playMoveSound();

      return { x: nextX, z: nextZ };
    });
  }, [gameState, isStoneAt, isValidTile, carriedStoneId]);

  const handleSpace = useCallback(() => {
    if (gameState !== 'PLAYING') return;

    if (isAtPortal && openBridges.bridge2) {
      setGameState('VICTORY');
      audioManager.playCelebration();
      setTimeout(() => {
        setPos(START_POS);
        setDir({ dx: 1, dz: 0 });
        setStones(INITIAL_STONES);
        setCarriedStoneId(null);
        setGameState('PLAYING');
        audioManager.resumeBgm();
      }, 3000);
      return;
    }

    if (carriedStoneId) {
      // If near a podium, place stone directly on the podium
      if (nearbyPodium) {
        setStones(prev => prev.map(s =>
          s.id === carriedStoneId ? { ...s, x: nearbyPodium.x, z: nearbyPodium.z } : s
        ));
        setCarriedStoneId(null);
        audioManager.playStoneSound();
        return;
      }

      // Otherwise drop at current position and move character aside
      const adjacentOffsets = [
        { dx: -1, dz: 0 },
        { dx: 1, dz: 0 },
        { dx: 0, dz: -1 },
        { dx: 0, dz: 1 },
      ];
      const freeSpot = adjacentOffsets.find(({ dx, dz }) => {
        const nx = pos.x + dx;
        const nz = pos.z + dz;
        return isValidTile(nx, nz) && !isPodium(nx, nz) && !stones.some(s => s.x === nx && s.z === nz && s.id !== carriedStoneId);
      });

      if (freeSpot) {
        setPos({ x: pos.x + freeSpot.dx, z: pos.z + freeSpot.dz });
        setDir({ dx: freeSpot.dx, dz: freeSpot.dz });
      }
      setCarriedStoneId(null);
      audioManager.playStoneSound();
    } else if (nearbyStoneId) {
      setCarriedStoneId(nearbyStoneId);
      setStones(prev => prev.map(s =>
        s.id === nearbyStoneId ? { ...s, x: pos.x, z: pos.z } : s
      ));
      audioManager.playStoneSound();
    }
  }, [gameState, carriedStoneId, nearbyStoneId, nearbyPodium, pos, stones, isValidTile, isAtPortal, openBridges]);

  // Keep track of previous bridge state to trigger sounds on open
  const prevBridgesRef = useRef({ bridge1: false, bridge2: false });
  useEffect(() => {
    if (openBridges.bridge1 && !prevBridgesRef.current.bridge1) audioManager.playBridgeSound();
    if (openBridges.bridge2 && !prevBridgesRef.current.bridge2) audioManager.playBridgeSound();
    prevBridgesRef.current = openBridges;
  }, [openBridges]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      audioManager.init(); // Start music/audio context on first interaction
      if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      switch(e.key.toLowerCase()) {
        case 'w': case 'arrowup': move(-1, 0); break;
        case 's': case 'arrowdown': move(1, 0); break;
        case 'a': case 'arrowleft': move(0, 1); break;
        case 'd': case 'arrowright': move(0, -1); break;
        case ' ': handleSpace(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move, handleSpace]);

  return { pos, dir, gameState, stones, carriedStoneId, nearbyStoneId, nearbyPodium, openBridges, isAtPortal };
};
