/* Minimal auth page JS — handles submit, toasts, and remember-me */
(function(){
  const form = document.getElementById('loginForm');
  const btn  = document.getElementById('login-btn');
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const rememberInput = document.getElementById('login-remember');

  // Restore remembered username
  try { const remembered = localStorage.getItem('fs-last-user'); if (remembered) usernameInput.value = remembered; } catch(e){}

  function showToast(type, title, msg='', duration=3500){
    const icons = { success: '✅', error: '❌', warn: '⚠️', info: 'ℹ️' };
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div'); el.className = `toast toast-${type}`;
    const icon = document.createElement('span'); icon.className = 'toast-icon'; icon.textContent = icons[type];
    const body = document.createElement('div'); body.className = 'toast-body';
    const t = document.createElement('div'); t.className='toast-title'; t.textContent = title; body.appendChild(t);
    if (msg){ const m = document.createElement('div'); m.className='toast-msg'; m.textContent = msg; body.appendChild(m); }
    const close = document.createElement('button'); close.type='button'; close.className='toast-close'; close.textContent='×'; close.addEventListener('click', ()=> dismissToast(el));
    el.appendChild(icon); el.appendChild(body); el.appendChild(close); container.appendChild(el);
    if (duration>0) setTimeout(()=>dismissToast(el), duration);
  }
  function dismissToast(el){ if (!el || el.classList.contains('toast-out')) return; el.classList.add('toast-out'); el.addEventListener('animationend', ()=>el.remove(), {once:true}); }

  async function submit(e){
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const remember = rememberInput.checked;
    if (!username || !password){ showToast('warn','Missing fields','Please enter username and password'); return; }

    btn.disabled = true; btn.textContent = 'Signing in...';
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ username, password, remember })
      });
      const data = await res.json().catch(()=>null);
      if (res.ok && data && data.success) {
        try { if (remember) localStorage.setItem('fs-last-user', username); else localStorage.removeItem('fs-last-user'); } catch(e){}
        showToast('success','Signed in','Redirecting...');
        window.location.href = (data.redirect || '/');
      } else {
        const msg = (data && (data.error || data.message)) || 'Invalid credentials';
        showToast('error','Sign in failed', msg);
        btn.disabled = false; btn.textContent = 'Sign in';
      }
    } catch (err) {
      showToast('error','Network error', err.message || 'Failed to reach server');
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  }

  form.addEventListener('submit', submit);
  // Allow Enter on inputs
  [usernameInput, passwordInput].forEach(i=>i.addEventListener('keyup', (e)=>{ if (e.key === 'Enter') submit(e); }));
})();
