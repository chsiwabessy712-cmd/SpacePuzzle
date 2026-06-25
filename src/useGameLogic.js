import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { audioManager } from './audioManager';

export const useGameLogic = (levelData, onVictory) => {
  const [pos, setPos] = useState(levelData.startPos);
  const [dir, setDir] = useState({ dx: 1, dz: 0 });
  const [gameState, setGameState] = useState('PLAYING');
  const [stones, setStones] = useState(levelData.stones);
  const [carriedStoneId, setCarriedStoneId] = useState(null);
  const [bouncingStones, setBouncingStones] = useState({});

  // Robot & Computer state
  const [robotPos, setRobotPos] = useState(levelData.robot || null);
  const [codingMode, setCodingMode] = useState(false);
  const [robotCommands, setRobotCommands] = useState([]);
  const [isRobotRunning, setIsRobotRunning] = useState(false);
  const [robotCarriedStoneId, setRobotCarriedStoneId] = useState(null);

  // Reset state when level changes
  useEffect(() => {
    setPos(levelData.startPos);
    setDir({ dx: 1, dz: 0 });
    setGameState('PLAYING');
    setStones(levelData.stones);
    setCarriedStoneId(null);
    setBouncingStones({});
    setRobotPos(levelData.robot || null);
    setCodingMode(false);
    setRobotCommands([]);
    setIsRobotRunning(false);
    setRobotCarriedStoneId(null);
    audioManager.resumeBgm();
  }, [levelData]);

  const isBaseTileValid = useCallback((x, z) => {
    return levelData.islands.some(island => 
      x >= island.xStart && x < island.xStart + island.w &&
      z >= island.zStart && z < island.zStart + island.d
    );
  }, [levelData.islands]);

  const isPodium = useCallback((x, z) => {
    return levelData.buttons.some(b => b.type === 'podium' && b.x === x && b.z === z);
  }, [levelData.buttons]);

  // Determine which bridges are open
  const openBridges = useMemo(() => {
    const status = {};
    const stoneOnTile = (bx, bz) => stones.some(s => s.x === bx && s.z === bz && s.id !== carriedStoneId && s.id !== robotCarriedStoneId);
    const robotOnTile = (bx, bz) => robotPos && robotPos.x === bx && robotPos.z === bz;
    
    levelData.bridges.forEach(bridge => {
      const requiredButtons = levelData.buttons.filter(b => b.bridgeId === bridge.id);
      const isOpen = requiredButtons.every(b => stoneOnTile(b.x, b.z) || robotOnTile(b.x, b.z));
      status[bridge.id] = isOpen;
    });
    
    return status;
  }, [stones, bouncingStones, carriedStoneId, robotCarriedStoneId, levelData, robotPos]);

  // Check if a tile is valid (base tiles + open bridge tiles)
  const isValidTile = useCallback((x, z) => {
    if (isBaseTileValid(x, z)) return true;
    for (const bridge of levelData.bridges) {
      if (openBridges[bridge.id]) {
        if (bridge.tiles.some(t => t.x === x && t.z === z)) return true;
      }
    }
    return false;
  }, [isBaseTileValid, openBridges, levelData.bridges]);

  // Find nearby podium
  const nearbyPodium = useMemo(() => {
    for (const p of levelData.buttons.filter(b => b.type === 'podium')) {
      const dx = Math.abs(p.x - pos.x);
      const dz = Math.abs(p.z - pos.z);
      if ((dx === 1 && dz === 0) || (dx === 0 && dz === 1)) {
        const hasStone = stones.some(s => s.x === p.x && s.z === p.z && s.id !== carriedStoneId);
        if (!hasStone) return p;
      }
    }
    return null;
  }, [pos, stones, carriedStoneId, levelData.buttons]);

  // Find nearby stone
  const nearbyStoneId = useMemo(() => {
    if (carriedStoneId) return null;
    for (const s of stones) {
      const dx = Math.abs(s.x - pos.x);
      const dz = Math.abs(s.z - pos.z);
      if ((dx === 1 && dz === 0) || (dx === 0 && dz === 1)) {
        return s.id;
      }
    }
    return null;
  }, [pos, stones, carriedStoneId]);

  // Detect nearby computer
  const nearbyComputer = useMemo(() => {
    if (!levelData.computer || carriedStoneId) return false;
    const dx = Math.abs(levelData.computer.x - pos.x);
    const dz = Math.abs(levelData.computer.z - pos.z);
    return (dx === 1 && dz === 0) || (dx === 0 && dz === 1);
  }, [pos, levelData.computer, carriedStoneId]);

  const isStoneAt = useCallback((x, z) => {
    return stones.some(s => s.x === x && s.z === z && s.id !== carriedStoneId);
  }, [stones, carriedStoneId]);

  // Determine if monkey is on one of the portal tiles
  const isAtPortal = useMemo(() => {
    const px = levelData.portal.x;
    const pz = levelData.portal.z;
    return (pos.x === px || pos.x === Math.ceil(px)) && (pos.z === pz || pos.z === Math.ceil(pz));
  }, [pos, levelData.portal]);

  // Run robot program
  const runRobotProgram = useCallback(() => {
    if (robotCommands.length === 0 || !robotPos) return;
    setIsRobotRunning(true);

    const executeCommand = (cmdIndex, currentPos, currentCarriedId) => {
      if (cmdIndex >= robotCommands.length) {
        setIsRobotRunning(false);
        return;
      }

      const cmd = robotCommands[cmdIndex];
      let targetX, targetZ;
      let targetStone = null;
      let targetBtn = null;

      if (cmd.type === 'goto') {
        targetBtn = levelData.robotButtons?.find(b => b.id === cmd.targetId);
        if (!targetBtn) { executeCommand(cmdIndex + 1, currentPos, currentCarriedId); return; }
        targetX = targetBtn.x; targetZ = targetBtn.z;
      } else if (cmd.type === 'pickup') {
        const anyItem = [...stones, ...(levelData.buttons || [])].find(i => i.id === cmd.targetId);
        if (!anyItem) { executeCommand(cmdIndex + 1, currentPos, currentCarriedId); return; }
        targetX = anyItem.x; targetZ = anyItem.z;
        targetStone = stones.find(s => s.id === cmd.targetId);
      } else if (cmd.type === 'drop') {
        const anyItem = [...stones, ...(levelData.buttons || [])].find(i => i.id === cmd.targetId);
        if (!anyItem) { executeCommand(cmdIndex + 1, currentPos, currentCarriedId); return; }
        targetX = anyItem.x; targetZ = anyItem.z;
        targetBtn = levelData.buttons?.find(b => b.id === cmd.targetId);
      }

      // Build path
      const steps = [];
      let curX = currentPos.x;
      let curZ = currentPos.z;
      
      while (curX !== targetX) {
        curX += curX < targetX ? 1 : -1;
        steps.push({ x: curX, z: curZ });
      }
      while (curZ !== targetZ) {
        curZ += curZ < targetZ ? 1 : -1;
        steps.push({ x: curX, z: curZ });
      }

      // For drop, robot stops adjacent to podium (don't step on it)
      if (cmd.type === 'drop' && steps.length > 0) {
        steps.pop();
      }

      // Perform action after arriving (used for both empty and non-empty paths)
      const performAction = (finalPos) => {
        setTimeout(() => {
          if (cmd.type === 'pickup' && targetStone) {
            // Pick up the stone - move it to robot position
            setRobotCarriedStoneId(targetStone.id);
            setStones(prev => prev.map(s => s.id === targetStone.id ? { ...s, x: finalPos.x, z: finalPos.z } : s));
            currentCarriedId = targetStone.id;
          } else if (cmd.type === 'drop' && currentCarriedId) {
            // Drop the stone at the target podium position (NOT the robot position)
            const droppedId = currentCarriedId;
            setRobotCarriedStoneId(null);
            setStones(prev => prev.map(s => s.id === droppedId ? { ...s, x: targetX, z: targetZ } : s));
            currentCarriedId = null;
            audioManager.playStoneSound();
          }

          setTimeout(() => {
            executeCommand(cmdIndex + 1, finalPos, currentCarriedId);
          }, 300);
        }, 200);
      };

      if (steps.length === 0) {
        performAction(currentPos);
        return;
      }

      steps.forEach((step, i) => {
        setTimeout(() => {
          setRobotPos({ x: step.x, z: step.z });
          audioManager.playMoveSound();
          
          // Move carried stone with robot
          if (currentCarriedId) {
            const carriedId = currentCarriedId;
            setStones(prev => prev.map(s => s.id === carriedId ? { ...s, x: step.x, z: step.z } : s));
          }

          if (i === steps.length - 1) {
            performAction(step);
          }
        }, (i + 1) * 300);
      });
    };

    executeCommand(0, robotPos, robotCarriedStoneId);
  }, [robotCommands, robotPos, levelData.robotButtons, levelData.buttons, stones, robotCarriedStoneId]);

  const move = useCallback((dx, dz) => {
    if (gameState !== 'PLAYING' || codingMode) return;

    setPos(prev => {
      const nextX = prev.x + dx;
      const nextZ = prev.z + dz;

      if (!isValidTile(nextX, nextZ)) {
        setGameState('FALLING');
        setTimeout(() => {
          setPos(levelData.startPos);
          setDir({ dx: 1, dz: 0 });
          setGameState('PLAYING');
          setStones(levelData.stones);
          setCarriedStoneId(null);
          setBouncingStones({});
          setRobotPos(levelData.robot || null);
          setRobotCommands([]);
          setIsRobotRunning(false);
        }, 1000);
        return prev;
      }

      if (isStoneAt(nextX, nextZ) || isPodium(nextX, nextZ)) {
        return prev;
      }
      if (levelData.computer && nextX === levelData.computer.x && nextZ === levelData.computer.z) {
        return prev;
      }

      let finalX = nextX;
      let finalZ = nextZ;

      // Check if stepping onto an open glass tube slider
      let isBridge = false;
      for (const bridge of levelData.bridges) {
        if (openBridges[bridge.id]) {
          if (bridge.tiles.some(t => t.x === nextX && t.z === nextZ)) {
             // Sucked in! Fly across the gap to the other side
             if (dx > 0) {
                 finalX = bridge.x + bridge.gap;
             } else if (dx < 0) {
                 finalX = bridge.x - 1;
             }
             isBridge = true;
             break;
          }
        }
      }

      if (isBridge) {
         setGameState('PRE_FLYING');
         setDir({ dx, dz });
         
         if (carriedStoneId) {
           const currentIsland = levelData.islands.find(isl => 
             prev.x >= isl.xStart && prev.x < isl.xStart + isl.w &&
             prev.z >= isl.zStart && prev.z < isl.zStart + isl.d
           );

           let dropped = false;
           if (currentIsland) {
             const possibleDrops = [];
             for (let x = currentIsland.xStart; x < currentIsland.xStart + currentIsland.w; x++) {
               for (let z = currentIsland.zStart; z < currentIsland.zStart + currentIsland.d; z++) {
                 if (x === prev.x && z === prev.z) continue;
                 if (isStoneAt(x, z) || isPodium(x, z)) continue;
                 if (levelData.portal && x === levelData.portal.x && z === levelData.portal.z) continue;
                 if (levelData.computer && x === levelData.computer.x && z === levelData.computer.z) continue;
                 possibleDrops.push({ x, z });
               }
             }

             if (possibleDrops.length > 0) {
               const dropPos = possibleDrops[Math.floor(Math.random() * possibleDrops.length)];
               setStones(prevStones => prevStones.map(s =>
                 s.id === carriedStoneId ? { ...s, x: dropPos.x, z: dropPos.z } : s
               ));
               dropped = true;
             }
           }
           
           if (!dropped) {
             setStones(prevStones => prevStones.map(s =>
               s.id === carriedStoneId ? { ...s, x: prev.x, z: prev.z } : s
             ));
           }
           
           setCarriedStoneId(null);
           audioManager.playStoneSound();
         }

         setTimeout(() => {
           setGameState('FLYING');
           setPos({ x: finalX, z: finalZ });
           audioManager.playMoveSound();

           setTimeout(() => {
             setGameState('DIZZY');
             setTimeout(() => {
               setGameState(prev => prev === 'DIZZY' ? 'PLAYING' : prev);
             }, 2000); // 2 seconds dizzy
           }, 2000); // 2 second flight
         }, 300); // 300ms to lift up before sliding
         
         return prev; // Stay in place while lifting
      }

      setDir({ dx, dz });
      
      if (carriedStoneId) {
        setStones(prevStones => prevStones.map(s =>
          s.id === carriedStoneId ? { ...s, x: finalX, z: finalZ } : s
        ));
      }

      audioManager.playMoveSound();
      return { x: finalX, z: finalZ };
    });
  }, [gameState, codingMode, isStoneAt, isValidTile, carriedStoneId, levelData, isPodium]);

  const handleSpace = useCallback(() => {
    if (gameState !== 'PLAYING') return;
    if (codingMode) return;

    if (nearbyComputer && !carriedStoneId) {
      setCodingMode(true);
      return;
    }

    const lastBridgeOpen = levelData.bridges.length === 0 || openBridges[levelData.bridges[levelData.bridges.length - 1].id];

    if (isAtPortal && lastBridgeOpen) {
      setGameState('VICTORY');
      audioManager.playCelebration();
      setTimeout(() => { onVictory(); }, 3000);
      return;
    }

    if (carriedStoneId) {
      if (nearbyPodium) {
        setStones(prev => prev.map(s =>
          s.id === carriedStoneId ? { ...s, x: nearbyPodium.x, z: nearbyPodium.z } : s
        ));
        setCarriedStoneId(null);
        audioManager.playStoneSound();
        return;
      }

      const possibleSpots = [
        { dx: dir.dx, dz: dir.dz },
        { dx: 1, dz: 0 }, { dx: -1, dz: 0 },
        { dx: 0, dz: 1 }, { dx: 0, dz: -1 }
      ];
      
      let freeSpot = null;
      for (const spot of possibleSpots) {
        const tx = pos.x + spot.dx;
        const tz = pos.z + spot.dz;
        if (isValidTile(tx, tz) && !isStoneAt(tx, tz) && !isPodium(tx, tz) && !isAtPortal) {
           freeSpot = spot;
           break;
        }
      }

      if (freeSpot) {
        setPos({ x: pos.x + freeSpot.dx, z: pos.z + freeSpot.dz });
        setDir({ dx: freeSpot.dx, dz: freeSpot.dz });
      }

      const tramp = levelData.trampolines?.find(t => t.x === pos.x && t.z === pos.z);
      if (tramp) {
        const sid = carriedStoneId;
        setBouncingStones(prev => ({ ...prev, [sid]: { phase: 'pre', fromX: pos.x, fromZ: pos.z, toX: tramp.targetX, toZ: tramp.targetZ, startTime: performance.now() } }));
        setTimeout(() => {
          setBouncingStones(prev => {
            const current = prev[sid];
            if (!current) return prev;
            return { ...prev, [sid]: { ...current, phase: 'jump', startTime: performance.now() } };
          });
        }, 600);
        setTimeout(() => {
          setStones(prev => prev.map(s => s.id === sid ? { ...s, x: tramp.targetX, z: tramp.targetZ } : s));
          setBouncingStones(prev => {
            const next = { ...prev };
            delete next[sid];
            return next;
          });
        }, 1400);
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
  }, [gameState, codingMode, carriedStoneId, nearbyStoneId, nearbyPodium, nearbyComputer, pos, stones, isValidTile, isAtPortal, openBridges, levelData, dir, isStoneAt, isPodium, onVictory]);

  // Bridge sound effects
  const prevBridgesRef = useRef({});
  useEffect(() => {
    let triggeredSound = false;
    levelData.bridges.forEach(bridge => {
      if (openBridges[bridge.id] && !prevBridgesRef.current[bridge.id]) {
        triggeredSound = true;
      }
    });
    if (triggeredSound) audioManager.playBridgeSound();
    prevBridgesRef.current = { ...openBridges };
  }, [openBridges, levelData.bridges]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      audioManager.init();
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','escape','p'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      
      if (codingMode) {
        if (e.key.toLowerCase() === 'p' || e.key === 'Escape') {
          setCodingMode(false);
          return;
        }
        if (e.key === ' ' && robotCommands.length > 0 && !isRobotRunning) {
          runRobotProgram();
        }
        return;
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
  }, [move, handleSpace, codingMode, isRobotRunning]);

  return {
    pos, dir, gameState, stones, bouncingStones, carriedStoneId,
    nearbyStoneId, nearbyPodium, openBridges, isAtPortal,
    nearbyComputer, codingMode, setCodingMode,
    robotPos, robotCommands, setRobotCommands,
    isRobotRunning, runRobotProgram, robotCarriedStoneId
  };
};
