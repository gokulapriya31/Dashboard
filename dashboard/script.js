// ============================================================
// DASHBOARD v3.0 — script.js
// Role-Based Access Control + Premium Features
// ============================================================

const APP_CONFIG = {
  appName: 'Dashboard', version: '4.0.0',
  refreshIntervalDefault: 60,
  sessionKey: 'dashboard_session', auditKey: 'dashboard_audit', settingsKey: 'dashboard_settings',
  ticketsKey: 'dashboard_tickets',
  thresholds: { storageCritical: 80, storageWarning: 60, cpuHigh: 75, memHigh: 80, healthDegraded: 80 }
};

// ============================================================
// RBAC — Role-Based Access Control
// ============================================================
const USERS = {
  admin: { password: 'admin123', name: 'Admin User', role: 'admin', avatar: 'A' },
  operator: { password: 'ops456', name: 'Ops Operator', role: 'operator', avatar: 'O' },
  viewer: { password: 'view789', name: 'View Only', role: 'viewer', avatar: 'V' },
};

const ROLE_LABELS = { admin: 'Administrator', operator: 'Operator', viewer: 'Read-Only Viewer' };

// Permission matrix: what each role can do
const PERMISSIONS = {
  admin: {
    canView: true, canExport: true, canTroubleshoot: true,
    canCreateIncident: true, canResolveAlerts: true, canRunActions: true,
    canAccessAI: true, canChangeSettings: true, canViewAudit: true,
    canRunBackup: true, canRestart: true, canConfig: true,
    navItems: ['overview', 'servers', 'storage', 'backups', 'alerts', 'tracker', 'assistant', 'auditlog'],
    quickActions: ['backup', 'healthcheck', 'logs', 'export', 'restart', 'config'],
  },
  operator: {
    canView: true, canExport: true, canTroubleshoot: true,
    canCreateIncident: false, canResolveAlerts: true, canRunActions: true,
    canAccessAI: true, canChangeSettings: false, canViewAudit: false,
    canRunBackup: true, canRestart: false, canConfig: false,
    navItems: ['overview', 'servers', 'storage', 'backups', 'alerts', 'tracker', 'assistant'],
    quickActions: ['backup', 'healthcheck', 'logs', 'export'],
  },
  viewer: {
    canView: true, canExport: false, canTroubleshoot: false,
    canCreateIncident: false, canResolveAlerts: false, canRunActions: false,
    canAccessAI: false, canChangeSettings: false, canViewAudit: false,
    canRunBackup: false, canRestart: false, canConfig: false,
    navItems: ['overview', 'servers', 'storage', 'backups', 'alerts'],
    quickActions: ['healthcheck'],
  },
};

// Check permission for current user
function hasPermission(perm) {
  if (!currentUser) return false;
  return PERMISSIONS[currentUser.role]?.[perm] ?? false;
}

function hasNavAccess(view) {
  if (!currentUser) return false;
  return PERMISSIONS[currentUser.role]?.navItems?.includes(view) ?? false;
}

let currentUser = null, currentPage = 'login', currentView = 'overview';
let refreshTimer = null, refreshCountdown = APP_CONFIG.refreshIntervalDefault;
let storageChartInstance = null, chatInited = {}, dashInited = false;
let alertFilter = 'all', ticketFilter = 'all';
// In-memory alert state tracking (id -> {state, worknotes[]})
let alertStates = {};

// ============================================================
// STORAGE API
// ============================================================
class StorageAPI {
  static getServers() {
    return [
      { name: 'PROD-WEB-01', role: 'Web Server', status: 'online', storagePct: 62, cpuPct: 45, memPct: 58, iops: 1250, totalGB: 512, usedGB: 317 },
      { name: 'PROD-DB-01', role: 'Database', status: 'online', storagePct: 78, cpuPct: 67, memPct: 72, iops: 3400, totalGB: 1024, usedGB: 799 },
      { name: 'PROD-APP-01', role: 'App Server', status: 'online', storagePct: 41, cpuPct: 32, memPct: 44, iops: 890, totalGB: 256, usedGB: 105 },
      { name: 'BACKUP-NAS-01', role: 'Backup Storage', status: 'online', storagePct: 55, cpuPct: 12, memPct: 28, iops: 420, totalGB: 4096, usedGB: 2253 },
      { name: 'DEV-TEST-01', role: 'Dev/Test', status: 'warning', storagePct: 89, cpuPct: 78, memPct: 82, iops: 2100, totalGB: 128, usedGB: 114 },
      { name: 'PROD-CACHE-01', role: 'Cache Server', status: 'online', storagePct: 23, cpuPct: 55, memPct: 61, iops: 5600, totalGB: 64, usedGB: 15 },
    ];
  }
  static getAlerts() {
    return [
      { id: 1, title: 'DEV-TEST-01 storage at 89%', detail: 'Disk usage exceeded critical threshold', time: '12 min ago', severity: 'critical', server: 'DEV-TEST-01' },
      { id: 2, title: 'PROD-DB-01 replication lag', detail: 'Database replication lag exceeds 30s', time: '45 min ago', severity: 'critical', server: 'PROD-DB-01' },
      { id: 3, title: 'PROD-DB-01 CPU spike detected', detail: 'CPU hit 67% during batch job — known ETL issue', time: '3h ago', severity: 'warning', server: 'PROD-DB-01' },
      { id: 4, title: 'PROD-CACHE-01 cache hit ratio low', detail: 'Cache hit ratio dropped to 72%', time: '4h ago', severity: 'warning', server: 'PROD-CACHE-01' },
      { id: 5, title: 'Backup completed successfully', detail: 'BACKUP-NAS-01 full backup done', time: '2h ago', severity: 'info', server: 'BACKUP-NAS-01' },
      { id: 6, title: 'Temp files auto-cleaned', detail: 'Freed 3.2 GB on PROD-WEB-01', time: '5h ago', severity: 'info', server: 'PROD-WEB-01' },
      { id: 7, title: 'All health checks passed', detail: '6/6 servers OK', time: '1d ago', severity: 'info', server: 'ALL' },
      { id: 8, title: 'Storage pool expanded', detail: 'PROD-WEB-01 +64 GB', time: '1d ago', severity: 'info', server: 'PROD-WEB-01' },
    ];
  }
  static getBackups() {
    return [
      { server: 'PROD-WEB-01', lastBackup: '2h ago', type: 'Full', size: '285 GB', status: 'success', next: 'Tomorrow 02:00' },
      { server: 'PROD-DB-01', lastBackup: '4h ago', type: 'Incremental', size: '48 GB', status: 'success', next: 'Today 22:00' },
      { server: 'PROD-APP-01', lastBackup: '6h ago', type: 'Full', size: '92 GB', status: 'success', next: 'Tomorrow 02:00' },
      { server: 'BACKUP-NAS-01', lastBackup: '2h ago', type: 'Mirror', size: '2.2 TB', status: 'success', next: 'Tomorrow 02:00' },
      { server: 'DEV-TEST-01', lastBackup: '1d ago', type: 'Full', size: '105 GB', status: 'warning', next: 'Overdue' },
      { server: 'PROD-CACHE-01', lastBackup: '12h ago', type: 'Snapshot', size: '12 GB', status: 'success', next: 'Today 18:00' },
    ];
  }
  static getActivities() {
    return [
      { color: 'green', title: 'Backup completed', detail: 'BACKUP-NAS-01 full backup', time: '2h ago' },
      { color: 'blue', title: 'Storage pool expanded', detail: 'PROD-WEB-01 +64 GB', time: '4h ago' },
      { color: 'amber', title: 'CPU spike detected', detail: 'PROD-DB-01 batch job', time: '5h ago' },
      { color: 'red', title: 'DEV-TEST-01 storage warning', detail: '89% usage', time: '6h ago' },
      { color: 'green', title: 'Health check passed', detail: '6/6 servers healthy', time: '1d ago' },
      { color: 'purple', title: 'Firmware updated', detail: 'PROD-CACHE-01 v3.2.1', time: '2d ago' },
    ];
  }
  static computeAggregates() {
    const svrs = this.getServers();
    const tot = svrs.reduce((s, v) => s + v.totalGB, 0), used = svrs.reduce((s, v) => s + v.usedGB, 0);
    const free = tot - used, usedP = Math.round(used / tot * 100), freeP = Math.round(free / tot * 100);
    const on = svrs.filter(s => s.status === 'online').length;
    return { totalStorage: tot, usedStorage: used, freeStorage: free, usedPct: usedP, freePct: freeP, onlineCount: on, healthScore: Math.round(on / svrs.length * 100), totalServers: svrs.length };
  }
}

