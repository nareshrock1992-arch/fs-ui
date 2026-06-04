/* ============================================================
   FreeSWITCH Dashboard — app.js
   Features: toast notifications, confirm dialog, conference
   filter dropdown, volume control, lock/unlock, dark mode
   persistence, auto-refresh with smart debounce.
   ============================================================ */

// ── Dark Mode ─────────────────────────────────────────────────
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('fs-dark', isDark ? '1' : '0');
}

(function initDarkMode() {
  if (localStorage.getItem('fs-dark') === '1') {
    document.body.classList.add('dark-mode');
  }
})();

// ── Toast Notifications ───────────────────────────────────────
/**
 * Show a toast message.
 * @param {'success'|'error'|'warn'|'info'} type
 * @param {string} title
 * @param {string} [msg]
 * @param {number} [duration=3500]
 */
function toast(type, title, msg = '', duration = 3500) {
  const icons = { success: '✅', error: '❌', warn: '⚠️', info: 'ℹ️' };
  const container = document.getElementById('toast-container');

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
    </div>
    <button class="toast-close" onclick="dismissToast(this.parentElement)">×</button>
  `;
  container.appendChild(el);

  if (duration > 0) {
    setTimeout(() => dismissToast(el), duration);
  }
}

function dismissToast(el) {
  if (!el || el.classList.contains('toast-out')) return;
  el.classList.add('toast-out');
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

// ── Confirm Dialog ────────────────────────────────────────────
let _confirmResolve = null;

function confirmResolve(val) {
  document.getElementById('confirm-overlay').classList.remove('show');
  if (_confirmResolve) { _confirmResolve(val); _confirmResolve = null; }
}

function showConfirm(title, msg, okLabel = 'Confirm') {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-ok-btn').textContent = okLabel;
  document.getElementById('confirm-overlay').classList.add('show');
  return new Promise(resolve => { _confirmResolve = resolve; });
}

// ── Sidebar / Navigation ──────────────────────────────────────
function toggleMenu(menuId, menuItemId) {
  const menu     = document.getElementById(menuId);
  const menuItem = document.getElementById(menuItemId);
  const isOpen   = menu.style.display === 'block';
  menu.style.display = isOpen ? 'none' : 'block';
  if (menuItem) menuItem.classList.toggle('open', !isOpen);
}

function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
  const section = document.getElementById(id);
  if (section) section.style.display = 'block';

  if (id === 'userListSection')         loadUsers();
  if (id === 'registeredSection')       loadRegistrations();
  if (id === 'manageConferenceSection') loadConferences();
  if (id === 'monitorConferenceSection') monitorConferences();
}

// ── Users ─────────────────────────────────────────────────────
async function addUser() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  if (!username || !password) {
    toast('warn', 'Missing fields', 'Please enter both username and password.');
    return;
  }
  try {
    const res  = await fetch(`/api/users/add?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
    const text = await res.text();
    if (res.ok) {
      toast('success', 'User created', text);
      document.getElementById('username').value = '';
      document.getElementById('password').value = '';
      loadUsers();
    } else {
      toast('error', 'Failed to create user', text);
    }
  } catch (err) {
    toast('error', 'Network error', err.message);
  }
}

async function loadUsers() {
  try {
    const res   = await fetch('/api/users/list');
    const users = await res.json();
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = '';
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="2"><div class="empty-state"><span class="icon">👤</span>No users configured</div></td></tr>';
      return;
    }
    users.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${u.username}</td><td>${u.extension}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) {
    toast('error', 'Failed to load users', err.message);
  }
}

