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
    document.getElementById('page-history').style.display   = page === 'history'   ? 'block' : 'none';
    document.getElementById('page-stocks').style.display    = page === 'stocks'    ? 'block' : 'none';
    if (page === 'dashboard') App.init();
    if (page === 'stocks')    ConfigEditor.load();
  },
};

// ── 종목 카드 정의 (추가/삭제: 이 배열만 수정) ────────────
// row: { ticker, price, ath, drop_pct, ma50, ma200, fired_alerts }
const TICKER_CARDS = [
  {
    render(app, row) {
      return `
        <div class="card">
          <div class="label">현재가 / 역대 신고점</div>
          <div class="price-pair">
            <div>
              <div class="value">$${Number(row.price).toFixed(2)}</div>
              <div class="meta price-sub">현재가</div>
            </div>
            <div class="price-arrow">→</div>
            <div>
              <div class="value">$${Number(row.ath).toFixed(2)}</div>
              <div class="meta price-sub">역대 신고점</div>
            </div>
          </div>
        </div>`;
    },
  },
  {
    render(app, row) {
      const cls = app.dropClass(row.drop_pct);
      const alertText = row.fired_alerts && row.fired_alerts.length
        ? `⚠️ ${Math.max(...row.fired_alerts)}% 알림 발송됨`
        : '알림 없음';
      return `
        <div class="card">
          <div class="label">신고점 대비 하락률</div>
          <div class="value ${cls}">-${Number(row.drop_pct).toFixed(2)}%</div>
          <div class="meta">${alertText}</div>
          ${app.renderThresholdBars(row.drop_pct)}
        </div>`;
    },
  },
  {
    render(app, row) {
      const ma50pct  = row.ma50  != null ? ((row.price / row.ma50  - 1) * 100) : null;
      const ma200pct = row.ma200 != null ? ((row.price / row.ma200 - 1) * 100) : null;
      const fmt = (pct, price) => pct != null
        ? `<span class="value-sm ${app.maClass(pct)}">${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</span>
           <span class="meta" style="margin-left:4px">$${Number(price).toFixed(2)}</span>`
        : `<span class="meta">—</span>`;
      return `
        <div class="card">
          <div class="label">이동평균 대비</div>
          <div class="ma-row"><span class="ma-name">MA50</span>${fmt(ma50pct, row.ma50)}</div>
          <div class="ma-row"><span class="ma-name">MA200</span>${fmt(ma200pct, row.ma200)}</div>
        </div>`;
    },
  },
];

// ── 시장 지표 컬럼 정의 (추가/삭제: 이 배열만 수정) ──────
// dashboardRender(app, live): live = { tickers, vix, fearGreed, timestamp }
// render(app, row): row = 이력 테이블 행 (Supabase monitor_history 데이터)
const MARKET_COLS = [
  {
    key: 'vix',
    label: 'VIX 공포지수',
    dashboardRender(app, live) {
      if (live.vix == null) return '';
      return `<div class="card gauge-card">
        <div class="label">VIX 공포지수</div>
        ${app.renderVixGaugeLarge(live.vix)}
      </div>`;
    },
    render(app, row) {
      if (row.vix == null) return '<span style="color:#475569">—</span>';
      const cls = app.vixClass(row.vix);
      const lbl = app.vixLabel(row.vix);
      return `<div style="display:flex;align-items:center;gap:8px">
        <span class="${cls}" style="font-weight:700">${Number(row.vix).toFixed(1)}</span>
        <span style="color:#64748b;font-size:0.75rem">${lbl}</span>
        <div class="mini-gauge"><div class="mini-fill ${cls}" style="width:${Math.min(row.vix/50*100,100).toFixed(0)}%"></div></div>
      </div>`;
    },
  },
  {
    key: 'fearGreed',
    label: '공포탐욕지수 (CNN)',
    dashboardRender(app, live) {
      if (!live.fearGreed || live.fearGreed.score == null) return '';
      return `<div class="card gauge-card">
        <div class="label">공포탐욕지수 (CNN)</div>
        ${app.renderFearGreedGaugeLarge(live.fearGreed.score)}
      </div>`;
    },
    render(app, row) {
      return '<span style="color:#475569">—</span>';
    },
  },
];