// ============================================================
// PARTICLES
// ============================================================
function initParticles() {
  const c = document.getElementById('particleCanvas'); if (!c) return;
  const ctx = c.getContext('2d'); let ps = [];
  function resize() { c.width = innerWidth; c.height = innerHeight; } resize(); addEventListener('resize', resize);
  class P {
    constructor() { this.reset() } reset() { this.x = Math.random() * c.width; this.y = Math.random() * c.height; this.s = Math.random() * 2 + .5; this.sx = (Math.random() - .5) * .4; this.sy = (Math.random() - .5) * .4; this.o = Math.random() * .4 + .1 }
    update() { this.x += this.sx; this.y += this.sy; if (this.x < 0 || this.x > c.width) this.sx *= -1; if (this.y < 0 || this.y > c.height) this.sy *= -1 }
    draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.s, 0, Math.PI * 2); ctx.fillStyle = `rgba(59,130,246,${this.o})`; ctx.fill() }
  }
  for (let i = 0; i < 60; i++)ps.push(new P());
  (function loop() {
    ctx.clearRect(0, 0, c.width, c.height); ps.forEach(p => { p.update(); p.draw() });
    for (let i = 0; i < ps.length; i++)for (let j = i + 1; j < ps.length; j++) { const dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y, d = Math.sqrt(dx * dx + dy * dy); if (d < 150) { ctx.beginPath(); ctx.moveTo(ps[i].x, ps[i].y); ctx.lineTo(ps[j].x, ps[j].y); ctx.strokeStyle = `rgba(59,130,246,${.08 * (1 - d / 150)})`; ctx.lineWidth = .5; ctx.stroke() } }
    requestAnimationFrame(loop);
  })();
}