// ── Registrations ─────────────────────────────────────────────
async function loadRegistrations() {
  try {
    const res     = await fetch('/api/registrations');
    const xmlText = await res.text();
    const parser  = new DOMParser();
    const xmlDoc  = parser.parseFromString(xmlText, 'application/xml');
    const tbody   = document.querySelector('#fs-table tbody');
    tbody.innerHTML = '';
    const regs = xmlDoc.getElementsByTagName('registration');
    if (!regs.length) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><span class="icon">📡</span>No registered users</div></td></tr>';
      return;
    }
    for (const reg of regs) {
      const user    = reg.getElementsByTagName('user')[0]?.textContent || '-';
      const host    = reg.getElementsByTagName('network-ip')[0]?.textContent || '-';
      const contact = reg.getElementsByTagName('contact')[0]?.textContent || '-';
      const agent   = reg.getElementsByTagName('agent')[0]?.textContent || '-';
      const status  = (reg.getElementsByTagName('status')[0]?.textContent || '-').replace(/\s+/g, ' ').trim();
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${user}</td><td>${host}</td><td>${contact}</td><td>${agent}</td><td>${status}</td>`;
      tbody.appendChild(tr);
    }
  } catch (err) {
    toast('error', 'Failed to load registrations', err.message);
  }
}

// ── Conferences: shared data fetch ───────────────────────────
async function fetchConferenceData() {
  const res  = await fetch('/api/conferences/list');
  const data = await res.json();
  return data.conferences || [];
}

function groupParticipants(participants) {
  const grouped = {};
  participants.forEach(p => {
    if (!grouped[p.conferenceName]) grouped[p.conferenceName] = [];
    grouped[p.conferenceName].push(p);
  });
  return grouped;
}

// ── Conference filter dropdown ───────────────────────────────
function updateFilterDropdown(grouped) {
  const sel     = document.getElementById('confFilter');
  const current = sel.value;
  // Remove all options except the first ("All")
  while (sel.options.length > 1) sel.remove(1);
  Object.keys(grouped).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });
  // Restore previous selection if still valid
  if (current && grouped[current]) sel.value = current;
}

// ── Manage Conferences ────────────────────────────────────────
async function loadConferences() {
  try {
    const participants = await fetchConferenceData();
    const tbody        = document.getElementById('conferenceList');
    const filterVal    = document.getElementById('confFilter').value;

    // Build grouped map
    const grouped = groupParticipants(participants);
    updateFilterDropdown(grouped);

    tbody.innerHTML = '';

    const confNames = Object.keys(grouped).filter(n => !filterVal || n === filterVal);

    if (!confNames.length) {
      tbody.innerHTML = `<tr><td colspan="4">
        <div class="empty-state"><span class="icon">🎙️</span>No active conferences</div>
      </td></tr>`;
      return;
    }

    confNames.forEach(confName => {
      const list     = grouped[confName];
      /*const isLocked = list[0]?.flags?.includes('locked');
*/
const isLocked = list[0]?.locked === true;

      // ── Conference header row ──────────────────────────────
      const hdr = document.createElement('tr');
      hdr.className = 'conf-header-row';
      hdr.innerHTML = `
        <td colspan="4">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <div class="conf-title">
              🎙️ ${confName}
              <span class="conf-badge">${list.length} member${list.length !== 1 ? 's' : ''}</span>
              ${isLocked ? '<span class="conf-badge locked">🔒 Locked</span>' : ''}
            </div>
            <div class="conf-actions">
              <button class="btn btn-mute-all"   onclick="muteAll('${confName}')">Mute All</button>
              <button class="btn btn-mute-all"   onclick="unmuteAll('${confName}')" style="color:var(--accent-success); border-color:rgba(22,163,74,0.2); background:rgba(22,163,74,0.06);">Unmute All</button>
              <button class="btn btn-lock"       onclick="toggleLock('${confName}', ${isLocked})">${isLocked ? '🔓 Unlock' : '🔒 Lock'}</button>
              <button class="btn btn-terminate"  onclick="terminateConference('${confName}')">⛔ Terminate</button>
            </div>
          </div>
        </td>
      `;
      tbody.appendChild(hdr);

      // ── Participant rows ──────────────────────────────────
      
// ── Participant rows ──────────────────────────────────
list.forEach(p => {

  const isMuted =
      Array.isArray(p.flags)
          ? !p.flags.includes('speak')
          : true;

  const isSpeaking = p.isTalking;

  console.log(
      "Member:",
      p.memberId,
      "Flags:",
      p.flags,
      "Muted:",
      isMuted
  );

  const tr = document.createElement('tr');

  tr.innerHTML = `
    <td>
      ${isSpeaking ? '<span class="speaking-dot"></span>' : ''}
      ${p.user || 'Unknown'}
    </td>

    <td>
      <span style="
        font-size:11px;
        font-weight:600;
        color:${isMuted
            ? 'var(--accent-danger)'
            : 'var(--accent-success)'}">

        ${isMuted
            ? '🔇 Muted'
            : isSpeaking
                ? '🟢 Speaking'
                : '🔵 Active'}
      </span>
    </td>

    <td>
      <div class="vol-wrap">
        🔊
        <input
          type="range"
          min="0"
          max="4"
          step="1"
          value="0"
          title="Volume (0=default)"
          onchange="setVolume(
            '${confName}',
            '${p.memberId}',
            this.value
          )">
      </div>
    </td>

    <td>

      <div style="
        display:flex;
        gap:5px;
        flex-wrap:wrap;
        align-items:center;
      ">

        <button
          class="btn ${isMuted ? 'btn-muted' : 'btn-mute'}"
          id="mute-btn-${confName}-${p.memberId}"

          onclick="${
            isMuted
            ? `unmuteMember('${confName}','${p.memberId}')`
            : `muteMember('${confName}','${p.memberId}')`
          }">

          ${isMuted
            ? '🔈 Unmute'
            : '🔇 Mute'}

        </button>

        <button
          class="btn btn-kick"
          onclick="kickMember(
            '${confName}',
            '${p.memberId}'
          )">

          ✂️ Kick

        </button>

      </div>

    </td>
  `;

  tbody.appendChild(tr);

});


});
  

/*      const isMuted    = p.flags && p.flags.includes('mute');
        const isSpeaking = p.isTalking;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            ${isSpeaking ? '<span class="speaking-dot"></span>' : ''}
            ${p.user}
          </td>
          <td>
            <span style="font-size:11px; font-weight:600; color:${isMuted ? 'var(--accent-danger)' : 'var(--accent-success)'}">
              ${isMuted ? '🔇 Muted' : isSpeaking ? '🟢 Speaking' : '🔵 Active'}
            </span>
          </td>
          <td>
            <div class="vol-wrap">
              🔊
              <input type="range" min="0" max="4" step="1" value="0"
                title="Volume (0=default)"
                onchange="setVolume('${confName}', '${p.memberId}', this.value)">
            </div>
          </td>
          <td>
            <div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center;">
              <button class="btn ${isMuted ? 'btn-muted' : 'btn-mute'}"
                      id="mute-btn-${confName}-${p.memberId}"
                      onclick="${isMuted ? `unmuteMember('${confName}','${p.memberId}')` : `muteMember('${confName}','${p.memberId}')`}">
                ${isMuted ? '🔈 Unmute' : '🔇 Mute'}
              </button>
              <button class="btn btn-kick" onclick="kickMember('${confName}','${p.memberId}')">✂️ Kick</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    });

*/

  } catch (err) {
    toast('error', 'Failed to load conferences', err.message);
    console.error(err);
  }
}

// ── Create Conference ─────────────────────────────────────────
async function createConference() {
  const name      = document.getElementById('confName').value.trim();
  const extension = document.getElementById('confExtension').value.trim();
  if (!name) { toast('warn', 'Missing name', 'Please enter a conference name.'); return; }
  if (!extension) { toast('warn', 'Missing extension', 'Please enter an extension to dial.'); return; }
  try {
    const res  = await fetch('/api/conferences/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, extension })
    });
    const data = await res.json();
    if (data.success) {
      toast('success', 'Conference created', `${name} is now active.`);
      document.getElementById('confName').value      = '';
      document.getElementById('confExtension').value = '';
    } else {
      toast('error', 'Failed to create conference', data.error || 'Unknown error');
    }
  } catch (err) {
    toast('error', 'Network error', err.message);
  }
}

// ── Kick ──────────────────────────────────────────────────────
async function kickMember(conferenceName, memberId) {
  const ok = await showConfirm('Kick participant', `Remove member ${memberId} from ${conferenceName}?`, 'Kick');
  if (!ok) return;
  try {
    const res  = await fetch('/api/conferences/kick', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conferenceName, memberId })
    });
    const data = await res.json();
    if (data.success) {
      toast('success', 'Kicked', `Member ${memberId} removed from ${conferenceName}.`);
      loadConferences();
    } else {
      toast('error', 'Kick failed', data.error);
    }
  } catch (err) {
    toast('error', 'Network error', err.message);
  }
}

// ── Mute ──────────────────────────────────────────────────────
async function muteMember(conferenceName, memberId) {
  try {
    const res  = await fetch('/api/conferences/mute', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conferenceName, memberId })
    });
    const data = await res.json();
    if (data.success) {
      toast('success', 'Muted', `Member ${memberId} muted.`);
      loadConferences();
    } else {
      toast('error', 'Mute failed', data.error);
    }
  } catch (err) {
    toast('error', 'Network error', err.message);
  }
}

// ── Unmute ────────────────────────────────────────────────────
async function unmuteMember(conferenceName, memberId) {
  try {
    const res  = await fetch('/api/conferences/unmute', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conferenceName, memberId })
    });
    const data = await res.json();
    if (data.success) {
      toast('success', 'Unmuted', `Member ${memberId} unmuted.`);
      loadConferences();
    } else {
      toast('error', 'Unmute failed', data.error);
    }
  } catch (err) {
    toast('error', 'Network error', err.message);
  }
}

// ── Mute All ──────────────────────────────────────────────────
async function muteAll(conferenceName) {
  const ok = await showConfirm('Mute all', `Mute all participants in ${conferenceName}?`, 'Mute All');
  if (!ok) return;
  try {
    const res  = await fetch('/api/conferences/muteall', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conferenceName })
    });
    const data = await res.json();
    if (data.success) {
      toast('success', 'All muted', `All participants in ${conferenceName} muted.`);
      loadConferences();
    } else {
      toast('error', 'Mute All failed', data.error || 'Unknown error');
    }
  } catch (err) {
    toast('error', 'Network error', err.message);
  }
}

// ── Unmute All ────────────────────────────────────────────────
async function unmuteAll(conferenceName) {
  const ok = await showConfirm('Unmute all', `Unmute all participants in ${conferenceName}?`, 'Unmute All');
  if (!ok) return;
  try {
    const res  = await fetch('/api/conferences/unmuteall', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conferenceName })
    });
    const data = await res.json();
    if (data.success) {
      toast('success', 'All unmuted', `All participants in ${conferenceName} unmuted.`);
      loadConferences();
    } else {
      toast('error', 'Unmute All failed', data.error || 'Unknown error');
    }
  } catch (err) {
    toast('error', 'Network error', err.message);
  }
}

// ── Lock / Unlock Conference ──────────────────────────────────
async function toggleLock(conferenceName, isCurrentlyLocked) {
  const action  = isCurrentlyLocked ? 'unlock' : 'lock';
  const label   = isCurrentlyLocked ? 'Unlock' : 'Lock';
  const ok      = await showConfirm(`${label} conference`, `${label} ${conferenceName}?`, label);
  if (!ok) return;
  try {
    const res  = await fetch(`/api/conferences/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conferenceName })
    });
    const data = await res.json();
    if (data.success) {
      toast('success', `Conference ${action}ed`, `${conferenceName} is now ${action}ed.`);
      loadConferences();
    } else {
      toast('error', `${label} failed`, data.error || 'Unknown error');
    }
  } catch (err) {
    toast('error', 'Network error', err.message);
  }
}

