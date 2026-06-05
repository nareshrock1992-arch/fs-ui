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

  const iconSpan = document.createElement('span');
  iconSpan.className = 'toast-icon';
  iconSpan.textContent = icons[type];

  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'toast-body';

  const titleDiv = document.createElement('div');
  titleDiv.className = 'toast-title';
  titleDiv.textContent = title;
  bodyDiv.appendChild(titleDiv);

  if (msg) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'toast-msg';
    msgDiv.textContent = msg;
    bodyDiv.appendChild(msgDiv);
  }

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => dismissToast(el));

  el.appendChild(iconSpan);
  el.appendChild(bodyDiv);
  el.appendChild(closeBtn);
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
    const res  = await fetch('/api/users/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });
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
    const res   = await fetch('/api/users/list', { credentials: 'include' });
    const users = await res.json();
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = '';
    if (!users.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 2;
      td.innerHTML = '<div class="empty-state"><span class="icon">👤</span>No users configured</div>';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    users.forEach(u => {
      const tr = document.createElement('tr');
      const tdUser = document.createElement('td'); tdUser.textContent = u.username || '';
      const tdExt  = document.createElement('td'); tdExt.textContent  = u.extension || '';
      tr.appendChild(tdUser);
      tr.appendChild(tdExt);
      tbody.appendChild(tr);
    });
  } catch (err) {
    toast('error', 'Failed to load users', err.message);
  }
}