// ============================================================
// TOAST / AUDIT
// ============================================================
function showToast(msg, type = 'info', title = '') {
  const c = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const t = document.createElement('div'); t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><div class="toast-text">${title ? `<strong>${title}</strong>` : ''}${msg}</div><button class="toast-close" onclick="this.parentElement.classList.add('toast-out');setTimeout(()=>this.parentElement.remove(),300)">✕</button>`;
  c.appendChild(t);
  setTimeout(() => { if (t.parentElement) { t.classList.add('toast-out'); setTimeout(() => t.remove(), 300) } }, 4000);
}
function auditLog(action, details = '') {
  const log = JSON.parse(localStorage.getItem(APP_CONFIG.auditKey) || '[]');
  log.push({ timestamp: new Date().toISOString(), user: currentUser?.name || 'Anon', role: currentUser?.role || '', action, details });
  if (log.length > 200) log.splice(0, log.length - 200);
  localStorage.setItem(APP_CONFIG.auditKey, JSON.stringify(log));
}

// ============================================================
// AUTH
// ============================================================
function attemptLogin(u, p) {
  const user = USERS[u.toLowerCase()];
  if (user && user.password === p) { currentUser = { ...user, username: u.toLowerCase() }; localStorage.setItem(APP_CONFIG.sessionKey, JSON.stringify({ username: currentUser.username, loginTime: Date.now() })); auditLog('LOGIN', `${currentUser.name} (${currentUser.role})`); return true; }
  return false;
}
function restoreSession() {
  const s = JSON.parse(localStorage.getItem(APP_CONFIG.sessionKey));
  if (s?.username && USERS[s.username]) { currentUser = { ...USERS[s.username], username: s.username }; return true; } return false;
}
function logout() { auditLog('LOGOUT', currentUser?.name); currentUser = null; localStorage.removeItem(APP_CONFIG.sessionKey); if (refreshTimer) clearInterval(refreshTimer); chatInited = {}; dashInited = false; navigateTo('login'); showToast('Signed out.', 'info'); }

// ============================================================
// RBAC — Apply Visibility
// ============================================================
function applyRBAC() {
  if (!currentUser) return;
  const role = currentUser.role;
  // Admin-only elements
  document.querySelectorAll('.rbac-admin').forEach(el => {
    el.classList.toggle('rbac-hidden', role !== 'admin');
  });
  // Hide for viewers (show for admin + operator)
  document.querySelectorAll('.rbac-no-viewer').forEach(el => {
    el.classList.toggle('rbac-hidden', role === 'viewer');
  });
  // Show only for viewers
  document.querySelectorAll('.rbac-viewer-only').forEach(el => {
    el.style.display = role === 'viewer' ? 'flex' : 'none';
  });
  // Role chips
  document.querySelectorAll('.role-chip').forEach(chip => {
    chip.className = `role-chip role-${role}`;
    chip.textContent = ROLE_LABELS[role] || role;
  });
}

// ============================================================
// NAVIGATION
// ============================================================
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const t = document.getElementById('page' + page.charAt(0).toUpperCase() + page.slice(1));
  if (t) { t.classList.add('active'); currentPage = page; }
  document.getElementById('particleCanvas').style.display = page === 'login' ? 'block' : 'none';
  if (page === 'home') initHomePage();
  if (page === 'dashboard') initDashboard();
}

// ============================================================
// INIT
// ============================================================
window.addEventListener('load', () => {
  initParticles();
  setTimeout(() => document.getElementById('pageLoader').classList.add('hidden'), 800);
  if (restoreSession()) navigateTo('home'); else navigateTo('login');
  initLoginPage(); initIncidentModal(); initSettingsModal(); initWorknoteModal();
});

// ============================================================
// LOGIN
// ============================================================
function initLoginPage() {
  const form = document.getElementById('loginForm'), err = document.getElementById('loginError'), btn = document.getElementById('loginBtn');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const u = document.getElementById('loginUsername').value.trim(), p = document.getElementById('loginPassword').value.trim();
    err.textContent = ''; document.getElementById('fg-username').classList.remove('error'); document.getElementById('fg-password').classList.remove('error');
    if (!u) { document.getElementById('fg-username').classList.add('error'); err.textContent = 'Enter username.'; return; }
    if (!p) { document.getElementById('fg-password').classList.add('error'); err.textContent = 'Enter password.'; return; }
    btn.classList.add('loading'); btn.disabled = true;
    setTimeout(() => {
      if (attemptLogin(u, p)) { showToast(`Welcome, ${currentUser.name}!`, 'success', 'Login Successful'); navigateTo('home'); }
      else { err.textContent = 'Invalid credentials.'; document.getElementById('fg-username').classList.add('error'); document.getElementById('fg-password').classList.add('error'); }
      btn.classList.remove('loading'); btn.disabled = false;
    }, 800);
  });
  document.querySelectorAll('.demo-user').forEach(b => b.addEventListener('click', () => { document.getElementById('loginUsername').value = b.dataset.user; document.getElementById('loginPassword').value = b.dataset.pass; }));
}

// ============================================================
// HOME PAGE
// ============================================================
function initHomePage() {
  if (!currentUser) return;
  applyRBAC();
  document.getElementById('homeUserAvatar').textContent = currentUser.avatar;
  document.getElementById('homeUserName').textContent = currentUser.name;
  const h = new Date().getHours();
  document.getElementById('welcomeTitle').textContent = `${h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}, ${currentUser.name} 👋`;
  const agg = StorageAPI.computeAggregates(), alerts = StorageAPI.getAlerts();
  const crit = alerts.filter(a => a.severity === 'critical').length;
  document.getElementById('welcomeSubtitle').textContent = crit > 0 ? `⚠️ ${crit} critical alert(s) requiring attention.` : 'All systems running normally.';
  document.getElementById('hstatServers').textContent = `${agg.onlineCount}/${agg.totalServers}`;
  document.getElementById('hstatStorage').textContent = `${(agg.totalStorage / 1024).toFixed(1)} TB`;
  document.getElementById('hstatHealth').textContent = `${agg.healthScore}%`;
  document.getElementById('hstatAlerts').textContent = alerts.length;

  // Welcome role info
  const roleInfo = document.getElementById('welcomeRoleInfo');
  const perms = PERMISSIONS[currentUser.role];
  const permList = [
    ['View Data', perms.canView], ['Export', perms.canExport], ['Troubleshoot', perms.canTroubleshoot],
    ['Create Incident', perms.canCreateIncident], ['AI Assistant', perms.canAccessAI], ['Settings', perms.canChangeSettings]
  ];
  roleInfo.innerHTML = `<span class="role-chip role-${currentUser.role}">${ROLE_LABELS[currentUser.role]}</span>` +
    permList.map(([name, ok]) => `<span class="welcome-perm"><span class="${ok ? 'perm-yes' : 'perm-no'}">${ok ? '✓' : '✕'}</span> ${name}</span>`).join('');

  updateHomeDatetime(); setInterval(updateHomeDatetime, 1000);

  // Activity timeline
  const tl = document.getElementById('activityTimeline'); tl.innerHTML = '';
  StorageAPI.getActivities().forEach(a => { const d = document.createElement('div'); d.className = 'activity-item'; d.innerHTML = `<div class="activity-dot ${a.color}"></div><div class="activity-text"><strong>${a.title}</strong><span>${a.detail}</span></div><span class="activity-time">${a.time}</span>`; tl.appendChild(d); });

  // Build nav grid based on role
  buildHomeNavGrid();
  buildQuickActions();

  document.getElementById('homeLogoutBtn').onclick = logout;
}

function buildHomeNavGrid() {
  const grid = document.getElementById('homeNavGrid'); grid.innerHTML = '';
  const items = [
    { id: 'overview', icon: '📊', bg: 'var(--gradient-blue)', title: 'Overview', desc: 'Infrastructure overview & health highlights' },
    { id: 'servers', icon: '🖥️', bg: 'var(--gradient-green)', title: 'Servers', desc: 'Server details' + (hasPermission('canAccessAI') ? ' with AI assistant' : '') },
    { id: 'storage', icon: '💽', bg: 'var(--gradient-purple)', title: 'Storage', desc: 'Storage metrics' + (hasPermission('canAccessAI') ? ' with AI assistant' : '') },
    { id: 'backups', icon: '☁️', bg: 'var(--gradient-amber)', title: 'Backups', desc: 'Backup status' + (hasPermission('canAccessAI') ? ' with AI assistant' : '') },
    { id: 'alerts', icon: '🔔', bg: 'var(--gradient-red)', title: 'Alerts', desc: hasPermission('canResolveAlerts') ? 'Alert management & incidents' : 'View alerts (read-only)' },
    { id: 'tracker', icon: '📋', bg: 'linear-gradient(135deg,#6366f1,#8b5cf6)', title: 'Ticket Tracker', desc: 'INC / CRQ / Vendor case tracking' },
    { id: 'assistant', icon: '🤖', bg: 'linear-gradient(135deg,#8b5cf6,#ec4899)', title: 'AI Assistant', desc: 'General troubleshooting', perm: 'canAccessAI' },
    { id: 'auditlog', icon: '📋', bg: 'linear-gradient(135deg,#64748b,#475569)', title: 'Audit Log', desc: 'View all user activity', perm: 'canViewAudit' },
  ];
  items.forEach(item => {
    if (item.perm && !hasPermission(item.perm)) return;
    if (!hasNavAccess(item.id)) return;
    const btn = document.createElement('button'); btn.className = 'nav-card'; btn.dataset.goto = item.id;
    btn.innerHTML = `<div class="nav-card-icon" style="background:${item.bg}">${item.icon}</div><div class="nav-card-text"><h3>${item.title}</h3><p>${item.desc}</p></div><span class="nav-arrow">→</span>`;
    btn.onclick = () => { navigateTo('dashboard'); setTimeout(() => switchView(item.id), 200); };
    grid.appendChild(btn);
  });
}

function buildQuickActions() {
  const grid = document.getElementById('quickActionGrid'), notice = document.getElementById('roleNotice');
  grid.innerHTML = '';
  const actions = [
    { id: 'backup', icon: '☁️', label: 'Run Backup', perm: 'canRunBackup' },
    { id: 'healthcheck', icon: '❤️', label: 'Health Check', perm: 'canView' },
    { id: 'logs', icon: '📋', label: 'View Logs', perm: 'canTroubleshoot' },
    { id: 'export', icon: '📥', label: 'Export Report', perm: 'canExport' },
    { id: 'restart', icon: '🔄', label: 'Restart Service', perm: 'canRestart' },
    { id: 'config', icon: '⚙️', label: 'Settings', perm: 'canChangeSettings' },
  ];
  const allowed = PERMISSIONS[currentUser.role].quickActions;
  actions.forEach(a => {
    const ok = hasPermission(a.perm) && allowed.includes(a.id);
    const btn = document.createElement('button');
    btn.className = `qaction-btn${ok ? '' : ' disabled'}`; btn.id = `qa-${a.id}`;
    btn.innerHTML = `${ok ? '' : '<span class="lock-badge">🔒</span>'}<span class="qaction-icon">${a.icon}</span><span class="qaction-label">${a.label}</span>`;
    if (ok) {
      btn.onclick = () => {
        if (a.id === 'backup') { showToast('Backup initiated…', 'success', 'Backup Started'); auditLog('ACTION', 'Manual backup'); }
        if (a.id === 'healthcheck') { showToast('Running health check…', 'info'); setTimeout(() => showToast('All servers passed.', 'success', 'Health Check'), 2000); }
        if (a.id === 'logs') { navigateTo('dashboard'); setTimeout(() => switchView('alerts'), 200); }
        if (a.id === 'export') exportToCSV();
        if (a.id === 'restart') { showToast('Service restart scheduled.', 'warning', 'Restart'); auditLog('ACTION', 'Service restart'); }
        if (a.id === 'config') openSettingsModal();
      };
    }
    grid.appendChild(btn);
  });
  notice.innerHTML = `<span>🔐</span> Logged in as <strong>${ROLE_LABELS[currentUser.role]}</strong> — ${currentUser.role === 'admin' ? 'Full access granted.' : currentUser.role === 'operator' ? 'Troubleshooting & operator actions enabled.' : 'Read-only access. Actions are restricted.'}`;
}

function updateHomeDatetime() { const el = document.getElementById('homeLiveDateTime'); if (el) el.textContent = new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }

// ============================================================
// DASHBOARD
// ============================================================
function initDashboard() {
  if (!currentUser) return;
  applyRBAC();
  document.getElementById('sidebarAvatar').textContent = currentUser.avatar;
  document.getElementById('sidebarUserName').textContent = currentUser.name;
  document.getElementById('sidebarUserRole').textContent = ROLE_LABELS[currentUser.role];
  updateDateTime(); setInterval(updateDateTime, 1000);
  updateUptime(); setInterval(updateUptime, 60000);
  buildSidebarNav();
  setupAutoRefresh();
  setupMobileMenu();
  document.getElementById('btnHomePage').onclick = () => navigateTo('home');
  document.getElementById('btnLogout').onclick = logout;
  document.getElementById('btnSettings').onclick = openSettingsModal;
  if (!dashInited) { dashInited = true; switchView('overview'); }
}

function buildSidebarNav() {
  const list = document.getElementById('sidebarNavList'); list.innerHTML = '';
  const items = [
    { id: 'overview', icon: '📊', label: 'Overview' },
    { id: 'servers', icon: '🖥️', label: 'Servers' },
    { id: 'storage', icon: '💽', label: 'Storage' },
    { id: 'backups', icon: '☁️', label: 'Backups' },
    { id: 'alerts', icon: '🔔', label: 'Alerts', badge: true },
    { id: 'tracker', icon: '📋', label: 'Tracker', ticketBadge: true },
    { id: 'assistant', icon: '🤖', label: 'AI Assistant' },
    { id: 'auditlog', icon: '📋', label: 'Audit Log' },
  ];
  items.forEach(item => {
    if (!hasNavAccess(item.id)) return;
    const li = document.createElement('li');
    const a = document.createElement('a'); a.href = '#'; a.id = `nav-${item.id}`;
    if (item.id === currentView) a.classList.add('active');
    let html = `<span class="nav-icon">${item.icon}</span> ${item.label}`;
    if (item.badge) {
      const count = StorageAPI.getAlerts().filter(a => a.severity === 'critical' || a.severity === 'warning').length;
      html += `<span class="nav-badge">${count}</span>`;
    }
    if (item.ticketBadge) {
      const tickets = getTickets();
      const openCount = tickets.filter(t => t.status === 'open' || t.status === 'in-progress').length;
      if (openCount > 0) html += `<span class="nav-badge">${openCount}</span>`;
    }
    a.innerHTML = html;
    a.onclick = e => { e.preventDefault(); switchView(item.id); };
    li.appendChild(a); list.appendChild(li);
  });
}

function switchView(view) {
  if (!hasNavAccess(view)) { showToast('Access denied for your role.', 'error', 'Permission Denied'); return; }
  currentView = view;
  document.querySelectorAll('.dash-view').forEach(v => v.classList.remove('active'));
  const t = document.getElementById('view-' + view); if (t) t.classList.add('active');
  document.querySelectorAll('.sidebar-nav a').forEach(l => l.classList.remove('active'));
  const nl = document.getElementById('nav-' + view); if (nl) nl.classList.add('active');
  const titles = { overview: 'Overview', servers: 'Servers', storage: 'Storage', backups: 'Backups', alerts: 'Alerts', tracker: 'Ticket Tracker', assistant: 'AI Assistant', auditlog: 'Audit Log' };
  document.getElementById('dashPageTitle').textContent = titles[view] || view;
  document.getElementById('bcActive').textContent = titles[view] || view;
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('visible');
  if (view === 'overview') initOverviewView(); if (view === 'servers') initServersView(); if (view === 'storage') initStorageView();
  if (view === 'backups') initBackupsView(); if (view === 'alerts') initAlertsView(); if (view === 'assistant') initAssistantView();
  if (view === 'auditlog') initAuditLogView(); if (view === 'tracker') initTrackerView();
  // Re-apply RBAC after view content is rendered
  applyRBAC();
}

// ---- OVERVIEW ----
function initOverviewView() {
  const agg = StorageAPI.computeAggregates(), svrs = StorageAPI.getServers();
  animateValue('storageValue', 0, agg.usedPct, '%', 1200);
  setTimeout(() => { document.getElementById('storageBar').style.width = agg.usedPct + '%'; }, 200);
  setBadge('storageBadge', agg.usedPct, [80, 60], ['Critical', 'Warning', 'Online'], ['badge-critical', 'badge-warning', 'badge-online']);
  document.getElementById('backupValue').textContent = '2h ago'; document.getElementById('backupBar').style.width = '85%';
  animateValue('freespaceValue', 0, agg.freeStorage, ' GB', 1200);
  setTimeout(() => { document.getElementById('freespaceBar').style.width = agg.freePct + '%'; }, 200);
  animateValue('healthValue', 0, agg.healthScore, '%', 1200);
  setTimeout(() => { document.getElementById('healthBar').style.width = agg.healthScore + '%'; }, 200);

  const tbody = document.getElementById('overviewDeviceTable'); tbody.innerHTML = '';
  svrs.forEach(sv => {
    const hl = sv.status === 'online' ? (sv.storagePct > 80 || sv.cpuPct > 75 ? 'At Risk' : 'Healthy') : 'Degraded';
    const hc = hl === 'Healthy' ? 'var(--accent-green)' : hl === 'At Risk' ? 'var(--accent-amber)' : 'var(--accent-red)';
    const bc = sv.storagePct > 80 ? 'var(--accent-red)' : sv.storagePct > 60 ? 'var(--accent-amber)' : 'var(--accent-green)';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><span class="server-name">${sv.name}</span><br><span style="font-size:11px;color:var(--text-muted)">${sv.role}</span></td><td><span class="status-dot ${sv.status}"></span>${sv.status === 'online' ? 'Online' : 'Warning'}</td><td><div class="mini-bar"><div class="mini-fill" style="width:${sv.storagePct}%;background:${bc}"></div></div>${sv.storagePct}%</td><td>${sv.cpuPct}%</td><td><span style="color:${hc};font-weight:600">${hl}</span></td>`;
    tbody.appendChild(tr);
  });

  const fg = document.getElementById('focusGrid'); fg.innerHTML = '';
  const issues = [];
  const hs = svrs.filter(s => s.storagePct > 80); if (hs.length) issues.push({ sev: 'critical', icon: '💽', title: 'Storage Critical', metric: `${hs.length} server(s) >80%`, desc: hs.map(s => `${s.name}: ${s.storagePct}%`).join(', '), color: 'red' });
  const hc2 = svrs.filter(s => s.cpuPct > 70); if (hc2.length) issues.push({ sev: 'warning', icon: '⚡', title: 'High CPU', metric: `${hc2.length} server(s)`, desc: hc2.map(s => `${s.name}: ${s.cpuPct}%`).join(', '), color: 'amber' });
  const hm = svrs.filter(s => s.memPct > 75); if (hm.length) issues.push({ sev: 'warning', icon: '🧠', title: 'Memory Pressure', metric: `${hm.length} server(s)`, desc: hm.map(s => `${s.name}: ${s.memPct}%`).join(', '), color: 'amber' });
  const deg = svrs.filter(s => s.status !== 'online'); if (deg.length) issues.push({ sev: 'critical', icon: '🖥️', title: 'Unhealthy Servers', metric: `${deg.length} server(s)`, desc: deg.map(s => `${s.name}: ${s.status}`).join(', '), color: 'red' });
  const od = StorageAPI.getBackups().filter(b => b.status === 'warning'); if (od.length) issues.push({ sev: 'warning', icon: '☁️', title: 'Backup Overdue', metric: `${od.length} server(s)`, desc: od.map(b => b.server).join(', '), color: 'amber' });
  if (!issues.length) issues.push({ sev: 'good', icon: '✅', title: 'All Systems Healthy', metric: 'No issues', desc: 'All parameters within normal range.', color: 'green' });
  issues.forEach(i => { const c = document.createElement('div'); c.className = `focus-card ${i.sev}`; c.innerHTML = `<div class="focus-card-icon">${i.icon}</div><div class="focus-card-text"><h4>${i.title}</h4><div class="focus-metric ${i.color}">${i.metric}</div><p>${i.desc}</p></div>`; fg.appendChild(c); });
}

