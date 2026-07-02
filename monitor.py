import json
import os
import sys
import requests
import yfinance as yf
from datetime import datetime, timezone
from supabase import create_client

CONFIG_FILE = "config.json"

def send_slack(webhook_url, message):
    resp = requests.post(webhook_url, json={"text": message}, timeout=10)
    resp.raise_for_status()

def get_current_price(ticker):
    info = yf.Ticker(ticker).fast_info
    return info["last_price"]

def get_ticker_stats(ticker):
    hist = yf.Ticker(ticker).history(period="max", auto_adjust=True)
    ath = float(hist["High"].max())
    ma50  = round(float(hist["Close"].rolling(50).mean().iloc[-1]), 2)
    ma200 = round(float(hist["Close"].rolling(200).mean().iloc[-1]), 2)
    return ath, ma50, ma200

def get_vix():
    return round(float(yf.Ticker("^VIX").fast_info["last_price"]), 2)

def monitor():
    webhook_url = os.environ.get("SLACK_WEBHOOK_URL")
    if not webhook_url:
        print("SLACK_WEBHOOK_URL not set", file=sys.stderr)
        sys.exit(1)

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not supabase_url or not supabase_key:
        print("SUPABASE_URL / SUPABASE_SERVICE_KEY not set", file=sys.stderr)
        sys.exit(1)
    sb = create_client(supabase_url, supabase_key)

    with open(CONFIG_FILE) as f:
        config = json.load(f)

    state_rows = sb.table("monitor_state").select("*").execute().data
    records = {
        row["ticker"]: {
            "all_time_high": float(row["all_time_high"]),
            "fired_alerts": row["fired_alerts"] or [],
        }
        for row in state_rows
    }

    run_log = []
    vix = get_vix()

    for stock in config["stocks"]:
        ticker = stock["ticker"]
        thresholds = sorted(stock["alerts"])

        current = get_current_price(ticker)
        ath_from_history, ma50, ma200 = get_ticker_stats(ticker)

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

        sb.table("monitor_state").upsert({
            "ticker": ticker,
            "all_time_high": rec["all_time_high"],
            "fired_alerts": rec["fired_alerts"],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

        run_log.append({
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "ticker": ticker,
            "current": round(current, 2),
            "ath": round(ath, 2),
            "drop_pct": round(drop_pct, 2),
            "alert_sent": max(to_fire) if to_fire else None,
            "vix": vix,
            "ma50": ma50,
            "ma200": ma200,
        })

    for entry in run_log:
        sb.table("monitor_history").insert({
            "date": entry["date"],
            "ticker": entry["ticker"],
            "current_price": entry["current"],
            "ath": entry["ath"],
            "drop_pct": entry["drop_pct"],
            "alert_sent": entry["alert_sent"],
            "vix": entry["vix"],
            "ma50": entry["ma50"],
            "ma200": entry["ma200"],
        }).execute()
    print(f"Supabase: inserted {len(run_log)} row(s)")

if __name__ == "__main__":
    monitor()
