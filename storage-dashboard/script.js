// ============================================================
// STORAGE DASHBOARD — script.js
// Handles: data simulation, charts, server table, AI assistant
// ============================================================

// ---- Simulated Server Data ----
const servers = [
  { name: 'PROD-WEB-01', role: 'Web Server', status: 'online', storagePct: 62, cpuPct: 45, totalGB: 512, usedGB: 317 },
  { name: 'PROD-DB-01', role: 'Database', status: 'online', storagePct: 78, cpuPct: 67, totalGB: 1024, usedGB: 799 },
  { name: 'PROD-APP-01', role: 'App Server', status: 'online', storagePct: 41, cpuPct: 32, totalGB: 256, usedGB: 105 },
  { name: 'BACKUP-NAS-01', role: 'Backup Storage', status: 'online', storagePct: 55, cpuPct: 12, totalGB: 4096, usedGB: 2253 },
  { name: 'DEV-TEST-01', role: 'Dev/Test', status: 'warning', storagePct: 89, cpuPct: 78, totalGB: 128, usedGB: 114 },
  { name: 'PROD-CACHE-01', role: 'Cache Server', status: 'online', storagePct: 23, cpuPct: 55, totalGB: 64, usedGB: 15 },
];

// Aggregate stats
function computeAggregates() {
  const totalStorage = servers.reduce((s, sv) => s + sv.totalGB, 0);
  const usedStorage = servers.reduce((s, sv) => s + sv.usedGB, 0);
  const freeStorage = totalStorage - usedStorage;
  const usedPct = Math.round((usedStorage / totalStorage) * 100);
  const freePct = Math.round((freeStorage / totalStorage) * 100);
  const onlineCount = servers.filter(s => s.status === 'online').length;
  const healthScore = Math.round((onlineCount / servers.length) * 100);
  return { totalStorage, usedStorage, freeStorage, usedPct, freePct, onlineCount, healthScore };
}

// ---- Page Loader ----
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('pageLoader').classList.add('hidden');
  }, 800);
  initDashboard();
});