// ── Terminate Conference ──────────────────────────────────────
async function terminateConference(conferenceName) {
  const ok = await showConfirm(
    'Terminate conference',
    `This will disconnect all participants in ${conferenceName}. This cannot be undone.`,
    '⛔ Terminate'
  );
  if (!ok) return;
  try {
    const res  = await fetch('/api/conferences/terminate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conferenceName })
    });
    const data = await res.json();
    if (data.success) {
      toast('success', 'Conference terminated', `${conferenceName} has been ended.`);
      loadConferences();
    } else {
      toast('error', 'Terminate failed', data.error || 'Unknown error');
    }
  } catch (err) {
    toast('error', 'Network error', err.message);
  }
}

// ── Volume control ────────────────────────────────────────────
// Uses FreeSWITCH: conference <name> volume_in <memberId> <level>
// Level 0 = default, 1-4 = louder, negative = quieter
async function setVolume(conferenceName, memberId, level) {
  try {
    const res  = await fetch('/api/conferences/volume', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conferenceName, memberId, level: parseInt(level) })
    });
    const data = await res.json();
    if (!data.success) {
      toast('warn', 'Volume adjustment failed', data.error || 'Check server logs');
    }
    // No toast on success — slider feedback is enough
  } catch (err) {
    toast('error', 'Network error', err.message);
  }
}