function setBadge(id, val, thresholds, labels, classes) { const el = document.getElementById(id); if (!el) return; for (let i = 0; i < thresholds.length; i++) { if (val > thresholds[i]) { el.className = 'card-badge ' + classes[i]; el.textContent = labels[i]; return; } } el.className = 'card-badge ' + classes[classes.length - 1]; el.textContent = labels[labels.length - 1]; }

// ---- SERVERS ----
function initServersView() {
  const svrs = StorageAPI.getServers(), tbody = document.getElementById('serverTableBody'); tbody.innerHTML = '';
  svrs.forEach(sv => {
    const bc = sv.storagePct > 80 ? 'var(--accent-red)' : sv.storagePct > 60 ? 'var(--accent-amber)' : 'var(--accent-green)';
    const mc = sv.memPct > 80 ? 'var(--accent-red)' : sv.memPct > 60 ? 'var(--accent-amber)' : 'var(--accent-green)';
    const tr = document.createElement('tr'); tr.dataset.name = sv.name.toLowerCase(); tr.dataset.role = sv.role.toLowerCase();
    tr.innerHTML = `<td><span class="server-name">${sv.name}</span><br><span style="font-size:11px;color:var(--text-muted)">${sv.role}</span></td><td><span class="status-dot ${sv.status}"></span>${sv.status === 'online' ? 'Online' : 'Warning'}</td><td><div class="mini-bar"><div class="mini-fill" style="width:${sv.storagePct}%;background:${bc}"></div></div>${sv.storagePct}%</td><td>${sv.cpuPct}%</td><td><div class="mini-bar"><div class="mini-fill" style="width:${sv.memPct}%;background:${mc}"></div></div>${sv.memPct}%</td><td>${sv.iops.toLocaleString()}</td>`;
    tbody.appendChild(tr);
  });
  const si = document.getElementById('serverSearch');
  if (si) si.oninput = () => { const q = si.value.toLowerCase(); document.querySelectorAll('#serverTableBody tr').forEach(r => r.classList.toggle('hidden-row', !(r.dataset.name || '').includes(q) && !(r.dataset.role || '').includes(q))); };
  const eb = document.getElementById('exportCSV'); if (eb) eb.onclick = () => { if (!hasPermission('canExport')) { showToast('Export not available for your role.', 'error'); return; } exportToCSV(); };
  if (hasPermission('canAccessAI')) initContextChat('server', 'serverChatMessages', 'serverChatInput', 'serverChatSend');
}

// ---- STORAGE ----
function initStorageView() {
  const agg = StorageAPI.computeAggregates(), svrs = StorageAPI.getServers();
  document.getElementById('stgTotalValue').textContent = `${(agg.totalStorage / 1024).toFixed(1)} TB`; document.getElementById('stgTotalBar').style.width = agg.usedPct + '%';
  document.getElementById('stgFreeValue').textContent = `${agg.freeStorage} GB`; document.getElementById('stgFreeBar').style.width = agg.freePct + '%';
  const avgI = Math.round(svrs.reduce((s, v) => s + v.iops, 0) / svrs.length); document.getElementById('stgIOValue').textContent = avgI.toLocaleString(); document.getElementById('stgIOBar').style.width = Math.min(avgI / 50, 100) + '%';
  const tbody = document.getElementById('storageDetailTable'); tbody.innerHTML = '';
  svrs.forEach(sv => { const bc = sv.storagePct > 80 ? 'var(--accent-red)' : sv.storagePct > 60 ? 'var(--accent-amber)' : 'var(--accent-green)'; const tr = document.createElement('tr'); tr.innerHTML = `<td><span class="server-name">${sv.name}</span></td><td>${sv.usedGB} GB</td><td>${sv.totalGB} GB</td><td><div class="mini-bar"><div class="mini-fill" style="width:${sv.storagePct}%;background:${bc}"></div></div>${sv.storagePct}%</td>`; tbody.appendChild(tr); });
  renderStorageChart();
  if (hasPermission('canAccessAI')) initContextChat('storage', 'storageChatMessages', 'storageChatInput', 'storageChatSend');
}
function renderStorageChart() {
  const ctx = document.getElementById('storageChart'); if (!ctx) return; if (storageChartInstance) storageChartInstance.destroy();
  const svrs = StorageAPI.getServers();
  storageChartInstance = new Chart(ctx.getContext('2d'), { type: 'bar', data: { labels: svrs.map(s => s.name), datasets: [{ label: 'Used (GB)', data: svrs.map(s => s.usedGB), backgroundColor: 'rgba(59,130,246,0.7)', borderRadius: 4 }, { label: 'Free (GB)', data: svrs.map(s => s.totalGB - s.usedGB), backgroundColor: 'rgba(16,185,129,0.4)', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } } } }, scales: { x: { stacked: true, ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } }, y: { stacked: true, ticks: { color: '#64748b', font: { size: 11 }, callback: v => v + ' GB' }, grid: { color: 'rgba(255,255,255,0.04)' } } } } });
}

