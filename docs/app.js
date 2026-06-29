const SUPABASE_URL  = 'https://tsbuquzmdnwyebbqqnao.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzYnVxdXptZG53eWViYnFxbmFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwOTA0NjgsImV4cCI6MjA5NzY2NjQ2OH0.hnjkdPfKc6pBAWGQwRndZXYzB4yQGdtWjXVnrUtk4C8';

// Auth
function showApp() {
  document.getElementById('auth-gate').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  App.init();
}

function showAuthGate() {
  document.getElementById('auth-gate').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

netlifyIdentity.on('init', user => { user ? showApp() : showAuthGate(); });
netlifyIdentity.on('login', () => { netlifyIdentity.close(); showApp(); });
netlifyIdentity.on('logout', showAuthGate);

document.getElementById('login-btn').addEventListener('click', () => {
  netlifyIdentity.open('login');
});

document.getElementById('logout-btn').addEventListener('click', () => {
  netlifyIdentity.logout();
});

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

  // ConfigEditor — CRUD 확장 예정
  // addStock(ticker, alerts) { ... }
  // editStock(ticker, alerts) { ... }
  // deleteStock(ticker) { ... }
};
