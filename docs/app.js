const SUPABASE_URL  = 'https://tsbuquzmdnwyebbqqnao.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzYnVxdXptZG53eWViYnFxbmFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwOTA0NjgsImV4cCI6MjA5NzY2NjQ2OH0.hnjkdPfKc6pBAWGQwRndZXYzB4yQGdtWjXVnrUtk4C8';

// Auth
function showApp() {
  document.getElementById('auth-gate').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  Nav.init();
  App.init();
}

function showAuthGate() {
  document.getElementById('auth-gate').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

const Auth = {
  _token: null,

  async init() {
    const stored = sessionStorage.getItem('sb_token');
    if (stored && await this._verify(stored)) {
      this._token = stored;
      showApp();
    } else {
      sessionStorage.removeItem('sb_token');
      showAuthGate();
    }
  },

  async login() {
    const email    = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errEl    = document.getElementById('auth-error');
    const btn      = document.getElementById('login-btn');

    if (!email || !password) {
      errEl.textContent = '이메일과 비밀번호를 입력하세요.';
      return;
    }

    btn.disabled = true;
    btn.textContent = '로그인 중...';
    errEl.textContent = '';

    try {
      const res = await fetch(
        `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
          body: JSON.stringify({ email, password }),
        }
      );

      if (!res.ok) {
        errEl.textContent = '이메일 또는 비밀번호가 올바르지 않습니다.';
        return;
      }

      const data = await res.json();
      this._token = data.access_token;
      sessionStorage.setItem('sb_token', this._token);
      showApp();
    } catch {
      errEl.textContent = '네트워크 오류가 발생했습니다.';
    } finally {
      btn.disabled = false;
      btn.textContent = '로그인';
    }
  },

  async logout() {
    if (this._token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this._token}`, apikey: SUPABASE_ANON },
      }).catch(() => {});
    }
    this._token = null;
    sessionStorage.removeItem('sb_token');
    showAuthGate();
  },

  async _verify(token) {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON },
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  getToken() { return this._token; },
};

Auth.init();

document.getElementById('login-btn').addEventListener('click', () => Auth.login());
document.getElementById('auth-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') Auth.login();
});
document.getElementById('logout-btn').addEventListener('click', () => Auth.logout());

// Navigation
const Nav = {
  init() {
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.page));
    });
  },
  navigate(page) {
    document.querySelectorAll('.nav-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.page === page));
    document.getElementById('page-dashboard').style.display = page === 'dashboard' ? 'block' : 'none';
    document.getElementById('page-stocks').style.display   = page === 'stocks'    ? 'block' : 'none';
    if (page === 'stocks') ConfigEditor.load();
  },
};