// ── Monitor Conferences ───────────────────────────────────────
async function monitorConferences() {
  try {
    const participants = await fetchConferenceData();
    const statsDiv     = document.getElementById('conferenceStats');
    const updatedEl    = document.getElementById('monitor-updated');

    if (updatedEl) {
      updatedEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    }

    if (!participants.length) {
      statsDiv.innerHTML = '<div class="empty-state"><span class="icon">📡</span>No active conferences</div>';
      return;
    }

    const grouped = groupParticipants(participants);
    statsDiv.innerHTML = '';

    // Summary stat cards
    const totalConfs    = Object.keys(grouped).length;
    const totalMembers  = participants.length;
    const mutedCount    = participants.filter(p => p.flags && p.flags.includes('hear')).length;
    const speakingCount = participants.filter(p => p.isTalking).length;

    const summary = document.createElement('div');
    summary.className = 'stats-grid';
    summary.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Active conferences</div>
        <div class="stat-value">${totalConfs}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total participants</div>
        <div class="stat-value">${totalMembers}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Muted</div>
        <div class="stat-value" style="color:var(--accent-danger)">${mutedCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Speaking now</div>
        <div class="stat-value" style="color:var(--accent-success)">${speakingCount}</div>
      </div>
    `;
    statsDiv.appendChild(summary);

    // Per-conference breakdown
    Object.entries(grouped).forEach(([confName, members]) => {
      const card = document.createElement('div');
      card.className = 'stat-card';
      card.style.marginTop = '14px';
      card.innerHTML = `
        <div class="stat-label">📞 ${confName}</div>
        <div class="stat-value">${members.length}</div>
        <div class="stat-sub">
          ${members.filter(m => m.isTalking).length} speaking ·
          ${members.filter(m => m.flags && m.flags.includes('hear')).length} muted
        </div>
        <div style="margin-top:10px; font-size:12px; color:var(--text-muted);">
          ${members.map(m => `<div style="padding:2px 0;">${m.user}${m.isTalking ? ' <span style="color:var(--accent-success)">●</span>' : ''}</div>`).join('')}
        </div>
      `;
      statsDiv.appendChild(card);
    });

  } catch (err) {
    toast('error', 'Monitor failed', err.message);
    console.error(err);
  }
}

// ── Auto-refresh ──────────────────────────────────────────────
let _refreshTimer = null;

function startAutoRefresh() {
  stopAutoRefresh();
  _refreshTimer = setInterval(() => {
    const activeSection = [...document.querySelectorAll('.section')].find(s => s.style.display !== 'none');
    if (!activeSection) return;
    if (activeSection.id === 'manageConferenceSection')  loadConferences();
    if (activeSection.id === 'monitorConferenceSection') monitorConferences();
  }, 5000);
}

function stopAutoRefresh() {
  if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
}

// ── Init ──────────────────────────────────────────────────────
window.onload = () => {
  // Auto-open menus
  document.getElementById('userMenu').style.display      = 'block';
  document.getElementById('conferenceMenu').style.display = 'block';
  document.getElementById('menu-user').classList.add('open');
  document.getElementById('menu-conf').classList.add('open');

  showSection('userListSection');
  startAutoRefresh();
};