// ---- BACKUPS ----
function initBackupsView() {
  const bkps = StorageAPI.getBackups();
  document.getElementById('bkpLastValue').textContent = '2h ago'; document.getElementById('bkpLastBar').style.width = '90%';
  document.getElementById('bkpCapValue').textContent = '55%'; document.getElementById('bkpCapBar').style.width = '55%';
  document.getElementById('bkpSchedValue').textContent = `${bkps.length} active`; document.getElementById('bkpSchedBar').style.width = '100%';
  const od = bkps.filter(b => b.status === 'warning'); if (od.length) { document.getElementById('bkpStatusBadge').className = 'card-badge badge-warning'; document.getElementById('bkpStatusBadge').textContent = 'Overdue'; }
  const tbody = document.getElementById('backupDetailTable'); tbody.innerHTML = '';
  bkps.forEach(b => { const tr = document.createElement('tr'); tr.innerHTML = `<td><span class="server-name">${b.server}</span></td><td>${b.lastBackup}</td><td>${b.type}</td><td>${b.size}</td><td>${b.status === 'success' ? '✅' : '⚠️'} ${b.status}</td><td>${b.next}</td>`; tbody.appendChild(tr); });
  if (hasPermission('canAccessAI')) initContextChat('backup', 'backupChatMessages', 'backupChatInput', 'backupChatSend');
}

// ---- ALERTS VIEW ----
function initAlertsView() {
  const alerts = StorageAPI.getAlerts();
  document.getElementById('alertTotalCount').textContent = alerts.length;
  document.getElementById('alertCriticalCount').textContent = alerts.filter(a => a.severity === 'critical').length;
  document.getElementById('alertWarningCount').textContent = alerts.filter(a => a.severity === 'warning').length;
  document.getElementById('alertInfoCount').textContent = alerts.filter(a => a.severity === 'info').length;
  renderManagedAlerts(alerts);
  document.getElementById('resetAlertFilter').onclick = () => filterAlerts('all');
}
function filterAlerts(type) {
  alertFilter = type;
  const labels = { all: 'All alerts', critical: 'Critical — Needs Action', warning: 'Warning — AI Known Fix', info: 'Minor — Auto Resolved' };
  document.getElementById('alertFilterLabel').textContent = 'Showing: ' + (labels[type] || 'All');
  document.getElementById('resetAlertFilter').style.display = type === 'all' ? 'none' : 'inline-block';
  renderManagedAlerts(StorageAPI.getAlerts().filter(a => type === 'all' || a.severity === type));
}

function getAlertState(id) {
  if (!alertStates[id]) alertStates[id] = { state: 'active', worknotes: [], ticketId: null };
  return alertStates[id];
}

function renderWorknotes(wns) {
  if (!wns || wns.length === 0) return '';
  return `<div class="alert-worknotes"><div class="wn-title">📝 Worknotes</div>` +
    wns.map(w => `<div class="wn-entry"><span class="wn-time">${w.time}</span>${w.text}</div>`).join('') + '</div>';
}

function renderManagedAlerts(alerts) {
  const list = document.getElementById('alertListManaged'); list.innerHTML = '';
  const canResolve = hasPermission('canResolveAlerts'), canIncident = hasPermission('canCreateIncident');
  alerts.forEach(a => {
    const st = getAlertState(a.id);
    const div = document.createElement('div');
    div.className = 'alert-managed-item';
    div.id = `alert-${a.id}`;
    // Apply state classes
    if (st.state === 'resolved') div.classList.add('alert-state-resolved');
    else if (st.state === 'pending') div.classList.add('alert-state-pending');

    let tag = '', actions = '';

    if (st.state === 'resolved') {
      tag = '<span class="alert-tag tag-resolved">✅ Resolved</span>';
      actions = '<span style="font-size:11px;color:var(--accent-green)">Resolved</span>';
    } else if (st.state === 'pending') {
      tag = `<span class="alert-tag tag-incident">🎫 ${st.ticketId || 'Pending'}</span>`;
      actions = `<span style="font-size:11px;color:var(--accent-amber)">${st.ticketId} — Pending Action</span>`;
    } else if (a.severity === 'critical') {
      tag = '<span class="alert-tag tag-incident">🎫 Needs Action</span>';
      actions = canIncident ?
        `<button class="alert-action-btn btn-incident" onclick="openIncidentModal(${a.id})">🎫 Raise Action</button>` :
        (canResolve ? `<button class="alert-action-btn btn-incident" onclick="openIncidentModal(${a.id})">🎫 Raise Action</button>` :
        '<span style="font-size:11px;color:var(--text-muted)">🔒 Admin only</span>');
    } else if (a.severity === 'warning') {
      tag = '<span class="alert-tag tag-ai">🤖 AI Known Fix</span>';
      actions = canResolve ? `<button class="alert-action-btn btn-ai" onclick="aiResolveAlert(${a.id})">🤖 AI Fix</button>` : '<span style="font-size:11px;color:var(--text-muted)">🔒 View only</span>';
    } else {
      tag = '<span class="alert-tag tag-auto">✅ Auto Resolved</span>';
      actions = canResolve ? `<button class="alert-action-btn btn-auto" onclick="autoResolveAlert(${a.id})">✅ Acknowledge</button>` : '<span style="font-size:11px;color:var(--text-muted)">🔒 View only</span>';
    }
    div.innerHTML = `<div class="alert-severity ${st.state === 'resolved' ? 'info' : st.state === 'pending' ? 'warning' : a.severity}"></div><div class="alert-body"><strong>${a.title}</strong><span>${a.detail}</span></div><div class="alert-meta"><span class="alert-time">${a.time}</span>${tag}</div><div class="alert-actions">${actions}</div>${renderWorknotes(st.worknotes)}`;
    list.appendChild(div);
  });
}

function addAlertWorknote(id, text) {
  const st = getAlertState(id);
  st.worknotes.push({ time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), text });
}

function autoResolveAlert(id) {
  if (!hasPermission('canResolveAlerts')) { showToast('Permission denied.', 'error'); return; }
  const alert = StorageAPI.getAlerts().find(a => a.id === id);
  const st = getAlertState(id);
  st.state = 'resolved';
  addAlertWorknote(id, `Auto-resolved by AI — ${alert ? alert.title : 'Alert'} acknowledged and cleared.`);
  renderManagedAlerts(StorageAPI.getAlerts().filter(a => alertFilter === 'all' || a.severity === alertFilter));
  showToast('Alert auto-resolved and worknote added.', 'success', 'Auto Resolved');
  auditLog('ALERT_RESOLVE', `#${id} auto-resolved`);
}

function aiResolveAlert(id) {
  if (!hasPermission('canResolveAlerts')) { showToast('Permission denied.', 'error'); return; }
  const alert = StorageAPI.getAlerts().find(a => a.id === id); if (!alert) return;
  const fixes = { 'CPU spike': 'Known ETL batch job — auto-resolves in ~45 min.', 'cache hit ratio': 'Expected after deployment — self-resolves in 1-2h.' };
  let fix = ''; for (const [k, v] of Object.entries(fixes)) { if (alert.title.toLowerCase().includes(k.toLowerCase())) { fix = v; break; } }
  if (!fix) fix = 'AI analyzing — monitoring will continue.';
  const st = getAlertState(id);
  st.state = 'resolved';
  addAlertWorknote(id, `AI Known Fix applied — ${fix}`);
  renderManagedAlerts(StorageAPI.getAlerts().filter(a => alertFilter === 'all' || a.severity === alertFilter));
  showToast('AI resolved: ' + fix, 'success', 'AI Resolution');
  auditLog('AI_RESOLVE', `#${id} — ${fix}`);
}

