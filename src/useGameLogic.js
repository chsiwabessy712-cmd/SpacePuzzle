import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { audioManager } from './audioManager';

export const useGameLogic = (levelData, onVictory, onRestart) => {
  const [pos, setPos] = useState(levelData.startPos);
  const [dir, setDir] = useState({ dx: 1, dz: 0 });
  const [gameState, setGameState] = useState('PLAYING');
  const [stones, setStones] = useState(levelData.stones);
  const [carriedStoneId, setCarriedStoneId] = useState(null);
  const [bouncingStones, setBouncingStones] = useState({});

  // Robot & Computer state
  const [robotPositions, setRobotPositions] = useState(() => {
    const posObj = {};
    if (levelData.robots) {
      levelData.robots.forEach(r => posObj[r.id] = { x: r.x, z: r.z });
    }
    return posObj;
  });
  const [activeRobotId, setActiveRobotId] = useState(null);
  const [codingMode, setCodingMode] = useState(false);
  const [robotCommands, setRobotCommands] = useState([]);
  const [isRobotRunning, setIsRobotRunning] = useState(false);
  const [robotCarriedStones, setRobotCarriedStones] = useState({});
  const [fallingRobots, setFallingRobots] = useState({});

  const resetLevel = useCallback(() => {
    setPos(levelData.startPos);
    setDir({ dx: 1, dz: 0 });
    setGameState('PLAYING');
    setStones(levelData.stones);
    setCarriedStoneId(null);
    setBouncingStones({});
    const posObj = {};
    if (levelData.robots) {
      levelData.robots.forEach(r => posObj[r.id] = { x: r.x, z: r.z });
    }
    setRobotPositions(posObj);
    setActiveRobotId(null);
    setCodingMode(false);
    setIsRobotRunning(false);
    setRobotCarriedStones({});
    setFallingRobots({});
    audioManager.resumeBgm();
  }, [levelData]);

  // Reset state when level changes
  useEffect(() => {
    resetLevel();
  }, [resetLevel]);

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
    const stoneOnTile = (bx, bz) => stones.some(s => s.x === bx && s.z === bz && s.id !== carriedStoneId && !Object.values(robotCarriedStones).includes(s.id));
    const robotOnTile = (bx, bz) => Object.values(robotPositions).some(rPos => rPos.x === bx && rPos.z === bz);
    
    levelData.bridges.forEach(bridge => {
      const requiredButtons = levelData.buttons.filter(b => b.bridgeId === bridge.id);
      const isOpen = requiredButtons.every(b => stoneOnTile(b.x, b.z) || robotOnTile(b.x, b.z));
      status[bridge.id] = isOpen;
    });
    
    return status;
  }, [stones, bouncingStones, carriedStoneId, robotCarriedStones, levelData, robotPositions]);

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

  // Find nearby button to stack on
  const nearbyPodium = useMemo(() => {
    for (const p of levelData.buttons) {
      const dx = Math.abs(p.x - pos.x);
      const dz = Math.abs(p.z - pos.z);
      if ((dx === 1 && dz === 0) || (dx === 0 && dz === 1)) {
        if (p.type === 'podium') {
          return p; // allow piling up on podiums
        } else if (p.type === 'floor') {
          const hasStone = stones.some(s => s.x === p.x && s.z === p.z && s.id !== carriedStoneId);
          if (hasStone) return p;
        }
      }
    }
    return null;
  }, [pos, stones, carriedStoneId, levelData.buttons]);

  // Find nearby stone
  const nearbyStoneId = useMemo(() => {
    if (carriedStoneId) return null;
    let foundId = null;
    for (const s of stones) {
      const dx = Math.abs(s.x - pos.x);
      const dz = Math.abs(s.z - pos.z);
      if ((dx === 1 && dz === 0) || (dx === 0 && dz === 1)) {
        foundId = s.id;
      }
    }
    return foundId;
  }, [pos, stones, carriedStoneId]);

  // Detect nearby computer
  const nearbyComputer = useMemo(() => {
    if (!levelData.computers || carriedStoneId) return null;
    for (const comp of levelData.computers) {
      const dx = Math.abs(comp.x - pos.x);
      const dz = Math.abs(comp.z - pos.z);
      if ((dx === 1 && dz === 0) || (dx === 0 && dz === 1)) {
        return comp;
      }
    }
    return null;
  }, [pos, levelData.computers, carriedStoneId]);

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
    if (robotCommands.length === 0 || !activeRobotId || !robotPositions[activeRobotId]) return;
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
        let targetItem = levelData.robotButtons?.find(b => b.id === cmd.targetId) || stones.find(s => s.id === cmd.targetId) || levelData.buttons?.find(b => b.id === cmd.targetId) || levelData.trampolines?.find(t => t.id === cmd.targetId);
        if (!targetItem) { executeCommand(cmdIndex + 1, currentPos, currentCarriedId); return; }
        targetX = targetItem.x; targetZ = targetItem.z;
      } else if (cmd.type === 'pickup') {
        targetStone = stones.find(s => s.id === cmd.targetId);
        if (!targetStone) { executeCommand(cmdIndex + 1, currentPos, currentCarriedId); return; }
        const isNear = Math.abs(currentPos.x - targetStone.x) <= 1 && Math.abs(currentPos.z - targetStone.z) <= 1;
        if (!isNear) { executeCommand(cmdIndex + 1, currentPos, currentCarriedId); return; }
        targetX = currentPos.x; targetZ = currentPos.z;
      } else if (cmd.type === 'drop') {
        const anyItem = [...stones, ...(levelData.buttons || []), ...(levelData.trampolines || [])].find(i => i.id === cmd.targetId);
        if (!anyItem) { executeCommand(cmdIndex + 1, currentPos, currentCarriedId); return; }
        targetX = anyItem.x; targetZ = anyItem.z;
        targetBtn = levelData.buttons?.find(b => b.id === cmd.targetId);
      }

      // Build path
      let steps = [];
      if (cmd.type === 'goto' || cmd.type === 'drop') {
        const isTargetUnwalkable = stones.some(s => s.x === targetX && s.z === targetZ && s.id !== currentCarriedId) || levelData.buttons?.some(b => b.type === 'podium' && b.x === targetX && b.z === targetZ) || levelData.trampolines?.some(t => t.x === targetX && t.z === targetZ);
        const stopAdjacent = cmd.type === 'drop' || isTargetUnwalkable;

        const queue = [[{ x: currentPos.x, z: currentPos.z }]];
        const visited = new Set();
        visited.add(`${currentPos.x},${currentPos.z}`);
        let foundPath = null;

        if (currentPos.x === targetX && currentPos.z === targetZ) {
          foundPath = [{ x: currentPos.x, z: currentPos.z }];
        } else if (stopAdjacent && Math.abs(currentPos.x - targetX) + Math.abs(currentPos.z - targetZ) === 1) {
          foundPath = [{ x: currentPos.x, z: currentPos.z }];
        }

        while (queue.length > 0 && !foundPath) {
          const path = queue.shift();
          const current = path[path.length - 1];

          const neighbors = [
            { x: current.x + 1, z: current.z },
            { x: current.x - 1, z: current.z },
            { x: current.x, z: current.z + 1 },
            { x: current.x, z: current.z - 1 }
          ];

          for (const n of neighbors) {
            const key = `${n.x},${n.z}`;
            if (!visited.has(key)) {
              visited.add(key);
              
              const hasStone = stones.some(s => s.x === n.x && s.z === n.z && s.id !== currentCarriedId);
              const hasPodium = levelData.buttons?.some(b => b.type === 'podium' && b.x === n.x && b.z === n.z);
              const walkable = isValidTile(n.x, n.z) && !hasStone && !hasPodium;

              if (walkable) {
                if (stopAdjacent && (Math.abs(n.x - targetX) + Math.abs(n.z - targetZ) === 1)) {
                  foundPath = [...path, n];
                  break;
                } else if (!stopAdjacent && n.x === targetX && n.z === targetZ) {
                  foundPath = [...path, n];
                  break;
                } else {
                  queue.push([...path, n]);
                }
              }
            }
          }
        }
        
        if (!foundPath) {
          setIsRobotRunning(false);
          return;
        }
        steps = foundPath.slice(1);
      }

      // Perform action after arriving (used for both empty and non-empty paths)
      const performAction = (finalPos) => {
        setTimeout(() => {
          if (cmd.type === 'pickup' && targetStone) {
            // Pick up the stone - move it to robot position
            setRobotCarriedStones(prev => ({ ...prev, [activeRobotId]: targetStone.id }));
            setStones(prev => prev.map(s => s.id === targetStone.id ? { ...s, x: finalPos.x, z: finalPos.z } : s));
            currentCarriedId = targetStone.id;
          } else if (cmd.type === 'drop' && currentCarriedId) {
            // Drop the stone at the target podium position (NOT the robot position)
            const droppedId = currentCarriedId;
            setRobotCarriedStones(prev => { const next = {...prev}; delete next[activeRobotId]; return next; });
            setStones(prev => prev.map(s => s.id === droppedId ? { ...s, x: targetX, z: targetZ } : s));
            currentCarriedId = null;
            audioManager.playStoneSound();

            const tramp = levelData.trampolines?.find(t => t.x === targetX && t.z === targetZ);
            if (tramp) {
              setBouncingStones(prev => ({ ...prev, [droppedId]: { phase: 'pre', fromX: targetX, fromZ: targetZ, toX: tramp.targetX, toZ: tramp.targetZ, startTime: performance.now() } }));
              setTimeout(() => {
                setBouncingStones(prev => {
                  const current = prev[droppedId];
                  if (!current) return prev;
                  return { ...prev, [droppedId]: { ...current, phase: 'jump', startTime: performance.now() } };
                });
              }, 600);
              setTimeout(() => {
                setStones(prev => prev.map(s => s.id === droppedId ? { ...s, x: tramp.targetX, z: tramp.targetZ } : s));
                setBouncingStones(prev => {
                  const next = { ...prev };
                  delete next[droppedId];
                  return next;
                });
              }, 1400);
            }
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

      let hasFallen = false;
      steps.forEach((step, i) => {
        setTimeout(() => {
          if (hasFallen) return;

          setRobotPositions(prev => ({ ...prev, [activeRobotId]: { x: step.x, z: step.z } }));
          
          if (!isValidTile(step.x, step.z)) {
            hasFallen = true;
            setIsRobotRunning(false);
            
            // Wait for the robot to move to the empty tile before falling
            setTimeout(() => {
              setFallingRobots(prev => ({ ...prev, [activeRobotId]: true }));
              setTimeout(() => {
                if (onRestart) onRestart();
                else resetLevel();
              }, 1200);
            }, 300);
            
            return;
          }
          
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

    executeCommand(0, robotPositions[activeRobotId], robotCarriedStones[activeRobotId]);
  }, [robotCommands, activeRobotId, robotPositions, levelData.robotButtons, levelData.buttons, stones, robotCarriedStones, resetLevel, isValidTile]);

  const move = useCallback((dx, dz) => {
    if (gameState !== 'PLAYING' || codingMode) return;

    setPos(prev => {
      const nextX = prev.x + dx;
      const nextZ = prev.z + dz;

      if (!isValidTile(nextX, nextZ)) {
        setGameState('FALLING');
        setTimeout(() => {
          if (onRestart) onRestart();
          else resetLevel();
        }, 1500);
        return { x: nextX, z: nextZ };
      }

      if (isStoneAt(nextX, nextZ) || isPodium(nextX, nextZ)) {
        return prev;
      }
      if (levelData.computers && levelData.computers.some(c => c.x === nextX && c.z === nextZ)) {
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
                 if (levelData.computers && levelData.computers.some(c => c.x === x && c.z === z)) continue;
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
            }, 800); // 800ms flight
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
      setActiveRobotId(nearbyComputer.targetRobotId);
      setRobotCommands([]);
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
    robotPositions, activeRobotId, robotCommands, setRobotCommands,
    isRobotRunning, runRobotProgram, robotCarriedStones, fallingRobots
  };
};
