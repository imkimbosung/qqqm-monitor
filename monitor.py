import json
import os
import sys
import requests
import yfinance as yf
from datetime import datetime, timezone
from supabase import create_client

CONFIG_FILE = "config.json"
RECORD_FILE = "high_record.json"
HISTORY_FILE = "docs/history.json"


def load_json(path, default):
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return default


def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def send_slack(webhook_url, message):
    resp = requests.post(webhook_url, json={"text": message}, timeout=10)
    resp.raise_for_status()


def get_current_price(ticker):
    info = yf.Ticker(ticker).fast_info
    return info["last_price"]


def get_all_time_high(ticker):
    hist = yf.Ticker(ticker).history(period="max", auto_adjust=True)
    return float(hist["High"].max())


def get_vix():
    return round(float(yf.Ticker("^VIX").fast_info["last_price"]), 2)


def monitor():
    webhook_url = os.environ.get("SLACK_WEBHOOK_URL")
    if not webhook_url:
        print("SLACK_WEBHOOK_URL not set", file=sys.stderr)
        sys.exit(1)

    config = load_json(CONFIG_FILE, {"stocks": []})
    records = load_json(RECORD_FILE, {})
    run_log = []
    vix = get_vix()

    for stock in config["stocks"]:
        ticker = stock["ticker"]
        thresholds = sorted(stock["alerts"])

        current = get_current_price(ticker)
        ath_from_history = get_all_time_high(ticker)

        rec = records.get(ticker, {"all_time_high": 0.0, "fired_alerts": []})

        new_ath = max(rec["all_time_high"], ath_from_history, current)
        if new_ath > rec["all_time_high"]:
            rec["all_time_high"] = new_ath
            rec["fired_alerts"] = []

        ath = rec["all_time_high"]
        drop_pct = (1 - current / ath) * 100

        to_fire = [t for t in thresholds if drop_pct >= t and t not in rec["fired_alerts"]]
        if to_fire:
            highest = max(to_fire)
            msg = (
                f"[{ticker} 하락 알림] 신고점 대비 -{drop_pct:.1f}% 하락\n"
                f"신고점: ${ath:.2f} → 현재가: ${current:.2f}\n"
                f"임계값 {highest}% 돌파"
            )
            send_slack(webhook_url, msg)
            print(f"Sent alert: {highest}% for {ticker}")
            rec["fired_alerts"].extend(to_fire)

        records[ticker] = rec
        run_log.append({
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "ticker": ticker,
            "current": round(current, 2),
            "ath": round(ath, 2),
            "drop_pct": round(drop_pct, 2),
            "alert_sent": max(to_fire) if to_fire else None,
            "vix": vix
        })

    save_json(RECORD_FILE, records)

    os.makedirs("docs", exist_ok=True)
    history = load_json(HISTORY_FILE, [])
    for entry in run_log:
        history.insert(0, entry)
    save_json(HISTORY_FILE, history[:90])

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
    if supabase_url and supabase_key:
        sb = create_client(supabase_url, supabase_key)
        for entry in run_log:
            sb.table("monitor_history").insert({
                "date": entry["date"],
                "ticker": entry["ticker"],
                "current_price": entry["current"],
                "ath": entry["ath"],
                "drop_pct": entry["drop_pct"],
                "alert_sent": entry["alert_sent"],
                "vix": entry["vix"],
            }).execute()
        print(f"Supabase: inserted {len(run_log)} row(s)")


if __name__ == "__main__":
    monitor()