// ---- ACTION MODAL (Incident / CRQ / Vendor) ----
let pendingIncidentId = null;
function initIncidentModal() {
  document.getElementById('modalClose').onclick = closeModal;
  document.getElementById('modalCancel').onclick = closeModal;
  document.getElementById('modalSubmit').onclick = submitTicket;
  document.getElementById('actionType').onchange = function() {
    const labels = { incident: '🎫 Raise Incident', change: '🔄 Raise Change Request', vendor: '🏢 Raise Vendor Case' };
    document.getElementById('actionModalTitle').textContent = labels[this.value] || '🎫 Raise Action';
  };
}
function openIncidentModal(id) {
  const a = StorageAPI.getAlerts().find(x => x.id === id); if (!a) return;
  pendingIncidentId = id;
  document.getElementById('incidentTitle').value = a.title;
  document.getElementById('incidentDesc').value = a.detail;
  document.getElementById('incidentWorknote').value = '';
  document.getElementById('actionType').value = 'incident';
  document.getElementById('actionModalTitle').textContent = '🎫 Raise Action';
  document.getElementById('incidentModal').classList.add('visible');
}
function closeModal() {
  document.getElementById('incidentModal').classList.remove('visible');
  pendingIncidentId = null;
}

// ---- TICKET DATA ----
function getTickets() { return JSON.parse(localStorage.getItem(APP_CONFIG.ticketsKey) || '[]'); }
function saveTickets(tickets) { localStorage.setItem(APP_CONFIG.ticketsKey, JSON.stringify(tickets)); }

function submitTicket() {
  const actionType = document.getElementById('actionType').value;
  const severity = document.getElementById('incidentSeverity').value;
  const title = document.getElementById('incidentTitle').value;
  const desc = document.getElementById('incidentDesc').value;
  const team = document.getElementById('incidentAssign').value;
  const worknote = document.getElementById('incidentWorknote').value.trim();

  const prefixes = { incident: 'INC', change: 'CRQ', vendor: 'VDR' };
  const prefix = prefixes[actionType] || 'INC';
  const tid = prefix + '-' + Date.now().toString().slice(-6);

  const typeLabels = { incident: 'Incident', change: 'Change Request', vendor: 'Vendor Case' };

  // Create ticket object
  const ticket = {
    id: tid, type: actionType, typeLabel: typeLabels[actionType],
    alertId: pendingIncidentId, alertTitle: title, description: desc,
    severity, assignedTo: team, status: 'open',
    created: new Date().toISOString(),
    worknotes: []
  };
  // Add initial worknote
  const initNote = `${typeLabels[actionType]} ${tid} raised — assigned to ${team}.`;
  ticket.worknotes.push({ time: new Date().toISOString(), user: currentUser.name, text: initNote });
  if (worknote) ticket.worknotes.push({ time: new Date().toISOString(), user: currentUser.name, text: worknote });

  // Save ticket
  const tickets = getTickets(); tickets.push(ticket); saveTickets(tickets);

  // Update alert state → pending (amber)
  const st = getAlertState(pendingIncidentId);
  st.state = 'pending';
  st.ticketId = tid;
  addAlertWorknote(pendingIncidentId, `${typeLabels[actionType]} ${tid} raised — assigned to ${team}.`);
  if (worknote) addAlertWorknote(pendingIncidentId, worknote);

  // Re-render alerts
  renderManagedAlerts(StorageAPI.getAlerts().filter(a => alertFilter === 'all' || a.severity === alertFilter));

  closeModal();
  showToast(`${tid} assigned to ${team}.`, 'success', `${typeLabels[actionType]} Created`);
  auditLog('TICKET_CREATE', `${tid} (${typeLabels[actionType]}) for "${title}" → ${team}`);
}

// ---- WORKNOTE MODAL ----
let pendingWorknoteTicketId = null;
function initWorknoteModal() {
  document.getElementById('worknoteClose').onclick = closeWorknoteModal;
  document.getElementById('worknoteCancel').onclick = closeWorknoteModal;
  document.getElementById('worknoteSubmit').onclick = submitWorknote;
}
function openWorknoteModal(ticketId) {
  pendingWorknoteTicketId = ticketId;
  document.getElementById('worknoteTicketId').value = ticketId;
  document.getElementById('worknoteText').value = '';
  document.getElementById('worknoteStatus').value = '';
  document.getElementById('worknoteModal').classList.add('visible');
}
function closeWorknoteModal() {
  document.getElementById('worknoteModal').classList.remove('visible');
  pendingWorknoteTicketId = null;
}
function submitWorknote() {
  const ticketId = pendingWorknoteTicketId;
  const text = document.getElementById('worknoteText').value.trim();
  const newStatus = document.getElementById('worknoteStatus').value;
  if (!text) { showToast('Please enter a worknote.', 'error'); return; }

  const tickets = getTickets();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) { showToast('Ticket not found.', 'error'); return; }

  // Add worknote
  ticket.worknotes.push({ time: new Date().toISOString(), user: currentUser.name, text });

  // Update status if changed
  const oldStatus = ticket.status;
  if (newStatus && newStatus !== ticket.status) {
    ticket.status = newStatus;
    ticket.worknotes.push({ time: new Date().toISOString(), user: currentUser.name, text: `Status changed: ${oldStatus} → ${newStatus}` });
  }

  saveTickets(tickets);

  // If resolved or closed, update alert to green
  if (newStatus === 'resolved' || newStatus === 'closed') {
    const st = getAlertState(ticket.alertId);
    st.state = 'resolved';
    addAlertWorknote(ticket.alertId, `${ticket.typeLabel} ${ticketId} ${newStatus}. ${text}`);
    // Re-render alerts if visible
    if (currentView === 'alerts') {
      renderManagedAlerts(StorageAPI.getAlerts().filter(a => alertFilter === 'all' || a.severity === alertFilter));
    }
  } else if (newStatus === 'in-progress') {
    addAlertWorknote(ticket.alertId, `${ticket.typeLabel} ${ticketId} in progress. ${text}`);
  }

  closeWorknoteModal();
  showToast('Worknote saved.', 'success');
  auditLog('WORKNOTE', `${ticketId}: ${text}`);
  if (currentView === 'tracker') initTrackerView();
}

// ---- TICKET TRACKER VIEW ----
function initTrackerView() {
  const tickets = getTickets();
  document.getElementById('ticketTotalCount').textContent = tickets.length;
  document.getElementById('ticketIncCount').textContent = tickets.filter(t => t.type === 'incident').length;
  document.getElementById('ticketCrqCount').textContent = tickets.filter(t => t.type === 'change').length;
  document.getElementById('ticketVdrCount').textContent = tickets.filter(t => t.type === 'vendor').length;

  const filtered = ticketFilter === 'all' ? tickets : tickets.filter(t => t.type === ticketFilter);
  renderTickets(filtered);

  document.getElementById('resetTicketFilter').onclick = () => filterTickets('all');
  document.getElementById('exportTicketsCSV').onclick = exportTicketsCSV;
}

function filterTickets(type) {
  ticketFilter = type;
  const labels = { all: 'All tickets', incident: 'Incidents only', change: 'Change Requests only', vendor: 'Vendor Cases only' };
  document.getElementById('ticketFilterLabel').textContent = 'Showing: ' + (labels[type] || 'All');
  document.getElementById('resetTicketFilter').style.display = type === 'all' ? 'none' : 'inline-block';
  const tickets = getTickets();
  const filtered = type === 'all' ? tickets : tickets.filter(t => t.type === type);
  renderTickets(filtered);
}

