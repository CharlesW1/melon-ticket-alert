// Melon Ticket Global - Browser Console Seat Monitor
// Paste this into your browser console while on the tkglobal.melon.com reservation page

// Configure these with your event's values
const MELON_CONFIG = {
  prodId: "event_prod_id",           // e.g. "212638"
  scheduleNo: "event_schedule_no",   // e.g. "100001"
  pocCode: "event_poc_code",         // e.g. "SC0002"
  checkInterval: 10000               // 10 seconds
};

const DISCORD_CONFIG = {
  webhookUrl: "your_discord_webhook_url",  // Optional - leave empty to disable
  userId: "your_discord_user_id"           // Optional - for mentions
};

async function melonSendDiscord(message) {
  if (!DISCORD_CONFIG.webhookUrl || DISCORD_CONFIG.webhookUrl === "your_discord_webhook_url") {
    console.log('Discord webhook not configured, skipping notification');
    return;
  }
  const tag = (DISCORD_CONFIG.userId && DISCORD_CONFIG.userId !== "your_discord_user_id") 
    ? `<@${DISCORD_CONFIG.userId}>` 
    : '';
  await fetch(DISCORD_CONFIG.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: `${tag} ${message}` })
  });
}

async function melonGetBlockList() {
  const url = `https://tkglobal.melon.com/tktapi/product/getAreaMap.json?callback=getBlockGradeSeatMapCallBack&v=1&prodId=${MELON_CONFIG.prodId}&scheduleNo=${MELON_CONFIG.scheduleNo}&pocCode=${MELON_CONFIG.pocCode}`;
  const response = await fetch(url);
  const text = await response.text();
  const data = JSON.parse(text.replace("/**/getBlockGradeSeatMapCallBack(", "").replace(");", ""));
  return data.seatData.da.sb;
}

async function melonCheckBlock(block) {
  const url = `https://tkglobal.melon.com/tktapi/product/seat/seatMapList.json?callback=getSeatListCallBack&v=1&prodId=${MELON_CONFIG.prodId}&scheduleNo=${MELON_CONFIG.scheduleNo}&blockId=${block.sbid}&pocCode=${MELON_CONFIG.pocCode}&corpCodeNo=`;
  const response = await fetch(url);
  const text = await response.text();
  const data = JSON.parse(text.replace("/**/getSeatListCallBack(", "").replace(");", ""));
  
  if (data.seatData) {
    return data.seatData.st[0].ss.filter(s => s.sid !== null).length;
  }
  return 0;
}

async function melonCheckAllSeats() {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n[${timestamp}] Starting check...`);
  
  try {
    const blocks = await melonGetBlockList();
    let totalFound = 0;
    let foundZones = [];
    
    for (const block of blocks) {
      const zoneName = block.sntv?.a || `Block ${block.sbid}`;
      const available = await melonCheckBlock(block);
      
      if (available > 0) {
        console.log(`  ✅ ${zoneName}: ${available} seats available!`);
        totalFound += available;
        foundZones.push(`${zoneName}: ${available}`);
      } else {
        console.log(`  ⬚ ${zoneName}: 0 seats`);
      }
    }
    
    console.log(`[${timestamp}] Done. Checked ${blocks.length} blocks, ${totalFound} total seats found.`);
    
    if (totalFound > 0) {
      alert(`🎫 ${totalFound} TOTAL SEATS AVAILABLE!`);
      await melonSendDiscord(`🎫 ${totalFound} SEATS AVAILABLE!\n${foundZones.join('\n')}`);
    }
  } catch (e) {
    console.error('Check failed:', e);
  }
}

// Start monitoring
const melonMonitorInterval = setInterval(melonCheckAllSeats, MELON_CONFIG.checkInterval);
melonCheckAllSeats();
console.log('🔍 Monitoring ALL blocks! Keep this tab open.');
console.log('To stop monitoring: clearInterval(melonMonitorInterval)');
