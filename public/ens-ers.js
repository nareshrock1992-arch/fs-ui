/**
 * ens-ers.js — Frontend CRUD logic for ENS/ERS Organization Management.
 *
 * Functions are parameterized by `mod` ('ens' | 'ers') so both services share
 * the same code with different table/input targets.
 *
 * Depends on: toast(), showConfirm() from app.js.
 */

const API = {
  orgs: '/api/organizations',
  depts: '/api/departments',
  contacts: '/api/contacts',
  groups: '/api/responders',
  reports: '/api/reports',
};

// ── Helpers ───────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }

function emptyRow(cols, msg) {
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = cols;
  td.innerHTML = `<div class="empty-state"><span class="icon">📭</span>${msg}</div>`;
  tr.appendChild(td);
  return tr;
}

async function apiFetch(url, opts = {}) {
  opts.credentials = 'include';
  opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Organizations ─────────────────────────────────────────────
async function loadOrgs(mod) {
  try {
    const data = await apiFetch(`${API.orgs}?module=${mod}`);
    const tbody = document.querySelector(`#${mod}-orgs-table tbody`);
    tbody.innerHTML = '';
    if (!data.organizations.length) { tbody.appendChild(emptyRow(5, 'No organizations')); return; }
    data.organizations.forEach(o => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${esc(o.name)}</td>
        <td>${esc(o.type)}</td>
        <td>${esc(o.description || '')}</td>
        <td>${o.active ? '✓ Active' : '✗ Inactive'}</td>
        <td>
          <button class="btn btn-sm" onclick="toggleOrgActive('${o.id}','${mod}',${!o.active})">${o.active ? 'Deactivate' : 'Activate'}</button>
          <button class="btn btn-sm btn-danger" onclick="deleteOrg('${o.id}','${mod}')">Delete</button>
        </td>`;
      tbody.appendChild(tr);
    });
  } catch (err) { toast('error', 'Failed to load organizations', err.message); }
}

async function createOrg(mod) {
  const name = el(`${mod}-org-name`).value.trim();
  const type = el(`${mod}-org-type`).value.trim() || 'default';
  const description = el(`${mod}-org-desc`).value.trim();
  if (!name) { toast('warn', 'Name required'); return; }
  try {
    await apiFetch(API.orgs, { method: 'POST', body: JSON.stringify({ name, type, description, modules: mod }) });
    toast('success', 'Organization created', name);
    el(`${mod}-org-name`).value = '';
    el(`${mod}-org-desc`).value = '';
    loadOrgs(mod);
  } catch (err) { toast('error', 'Failed to create organization', err.message); }
}

async function toggleOrgActive(id, mod, active) {
  try {
    await apiFetch(`${API.orgs}/${id}`, { method: 'PUT', body: JSON.stringify({ active }) });
    loadOrgs(mod);
  } catch (err) { toast('error', 'Update failed', err.message); }
}

async function deleteOrg(id, mod) {
  const ok = await showConfirm('Delete Organization', 'This will also delete all departments, contacts, and groups under it. Continue?', 'Delete');
  if (!ok) return;
  try {
    await apiFetch(`${API.orgs}/${id}`, { method: 'DELETE' });
    toast('success', 'Organization deleted');
    loadOrgs(mod);
  } catch (err) { toast('error', 'Delete failed', err.message); }
}

// ── Departments ───────────────────────────────────────────────
async function loadDepts(mod) {
  try {
    await populateOrgSelect(`${mod}-dept-org`, mod);
    const data = await apiFetch(`${API.depts}?module=${mod}`);
    const tbody = document.querySelector(`#${mod}-depts-table tbody`);
    tbody.innerHTML = '';
    if (!data.departments.length) { tbody.appendChild(emptyRow(4, 'No departments')); return; }
    data.departments.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${esc(d.name)}</td>
        <td>${esc(d.Organization ? d.Organization.name : '')}</td>
        <td>${esc(d.description || '')}</td>
        <td><button class="btn btn-sm btn-danger" onclick="deleteDept('${d.id}','${mod}')">Delete</button></td>`;
      tbody.appendChild(tr);
    });
  } catch (err) { toast('error', 'Failed to load departments', err.message); }
}

async function createDept(mod) {
  const organization_Id = el(`${mod}-dept-org`).value;
  const name = el(`${mod}-dept-name`).value.trim();
  const description = el(`${mod}-dept-desc`).value.trim();
  if (!name || !organization_Id) { toast('warn', 'Name and organization required'); return; }
  try {
    await apiFetch(API.depts, { method: 'POST', body: JSON.stringify({ name, description, modules: mod, organization_Id }) });
    toast('success', 'Department created', name);
    el(`${mod}-dept-name`).value = '';
    el(`${mod}-dept-desc`).value = '';
    loadDepts(mod);
  } catch (err) { toast('error', 'Failed to create department', err.message); }
}

async function deleteDept(id, mod) {
  const ok = await showConfirm('Delete Department', 'Contacts in this department will have their department cleared. Continue?', 'Delete');
  if (!ok) return;
  try {
    await apiFetch(`${API.depts}/${id}`, { method: 'DELETE' });
    toast('success', 'Department deleted');
    loadDepts(mod);
  } catch (err) { toast('error', 'Delete failed', err.message); }
}

// ── Contacts (Users) ──────────────────────────────────────────
async function loadContacts(mod) {
  try {
    await populateOrgSelect(`${mod}-contact-org`, mod);
    await populateDeptSelect(mod);
    const data = await apiFetch(`${API.contacts}?module=${mod}`);
    const tbody = document.querySelector(`#${mod}-contacts-table tbody`);
    tbody.innerHTML = '';
    if (!data.contacts.length) { tbody.appendChild(emptyRow(7, 'No users / contacts')); return; }
    data.contacts.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${esc(c.name)}</td>
        <td>${esc(c.role)}</td>
        <td>${esc(c.phone)}</td>
        <td>${esc(c.email || '')}</td>
        <td>${esc(c.Organization ? c.Organization.name : '')}</td>
        <td>${esc(c.Department ? c.Department.name : '—')}</td>
        <td><button class="btn btn-sm btn-danger" onclick="deleteContact('${c.id}','${mod}')">Delete</button></td>`;
      tbody.appendChild(tr);
    });
  } catch (err) { toast('error', 'Failed to load contacts', err.message); }
}

async function createContact(mod) {
  const organization_Id = el(`${mod}-contact-org`).value;
  const department_Id = el(`${mod}-contact-dept`).value || null;
  const name = el(`${mod}-contact-name`).value.trim();
  const role = el(`${mod}-contact-role`).value.trim() || 'member';
  const phone = el(`${mod}-contact-phone`).value.trim();
  const email = el(`${mod}-contact-email`).value.trim();
  if (!name || !phone || !organization_Id) { toast('warn', 'Name, phone, and organization required'); return; }
  try {
    await apiFetch(API.contacts, { method: 'POST', body: JSON.stringify({ name, role, phone, email, organization_Id, department_Id, modules: mod }) });
    toast('success', 'User added', name);
    el(`${mod}-contact-name`).value = '';
    el(`${mod}-contact-phone`).value = '';
    el(`${mod}-contact-email`).value = '';
    loadContacts(mod);
  } catch (err) { toast('error', 'Failed to add user', err.message); }
}

async function deleteContact(id, mod) {
  const ok = await showConfirm('Delete Contact', 'Remove this user from the system?', 'Delete');
  if (!ok) return;
  try {
    await apiFetch(`${API.contacts}/${id}`, { method: 'DELETE' });
    toast('success', 'User deleted');
    loadContacts(mod);
  } catch (err) { toast('error', 'Delete failed', err.message); }
}

// ── Groups (Responders) ───────────────────────────────────────
async function loadGroups(mod) {
  try {
    await populateOrgSelect(`${mod}-group-org`, mod);
    const data = await apiFetch(`${API.groups}?module=${mod}`);
    const tbody = document.querySelector(`#${mod}-groups-table tbody`);
    tbody.innerHTML = '';
    if (!data.responders.length) { tbody.appendChild(emptyRow(5, 'No groups')); return; }
    for (const g of data.responders) {
      // Fetch members count for display
      let memberCount = '—';
      try {
        const detail = await apiFetch(`${API.groups}/${g.id}`);
        memberCount = detail.responder.Contacts ? detail.responder.Contacts.length : 0;
      } catch (_) {}
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${esc(g.name)}</td>
        <td>${esc(g.description || '')}</td>
        <td>${esc(g.Organization ? g.Organization.name : '')}</td>
        <td>${memberCount}</td>
        <td>
          <button class="btn btn-sm" onclick="manageMembers('${g.id}','${mod}')">Members</button>
          <button class="btn btn-sm btn-danger" onclick="deleteGroup('${g.id}','${mod}')">Delete</button>
        </td>`;
      tbody.appendChild(tr);
    }
  } catch (err) { toast('error', 'Failed to load groups', err.message); }
}

async function createGroup(mod) {
  const organization_Id = el(`${mod}-group-org`).value;
  const name = el(`${mod}-group-name`).value.trim();
  const description = el(`${mod}-group-desc`).value.trim();
  if (!name || !organization_Id) { toast('warn', 'Name and organization required'); return; }
  try {
    await apiFetch(API.groups, { method: 'POST', body: JSON.stringify({ name, description, modules: mod, organization_Id }) });
    toast('success', 'Group created', name);
    el(`${mod}-group-name`).value = '';
    el(`${mod}-group-desc`).value = '';
    loadGroups(mod);
  } catch (err) { toast('error', 'Failed to create group', err.message); }
}

async function deleteGroup(id, mod) {
  const ok = await showConfirm('Delete Group', 'This will remove the group and all member associations. Continue?', 'Delete');
  if (!ok) return;
  try {
    await apiFetch(`${API.groups}/${id}`, { method: 'DELETE' });
    toast('success', 'Group deleted');
    loadGroups(mod);
  } catch (err) { toast('error', 'Delete failed', err.message); }
}

async function manageMembers(groupId, mod) {
  try {
    const detail = await apiFetch(`${API.groups}/${groupId}`);
    const group = detail.responder;
    const contacts = (await apiFetch(`${API.contacts}?module=${mod}`)).contacts;
    const currentIds = (group.Contacts || []).map(c => c.id);

    let html = `<h3 style="margin-top:0;">Members of "${esc(group.name)}"</h3>`;
    html += '<div style="max-height:300px;overflow-y:auto;">';
    contacts.forEach(c => {
      const checked = currentIds.includes(c.id) ? 'checked' : '';
      html += `<label style="display:block;margin:4px 0;cursor:pointer;"><input type="checkbox" value="${c.id}" ${checked}> ${esc(c.name)} (${esc(c.phone)})</label>`;
    });
    html += '</div>';
    html += `<button class="btn" style="margin-top:12px;" id="save-members-btn">Save Members</button>`;

    // Use a modal overlay
    let overlay = document.getElementById('members-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'members-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;';
      document.body.appendChild(overlay);
    }
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--bg-primary,#1e1e2e);padding:20px;border-radius:10px;min-width:320px;max-width:500px;color:var(--text-primary,#fff);';
    box.innerHTML = html;
    overlay.innerHTML = '';
    overlay.appendChild(box);
    overlay.style.display = 'flex';

    // Close on click outside
    overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = 'none'; };

    document.getElementById('save-members-btn').onclick = async () => {
      const checkboxes = box.querySelectorAll('input[type=checkbox]');
      const contactIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
      try {
        await apiFetch(`${API.groups}/${groupId}`, { method: 'PUT', body: JSON.stringify({ contactIds }) });
        toast('success', 'Members updated');
        overlay.style.display = 'none';
        loadGroups(mod);
      } catch (err) { toast('error', 'Failed to save members', err.message); }
    };
  } catch (err) { toast('error', 'Failed to load member data', err.message); }
}

// ── Reports ───────────────────────────────────────────────────
async function loadReports(mod) {
  try {
    const data = await apiFetch(`${API.reports}?module=${mod}&limit=200`);
    const tbody = document.querySelector(`#${mod}-reports-table tbody`);
    tbody.innerHTML = '';
    if (!data.reports.length) { tbody.appendChild(emptyRow(6, 'No blast reports yet')); return; }
    data.reports.forEach(r => {
      const tr = document.createElement('tr');
      const date = r.created_at ? new Date(r.created_at).toLocaleString() : '—';
      tr.innerHTML = `
        <td>${esc(date)}</td>
        <td>${esc(r.caller_id || '')}</td>
        <td>${esc(r.blasted_to || '')}</td>
        <td>${esc(r.blast_status || '')}</td>
        <td>${esc(r.attendance_status || '')}</td>
        <td>${r.record_duration != null ? r.record_duration + 's' : '—'}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) { toast('error', 'Failed to load reports', err.message); }
}

// ── Shared: populate org dropdown ─────────────────────────────
async function populateOrgSelect(selectId, mod) {
  const sel = el(selectId);
  if (!sel) return;
  const current = sel.value;
  try {
    const data = await apiFetch(`${API.orgs}?module=${mod}`);
    sel.innerHTML = '<option value="">— Select organization —</option>';
    data.organizations.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.name;
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  } catch (_) {}
}

// ── Shared: populate dept dropdown (depends on selected org) ──
async function populateDeptSelect(mod) {
  const orgSel = el(`${mod}-contact-org`);
  const deptSel = el(`${mod}-contact-dept`);
  if (!orgSel || !deptSel) return;
  const orgId = orgSel.value;
  deptSel.innerHTML = '<option value="">— None —</option>';
  if (!orgId) return;
  try {
    const data = await apiFetch(`${API.depts}?module=${mod}&organization_Id=${orgId}`);
    data.departments.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name;
      deptSel.appendChild(opt);
    });
  } catch (_) {}
}

// ── Escape HTML ───────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return str.toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
