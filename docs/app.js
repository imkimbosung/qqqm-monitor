const App = {
  async init() {
    try {
      const res = await fetch('history.json');
      const data = await res.json();
      this.renderSummary(data);
      this.renderTable(data);
      this.renderLastUpdated(data);
    } catch {
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

  renderSummary(data) {
    const el = document.getElementById('summary');
    if (!data.length) {
      el.innerHTML = '<p class="empty">아직 기록이 없습니다. 첫 번째 실행 후 표시됩니다.</p>';
      return;
    }
    const latest = data[0];
    const cls = this.dropClass(latest.drop_pct);
    el.innerHTML = `
      <div class="card">
        <div class="label">현재가</div>
        <div class="value">$${latest.current.toFixed(2)}</div>
        <div class="meta">${latest.ticker} · ${latest.date}</div>
      </div>
      <div class="card">
        <div class="label">역대 신고점</div>
        <div class="value">$${latest.ath.toFixed(2)}</div>
        <div class="meta">수정주가 기준</div>
      </div>
      <div class="card">
        <div class="label">신고점 대비 하락률</div>
        <div class="value ${cls}">-${latest.drop_pct.toFixed(2)}%</div>
        <div class="meta">${latest.alert_sent ? `⚠️ ${latest.alert_sent}% 알림 발송` : '알림 없음'}</div>
      </div>
    `;
  },

  renderTable(data) {
    const tbody = document.getElementById('history-body');
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">기록 없음</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(row => {
      const cls = this.dropClass(row.drop_pct);
      const alertCell = row.alert_sent
        ? `<span class="badge">${row.alert_sent}% 발송</span>`
        : '<span style="color:#475569">—</span>';
      return `
        <tr class="${row.alert_sent ? 'alerted' : ''}">
          <td>${row.date}</td>
          <td>${row.ticker}</td>
          <td>$${row.current.toFixed(2)}</td>
          <td class="${cls}">-${row.drop_pct.toFixed(2)}%</td>
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

App.init();
