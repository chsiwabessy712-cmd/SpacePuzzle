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

  // Max 4 islands, but level 6 and 7 are specifically 3 lands
  const numIslands = (level === 6 || level === 7) ? 3 : Math.min(3 + Math.floor((level - 1) / 2), 4);
  
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
    const w = rng.nextInt(4, 7);
    const d = rng.nextInt(4, 7);

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
      }
    }

    if (i < numIslands - 1) {
      const bridgeW = rng.nextInt(1, 3);
      // Ensure bridge fits on the current island
      const maxZ = island.zStart + d - bridgeW;
      // Pick a random valid position for the outgoing bridge
      const bridgeZ = rng.nextInt(island.zStart, maxZ + 1);

      // Mark outgoing bridge tiles on this island as occupied
      for (let bw = 0; bw < bridgeW; bw++) {
        occupiedTiles.add(`${currentX + w - 1},${bridgeZ + bw}`);
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
  let computer = null;
  let robot = null;
  let robotButtons = [];

  for (let i = 0; i < numIslands - 1; i++) {
    const bridge = bridges[i];

    // Level 6+ special: first bridge uses computer+robot instead of stone+button
    if (level >= 6 && i === 0) {
      // Place computer on island 0 (player's island), avoiding borders and occupied
      const compIsland = islands[0];
      let cx, cz;
      let attempts = 0;
      do {
        cx = compIsland.xStart + rng.nextInt(1, compIsland.w - 1);
        cz = compIsland.zStart + rng.nextInt(1, compIsland.d - 1);
        attempts++;
      } while (occupiedTiles.has(`${cx},${cz}`) && attempts < 100);
      occupiedTiles.add(`${cx},${cz}`);

      computer = { x: cx, z: cz };

      // Place robot on island 1 (different island)
      const robotIsland = islands[1];
      let rx, rz;
      attempts = 0;
      do {
        rx = robotIsland.xStart + rng.nextInt(1, robotIsland.w - 1);
        rz = robotIsland.zStart + rng.nextInt(1, robotIsland.d - 1);
        attempts++;
      } while (occupiedTiles.has(`${rx},${rz}`) && attempts < 100);
      occupiedTiles.add(`${rx},${rz}`);

      robot = { x: rx, z: rz };

      // Level 7: Place a stone and a podium on the robot's island
      if (level === 7) {
        let sx, sz, px, pz;
        let attempts = 0;
        do {
          sx = robotIsland.xStart + rng.nextInt(1, robotIsland.w - 1);
          sz = robotIsland.zStart + rng.nextInt(1, robotIsland.d - 1);
          attempts++;
        } while (occupiedTiles.has(`${sx},${sz}`) && attempts < 100);
        occupiedTiles.add(`${sx},${sz}`);
        
        attempts = 0;
        do {
          px = robotIsland.xStart + rng.nextInt(1, robotIsland.w - 1);
          pz = robotIsland.zStart + rng.nextInt(1, robotIsland.d - 1);
          attempts++;
        } while (occupiedTiles.has(`${px},${pz}`) && attempts < 100);
        occupiedTiles.add(`${px},${pz}`);

        const stone = {
           id: `stone${stoneCounter}`,
           x: sx, z: sz,
           targetId: `btn${btnCounter}`
        };
        stones.push(stone);
        stoneCounter++;
        
        const podium = {
           id: `btn${btnCounter}`,
           type: 'podium',
           x: px, z: pz,
           bridgeId: bridge.id,
           label: 'B'
        };
        buttons.push(podium);
        bridge.reqs.push(podium.id);
        
        if (bridges[1]) bridges[1].reqs.push(podium.id);
        islands[0].itemsCount = islands[0].maxItems;
        btnCounter++;
      } else {
        // Level 6/8: Place a floor button on the robot's island
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
        
        if (level === 6) {
           if (bridges[1]) bridges[1].reqs.push(rbtn.id);
           islands[0].itemsCount = islands[0].maxItems; // ensure no other items on first land
        }
        btnCounter++;
      }
      
      continue; // skip normal lock generation for this bridge
    }
    
    if ((level === 6 || level === 7) && i === 1) {
       continue; // skip normal lock generation for second bridge, already handled
    }

    let numLocks = level >= 6 ? 3 : (level >= 3 ? 2 : 1);
    
    const availableIslands = islands.slice(0, i + 1);
    let totalCapacity = 0;
    availableIslands.forEach(isl => {
      totalCapacity += (isl.maxItems - isl.itemsCount);
    });
    const maxLocks = Math.floor(totalCapacity / 2);
    numLocks = Math.min(numLocks, maxLocks);

    for (let l = 0; l < numLocks; l++) {
      const useTrampoline = level >= 3 && level <= 5 && rng.next() > 0.5;
      
      let targetButtonIsland;
      let targetTrampolineIsland = null;

      if (useTrampoline) {
        // Button goes to next island (i+1), trampoline goes to available island
        targetButtonIsland = islands[i + 1];
        const validTrampolineIslands = availableIslands.filter(isl => isl.itemsCount < isl.maxItems);
        if (validTrampolineIslands.length === 0) {
           // fallback to normal
           targetButtonIsland = availableIslands[rng.nextInt(0, availableIslands.length)];
        } else {
           targetTrampolineIsland = validTrampolineIslands[rng.nextInt(0, validTrampolineIslands.length)];
           targetTrampolineIsland.itemsCount++;
        }
      } else {
        const validButtonIslands = availableIslands.filter(isl => isl.itemsCount < isl.maxItems);
        if (validButtonIslands.length === 0) break;
        targetButtonIsland = validButtonIslands[rng.nextInt(0, validButtonIslands.length)];
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
        
        trampolines.push({
           id: `tramp${btnCounter}`,
           x: tx,
           z: tz,
           targetX: bx,
           targetZ: bz
        });
      }

      const validStoneIslands = availableIslands.filter(isl => isl.itemsCount < isl.maxItems);
      if (validStoneIslands.length === 0) break;
      const stoneIsland = validStoneIslands[rng.nextInt(0, validStoneIslands.length)];
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
        bridgeId: bridge.id
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

  return {
    level,
    startPos,
    islands,
    bridges,
    buttons,
    stones,
    trampolines,
    computer,
    robot,
    robotButtons,
    portal
  };
}