// Dashboard
const App = {
  async init() {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/monitor_history?order=date.desc,id.desc&limit=90`,
        { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
      );
      const rows = await res.json();
      const data = rows.map(r => ({
        date:       r.date,
        ticker:     r.ticker,
        current:    r.current_price,
        ath:        r.ath,
        drop_pct:   r.drop_pct,
        alert_sent: r.alert_sent,
        vix:        r.vix,
        ma50:       r.ma50,
        ma200:      r.ma200,
      }));
      this.renderSummary(data);
      this.renderTable(data);
      this.renderLastUpdated(data);
    } catch (e) {
      document.getElementById('summary').innerHTML =
        '<p class="empty">데이터를 불러올 수 없습니다.</p>';
    }
  },

  dropClass(pct) {
    if (pct >= 20) return 'danger';
    if (pct >= 15) return 'alert';
    if (pct >= 10) return 'warn';
    return 'safe';
  },

  vixClass(v) {
    if (v >= 30) return 'danger';
    if (v >= 20) return 'alert';
    if (v >= 15) return 'warn';
    return 'safe';
  },

  vixLabel(v) {
    if (v >= 30) return '극도 공포';
    if (v >= 20) return '공포';
    if (v >= 15) return '보통';
    return '안정';
  },

  maClass(pct) {
    if (pct >= 5)  return 'safe';
    if (pct >= 0)  return 'warn';
    return 'danger';
  },

  renderThresholdBars(drop_pct) {
    const thresholds = [10, 15, 20];
    return `
      <div class="threshold-bars">
        ${thresholds.map(t => {
          const filled = Math.min(drop_pct / t * 100, 100).toFixed(0);
          const fired  = drop_pct >= t;
          const remain = fired ? '발송됨' : `-${(t - drop_pct).toFixed(1)}% 남음`;
          const cls    = t >= 20 ? 'danger' : t >= 15 ? 'alert' : 'warn';
          return `
            <div class="threshold-row">
              <span class="threshold-label">${t}%</span>
              <div class="gauge-bar threshold-gauge">
                <div class="gauge-fill ${cls}" style="width:${filled}%"></div>
              </div>
              <span class="threshold-remain ${fired ? cls : ''}">${remain}</span>
            </div>`;
        }).join('')}
      </div>`;
  },

  renderVixGauge(v) {
    if (v == null) return '<span style="color:#475569">—</span>';
    const pct = Math.min(v / 50 * 100, 100).toFixed(1);
    const cls = this.vixClass(v);
    return `
      <div class="gauge-wrap">
        <div class="gauge-bar">
          <div class="gauge-fill ${cls}" style="width:${pct}%"></div>
        </div>
        <div class="gauge-labels">
          <span>안정</span><span>보통</span><span>공포</span><span>극도</span>
        </div>
      </div>
    `;
  },

  renderSummary(data) {
    const el = document.getElementById('summary');
    if (!data.length) {
      el.innerHTML = '<p class="empty">아직 기록이 없습니다. 첫 번째 실행 후 표시됩니다.</p>';
      return;
    }
    const latest = data[0];
    const cls  = this.dropClass(latest.drop_pct);
    const vCls = latest.vix != null ? this.vixClass(latest.vix) : '';
    const vLbl = latest.vix != null ? this.vixLabel(latest.vix) : '—';
    const ma50pct  = latest.ma50  != null ? ((latest.current / latest.ma50  - 1) * 100) : null;
    const ma200pct = latest.ma200 != null ? ((latest.current / latest.ma200 - 1) * 100) : null;
    const ma50Cls  = ma50pct  != null ? this.maClass(ma50pct)  : '';
    const ma200Cls = ma200pct != null ? this.maClass(ma200pct) : '';

    el.innerHTML = `
      <div class="card">
        <div class="label">현재가</div>
        <div class="value">$${Number(latest.current).toFixed(2)}</div>
        <div class="meta">${latest.ticker} · ${latest.date}</div>
      </div>
      <div class="card">
        <div class="label">역대 신고점</div>
        <div class="value">$${Number(latest.ath).toFixed(2)}</div>
        <div class="meta">수정주가 기준</div>
      </div>
      <div class="card">
        <div class="label">신고점 대비 하락률</div>
        <div class="value ${cls}">-${Number(latest.drop_pct).toFixed(2)}%</div>
        <div class="meta">${latest.alert_sent ? `⚠️ ${latest.alert_sent}% 알림 발송` : '알림 없음'}</div>
        ${this.renderThresholdBars(latest.drop_pct)}
      </div>
      <div class="card">
        <div class="label">VIX 공포지수</div>
        <div class="value ${vCls}">${latest.vix != null ? Number(latest.vix).toFixed(1) : '—'}</div>
        <div class="meta">${vLbl}</div>
        ${latest.vix != null ? this.renderVixGauge(latest.vix) : ''}
      </div>
      <div class="card">
        <div class="label">MA50 대비</div>
        <div class="value ${ma50Cls}">${ma50pct != null ? (ma50pct >= 0 ? '+' : '') + ma50pct.toFixed(2) + '%' : '—'}</div>
        <div class="meta">${latest.ma50 != null ? `$${Number(latest.ma50).toFixed(2)}` : '데이터 없음'}</div>
      </div>
      <div class="card">
        <div class="label">MA200 대비</div>
        <div class="value ${ma200Cls}">${ma200pct != null ? (ma200pct >= 0 ? '+' : '') + ma200pct.toFixed(2) + '%' : '—'}</div>
        <div class="meta">${latest.ma200 != null ? `$${Number(latest.ma200).toFixed(2)}` : '데이터 없음'}</div>
      </div>
    `;
  },

  renderTable(data) {
    const tbody = document.getElementById('history-body');
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">기록 없음</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(row => {
      const cls  = this.dropClass(row.drop_pct);
      const vCls = row.vix != null ? this.vixClass(row.vix) : '';
      const alertCell = row.alert_sent
        ? `<span class="badge">${row.alert_sent}% 발송</span>`
        : '<span style="color:#475569">—</span>';
      const vixCell = row.vix != null ? `
        <div style="display:flex;align-items:center;gap:6px">
          <span class="${vCls}">${Number(row.vix).toFixed(1)}</span>
          <div class="mini-gauge"><div class="mini-fill ${vCls}" style="width:${Math.min(row.vix/50*100,100).toFixed(0)}%"></div></div>
        </div>` : '<span style="color:#475569">—</span>';
      const ma50pct  = row.ma50  != null ? ((row.current / row.ma50  - 1) * 100) : null;
      const ma200pct = row.ma200 != null ? ((row.current / row.ma200 - 1) * 100) : null;
      const fmtMa = pct => pct != null
        ? `<span class="${this.maClass(pct)}">${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</span>`
        : '<span style="color:#475569">—</span>';
      return `
        <tr class="${row.alert_sent ? 'alerted' : ''}">
          <td>${row.date}</td>
          <td>${row.ticker}</td>
          <td>$${Number(row.current).toFixed(2)}</td>
          <td class="${cls}">-${Number(row.drop_pct).toFixed(2)}%</td>
          <td>${vixCell}</td>
          <td>${fmtMa(ma50pct)}</td>
          <td>${fmtMa(ma200pct)}</td>
          <td>${alertCell}</td>
        </tr>
      `;
    }).join('');
  },

  renderLastUpdated(data) {
    if (!data.length) return;
    document.getElementById('last-updated').textContent =
      `마지막 업데이트: ${data[0].date}`;
  },
};

// Stock Management
const ConfigEditor = {
  sha: null,
  stocks: [],
  _editIndex: null,

  async load() {
    const list = document.getElementById('stocks-list');
    list.innerHTML = '<p class="empty">불러오는 중...</p>';
    try {
      const res = await fetch('/api/get-config');
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      this.sha    = data.sha;
      this.stocks = data.stocks || [];
      this.render();
    } catch (e) {
      list.innerHTML = '<p class="empty">설정을 불러올 수 없습니다.</p>';
    }
  },

  render() {
    const el = document.getElementById('stocks-list');
    if (!this.stocks.length) {
      el.innerHTML = '<p class="empty">종목이 없습니다. 추가 버튼을 눌러 시작하세요.</p>';
      return;
    }
    el.innerHTML = this.stocks.map((s, i) => `
      <div class="stock-item card">
        <div>
          <div class="stock-ticker">${s.ticker}</div>
          <div class="stock-alerts">알림 임계값: ${s.alerts.join(', ')}%</div>
        </div>
        <div class="stock-actions">
          <button class="btn-ghost" onclick="ConfigEditor.openEdit(${i})">편집</button>
          <button class="btn-ghost danger" onclick="ConfigEditor.confirmDelete(${i})">삭제</button>
        </div>
      </div>`).join('');
  },

  openAdd() {
    this._editIndex = null;
    document.getElementById('modal-title').textContent = '종목 추가';
    document.getElementById('modal-ticker').value = '';
    document.getElementById('modal-ticker').disabled = false;
    document.getElementById('modal-alerts').value = '';
    document.getElementById('stock-modal').style.display = 'flex';
    document.getElementById('modal-ticker').focus();
  },

  openEdit(i) {
    const s = this.stocks[i];
    this._editIndex = i;
    document.getElementById('modal-title').textContent = '종목 편집';
    document.getElementById('modal-ticker').value = s.ticker;
    document.getElementById('modal-ticker').disabled = true;
    document.getElementById('modal-alerts').value = s.alerts.join(', ');
    document.getElementById('stock-modal').style.display = 'flex';
    document.getElementById('modal-alerts').focus();
  },

  closeModal() {
    document.getElementById('stock-modal').style.display = 'none';
  },

  async saveModal() {
    const ticker = document.getElementById('modal-ticker').value.trim().toUpperCase();
    const alertsRaw = document.getElementById('modal-alerts').value;
    const alerts = alertsRaw.split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0);

    if (!ticker) { alert('티커 심볼을 입력하세요.'); return; }
    if (!alerts.length) { alert('유효한 임계값을 입력하세요. (예: 10, 15, 20)'); return; }

    const btn = document.getElementById('modal-save');
    btn.disabled = true;
    btn.textContent = '저장 중...';

    const newStocks = [...this.stocks];
    if (this._editIndex !== null) {
      newStocks[this._editIndex] = { ticker: newStocks[this._editIndex].ticker, alerts };
    } else {
      if (newStocks.find(s => s.ticker === ticker)) {
        alert('이미 존재하는 티커입니다.');
        btn.disabled = false;
        btn.textContent = '저장';
        return;
      }
      newStocks.push({ ticker, alerts });
    }

    const ok = await this._save(newStocks);
    btn.disabled = false;
    btn.textContent = '저장';
    if (ok) this.closeModal();
  },

  confirmDelete(i) {
    if (!confirm(`${this.stocks[i].ticker}을(를) 삭제할까요?`)) return;
    this._save(this.stocks.filter((_, idx) => idx !== i));
  },

  async _save(newStocks) {
    const token = Auth.getToken();
    if (!token) { alert('로그인이 필요합니다.'); return false; }

    try {
      const res = await fetch('/api/update-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ stocks: newStocks, sha: this.sha }),
      });

      if (res.status === 409) {
        alert('다른 곳에서 설정이 변경되었습니다. 목록을 새로 불러옵니다.');
        await this.load();
        return false;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert('저장 실패: ' + (err.error || res.status));
        return false;
      }

      const data = await res.json();
      this.sha    = data.sha;
      this.stocks = newStocks;
      this.render();
      return true;
    } catch (e) {
      alert('네트워크 오류가 발생했습니다.');
      return false;
    }
  },
};

// Modal event bindings
document.getElementById('add-stock-btn').addEventListener('click', () => ConfigEditor.openAdd());
document.getElementById('modal-cancel').addEventListener('click', () => ConfigEditor.closeModal());
document.getElementById('modal-save').addEventListener('click', () => ConfigEditor.saveModal());
document.getElementById('stock-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) ConfigEditor.closeModal();
});
document.getElementById('modal-ticker').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('modal-alerts').focus();
});
document.getElementById('modal-alerts').addEventListener('keydown', e => {
  if (e.key === 'Enter') ConfigEditor.saveModal();
});
