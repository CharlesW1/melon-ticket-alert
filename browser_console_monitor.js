// Melon Ticket Global - Browser Console Seat Monitor
// Paste this into your browser console while on the tkglobal.melon.com reservation page after logging in

/**************** CONFIG ****************/

const MELON_CONFIG = {
  prodId: "212638",
  scheduleNo: "100001",
  pocCode: "SC0002",
  checkInterval: 15 * 60 * 1000,      // 15 minutes for one complete loop
  priorityFrequency: 3               // Every 3rd request is a priority check
};

const DISCORD_CONFIG = {
  webhookUrl: "your_discord_webhook_url", // Replace with your webhook URL
  userId: "176444535356784640"
};


/**************** UTIL ****************/

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function now() {
  return new Date().toLocaleTimeString();
}

let lastRequestTime = 0;
let requestThrottleMs = 10000; // Default to 10 seconds

async function throttledFetch(url, throttleOverrideMs = null) {
  const currentTime = Date.now();
  const timeSinceLastRequest = currentTime - lastRequestTime;

  // Use override if provided (e.g. for high-frequency priority checks)
  const throttle = throttleOverrideMs !== null ? throttleOverrideMs : requestThrottleMs;
  const delayNeeded = Math.max(0, throttle - timeSinceLastRequest);

  if (delayNeeded > 0) {
    await sleep(delayNeeded);
  }

  lastRequestTime = Date.now();
  return fetch(url);
}

// Pre-calculate Discord mention tag and config status
const isDiscordConfigured = DISCORD_CONFIG.webhookUrl && DISCORD_CONFIG.webhookUrl !== "your_discord_webhook_url";
const discordMentionTag = (isDiscordConfigured && DISCORD_CONFIG.userId && DISCORD_CONFIG.userId !== "your_discord_user_id") ? `<@${DISCORD_CONFIG.userId}>` : '';

async function melonSendDiscord(message) {
  if (!isDiscordConfigured) {
    console.log('Discord webhook not configured, skipping notification');
    return;
  }
  try {
    await fetch(DISCORD_CONFIG.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `${discordMentionTag} ${message}` })
    });
  } catch (e) {
    console.error(`[${now()}] ❌ Failed to send Discord notification`, e);
  }
}


/**************** MELON API ****************/

async function melonGetBlockList() {
  console.log(`[${now()}] 📥 Fetching block list...`);

  const url =
    `https://tkglobal.melon.com/tktapi/product/getAreaMap.json` +
    `?callback=getBlockGradeSeatMapCallBack` +
    `&v=1` +
    `&prodId=${MELON_CONFIG.prodId}` +
    `&scheduleNo=${MELON_CONFIG.scheduleNo}` +
    `&pocCode=${MELON_CONFIG.pocCode}`;

  try {
    const response = await throttledFetch(url);
    const text = await response.text();

    // Optimized: Use slice instead of multiple replaces for better performance and robustness
    const startIdx = text.indexOf('(') + 1;
    const endIdx = text.lastIndexOf(')');
    const json = JSON.parse(text.slice(startIdx, endIdx));

    const rawBlocks = json?.seatData?.da?.sb || [];

    // Optimized: Pre-process block data to avoid repeated calculations in the monitor loop
    const blocks = rawBlocks.map(block => ({
      ...block,
      zone: block.sntv?.a || "UNKNOWN",
      floor: block.sntv?.f || "UNKNOWN",
      // Pre-construct the URL once to avoid template literal overhead in high-frequency checks
      seatMapUrl: `https://tkglobal.melon.com/tktapi/product/seat/seatMapList.json` +
        `?callback=getSeatListCallBack` +
        `&v=1` +
        `&prodId=${MELON_CONFIG.prodId}` +
        `&scheduleNo=${MELON_CONFIG.scheduleNo}` +
        `&blockId=${block.sbid}` +
        `&pocCode=${MELON_CONFIG.pocCode}` +
        `&corpCodeNo=`
    }));

    console.log(`[${now()}] ✅ Loaded and pre-processed ${blocks.length} blocks.`);
    return blocks;
  } catch (e) {
    console.error(`[${now()}] ❌ Failed to fetch block list`, e);
    return [];
  }
}

// seatCache maps blockId -> lastCheckedTimestamp
const seatCache = new Map();