function renderTickets(tickets) {
  const list = document.getElementById('ticketListManaged'); list.innerHTML = '';
  if (tickets.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:14px">📋 No tickets found. Raise an action from the Alerts page to create tickets.</div>';
    return;
  }
  const canUpdate = hasPermission('canResolveAlerts');
  tickets.slice().reverse().forEach(t => {
    const div = document.createElement('div');
    div.className = `ticket-item${t.status === 'resolved' ? ' ticket-resolved' : ''}${t.status === 'closed' ? ' ticket-closed' : ''}`;
    const typeClass = `type-${t.type}`;
    const statusClass = `status-${t.status}`;
    const statusLabels = { open: '🔴 Open', 'in-progress': '🔵 In Progress', resolved: '🟢 Resolved', closed: '⚫ Closed' };
    const created = new Date(t.created).toLocaleString();

    let wnHtml = '';
    if (t.worknotes && t.worknotes.length > 0) {
      wnHtml = '<div class="ticket-worknotes-log">' + t.worknotes.map(w =>
        `<div class="wn-entry"><span class="wn-time">${new Date(w.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span><span class="wn-user">${w.user}</span>${w.text}</div>`
      ).join('') + '</div>';
    }

    let actionsHtml = '';
    if (canUpdate && t.status !== 'closed') {
      actionsHtml = `<div class="ticket-item-actions">
        <button class="ticket-action-btn btn-worknote" onclick="openWorknoteModal('${t.id}')">📝 Add Worknote</button>
        ${t.status !== 'resolved' ? `<button class="ticket-action-btn btn-resolve" onclick="quickResolveTicket('${t.id}')">✅ Resolve</button>` : ''}
      </div>`;
    }

    div.innerHTML = `<div class="ticket-item-header">
        <span class="ticket-id">${t.id}</span>
        <span class="ticket-type-badge ${typeClass}">${t.typeLabel}</span>
        <span class="ticket-status-badge ${statusClass}">${statusLabels[t.status] || t.status}</span>
        <span class="ticket-title">${t.alertTitle}</span>
        <span class="ticket-meta">${created}</span>
      </div>
      <div class="ticket-item-body">
        <div><span class="ticket-detail-label">Severity</span>${t.severity}</div>
        <div><span class="ticket-detail-label">Assigned To</span>${t.assignedTo}</div>
        <div><span class="ticket-detail-label">Description</span>${t.description}</div>
      </div>
      ${wnHtml}${actionsHtml}`;
    list.appendChild(div);
  });
}

function quickResolveTicket(ticketId) {
  const tickets = getTickets();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return;
  ticket.status = 'resolved';
  ticket.worknotes.push({ time: new Date().toISOString(), user: currentUser.name, text: 'Ticket resolved.' });
  saveTickets(tickets);

  // Update alert state → green
  const st = getAlertState(ticket.alertId);
  st.state = 'resolved';
  addAlertWorknote(ticket.alertId, `${ticket.typeLabel} ${ticketId} resolved.`);

  showToast(`${ticketId} resolved.`, 'success', 'Ticket Resolved');
  auditLog('TICKET_RESOLVE', ticketId);
  initTrackerView();
}

function exportTicketsCSV() {
  if (!hasPermission('canExport')) { showToast('Export restricted.', 'error'); return; }
  const tickets = getTickets();
  if (tickets.length === 0) { showToast('No tickets to export.', 'warning'); return; }
  const BOM = '\uFEFF';
  let csv = BOM + '"Ticket ID","Type","Alert","Severity","Assigned To","Status","Created","Last Worknote"\n';
  tickets.forEach(t => {
    const lastWn = t.worknotes.length > 0 ? t.worknotes[t.worknotes.length - 1].text.replace(/"/g, '""') : '';
    csv += `"${t.id}","${t.typeLabel}","${t.alertTitle.replace(/"/g, '""')}","${t.severity}","${t.assignedTo}","${t.status}","${new Date(t.created).toLocaleString()}","${lastWn}"\n`;
  });
  const l = document.createElement('a');
  l.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  l.download = `tickets_${new Date().toISOString().slice(0, 10)}.csv`;
  l.click();
  showToast('Tickets exported to CSV.', 'success', 'Export Complete');
  auditLog('EXPORT', 'Tickets CSV');
}

// ---- SETTINGS MODAL ----
function initSettingsModal() {
  document.getElementById('settingsClose').onclick = closeSettings; document.getElementById('settingsCancel').onclick = closeSettings;
  document.getElementById('settingsSave').onclick = () => { showToast('Settings saved.', 'success'); closeSettings(); };
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = tab.dataset.tab === 'general' ? 'settingsGeneral' : tab.dataset.tab === 'thresholds' ? 'settingsThresholds' : 'settingsAudit';
      document.getElementById(panel).classList.add('active');
      if (tab.dataset.tab === 'audit') loadAuditInSettings();
    };
  });
  document.getElementById('clearAuditLog').onclick = () => { localStorage.removeItem(APP_CONFIG.auditKey); showToast('Audit log cleared.', 'info'); loadAuditInSettings(); };
}
function openSettingsModal() { if (!hasPermission('canChangeSettings')) { showToast('Settings access restricted to Admin.', 'error'); return; } document.getElementById('settingsModal').classList.add('visible'); }
function closeSettings() { document.getElementById('settingsModal').classList.remove('visible'); }
function loadAuditInSettings() {
  const log = JSON.parse(localStorage.getItem(APP_CONFIG.auditKey) || '[]').reverse().slice(0, 50);
  const tbody = document.getElementById('auditTableBody'); tbody.innerHTML = '';
  log.forEach(e => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${new Date(e.timestamp).toLocaleString()}</td><td>${e.user}</td><td><span class="role-chip role-${e.role}" style="font-size:9px;padding:1px 6px">${e.role}</span></td><td>${e.action}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.details}</td>`; tbody.appendChild(tr); });
}

// ---- AUDIT LOG VIEW (admin) ----
function initAuditLogView() {
  const log = JSON.parse(localStorage.getItem(APP_CONFIG.auditKey) || '[]').reverse();
  const tbody = document.getElementById('auditViewBody'); tbody.innerHTML = '';
  log.forEach(e => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${new Date(e.timestamp).toLocaleString()}</td><td>${e.user}</td><td><span class="role-chip role-${e.role}" style="font-size:9px;padding:1px 6px">${e.role}</span></td><td>${e.action}</td><td>${e.details}</td>`; tbody.appendChild(tr); });
  document.getElementById('exportAuditCSV').onclick = () => {
    const BOM = '\uFEFF';
    let csv = BOM + '"Time","User","Role","Action","Details"\n';
    log.forEach(e => { csv += `"${new Date(e.timestamp).toLocaleString()}","${e.user}","${e.role}","${e.action}","${(e.details || '').replace(/"/g, '""')}"\n`; });
    const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); l.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`; l.click(); showToast('Audit log exported.', 'success');
  };
  document.getElementById('clearAuditBtn').onclick = () => { localStorage.removeItem(APP_CONFIG.auditKey); showToast('Cleared.', 'info'); initAuditLogView(); };
}

// ---- AI ASSISTANT ----
function initAssistantView() { if (hasPermission('canAccessAI')) initContextChat('general', 'chatMessages', 'chatInput', 'chatSendBtn'); }

// ============================================================
// CONTEXT AI CHAT
// ============================================================
function initContextChat(ctx, msgId, inputId, sendId) {
  if (chatInited[ctx]) return; chatInited[ctx] = true;
  const container = document.getElementById(msgId), input = document.getElementById(inputId), btn = document.getElementById(sendId); if (!container || !input || !btn) return;
  const greetings = { server: `👋 **Server AI Assistant** ready. Ask about CPU, memory, performance.`, storage: `👋 **Storage AI Assistant** ready. Ask about capacity, RAID, disk health.`, backup: `👋 **Backup AI Assistant** ready. Ask about schedules, restore, retention.`, general: `👋 Hi ${currentUser?.name}! **General AI Assistant** — ask about storage, backups, or servers.` };
  addChatMsg(container, 'ai', greetings[ctx] || greetings.general, ctx);
  document.querySelectorAll(`.quick-chip[data-ctx="${ctx}"]`).forEach(c => c.onclick = () => { input.value = c.dataset.query; send(); });
  btn.onclick = send; input.onkeydown = e => { if (e.key === 'Enter') send(); };
  function send() { const q = input.value.trim(); if (!q) return; addChatMsg(container, 'user', q, ctx); input.value = ''; const tid = showTyping(container); setTimeout(() => { removeTyping(tid); addChatMsg(container, 'ai', getCtxResponse(ctx, q), ctx); auditLog('AI_QUERY', `[${ctx}] ${q}`); }, 600 + Math.random() * 800); }
}

function getCtxResponse(ctx, query) {
  const l = query.toLowerCase(), agg = StorageAPI.computeAggregates(), svrs = StorageAPI.getServers();
  if (ctx === 'server') {
    if (l.includes('cpu') || l.includes('high')) { const h = svrs.filter(s => s.cpuPct > 60); return `⚡ **CPU Analysis:**\n\n${h.length ? h.map(s => `• **${s.name}** — ${s.cpuPct}%`).join('\n') : 'All normal'}\n\n**Tips:** \`top -o %CPU\`, check scheduled jobs, consider load balancing.`; }
    if (l.includes('mem') || l.includes('ram')) { const h = svrs.filter(s => s.memPct > 60); return `🧠 **Memory:**\n\n${h.map(s => `• **${s.name}** — ${s.memPct}%`).join('\n')}\n\nCheck for leaks, review pools, add RAM if >80%.`; }
    if (l.includes('perf') || l.includes('overview')) return `📊 **Performance:**\n\n${svrs.map(s => `• **${s.name}** — CPU:${s.cpuPct}% Mem:${s.memPct}% Disk:${s.storagePct}%`).join('\n')}`;
    if (l.includes('optim') || l.includes('improve')) return `🔧 **Optimization:**\n1. Load balance web/app\n2. Optimize DB queries\n3. Scale DEV-TEST-01\n4. Set alerts >75% CPU/Memory`;
  }
  if (ctx === 'storage') {
    if (l.includes('high') || l.includes('usage')) return `💾 **Storage:** ${agg.usedPct}% used (${agg.usedStorage}/${agg.totalStorage} GB)\n\n${svrs.filter(s => s.storagePct > 60).map(s => `• **${s.name}** — ${s.storagePct}%`).join('\n')}\n\n**Actions:** Rotate logs, clear temp files, archive cold data.`;
    if (l.includes('raid')) return `🔧 **RAID:**\n\n| Level | Tolerance | Best For |\n|---|---|---|\n| RAID 0 | None | Speed |\n| RAID 1 | 1 disk | Mirroring |\n| RAID 5 | 1 disk | File servers |\n| RAID 10 | 1/mirror | Databases |`;
    if (l.includes('health') || l.includes('disk')) return `❤️ **Disk Health:** Score ${agg.healthScore}%\n\nRun \`smartctl -a /dev/sda\` for S.M.A.R.T. data.\nCheck: Reallocated Sectors, Temperature, Pending Sectors.`;
    if (l.includes('free') || l.includes('clean')) return `🧹 **Free space tips:**\n• Clear temp: 2-10 GB\n• Rotate logs: 5-50 GB\n• Remove old snapshots: 10-100 GB\n\n**Free now:** ${agg.freeStorage} GB (${agg.freePct}%)`;
  }
  if (ctx === 'backup') {
    if (l.includes('status')) { const b = StorageAPI.getBackups(); return `☁️ **Backups:**\n\n${b.map(x => `• **${x.server}** — ${x.status === 'success' ? '✅' : '⚠️'} ${x.type} (${x.size})`).join('\n')}`; }
    if (l.includes('restore')) return `🔄 **Restore:**\n1. Stop services\n2. \`rsync -avz /backup/latest/ /target/\`\n3. Verify + restart\n\n⚠️ Test in staging first.`;
    if (l.includes('retention')) return `📅 **Retention:** Full=30d, Incremental=7d, Snapshot=24h, Archive=1yr\n\nFollow 3-2-1 rule (3 copies, 2 media, 1 offsite).`;
    if (l.includes('offsite') || l.includes('cloud')) return `🌐 **Offsite:** AWS S3 + Glacier, Azure Blob cool tier, or GCP nearline.\nEncrypt, throttle bandwidth, auto-tier lifecycle.`;
  }
  // General fallback
  const guard = ['storage', 'disk', 'backup', 'restore', 'raid', 'server', 'cpu', 'memory', 'health', 'slow', 'error', 'performance', 'log', 'alert', 'help', 'how', 'what', 'why', 'check', 'fix', 'hi', 'hello', 'hey', 'snapshot', 'cloud'];
  if (!guard.some(t => l.includes(t))) return `🛡️ I only handle **storage & server** topics.\n\nTry: storage, backup, server, CPU, memory, health.`;
  if (l.includes('hi') || l.includes('hello') || l.includes('help')) return `👋 I can help with:\n• 💾 Storage\n• ☁️ Backups\n• 🖥️ Servers\n• 🔧 RAID\n• ❤️ Disk health`;
  return `📊 **Infrastructure:** Storage ${agg.usedPct}% | Free ${agg.freeStorage} GB | Online ${agg.onlineCount}/${agg.totalServers} | Health ${agg.healthScore}%`;
}