// ---- Init Dashboard ----
function initDashboard() {
  updateDateTime();
  setInterval(updateDateTime, 1000);
  populateStatusCards();
  populateServerTable();
  renderStorageChart();
  renderAlerts();
  initAIChat();
  updateUptime();
  setInterval(updateUptime, 60000);

  // Sidebar nav highlighting
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-nav a').forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      // Scroll to relevant section
      const id = link.id.replace('nav-', '');
      const sectionMap = {
        'overview': 'statusGrid',
        'servers': 'serverTable',
        'storage': 'storageChart',
        'backups': 'card-backup',
        'assistant': 'aiSection',
        'alerts': 'alertList',
      };
      const target = document.getElementById(sectionMap[id]);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

// ---- Live Date/Time ----
function updateDateTime() {
  const now = new Date();
  const opts = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
  document.getElementById('liveDateTime').textContent = now.toLocaleDateString('en-US', opts);
}

// ---- Uptime ----
const bootTime = Date.now() - (72 * 60 * 60 * 1000 + 14 * 60 * 1000); // 72h 14m simulated
function updateUptime() {
  const diff = Date.now() - bootTime;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  document.getElementById('sidebarUptime').textContent = `Uptime: ${days}d ${hours}h ${mins}m`;
}

// ---- Status Cards ----
function populateStatusCards() {
  const agg = computeAggregates();

  // Storage card
  animateValue('storageValue', 0, agg.usedPct, '%', 1200);
  setTimeout(() => { document.getElementById('storageBar').style.width = agg.usedPct + '%'; }, 200);
  if (agg.usedPct > 80) {
    document.getElementById('storageBadge').className = 'card-badge badge-critical';
    document.getElementById('storageBadge').textContent = 'Critical';
  } else if (agg.usedPct > 60) {
    document.getElementById('storageBadge').className = 'card-badge badge-warning';
    document.getElementById('storageBadge').textContent = 'Warning';
  }

  // Backup card
  document.getElementById('backupValue').textContent = '2h ago';
  document.getElementById('backupBar').style.width = '85%';
  document.getElementById('backupBadge').className = 'card-badge badge-online';
  document.getElementById('backupBadge').textContent = 'Healthy';

  // Free space card
  const freeGB = agg.freeStorage;
  animateValue('freespaceValue', 0, freeGB, ' GB', 1200);
  setTimeout(() => { document.getElementById('freespaceBar').style.width = agg.freePct + '%'; }, 200);
  if (agg.freePct < 20) {
    document.getElementById('freespaceBadge').className = 'card-badge badge-critical';
    document.getElementById('freespaceBadge').textContent = 'Low';
  }

  // Health card
  animateValue('healthValue', 0, agg.healthScore, '%', 1200);
  setTimeout(() => { document.getElementById('healthBar').style.width = agg.healthScore + '%'; }, 200);
  if (agg.healthScore < 80) {
    document.getElementById('healthBadge').className = 'card-badge badge-warning';
    document.getElementById('healthBadge').textContent = 'Degraded';
  }
}

function animateValue(elementId, start, end, suffix, duration) {
  const el = document.getElementById(elementId);
  const range = end - start;
  const startTime = performance.now();
  function step(ts) {
    const progress = Math.min((ts - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    el.textContent = Math.round(start + range * eased) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ---- Server Table ----
function populateServerTable() {
  const tbody = document.getElementById('serverTableBody');
  tbody.innerHTML = '';
  servers.forEach(sv => {
    const barColor = sv.storagePct > 80 ? 'var(--accent-red)' :
      sv.storagePct > 60 ? 'var(--accent-amber)' : 'var(--accent-green)';
    const statusLabel = sv.status === 'online' ? 'Online' : sv.status === 'warning' ? 'Warning' : 'Offline';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <span class="server-name">${sv.name}</span><br>
        <span style="font-size:11px;color:var(--text-muted)">${sv.role}</span>
      </td>
      <td><span class="status-dot ${sv.status}"></span>${statusLabel}</td>
      <td>
        <div class="mini-bar"><div class="mini-fill" style="width:${sv.storagePct}%;background:${barColor}"></div></div>
        ${sv.storagePct}%
      </td>
      <td>${sv.cpuPct}%</td>
    `;
    tbody.appendChild(tr);
  });
}

// ---- Chart ----
function renderStorageChart() {
  const ctx = document.getElementById('storageChart').getContext('2d');
  const labels = servers.map(s => s.name);
  const usedData = servers.map(s => s.usedGB);
  const freeData = servers.map(s => s.totalGB - s.usedGB);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Used (GB)',
          data: usedData,
          backgroundColor: 'rgba(59,130,246,0.7)',
          borderRadius: 4,
        },
        {
          label: 'Free (GB)',
          data: freeData,
          backgroundColor: 'rgba(16,185,129,0.4)',
          borderRadius: 4,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } }
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: '#64748b', font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          stacked: true,
          ticks: { color: '#64748b', font: { size: 11 }, callback: v => v + ' GB' },
          grid: { color: 'rgba(255,255,255,0.04)' }
        }
      }
    }
  });
}

// ---- Alerts ----
function renderAlerts() {
  const alerts = [
    { icon: '🔴', title: 'DEV-TEST-01 storage at 89%', detail: 'Disk usage exceeded warning threshold', time: '12 min ago' },
    { icon: '🟢', title: 'Backup completed successfully', detail: 'BACKUP-NAS-01 full backup cycle done', time: '2 hours ago' },
    { icon: '🟡', title: 'PROD-DB-01 CPU spike detected', detail: 'CPU usage hit 67% during batch job', time: '3 hours ago' },
    { icon: '🔵', title: 'Storage pool expanded', detail: 'PROD-WEB-01 added 64 GB to pool', time: '1 day ago' },
    { icon: '🟢', title: 'All health checks passed', detail: 'Scheduled health check — 6/6 servers OK', time: '1 day ago' },
  ];

  const list = document.getElementById('alertList');
  list.innerHTML = '';
  alerts.forEach(a => {
    const div = document.createElement('div');
    div.className = 'alert-item';
    div.innerHTML = `
      <span class="alert-icon">${a.icon}</span>
      <div class="alert-text"><strong>${a.title}</strong><span>${a.detail}</span></div>
      <span class="alert-time">${a.time}</span>
    `;
    list.appendChild(div);
  });
}

// ============================================================
// AI TROUBLESHOOTING ASSISTANT (with guardrails)
// ============================================================

const AI_NAME = 'StorageBot';

// Guardrail: allowed topics
const ALLOWED_TOPICS = [
  'storage', 'disk', 'backup', 'restore', 'raid', 'nas', 'san',
  'free space', 'capacity', 'volume', 'partition', 'mount',
  'server', 'cpu', 'memory', 'ram', 'health', 'uptime',
  'troubleshoot', 'slow', 'error', 'failure', 'crash',
  'log', 'alert', 'warning', 'critical', 'performance',
  'snapshot', 'replication', 'deduplication', 'compression',
  'iops', 'latency', 'throughput', 'bandwidth',
  'file system', 'ntfs', 'ext4', 'zfs', 'lvm',
  'defragment', 'fragmentation', 'quota', 'cleanup',
  'ssh', 'remote', 'monitoring', 'nagios', 'zabbix',
  'temperature', 'smart', 'firmware', 'hardware',
  'cloud', 'azure', 'aws', 's3', 'blob',
  'help', 'how', 'what', 'why', 'check', 'fix', 'status', 'overview',
  'hi', 'hello', 'hey'
];

// Check if query is within guardrails
function isOnTopic(query) {
  const lower = query.toLowerCase();
  return ALLOWED_TOPICS.some(topic => lower.includes(topic));
}

// Knowledge base for troubleshooting responses — using functions for dynamic data
function getKBEntry(key) {
  const agg = computeAggregates();
  const entries = {
    'high storage': {
      answer: `Here's a step-by-step approach to tackle high storage usage:\n\n1. **Identify large files** — Run a disk usage scan (e.g., \`du -sh /*\` on Linux or TreeSize on Windows)\n2. **Check log files** — Logs often grow unchecked: \`/var/log\`, application logs, database logs\n3. **Review old backups** — Remove outdated local backup copies\n4. **Clear temp files** — Flush \`/tmp\`, recycle bins, and browser caches\n5. **Compress infrequently used data** — Use gzip/zstd for archival data\n6. **Set up disk quotas** — Prevent users from consuming excessive space\n\n📊 **Current status:** Your aggregate storage is at **${agg.usedPct}%** used.`,
      topics: ['storage', 'high', 'full', 'usage', 'disk space', 'running out']
    },
    'backup status': {
      answer: '☁️ **Backup Status Overview:**\n\n• **Last Full Backup:** 2 hours ago — ✅ Completed\n• **Backup Target:** BACKUP-NAS-01 (4 TB NAS)\n• **Backup Used:** 2,253 GB / 4,096 GB (55%)\n• **Backup Schedule:** Full daily at 02:00, incremental every 4h\n• **Retention:** 30-day rolling window\n\n**Recommendations:**\n- Verify backup integrity with periodic restore tests\n- Monitor NAS capacity — currently at 55%\n- Consider offsite/cloud replication for DR',
      topics: ['backup', 'restore', 'recovery', 'snapshot']
    },
    'slow server': {
      answer: '🐢 **Server Slowness Troubleshooting:**\n\n1. **Check CPU usage** — High CPU can bottleneck I/O:\n   - Linux: \`top\`, \`htop\`\n   - Windows: Task Manager → Performance\n\n2. **Check Disk I/O** — Look for I/O wait:\n   - \`iostat -x 1\` or \`iotop\`\n   - High await times indicate disk problems\n\n3. **Memory pressure** — Swapping kills performance:\n   - \`free -h\` — check swap usage\n   - Windows: Resource Monitor → Memory\n\n4. **Network latency** — Test with \`ping\` and \`traceroute\`\n\n5. **Application logs** — Check for errors/exceptions\n\n6. **Storage fragmentation** — Defrag if on HDD\n\n⚡ **Quick wins:** Restart stuck services, clear caches, check for runaway processes.',
      topics: ['slow', 'performance', 'lag', 'latency', 'speed']
    },
    'free disk space': {
      answer: '🧹 **How to Free Up Disk Space:**\n\n| Action | Expected Savings |\n|--------|------------------|\n| Clear temp files | 2-10 GB |\n| Rotate & compress logs | 5-50 GB |\n| Remove old packages/updates | 1-5 GB |\n| Delete orphaned snapshots | 10-100 GB |\n| Clean Docker images | 5-30 GB |\n| Archive cold data to NAS/cloud | Variable |\n\n**Commands:**\n- Linux: \`sudo apt autoremove\`, \`journalctl --vacuum-time=7d\`\n- Windows: Disk Cleanup, \`cleanmgr /d C:\`\n- Docker: \`docker system prune -a\`',
      topics: ['free', 'cleanup', 'clean', 'space', 'delete', 'remove']
    },
    'raid': {
      answer: '🔧 **RAID Configuration Overview:**\n\n| Level | Min Disks | Fault Tolerance | Performance |\n|-------|-----------|-----------------|-------------|\n| RAID 0 | 2 | None ❌ | Excellent read/write |\n| RAID 1 | 2 | 1 disk failure ✅ | Good read, normal write |\n| RAID 5 | 3 | 1 disk failure ✅ | Good read, slower write |\n| RAID 6 | 4 | 2 disk failures ✅ | Good read, slow write |\n| RAID 10 | 4 | 1 per mirror ✅ | Excellent all |\n\n**Best practices:**\n- Use RAID 10 for databases\n- RAID 5/6 for file servers\n- Always maintain hot spares\n- RAID is NOT a backup — always pair with backup strategy',
      topics: ['raid', 'redundancy', 'mirror', 'stripe']
    },
    'disk health': {
      answer: `❤️ **Disk Health Check Guide:**\n\n1. **S.M.A.R.T. Status** — Check for pre-failure indicators:\n   - Linux: \`smartctl -a /dev/sda\`\n   - Windows: CrystalDiskInfo\n\n2. **Key SMART metrics to watch:**\n   - Reallocated Sectors Count\n   - Current Pending Sector Count\n   - Temperature (> 55°C is concerning)\n   - Power-On Hours\n\n3. **File system integrity:**\n   - Linux: \`fsck\` (unmounted) or \`e2fsck\`\n   - Windows: \`chkdsk /f\`\n\n4. **Current server health score:** The dashboard shows overall health at **${agg.healthScore}%**\n\n⚠️ Replace disks proactively when SMART shows degradation.`,
      topics: ['health', 'smart', 'disk check', 'diagnostic', 'drive']
    },
    'hello': {
      answer: `👋 Hello! I'm **${AI_NAME}**, your AI storage and server troubleshooting assistant.\n\nI can help you with:\n• 💾 Storage usage analysis\n• ☁️ Backup status & management\n• 🐢 Server performance issues\n• 🧹 Disk cleanup recommendations\n• 🔧 RAID configuration\n• ❤️ Disk health diagnostics\n\nJust type your question or click a quick action above!`,
      topics: ['hi', 'hello', 'hey', 'help', 'what can you do']
    },
    'general': {
      answer: `Based on the current dashboard data:\n\n• **Aggregate Storage:** ${agg.usedPct}% used across ${servers.length} servers\n• **Free Space:** ${agg.freeStorage} GB available\n• **Servers Online:** ${agg.onlineCount}/${servers.length}\n• **Health Score:** ${agg.healthScore}%\n\nCan you tell me more specifically what you need help with? For example:\n- Storage capacity planning\n- Backup verification\n- Performance troubleshooting`,
      topics: ['status', 'overview', 'check', 'summary', 'how']
    }
  };
  return key ? entries[key] : entries;
}

function findBestResponse(query) {
  const lower = query.toLowerCase();
  const entries = getKBEntry();
  let bestMatch = null;
  let bestScore = 0;

  for (const [key, entry] of Object.entries(entries)) {
    let score = 0;
    for (const topic of entry.topics) {
      if (lower.includes(topic)) score += topic.length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  return bestMatch ? bestMatch.answer : getKBEntry('general').answer;
}

const GUARDRAIL_RESPONSE = `🛡️ I appreciate your question, but I'm specifically designed to help with **storage, backup, and server troubleshooting** topics only.\n\nHere are some things I can help with:\n• Storage usage and capacity planning\n• Backup status and restore procedures\n• Server performance troubleshooting\n• Disk health diagnostics\n• RAID configuration guidance\n\nPlease ask me something related to these topics!`;

// ---- Chat UI Logic ----
function initAIChat() {
  const msgContainer = document.getElementById('chatMessages');
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');

  // Welcome message
  addMessage('ai', `👋 Hi! I'm **${AI_NAME}**, your AI troubleshooting assistant. Ask me about storage, backups, server health, or click a quick action below to get started.`);

  // Quick action chips
  document.querySelectorAll('.quick-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const query = chip.getAttribute('data-query');
      input.value = query;
      handleSend();
    });
  });

  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSend();
  });

  function handleSend() {
    const query = input.value.trim();
    if (!query) return;

    addMessage('user', query);
    input.value = '';

    // Show typing indicator
    const typingId = showTyping();

    // Simulate AI "thinking" delay
    const delay = 600 + Math.random() * 1000;
    setTimeout(() => {
      removeTyping(typingId);
      if (isOnTopic(query)) {
        const response = findBestResponse(query);
        addMessage('ai', response);
      } else {
        addMessage('ai', GUARDRAIL_RESPONSE);
      }
    }, delay);
  }
}

function addMessage(role, text) {
  const container = document.getElementById('chatMessages');
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Convert markdown-like formatting to HTML
  let html = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\`([^`]+)\`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:3px;font-size:12px">$1</code>')
    .replace(/\n/g, '<br>');

  // Handle tables (simple markdown table → HTML)
  if (html.includes('|')) {
    html = html.replace(/((?:\|[^\n<]+\|(?:<br>)?)+)/g, (tableBlock) => {
      const rows = tableBlock.split('<br>').filter(r => r.trim() && !r.match(/^\|[\s-|]+\|$/));
      if (rows.length < 2) return tableBlock;
      let table = '<table style="width:100%;font-size:12px;margin:8px 0;border-collapse:collapse">';
      rows.forEach((row, i) => {
        const cells = row.split('|').filter(c => c.trim());
        const tag = i === 0 ? 'th' : 'td';
        const style = i === 0
          ? 'style="text-align:left;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.1);color:var(--accent-blue)"'
          : 'style="padding:5px 8px;border-bottom:1px solid rgba(255,255,255,0.05)"';
        table += '<tr>' + cells.map(c => `<${tag} ${style}>${c.trim()}</${tag}>`).join('') + '</tr>';
      });
      table += '</table>';
      return table;
    });
  }

  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${role}`;
  msgDiv.innerHTML = `
    <div class="msg-avatar">${role === 'ai' ? '🤖' : '👤'}</div>
    <div class="msg-bubble">
      ${html}
      <span class="msg-time">${timeStr}</span>
    </div>
  `;
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

function showTyping() {
  const container = document.getElementById('chatMessages');
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.className = 'chat-msg ai';
  div.id = id;
  div.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-bubble">
      <div class="typing-indicator"><span></span><span></span><span></span></div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}