async function melonCheckSingleBlock(block) {
  // Optimized: Use pre-processed properties
  const { zone, floor, sbid: blockId, seatMapUrl } = block;

  const hasSeatsPreviously = seatCache.has(blockId);
  // Use halved throttle for high-frequency checks if seats were previously found
  const throttleOverride = hasSeatsPreviously ? Math.max(requestThrottleMs / 2, 5000) : null;

  const priorityLabel = hasSeatsPreviously ? "[PRIORITY] " : "";
  console.log(`[${now()}] ${priorityLabel}🔎 Checking block: Floor ${floor} | ${zone} | sbid=${blockId}`);

  try {
    const response = await throttledFetch(seatMapUrl, throttleOverride);
    const text = await response.text();

    // Performance Optimization: Fast-path for empty blocks.
    // Most blocks are empty. Checking the raw text for the existence of an ID
    // is significantly faster than slicing, parsing, and iterating over a large JSON.
    if (!text.includes('"sid":"')) {
      if (hasSeatsPreviously) {
        console.log(`[${now()}] ⬚ Seats are now GONE in Floor ${floor} | ${zone} (sbid=${blockId})`);
        seatCache.delete(blockId);
      } else {
        console.log(`[${now()}] ⬚ No seats in Floor ${floor} | ${zone} (sbid=${blockId})`);
      }
      return 0;
    }

    // Optimized: Use slice instead of multiple replaces for better performance and robustness
    const startIdx = text.indexOf('(') + 1;
    const endIdx = text.lastIndexOf(')');
    const json = JSON.parse(text.slice(startIdx, endIdx));

    let count = 0;
    const st = json?.seatData?.st;
    if (st) {
      // Optimized & Fixed: Check all seat grades (st) and avoid unnecessary property lookups in inner loop
      for (let i = 0, lenI = st.length; i < lenI; i++) {
        const ss = st[i].ss;
        if (ss) {
          for (let j = 0, lenJ = ss.length; j < lenJ; j++) {
            if (ss[j].sid !== null) count++;
          }
        }
      }
    }

    if (count > 0) {
      console.log(`[${now()}] 🎫 FOUND ${count} seats in Floor ${floor} | ${zone} (sbid=${blockId})`);
      await melonSendDiscord(`🎫 **${count} seats available**\nFloor ${floor} | ${zone} (${blockId})`);

      // Update last checked time
      seatCache.set(blockId, Date.now());
    } else if (hasSeatsPreviously) {
      // Handle the rare case where text.includes was true but count is 0
      console.log(`[${now()}] ⬚ Seats are now GONE (unexpected) in Floor ${floor} | ${zone} (sbid=${blockId})`);
      seatCache.delete(blockId);
    }

    return count;

  } catch (e) {
    console.error(`[${now()}] ❌ Failed checking Floor ${floor} | ${zone} (sbid=${blockId})`, e);
    return 0;
  }
}


/**************** SORTING ****************/

function sortBlocks(blocks) {
  return blocks.sort((a, b) => {
    // Optimized: Use pre-processed floor and zone
    const rawFloorA = Number(a.floor);
    const rawFloorB = Number(b.floor);

    const floorA = Number.isFinite(rawFloorA) ? rawFloorA : -1;
    const floorB = Number.isFinite(rawFloorB) ? rawFloorB : -1;

    if (floorA !== floorB) return floorA - floorB;

    const zoneA = a.zone.toUpperCase();
    const zoneB = b.zone.toUpperCase();
    if (zoneA !== zoneB) return zoneA.localeCompare(zoneB);

    const idA = Number(a.sbid);
    const idB = Number(b.sbid);

    return (Number.isFinite(idA) ? idA : 0) -
           (Number.isFinite(idB) ? idB : 0);
  });
}

function logSortedBlocks(blocks) {
  // Optimized: Use pre-processed floor and zone
  const table = blocks.map(b => ({
    floor: b.floor,
    zone: b.zone,
    sbid: b.sbid
  }));

  console.log(`[${now()}] 📋 Sorted block list:`);
  console.table(table);
}

/**************** MONITOR LOOP ****************/

let blocks = [];
let blocksMap = new Map(); // Optimized: Map for O(1) lookup of blocks by sbid
let blockIndex = 0;
let globalRequestCount = 0;

async function startMelonMonitor() {
  if (!DISCORD_CONFIG.webhookUrl || DISCORD_CONFIG.webhookUrl === "your_discord_webhook_url") {
    console.log('Discord webhook not configured, skipping notification');
  }
  
  blocks = await melonGetBlockList();

  if (blocks.length === 0) {
    console.error("❌ No blocks found. Stopping.");
    return;
  }

  // 🔁 Sort blocks by floor, then alphabetically
  blocks = sortBlocks(blocks);

  // Optimized: Build map for O(1) lookups
  blocksMap = new Map();
  blocks.forEach(b => blocksMap.set(b.sbid, b));

  // 🧾 Log the sorted list in table form
  logSortedBlocks(blocks);

  // Calculate request interval based on loop time and number of blocks
  const requestIntervalMs = Math.floor(MELON_CONFIG.checkInterval / blocks.length);
  requestThrottleMs = Math.max(requestIntervalMs, 10000); // Minimum 10 seconds
  console.log(`🔁 Starting staggered monitor: ${blocks.length} blocks in 15 minutes (${Math.round(requestIntervalMs / 1000)}s per block)`);
  console.log(`⏱️ Request throttle: ${requestThrottleMs / 1000}s between requests`);

  lastRequestTime = Date.now() - requestThrottleMs;

  while (true) {
    globalRequestCount++;

    // Determine if we should do a priority check
    const shouldDoPriorityCheck = seatCache.size > 0 && (globalRequestCount % MELON_CONFIG.priorityFrequency === 0);

    if (shouldDoPriorityCheck) {
      // Find the block with the earliest lastCheckedTimestamp
      let earliestTime = Infinity;
      let priorityBlockId = null;

      for (const [sbid, timestamp] of seatCache.entries()) {
        if (timestamp < earliestTime) {
          earliestTime = timestamp;
          priorityBlockId = sbid;
        }
      }

      const block = blocksMap.get(priorityBlockId);
      if (block) {
        await melonCheckSingleBlock(block);
      } else {
        // Should not happen if data is consistent, but clean up just in case
        seatCache.delete(priorityBlockId);
      }
    } else {
      const block = blocks[blockIndex];
      await melonCheckSingleBlock(block);
      blockIndex = (blockIndex + 1) % blocks.length;
    }
  }
}

/**************** START ****************/

startMelonMonitor().catch(e => console.error("Monitor error:", e));
