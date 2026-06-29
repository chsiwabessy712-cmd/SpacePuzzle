// Seeded PRNG for consistent levels
class Random {
  constructor(seed) {
    this.seed = seed;
  }
  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min)) + min;
  }
}

export function generateLevel(level) {
  const rng = new Random(level * 1337);

  // Max 4 islands, but level 3 and 4 are specifically 3 lands
  const numIslands = (level === 3 || level === 4) ? 3 : Math.min(3 + Math.floor((level - 1) / 2), 4);
  
  const islands = [];
  const bridges = [];
  const buttons = [];
  const stones = [];
  const trampolines = [];
  const occupiedTiles = new Set(); // store "x,z" to prevent overlap

  let currentX = 0;
  let currentZ = 0;
  let prevBridgeW = 1;

  let btnCounter = 1;
  let stoneCounter = 1;

  // Start position is always on the first island at relative 1,2
  const startPos = { x: 1, z: 2 };
  occupiedTiles.add(`${startPos.x},${startPos.z}`);

  for (let i = 0; i < numIslands; i++) {
    let w = rng.nextInt(4, 7);
    let d = rng.nextInt(4, 7);
    const isRobotIsland = (level >= 3 && level <= 4 && i === 1) || (level >= 5 && i === 2);
    if (level >= 4 && isRobotIsland) {
      if (w < 6) w = 6;
      if (d < 6) d = 6;
    }

    let zStart = 0;
    if (i > 0) {
       // The incoming bridge is at Z = currentZ with width prevBridgeW.
       // We must ensure the island's Z range covers [currentZ, currentZ + prevBridgeW - 1].
       // This means:
       // island.zStart <= currentZ
       // island.zStart + d - 1 >= currentZ + prevBridgeW - 1  =>  island.zStart >= currentZ + prevBridgeW - d
       const minZ = currentZ + prevBridgeW - d;
       const maxZ = currentZ;
       zStart = rng.nextInt(minZ, maxZ + 1);
    }

    const island = {
      id: i,
      xStart: currentX,
      zStart: zStart,
      w,
      d,
      maxItems: (w * d <= 20) ? 2 : 4,
      itemsCount: 0
    };
    islands.push(island);

    // Mark incoming bridge tiles on this island as occupied
    if (i > 0) {
      for (let bw = 0; bw < prevBridgeW; bw++) {
        occupiedTiles.add(`${currentX},${currentZ + bw}`);
        occupiedTiles.add(`${currentX + 1},${currentZ + bw}`); // In front of tube
        occupiedTiles.add(`${currentX},${currentZ + bw - 1}`); // Beside tube
        occupiedTiles.add(`${currentX},${currentZ + bw + 1}`); // Beside tube
      }
    }

    if (i < numIslands - 1) {
      const bridgeW = 1; // Always 1 tile wide so tube meshes perfectly center on the tile
      // Ensure bridge fits on the current island
      const maxZ = island.zStart + d - bridgeW;
      // Pick a random valid position for the outgoing bridge
      const bridgeZ = rng.nextInt(island.zStart, maxZ + 1);

      // Mark outgoing bridge tiles on this island as occupied
      for (let bw = 0; bw < bridgeW; bw++) {
        occupiedTiles.add(`${currentX + w - 1},${bridgeZ + bw}`);
        occupiedTiles.add(`${currentX + w - 2},${bridgeZ + bw}`); // In front of tube
        occupiedTiles.add(`${currentX + w - 1},${bridgeZ + bw - 1}`); // Beside tube
        occupiedTiles.add(`${currentX + w - 1},${bridgeZ + bw + 1}`); // Beside tube
      }
      
      prevBridgeW = bridgeW;
      const bridgeId = `bridge${i+1}`;
      const gap = rng.nextInt(2, 4);

      const bridgeTiles = [];
      for (let bx = 0; bx < gap; bx++) {
         for (let bz = 0; bz < bridgeW; bz++) {
            bridgeTiles.push({ x: currentX + w + bx, z: bridgeZ + bz });
         }
      }

      bridges.push({
        id: bridgeId,
        x: currentX + w,
        z: bridgeZ,
        gap,
        width: bridgeW,
        tiles: bridgeTiles,
        reqs: []
      });

      currentZ = bridgeZ;
      currentX += w + gap;
    } else {
      currentX += w;
    }
  }

  // PASS 2: Generate Locks and Items
  let computers = [];
  let robots = [];
  let robotButtons = [];
  let nextPodiumLabelCode = 65;

  for (let i = 0; i < numIslands - 1; i++) {
    const bridge = bridges[i];

    const isComputerRobotBridge = (level >= 3 && level <= 4 && i === 0) || (level >= 5 && (i === 0 || i === 1));

    // Level 3+ special: bridge uses computer+robot instead of standard puzzle
    if (isComputerRobotBridge) {
      // Place computer on island i, avoiding borders and occupied
      const compIsland = islands[i];
      let cx, cz;
      let attempts = 0;
      do {
        if (attempts === 0) {
          // Try bottom-left corner to keep computer away from stones, robots, and podiums
          cx = compIsland.xStart + 1;
          cz = compIsland.zStart + compIsland.d - 2;
        } else {
          cx = compIsland.xStart + rng.nextInt(1, compIsland.w - 1);
          cz = compIsland.zStart + rng.nextInt(1, compIsland.d - 1);
        }
        attempts++;
      } while (occupiedTiles.has(`${cx},${cz}`) && attempts < 100);
      occupiedTiles.add(`${cx},${cz}`);

      computers.push({ id: `comp${i}`, x: cx, z: cz, targetRobotId: `robot${i+1}` });

      // Place robot on island i + 1
      const robotIsland = islands[i + 1];
      let rx, rz;
      attempts = 0;
      do {
        if (attempts === 0) {
          // Try top-right corner to keep robot away from stones (top-left) and podiums (bottom-right)
          rx = robotIsland.xStart + robotIsland.w - 2;
          rz = robotIsland.zStart + 1;
        } else {
          rx = robotIsland.xStart + rng.nextInt(1, robotIsland.w - 1);
          rz = robotIsland.zStart + rng.nextInt(1, robotIsland.d - 1);
        }
        attempts++;
      } while (occupiedTiles.has(`${rx},${rz}`) && attempts < 100);
      occupiedTiles.add(`${rx},${rz}`);

      robots.push({ id: `robot${i+1}`, x: rx, z: rz });

      // Level 4+: Place a stone and podium pair for EACH remaining bridge on the robot's island
      if (level >= 4) {

        const robotBridges = (level >= 5) ? [bridges[i]] : bridges.slice(i);
        const numPairs = robotBridges.length;
        
        // Collect all valid tiles (excluding robot, computer, and portal)
        let allTiles = [];
        for (let tx = robotIsland.xStart; tx < robotIsland.xStart + robotIsland.w; tx++) {
          for (let tz = robotIsland.zStart; tz < robotIsland.zStart + robotIsland.d; tz++) {
            // Leave a 1-tile gap from portal if this is the last island
            let isNearPortal = false;
            if (i === numIslands - 2) {
              const px = robotIsland.xStart + Math.floor((robotIsland.w - 2) / 2);
              const pz = robotIsland.zStart + Math.floor((robotIsland.d - 2) / 2);
              if (tx >= px - 1 && tx <= px + 2 && tz >= pz - 1 && tz <= pz + 2) {
                isNearPortal = true;
              }
            }
            if (!occupiedTiles.has(`${tx},${tz}`) && !isNearPortal) {
              allTiles.push({ x: tx, z: tz });
            }
          }
        }
        
        // Sort tiles by distance from top-left corner to spread stones and podiums
        allTiles.sort((a, b) => {
           const distA = (a.x - robotIsland.xStart) + (a.z - robotIsland.zStart);
           const distB = (b.x - robotIsland.xStart) + (b.z - robotIsland.zStart);
           return distA - distB;
        });
        
        for (let bi = 0; bi < numPairs; bi++) {
          if (allTiles.length < 2) break; // Safety check

          const useTrampoline = (level === 7 || level === 8);

          // Place stone at top-left-most available
          const st = allTiles.shift();
          occupiedTiles.add(`${st.x},${st.z}`);
          
          // Place podium/trampoline at bottom-right-most available
          const pt = allTiles.pop();
          occupiedTiles.add(`${pt.x},${pt.z}`);

          stones.push({
             id: `stone${stoneCounter}`,
             x: st.x, z: st.z,
             targetId: useTrampoline ? `tramp${btnCounter}` : `btn${btnCounter}`
          });
          stoneCounter++;
          
          if (useTrampoline) {
             let bx, bz;
             let attempts = 0;
             const targetIsland = islands[i];
             do {
               bx = targetIsland.xStart + rng.nextInt(0, targetIsland.w);
               bz = targetIsland.zStart + rng.nextInt(0, targetIsland.d);
               attempts++;
             } while (occupiedTiles.has(`${bx},${bz}`) && attempts < 100);
             occupiedTiles.add(`${bx},${bz}`);

             let trTargetX, trTargetZ;
             attempts = 0;
             do {
               trTargetX = targetIsland.xStart + rng.nextInt(0, targetIsland.w);
               trTargetZ = targetIsland.zStart + rng.nextInt(0, targetIsland.d);
               attempts++;
             } while (occupiedTiles.has(`${trTargetX},${trTargetZ}`) && attempts < 100);
             occupiedTiles.add(`${trTargetX},${trTargetZ}`);

             const podium = {
                id: `btn${btnCounter}`,
                type: 'podium',
                x: bx, z: bz,
                bridgeId: robotBridges[bi].id,
                label: String.fromCharCode(nextPodiumLabelCode++)
             };
             buttons.push(podium);
             
             trampolines.push({
                id: `tramp${btnCounter}`,
                x: pt.x, z: pt.z,
                targetX: trTargetX, targetZ: trTargetZ
             });
             robotBridges[bi].reqs.push(podium.id);
          } else {
             const podium = {
                id: `btn${btnCounter}`,
                type: 'podium',
                x: pt.x, z: pt.z,
                bridgeId: robotBridges[bi].id,
                label: String.fromCharCode(nextPodiumLabelCode++)
             };
             buttons.push(podium);
             robotBridges[bi].reqs.push(podium.id);
          }
          btnCounter++;
        }
        
        if (level === 6 && allTiles.length > 0) {
           const rbt = allTiles.shift();
           occupiedTiles.add(`${rbt.x},${rbt.z}`);
           const rbtn = {
             id: `rbtn${btnCounter}`,
             type: 'floor',
             x: rbt.x, z: rbt.z,
             bridgeId: robotBridges[0].id,
             label: String.fromCharCode(nextPodiumLabelCode++)
           };
           robotButtons.push(rbtn);
           buttons.push(rbtn);
           robotBridges[0].reqs.push(rbtn.id);
           btnCounter++;
        }

        robotIsland.itemsCount = robotIsland.maxItems;
      } else {
        // Level 3: Place a floor button on the robot's island
        let bx, bz;
        let attempts = 0;
        do {
          bx = robotIsland.xStart + rng.nextInt(1, robotIsland.w - 1);
          bz = robotIsland.zStart + rng.nextInt(1, robotIsland.d - 1);
          attempts++;
        } while (occupiedTiles.has(`${bx},${bz}`) && attempts < 100);
        occupiedTiles.add(`${bx},${bz}`);

        const rbtn = {
          id: `rbtn${btnCounter}`,
          type: 'floor',
          x: bx,
          z: bz,
          bridgeId: bridge.id,
          label: 'C'
        };
        robotButtons.push(rbtn);
        buttons.push(rbtn);
        bridge.reqs.push(rbtn.id);
        
        if (level === 3) {
           if (bridges[1]) bridges[1].reqs.push(rbtn.id);
           islands[0].itemsCount = islands[0].maxItems;
        }
        btnCounter++;
      }
      
      continue; // skip normal lock generation for this bridge
    }
    
    if (level === 3 && i === 1) {
       continue; // skip normal lock generation for second bridge in level 3
    }

    if (level === 2 && i === 0) {
       continue; // First bridge in level 2 is open
    }
    if (level === 3 && i === 0) {
       continue; // First bridge in level 3 is open
    }

    let numLocks = level >= 3 ? 3 : (level >= 3 ? 2 : 1);
    if ((level === 2 || level === 3) && i === 1) numLocks = 1;
    if (level >= 5 && i === 0) numLocks = 1;
    if (level === 3 && i === 2) numLocks = 1;
    
    const availableIslands = islands.slice(0, i + 1);
    let totalCapacity = 0;
    availableIslands.forEach(isl => {
      totalCapacity += (isl.maxItems - isl.itemsCount);
    });
    const maxLocks = Math.floor(totalCapacity / 2);
    numLocks = Math.min(numLocks, maxLocks);

    for (let l = 0; l < numLocks; l++) {
      let targetButtonIsland;
      let targetTrampolineIsland = null;

      if (level === 2 && i === 1) {
        targetButtonIsland = islands[0];
        targetTrampolineIsland = islands[1];
        targetButtonIsland.itemsCount++;
        targetTrampolineIsland.itemsCount++;
      } else if (level === 3 && i === 1) {
        targetButtonIsland = islands[2];
        targetTrampolineIsland = islands[1];
        targetButtonIsland.itemsCount++;
        targetTrampolineIsland.itemsCount++;
      } else if (level === 3 && i === 2) {
        targetButtonIsland = islands[2];
        targetButtonIsland.itemsCount++;
      } else {
        let useTrampoline = level >= 3 && level <= 5 && rng.next() > 0.5;
        if (i === numIslands - 2) useTrampoline = false; // Prevent targeting portal land
        
        if (useTrampoline) {
          // Button goes to next island (i+1), trampoline goes to available island
          targetButtonIsland = islands[i + 1];
          const trampolineIsland = islands[i];
          if (trampolineIsland.itemsCount >= trampolineIsland.maxItems) {
             // fallback to normal
             targetButtonIsland = availableIslands[rng.nextInt(0, availableIslands.length)];
             useTrampoline = false;
          } else {
             targetTrampolineIsland = trampolineIsland;
             targetTrampolineIsland.itemsCount++;
          }
        } else {
          const validButtonIslands = availableIslands.filter(isl => isl.itemsCount < isl.maxItems);
          if (validButtonIslands.length === 0) break;
          targetButtonIsland = validButtonIslands[rng.nextInt(0, validButtonIslands.length)];
        }
      }
      
      targetButtonIsland.itemsCount++;
      const isPodium = level > 1 && rng.next() > 0.5;

      let bx, bz, sx, sz;
      let attempts = 0;
      let validPos = false;
      
      do {
        bx = targetButtonIsland.xStart + rng.nextInt(0, targetButtonIsland.w);
        bz = targetButtonIsland.zStart + rng.nextInt(0, targetButtonIsland.d);
        let isBorder = false;
        if (!isPodium) {
           isBorder = bx === targetButtonIsland.xStart || bx === targetButtonIsland.xStart + targetButtonIsland.w - 1 ||
                      bz === targetButtonIsland.zStart || bz === targetButtonIsland.zStart + targetButtonIsland.d - 1;
        }
        validPos = !occupiedTiles.has(`${bx},${bz}`) && !isBorder;
        attempts++;
      } while (!validPos && attempts < 100);
      occupiedTiles.add(`${bx},${bz}`);

      if (targetTrampolineIsland) {
        let tx, tz;
        attempts = 0;
        do {
          tx = targetTrampolineIsland.xStart + rng.nextInt(0, targetTrampolineIsland.w);
          tz = targetTrampolineIsland.zStart + rng.nextInt(0, targetTrampolineIsland.d);
          attempts++;
        } while (occupiedTiles.has(`${tx},${tz}`) && attempts < 100);
        occupiedTiles.add(`${tx},${tz}`);
        
        let trTargetX, trTargetZ;
        attempts = 0;
        do {
          trTargetX = targetButtonIsland.xStart + rng.nextInt(0, targetButtonIsland.w);
          trTargetZ = targetButtonIsland.zStart + rng.nextInt(0, targetButtonIsland.d);
          attempts++;
        } while (occupiedTiles.has(`${trTargetX},${trTargetZ}`) && attempts < 100);
        occupiedTiles.add(`${trTargetX},${trTargetZ}`);

        trampolines.push({
           id: `tramp${btnCounter}`,
           x: tx,
           z: tz,
           targetX: trTargetX,
           targetZ: trTargetZ
        });
      }

      let stoneIsland;
      if (level === 2 && i === 1) {
        stoneIsland = islands[1];
      } else if (level === 3 && i === 1) {
        stoneIsland = islands[1];
      } else if (level === 3 && i === 2) {
        stoneIsland = islands[2];
      } else {
        if (targetTrampolineIsland) {
          stoneIsland = targetTrampolineIsland;
        } else {
          stoneIsland = targetButtonIsland;
        }
      }
      stoneIsland.itemsCount++;
      
      attempts = 0;
      do {
        sx = stoneIsland.xStart + rng.nextInt(0, stoneIsland.w);
        sz = stoneIsland.zStart + rng.nextInt(0, stoneIsland.d);
        attempts++;
      } while (occupiedTiles.has(`${sx},${sz}`) && attempts < 100);
      occupiedTiles.add(`${sx},${sz}`);

      buttons.push({
        id: `btn${btnCounter}`,
        type: isPodium ? 'podium' : 'floor',
        x: bx,
        z: bz,
        bridgeId: bridge.id,
        ...(isPodium ? { label: String.fromCharCode(nextPodiumLabelCode++) } : {})
      });

      stones.push({
        id: `stone${stoneCounter}`,
        x: sx,
        z: sz
      });

      bridge.reqs.push(`btn${btnCounter}`);
      btnCounter++;
      stoneCounter++;
    }
  }

  const lastIsland = islands[numIslands - 1];
  
  // Center the portal (which is 2x2) in the middle of the last island
  const px = lastIsland.xStart + Math.floor((lastIsland.w - 2) / 2);
  const pz = lastIsland.zStart + Math.floor((lastIsland.d - 2) / 2);

  const portal = { x: px, z: pz };

  if (level === 7) {
    const btn4 = buttons.find(b => b.id === 'btn4');
    if (btn4) {
      btn4.x = 4;
      btn4.z = 0;
      btn4.bridgeId = 'bridge1';
    }

    const stone3 = stones.find(s => s.id === 'stone3');
    if (stone3) {
      stone3.x = 9;
      stone3.z = 6;
    }

    const bridge1 = bridges.find(b => b.id === 'bridge1');
    if (bridge1 && !bridge1.reqs.includes('btn4')) {
      bridge1.reqs.push('btn4');
    }

    const bridge3 = bridges.find(b => b.id === 'bridge3');
    if (bridge3) {
      bridge3.reqs = bridge3.reqs.filter(id => id !== 'btn4');
    }
  }

  if (level === 8) {
    const btn1 = buttons.find(b => b.id === 'btn1');
    if (btn1) {
      btn1.x = 0;
      btn1.z = 3;
    }

    const stone1 = stones.find(s => s.id === 'stone1');
    if (stone1) {
      stone1.x = 17;
      stone1.z = 0;
    }

    const stone2 = stones.find(s => s.id === 'stone2');
    if (stone2) {
      stone2.x = 13;
      stone2.z = -2;
    }

    const stone3 = stones.find(s => s.id === 'stone3');
    if (stone3) {
      stone3.x = 17;
      stone3.z = 1;
    }

    const stone4 = stones.find(s => s.id === 'stone4');
    if (stone4) {
      stone4.x = 17;
      stone4.z = 2;
    }

    const comp0 = computers.find(c => c.id === 'comp0');
    if (comp0) {
      comp0.x = 4;
      comp0.z = 4;
    }

    const btn3 = buttons.find(b => b.id === 'btn3');
    if (btn3) {
      btn3.x = 4;
      btn3.z = 0;
    }

    const btn5 = {
      id: 'btn5',
      type: 'floor',
      x: 11,
      z: 2,
      bridgeId: 'bridge1',
      label: 'D'
    };
    buttons.push(btn5);
    robotButtons.push(btn5);

    const btn6 = {
      id: 'btn6',
      type: 'floor',
      x: 19,
      z: 3,
      bridgeId: 'bridge3',
      label: 'E'
    };
    buttons.push(btn6);
    robotButtons.push(btn6);
    
    const bridge1 = bridges.find(b => b.id === 'bridge1');
    const bridge2 = bridges.find(b => b.id === 'bridge2');
    const bridge3 = bridges.find(b => b.id === 'bridge3');
    
    // Make btn1 open bridge2 instead
    if (btn1) btn1.bridgeId = 'bridge2';
    if (bridge1) bridge1.reqs = bridge1.reqs.filter(id => id !== 'btn1');
    if (bridge2) bridge2.reqs.push('btn1');

    // Make btn2 and btn5 open bridge1
    const btn2 = buttons.find(b => b.id === 'btn2');
    if (btn2) {
      btn2.bridgeId = 'bridge1';
      if (bridge2) bridge2.reqs = bridge2.reqs.filter(id => id !== 'btn2');
      if (bridge1) bridge1.reqs.push('btn2');
    }
    if (bridge1) bridge1.reqs.push('btn5');
    
    // btn6 opens bridge3
    if (bridge3) bridge3.reqs.push('btn6');

    // Add a trampoline on the starting land to throw stones back to the 2nd land
    const startingIsland = islands[0];
    const secondIsland = islands[1];
    trampolines.push({
      id: 'tramp_back',
      x: startingIsland.xStart + 2,
      z: startingIsland.zStart + 2,
      targetX: secondIsland.xStart + 2,
      targetZ: secondIsland.zStart + 2
    });
  }

  return {
    level,
    startPos,
    islands,
    bridges,
    buttons,
    stones,
    trampolines,
    computers,
    robots,
    robotButtons,
    portal
  };
}