// Dashboard
const App = {
  async init() {
    document.getElementById('summary').innerHTML =
      '<p class="empty" style="grid-column:1/-1">불러오는 중...</p>';

    try {
      const [liveRes, histRes] = await Promise.all([
        fetch('/api/live-prices'),
        fetch(
          `${SUPABASE_URL}/rest/v1/monitor_history?order=date.desc,id.desc&limit=90`,
          { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
        ),
      ]);

      const live = await liveRes.json();
      const rows = await histRes.json();

      const histData = rows.map(r => ({
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

      this.renderSummary(live.tickers || []);
      this.renderMarketSummary(live);
      this.renderMarketTable(histData);
      this.renderTable(histData);
      this.renderLastUpdated(live.timestamp);
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

  fngClass(score) {
    if (score <= 25) return 'danger';
    if (score <= 45) return 'alert';
    if (score <= 55) return 'warn';
    return 'safe';
  },

  fngLabel(score) {
    if (score <= 25) return '극도 공포';
    if (score <= 45) return '공포';
    if (score <= 55) return '중립';
    if (score <= 75) return '탐욕';
    return '극도 탐욕';
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

  renderVixGaugeLarge(vix) {
    const cx = 120, cy = 110, R = 95, r = 65;
    const toRad = v => (1 - Math.min(Math.max(v, 0), 50) / 50) * Math.PI;
    const pt = (radius, v) => {
      const a = toRad(v);
      return [cx + radius * Math.cos(a), cy - radius * Math.sin(a)];
    };
    const arcPath = (from, to) => {
      const [x1, y1] = pt(R, from);
      const [x2, y2] = pt(R, to);
      const [x3, y3] = pt(r, to);
      const [x4, y4] = pt(r, from);
      return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${r} ${r} 0 0 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
    };
    const zones = [
      { from: 0,  to: 15, color: '#4ade80' },
      { from: 15, to: 20, color: '#facc15' },
      { from: 20, to: 30, color: '#fb923c' },
      { from: 30, to: 50, color: '#f87171' },
    ];
    const [nx, ny] = pt(R - 8, +vix);
    const lbl = this.vixLabel(vix);
    const tickLabels = [0, 15, 20, 30, 50].map(v => {
      const [tx, ty] = pt(R + 10, v);
      return `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="8" fill="#475569">${v}</text>`;
    }).join('');
    return `
      <svg viewBox="0 0 240 148" style="width:100%;max-width:300px;display:block;margin:8px auto 0">
        ${zones.map(z => `<path d="${arcPath(z.from, z.to)}" fill="${z.color}" opacity="0.85"/>`).join('')}
        ${tickLabels}
        <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(2)}" y2="${ny.toFixed(2)}" stroke="#e2e8f0" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="${cx}" cy="${cy}" r="5" fill="#e2e8f0"/>
        <text x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="26" font-weight="700" fill="#e2e8f0">${Number(vix).toFixed(1)}</text>
        <text x="${cx}" y="${cy + 40}" text-anchor="middle" font-size="11" fill="#94a3b8">${lbl}</text>
      </svg>`;
  },

  renderFearGreedGaugeLarge(score) {
    const cx = 120, cy = 110, R = 95, r = 65;
    const toRad = v => (1 - Math.min(Math.max(v, 0), 100) / 100) * Math.PI;
    const pt = (radius, v) => {
      const a = toRad(v);
      return [cx + radius * Math.cos(a), cy - radius * Math.sin(a)];
    };
    const arcPath = (from, to) => {
      const [x1, y1] = pt(R, from);
      const [x2, y2] = pt(R, to);
      const [x3, y3] = pt(r, to);
      const [x4, y4] = pt(r, from);
      return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${r} ${r} 0 0 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
    };
    const zones = [
      { from: 0,  to: 25,  color: '#f87171' },
      { from: 25, to: 45,  color: '#fb923c' },
      { from: 45, to: 55,  color: '#facc15' },
      { from: 55, to: 75,  color: '#4ade80' },
      { from: 75, to: 100, color: '#16a34a' },
    ];
    const [nx, ny] = pt(R - 8, +score);
    const lbl = this.fngLabel(score);
    const tickLabels = [0, 25, 50, 75, 100].map(v => {
      const [tx, ty] = pt(R + 10, v);
      return `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="8" fill="#475569">${v}</text>`;
    }).join('');
    return `
      <svg viewBox="0 0 240 148" style="width:100%;max-width:300px;display:block;margin:8px auto 0">
        ${zones.map(z => `<path d="${arcPath(z.from, z.to)}" fill="${z.color}" opacity="0.85"/>`).join('')}
        ${tickLabels}
        <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(2)}" y2="${ny.toFixed(2)}" stroke="#e2e8f0" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="${cx}" cy="${cy}" r="5" fill="#e2e8f0"/>
        <text x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="26" font-weight="700" fill="#e2e8f0">${Number(score).toFixed(0)}</text>
        <text x="${cx}" y="${cy + 40}" text-anchor="middle" font-size="11" fill="#94a3b8">${lbl}</text>
      </svg>`;
  },

  renderSummary(tickers) {
    const el = document.getElementById('summary');
    if (!tickers.length) {
      el.innerHTML = '<p class="empty">아직 기록이 없습니다. 첫 번째 실행 후 표시됩니다.</p>';
      return;
    }
    el.innerHTML = tickers.map((row, i) =>
      `<div class="ticker-header${i === 0 ? ' first' : ''}">${row.ticker}</div>` +
      TICKER_CARDS.map(c => c.render(this, row)).join('')
    ).join('');
  },

  renderTable(data) {
    const tbody = document.getElementById('history-body');
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">기록 없음</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(row => {
      const cls = this.dropClass(row.drop_pct);
      const alertCell = row.alert_sent
        ? `<span class="badge">${row.alert_sent}% 발송</span>`
        : '<span style="color:#475569">—</span>';
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
          <td>${fmtMa(ma50pct)}</td>
          <td>${fmtMa(ma200pct)}</td>
          <td>${alertCell}</td>
        </tr>
      `;
    }).join('');
  },

  renderMarketSummary(live) {
    const el = document.getElementById('market-summary');
    if (!el) return;
    el.innerHTML = `
      <div class="section-title" style="margin-top:20px;margin-bottom:12px">시장 지표</div>
      <div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:28px">
        ${MARKET_COLS.map(c => c.dashboardRender(this, live)).join('')}
      </div>`;
  },

  renderMarketTable(data) {
    const thead = document.getElementById('market-head');
    const tbody = document.getElementById('market-body');
    if (!thead || !tbody) return;

    const seen = new Set();
    const byDate = [];
    for (const row of data) {
      if (!seen.has(row.date)) { seen.add(row.date); byDate.push(row); }
    }

    thead.innerHTML = `<tr>
      <th>날짜</th>
      ${MARKET_COLS.map(c => `<th>${c.label}</th>`).join('')}
    </tr>`;

    tbody.innerHTML = byDate.length
      ? byDate.map(row => `
          <tr>
            <td>${row.date}</td>
            ${MARKET_COLS.map(c => `<td>${c.render(this, row)}</td>`).join('')}
          </tr>`).join('')
      : `<tr><td colspan="${1 + MARKET_COLS.length}" class="empty">기록 없음</td></tr>`;
  },

  renderLastUpdated(timestamp) {
    const el = document.getElementById('last-updated');
    if (!el) return;
    try {
      const hms = new Date(timestamp).toLocaleTimeString('ko-KR');
      el.textContent = `실시간 조회: ${hms}`;
    } catch {
      el.textContent = '';
    }
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
      const notice = document.createElement('p');
      notice.className = 'empty';
      notice.style.color = '#4ade80';
      notice.textContent = '저장 완료. 다음 자동 실행 시 대시보드에 반영됩니다.';
      document.getElementById('stocks-list').prepend(notice);
      setTimeout(() => notice.remove(), 4000);
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