// ── Registrations ─────────────────────────────────────────────
async function loadRegistrations() {
  try {
    const res     = await fetch('/api/registrations', { credentials: 'include' });
    const xmlText = await res.text();
    const parser  = new DOMParser();
    const xmlDoc  = parser.parseFromString(xmlText, 'application/xml');
    const tbody   = document.querySelector('#fs-table tbody');
    tbody.innerHTML = '';
    const regs = xmlDoc.getElementsByTagName('registration');
    if (!regs.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td'); td.colSpan = 5;
      td.innerHTML = '<div class="empty-state"><span class="icon">📡</span>No registered users</div>';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    for (const reg of regs) {
      const user    = reg.getElementsByTagName('user')[0]?.textContent || '-';
      const host    = reg.getElementsByTagName('network-ip')[0]?.textContent || '-';
      const contact = reg.getElementsByTagName('contact')[0]?.textContent || '-';
      const agent   = reg.getElementsByTagName('agent')[0]?.textContent || '-';
      const status  = (reg.getElementsByTagName('status')[0]?.textContent || '-').replace(/\s+/g, ' ').trim();
      const tr = document.createElement('tr');
      const tdUser = document.createElement('td'); tdUser.textContent = user;
      const tdHost = document.createElement('td'); tdHost.textContent = host;
      const tdContact = document.createElement('td'); tdContact.textContent = contact;
      const tdAgent = document.createElement('td'); tdAgent.textContent = agent;
      const tdStatus = document.createElement('td'); tdStatus.textContent = status;
      tr.appendChild(tdUser);
      tr.appendChild(tdHost);
      tr.appendChild(tdContact);
      tr.appendChild(tdAgent);
      tr.appendChild(tdStatus);
      tbody.appendChild(tr);
    }
  } catch (err) {
    toast('error', 'Failed to load registrations', err.message);
  }
}

// ── Conferences: shared data fetch ───────────────────────────
async function fetchConferenceData() {
  const res  = await fetch('/api/conferences/list', { credentials: 'include' });
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
    const [participants, activeData] = await Promise.all([
      fetchConferenceData(),
      fetch('/api/conferences/active', { credentials: 'include' })
        .then(r => r.json())
        .catch(() => ({ conferences: [] }))
    ]);
    const activeMap = new Map((activeData.conferences || []).map(c => [c.name, c]));
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
      const isLocked = list[0]?.locked === true;

      // Conference header row
      const hdr = document.createElement('tr');
      hdr.className = 'conf-header-row';
      const td = document.createElement('td'); td.colSpan = 4;

      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'space-between';
      container.style.flexWrap = 'wrap';
      container.style.gap = '8px';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'conf-title';
      titleWrap.textContent = `🎙️ ${confName}`;

      const activeInfo = activeMap.get(confName);
      if (activeInfo) {
        const elapsed = formatElapsedTime(activeInfo.elapsedMinutes);
        const timer = document.createElement('span');
        timer.className = 'conf-timer';
        timer.textContent = `⏱ ${elapsed}`;
        timer.style.marginLeft = '10px';
        timer.style.fontSize = '12px';
        timer.style.color = 'var(--text-muted)';
        titleWrap.appendChild(timer);
      }

      const badge = document.createElement('span');
      badge.className = 'conf-badge';
      badge.textContent = `${list.length} member${list.length !== 1 ? 's' : ''}`;
      titleWrap.appendChild(badge);

      if (isLocked) {
        const locked = document.createElement('span');
        locked.className = 'conf-badge locked';
        locked.textContent = '🔒 Locked';
        titleWrap.appendChild(locked);
      }

      const actions = document.createElement('div');
      actions.className = 'conf-actions';

      const btnMuteAll = document.createElement('button'); btnMuteAll.type = 'button'; btnMuteAll.className = 'btn btn-mute-all'; btnMuteAll.textContent = 'Mute All'; btnMuteAll.addEventListener('click', () => muteAll(confName));
      const btnUnmuteAll = document.createElement('button'); btnUnmuteAll.type = 'button'; btnUnmuteAll.className = 'btn btn-mute-all'; btnUnmuteAll.textContent = 'Unmute All'; btnUnmuteAll.style.color = 'var(--accent-success)'; btnUnmuteAll.style.borderColor = 'rgba(22,163,74,0.2)'; btnUnmuteAll.style.background = 'rgba(22,163,74,0.06)'; btnUnmuteAll.addEventListener('click', () => unmuteAll(confName));
      const btnLock = document.createElement('button'); btnLock.type = 'button'; btnLock.className = 'btn btn-lock'; btnLock.textContent = isLocked ? '🔓 Unlock' : '🔒 Lock'; btnLock.addEventListener('click', () => toggleLock(confName, isLocked));
      const btnTerminate = document.createElement('button'); btnTerminate.type = 'button'; btnTerminate.className = 'btn btn-terminate'; btnTerminate.textContent = '⛔ Terminate'; btnTerminate.addEventListener('click', () => terminateConference(confName));

      actions.appendChild(btnMuteAll);
      actions.appendChild(btnUnmuteAll);
      actions.appendChild(btnLock);
      actions.appendChild(btnTerminate);

      container.appendChild(titleWrap);
      container.appendChild(actions);
      td.appendChild(container);
      hdr.appendChild(td);
      tbody.appendChild(hdr);

      // Participant rows
      list.forEach(p => {
        const isMuted = Array.isArray(p.flags) ? !p.flags.includes('speak') : true;
        const isSpeaking = !!p.isTalking;

        const tr = document.createElement('tr');

        // Name cell
        const tdName = document.createElement('td');
        if (isSpeaking) {
          const dot = document.createElement('span'); dot.className = 'speaking-dot'; tdName.appendChild(dot);
        }
        const nameSpan = document.createElement('span'); nameSpan.textContent = p.user || 'Unknown'; tdName.appendChild(nameSpan);

        // Status cell
        const tdStatus = document.createElement('td');
        const statusSpan = document.createElement('span');
        statusSpan.style.fontSize = '11px'; statusSpan.style.fontWeight = '600';
        statusSpan.style.color = isMuted ? 'var(--accent-danger)' : 'var(--accent-success)';
        statusSpan.textContent = isMuted ? '🔇 Muted' : (isSpeaking ? '🟢 Speaking' : '🔵 Active');
        tdStatus.appendChild(statusSpan);

        // Volume cell
        const tdVol = document.createElement('td');
        const volWrap = document.createElement('div'); volWrap.className = 'vol-wrap';
        volWrap.textContent = '🔊 ';
        const input = document.createElement('input');
        input.type = 'range'; input.min = '0'; input.max = '4'; input.step = '1'; input.value = '0'; input.title = 'Volume (0=default)';
        input.addEventListener('change', () => setVolume(confName, p.memberId, input.value));
        volWrap.appendChild(input);
        tdVol.appendChild(volWrap);

        // Actions cell
        const tdActions = document.createElement('td');
        const actionsWrap = document.createElement('div');
        actionsWrap.style.display = 'flex'; actionsWrap.style.gap = '5px'; actionsWrap.style.flexWrap = 'wrap'; actionsWrap.style.alignItems = 'center';

        const btnMute = document.createElement('button'); btnMute.type = 'button'; btnMute.className = `btn ${isMuted ? 'btn-muted' : 'btn-mute'}`; btnMute.id = `mute-btn-${confName}-${p.memberId}`;
        btnMute.textContent = isMuted ? '🔈 Unmute' : '🔇 Mute';
        btnMute.addEventListener('click', () => {
          if (isMuted) unmuteMember(confName, p.memberId); else muteMember(confName, p.memberId);
        });

        const btnKick = document.createElement('button'); btnKick.type = 'button'; btnKick.className = 'btn btn-kick'; btnKick.textContent = '✂️ Kick'; btnKick.addEventListener('click', () => kickMember(confName, p.memberId));

        actionsWrap.appendChild(btnMute);
        actionsWrap.appendChild(btnKick);
        tdActions.appendChild(actionsWrap);

        tr.appendChild(tdName);
        tr.appendChild(tdStatus);
        tr.appendChild(tdVol);
        tr.appendChild(tdActions);
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
      credentials: 'include',
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
      credentials: 'include',
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
      credentials: 'include',
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
      credentials: 'include',
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
      credentials: 'include',
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
      credentials: 'include',
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
      credentials: 'include',
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
      credentials: 'include',
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
      credentials: 'include',
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
    const activeConfs = await fetch('/api/conferences/active', { credentials: 'include' }).then(r => r.json()).catch(() => ({ conferences: [] }));
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

    // Create a map of conference start times
    const confTimings = {};
    (activeConfs.conferences || []).forEach(c => {
      confTimings[c.name] = {
        startedAt: c.startedAt,
        elapsedMinutes: c.elapsedMinutes
      };
    });

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
      const timing = confTimings[confName] || {};
      const elapsedMinutes = timing.elapsedMinutes || 0;
      const elapsedStr = formatElapsedTime(elapsedMinutes);

      const card = document.createElement('div');
      card.className = 'stat-card';
      card.style.marginTop = '14px';
      card.innerHTML = `
        <div class="stat-label">📞 ${confName}</div>
        <div class="stat-value">${members.length}</div>
        <div class="stat-sub">
          ⏱ ${elapsedStr} · 
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

function formatElapsedTime(minutes) {
  const mins = Math.floor(minutes);
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
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

// ── Logout ────────────────────────────────────────────────────
async function logout() {
  try {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    if (res.ok) {
      toast('success', 'Logged out', 'Redirecting to login...');
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 1500);
    }
  } catch (err) {
    toast('error', 'Logout failed', err.message);
  }
}

// ── Admin Users ───────────────────────────────────────────────
async function loadAdminUsers() {
  try {
    const res = await fetch('/api/auth/users', { credentials: 'include' });
    const users = await res.json();
    const tbody = document.querySelector('#admin-table tbody');
    tbody.innerHTML = '';
    if (!users.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 2;
      td.innerHTML = '<div class="empty-state"><span class="icon">👤</span>No users</div>';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    users.forEach(u => {
      const tr = document.createElement('tr');
      const tdUser = document.createElement('td'); tdUser.textContent = u.username || '';
      const tdAdmin = document.createElement('td'); tdAdmin.textContent = u.isAdmin ? '✅ Admin' : '❌ User';
      tr.appendChild(tdUser);
      tr.appendChild(tdAdmin);
      tbody.appendChild(tr);
    });
  } catch (err) {
    toast('error', 'Failed to load admin users', err.message);
  }
}

async function createAdminUser() {
  const username = document.getElementById('adminUsername').value.trim();
  const password = document.getElementById('adminPassword').value.trim();
  if (!username || !password) {
    toast('warn', 'Missing fields', 'Please enter both username and password.');
    return;
  }
  if (password.length < 6) {
    toast('warn', 'Weak password', 'Password must be at least 6 characters.');
    return;
  }
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password, isAdmin: true })
    });
    const data = await res.json();
    if (data.success) {
      toast('success', 'Admin user created', `${username} added as admin.`);
      document.getElementById('adminUsername').value = '';
      document.getElementById('adminPassword').value = '';
      loadAdminUsers();
    } else {
      toast('error', 'Failed to create admin', data.error || 'Unknown error');
    }
  } catch (err) {
    toast('error', 'Network error', err.message);
  }
}

// ── Init ──────────────────────────────────────────────────────
window.onload = () => {
  // Auto-open conference menu first
  document.getElementById('conferenceMenu').style.display = 'block';
  document.getElementById('menu-conf').classList.add('open');

  // Keep user menu collapsed by default, but available below
  document.getElementById('userMenu').style.display      = 'none';
  document.getElementById('menu-user').classList.remove('open');

  showSection('manageConferenceSection');
  startAutoRefresh();
};