// ============================================================
// CHAT HELPERS
// ============================================================
function addChatMsg(container, role, text, ctx) {
  const t = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  let html = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:3px;font-size:12px">$1</code>').replace(/\n/g, '<br>');
  if (html.includes('|')) { html = html.replace(/((?:\|[^\n<]+\|(?:<br>)?)+)/g, (block) => { const rows = block.split('<br>').filter(r => r.trim() && !r.match(/^\|[\s-|]+\|$/)); if (rows.length < 2) return block; let tbl = '<table style="width:100%;font-size:12px;margin:8px 0;border-collapse:collapse">'; rows.forEach((row, i) => { const cells = row.split('|').filter(c => c.trim()); const tag = i === 0 ? 'th' : 'td'; const st = i === 0 ? 'style="text-align:left;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.1);color:var(--accent-blue)"' : 'style="padding:5px 8px;border-bottom:1px solid rgba(255,255,255,0.05)"'; tbl += '<tr>' + cells.map(c => `<${tag} ${st}>${c.trim()}</${tag}>`).join('') + '</tr>'; }); return tbl + '</table>'; }); }
  const icons = { server: '🖥️', storage: '💽', backup: '☁️', general: '🤖' };
  const d = document.createElement('div'); d.className = `chat-msg ${role}`; d.innerHTML = `<div class="msg-avatar">${role === 'ai' ? (icons[ctx] || '🤖') : '👤'}</div><div class="msg-bubble">${html}<span class="msg-time">${t}</span></div>`;
  container.appendChild(d); container.scrollTop = container.scrollHeight;
}
function showTyping(container) { const id = 't-' + Date.now(); const d = document.createElement('div'); d.className = 'chat-msg ai'; d.id = id; d.innerHTML = '<div class="msg-avatar">🤖</div><div class="msg-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>'; container.appendChild(d); container.scrollTop = container.scrollHeight; return id; }
function removeTyping(id) { document.getElementById(id)?.remove(); }

// ============================================================
// UTILITIES
// ============================================================
function updateDateTime() { const el = document.getElementById('liveDateTime'); if (el) el.textContent = new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
const bootTime = Date.now() - (72 * 3600000 + 14 * 60000);
function updateUptime() { const d = Date.now() - bootTime; const days = Math.floor(d / 864e5), hrs = Math.floor(d % 864e5 / 36e5), mins = Math.floor(d % 36e5 / 6e4); const el = document.getElementById('sidebarUptime'); if (el) el.textContent = `Uptime: ${days}d ${hrs}h ${mins}m`; }
function setupAutoRefresh() { const sel = document.getElementById('refreshInterval'), ct = document.getElementById('countdownText'), cf = document.getElementById('countdownFill'); if (!sel) return; const circ = 2 * Math.PI * 8; function start() { if (refreshTimer) clearInterval(refreshTimer); const iv = +sel.value; if (!iv) { if (ct) ct.textContent = '—'; if (cf) cf.style.strokeDashoffset = circ; return; } refreshCountdown = iv; if (ct) ct.textContent = refreshCountdown; refreshTimer = setInterval(() => { refreshCountdown--; if (ct) ct.textContent = refreshCountdown; if (cf) cf.style.strokeDashoffset = circ * (1 - (1 - refreshCountdown / iv)); if (refreshCountdown <= 0) { refreshCountdown = iv; switchView(currentView); showToast('Refreshed.', 'info'); } }, 1000); } sel.onchange = start; start(); }
function setupMobileMenu() { document.getElementById('hamburgerBtn')?.addEventListener('click', () => { document.getElementById('sidebar')?.classList.toggle('open'); document.getElementById('sidebarOverlay')?.classList.toggle('visible'); }); document.getElementById('sidebarOverlay')?.addEventListener('click', () => { document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('sidebarOverlay')?.classList.remove('visible'); }); }
function animateValue(id, start, end, suffix, dur) { const el = document.getElementById(id); if (!el) return; const range = end - start, st = performance.now(); function step(ts) { const p = Math.min((ts - st) / dur, 1); el.textContent = Math.round(start + range * (1 - Math.pow(1 - p, 3))) + suffix; if (p < 1) requestAnimationFrame(step); } requestAnimationFrame(step); }
function exportToCSV() {
  if (!hasPermission('canExport')) { showToast('Export restricted.', 'error'); return; }
  const svrs = StorageAPI.getServers();
  const BOM = '\uFEFF';
  let csv = BOM + '"Server","Role","Status","Storage %","CPU %","Memory %","IOPS","Total GB","Used GB"\n';
  svrs.forEach(s => {
    csv += `"${s.name}","${s.role}","${s.status}","${s.storagePct}","${s.cpuPct}","${s.memPct}","${s.iops}","${s.totalGB}","${s.usedGB}"\n`;
  });
  const l = document.createElement('a');
  l.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  l.download = `dashboard_${new Date().toISOString().slice(0, 10)}.csv`;
  l.click();
  showToast('Exported to CSV.', 'success', 'Export Complete');
  auditLog('EXPORT', 'Server Data CSV');
}