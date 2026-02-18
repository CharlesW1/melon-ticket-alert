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

async function melonSendDiscord(message) {
  if (!DISCORD_CONFIG.webhookUrl || DISCORD_CONFIG.webhookUrl === "your_discord_webhook_url") {
    console.log('Discord webhook not configured, skipping notification');
    return;
  }
  const tag = (DISCORD_CONFIG.userId && DISCORD_CONFIG.userId !== "your_discord_user_id") ? `<@${DISCORD_CONFIG.userId}>` : '';
  try {
    await fetch(DISCORD_CONFIG.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `${tag} ${message}` })
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

    const blocks = json?.seatData?.da?.sb || [];
    console.log(`[${now()}] ✅ Loaded ${blocks.length} blocks.`);
    return blocks;
  } catch (e) {
    console.error(`[${now()}] ❌ Failed to fetch block list`, e);
    return [];
  }
}

// seatCache maps blockId -> lastCheckedTimestamp
const seatCache = new Map();

async function melonCheckSingleBlock(block) {
  const zone = block.sntv?.a || "UNKNOWN";
  const floor = block.sntv?.f || "UNKNOWN";
  const blockId = block.sbid;

  const hasSeatsPreviously = seatCache.has(blockId);
  // Use halved throttle for high-frequency checks if seats were previously found
  const throttleOverride = hasSeatsPreviously ? Math.max(requestThrottleMs / 2, 5000) : null;

  const url =
    `https://tkglobal.melon.com/tktapi/product/seat/seatMapList.json` +
    `?callback=getSeatListCallBack` +
    `&v=1` +
    `&prodId=${MELON_CONFIG.prodId}` +
    `&scheduleNo=${MELON_CONFIG.scheduleNo}` +
    `&blockId=${blockId}` +
    `&pocCode=${MELON_CONFIG.pocCode}` +
    `&corpCodeNo=`;

  const priorityLabel = hasSeatsPreviously ? "[PRIORITY] " : "";
  console.log(`[${now()}] ${priorityLabel}🔎 Checking block: Floor ${floor} | ${zone} | sbid=${blockId}`);

  try {
    const response = await throttledFetch(url, throttleOverride);
    const text = await response.text();

    // Optimized: Use slice instead of multiple replaces for better performance and robustness
    const startIdx = text.indexOf('(') + 1;
    const endIdx = text.lastIndexOf(')');
    const json = JSON.parse(text.slice(startIdx, endIdx));

    let count = 0;
    const ss = json?.seatData?.st?.[0]?.ss;
    if (ss) {
      for (let i = 0; i < ss.length; i++) {
        if (ss[i].sid !== null) count++;
      }
    }

    if (count > 0) {
      console.log(`[${now()}] 🎫 FOUND ${count} seats in Floor ${floor} | ${zone} (sbid=${blockId})`);
      await melonSendDiscord(`🎫 **${count} seats available**\nFloor ${floor} | ${zone} (${blockId})`);

      // Optimized: Update last checked time AND move to end of Map insertion order for O(1) rotation
      seatCache.delete(blockId);
      seatCache.set(blockId, Date.now());
    } else {
      if (hasSeatsPreviously) {
        console.log(`[${now()}] ⬚ Seats are now GONE in Floor ${floor} | ${zone} (sbid=${blockId})`);
        // Remove from priority cache if count is 0
        seatCache.delete(blockId);
      } else {
        console.log(`[${now()}] ⬚ No seats in Floor ${floor} | ${zone} (sbid=${blockId})`);
      }
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
    const floorA = Number(a.sntv?.f ?? -1);
    const floorB = Number(b.sntv?.f ?? -1);
    if (floorA !== floorB) return floorA - floorB;

    const zoneA = (a.sntv?.a || "").toUpperCase();
    const zoneB = (b.sntv?.a || "").toUpperCase();
    if (zoneA !== zoneB) return zoneA.localeCompare(zoneB);

    return a.sbid - b.sbid;
  });
}

function logSortedBlocks(blocks) {
  const table = blocks.map(b => ({
    floor: b.sntv?.f ?? "UNKNOWN",
    zone: b.sntv?.a ?? "UNKNOWN",
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
      // Optimized: Leverage Map insertion order to find the least-recently checked block in O(1)
      const priorityBlockId = seatCache.keys().next().value;
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
