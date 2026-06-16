# QQQM Monitor — 프로젝트 컨텍스트

## 개요
QQQM 주가가 역대 신고점(장중 고가 기준, 수정주가) 대비 10%, 15%, 20% 하락 시
Slack으로 알림을 보내는 자동화 프로그램.

- **GitHub repo**: https://github.com/imkimbosung/qqqm-monitor
- **대시보드**: Netlify 배포 (Netlify Identity 이메일 로그인 필요)
- **실행**: 평일 KST 23:00 GitHub Actions 자동 실행
- **비용**: $0

---

## 파일 구성

```
qqqProject/
├── config.json                  ← 종목 + 알림 % 설정 (사용자 편집)
├── monitor.py                   ← 핵심 로직
├── high_record.json             ← 신고점 + 발송 기록 (자동 관리)
├── requirements.txt
├── docs/
│   ├── index.html               ← 대시보드 UI
│   ├── app.js                   ← 대시보드 로직 (Netlify Identity 인증)
│   ├── style.css                ← 반응형 스타일
│   └── history.json             ← 일별 체크 이력 (자동 추가, 최대 90일)
└── .github/
    └── workflows/
        └── monitor.yml          ← 스케줄 실행 + 파일 자동 커밋
```

---

## 핵심 로직 (`monitor.py`)

1. `config.json`에서 ticker, 임계값 로드
2. yfinance로 전체 역사 데이터 조회 → **장중 고가(High)** 기준 ATH 계산
3. `high_record.json`에서 이전 ATH, 발송 기록 로드
4. ATH 갱신 시 `fired_alerts` 초기화
5. 하락률 계산: `(1 - current / ath) * 100`
6. 미발송 임계값 중 조건 충족한 것들 → **가장 높은 것 1개만** Slack 발송
7. `high_record.json`, `docs/history.json` 저장

### 중요 결정 사항
- **ATH 기준**: 장중 고가(`High`) — 종가(`Close`)가 아님. 사용자가 보는 신고점과 일치시키기 위해 변경.
- **알림 방식**: 10%, 15% 동시 충족 시 15% 알림 1개만 발송. `fired_alerts`에 둘 다 기록.
- **중복 방지**: `fired_alerts`에 기록된 임계값은 ATH 갱신 전까지 재발송 없음.

---

## 인프라

### GitHub Actions (`monitor.yml`)
- **스케줄**: `0 14 * * 1-5` (UTC 14:00 = KST 23:00, 평일)
- **수동 실행**: Actions 탭 → QQQM Drop Monitor → Run workflow
- **Secrets**: `SLACK_WEBHOOK_URL` (repo Settings → Secrets)
- **자동 커밋**: 실행 후 `high_record.json`, `docs/history.json` 변경분 자동 push

### Netlify
- **Publish directory**: `docs`
- **Build command**: 없음 (순수 정적 사이트)
- **인증**: Netlify Identity (이메일/비밀번호, Invite only)
- **자동 재배포**: GitHub push 시 트리거

### Slack
- **Webhook**: GitHub Secret `SLACK_WEBHOOK_URL`에 저장
- 메시지 형식:
  ```
  [QQQM 하락 알림] 신고점 대비 -15.2% 하락
  신고점: $308.21 → 현재가: $261.98
  임계값 15% 돌파
  ```

---

## 현재 상태 (2026-06-16 기준)

| 항목 | 값 |
|------|-----|
| QQQM ATH | $308.21 (2026-06-03 장중) |
| 발송된 알림 | 없음 (`fired_alerts: []`) |
| 현재가 | ~$305 |
| 하락률 | ~0.8% |

---

## 로컬 테스트 방법

```bash
# 의존성 설치
pip3 install -r requirements.txt

# 실행
SLACK_WEBHOOK_URL="<webhook_url>" python3 monitor.py

# 알림 발송 강제 테스트: high_record.json에서 all_time_high를 345.0으로 올린 후 실행
# 테스트 후 all_time_high를 308.21로 복원할 것
```

---

## 향후 확장 계획

### CRUD (종목 추가/수정/삭제 UI)
- `docs/app.js`에 `ConfigEditor` 골격 주석으로 준비되어 있음
- 구현 시 필요한 것:
  - Netlify Functions: GitHub PAT를 서버 측에 보관하고 `config.json` 읽기/쓰기 프록시
  - Netlify 환경변수: `GITHUB_TOKEN`, `REPO_OWNER`, `REPO_NAME`
  - UI: 종목 추가/삭제 폼, 알림 % 편집

### 종목 추가 방법 (현재)
`config.json`에 항목 추가 후 push:
```json
{
  "stocks": [
    { "ticker": "QQQM", "alerts": [10, 15, 20] },
    { "ticker": "SPY",  "alerts": [10, 15, 20] }
  ]
}
```

---

## 주의사항

- `.claude/` 폴더는 `.gitignore`에 추가됨 (Slack Webhook URL 노출 방지)
- `high_record.json`은 GitHub Actions가 자동 커밋 → 로컬 pull 없이 push 시 rebase 필요
  ```bash
  git pull --rebase && git push
  ```
