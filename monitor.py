import json
import os
import sys
import requests
import yfinance as yf

CONFIG_FILE = "config.json"
RECORD_FILE = "high_record.json"


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
    return float(hist["Close"].max())


def monitor():
    webhook_url = os.environ.get("SLACK_WEBHOOK_URL")
    if not webhook_url:
        print("SLACK_WEBHOOK_URL not set", file=sys.stderr)
        sys.exit(1)

    config = load_json(CONFIG_FILE, {"stocks": []})
    records = load_json(RECORD_FILE, {})

    for stock in config["stocks"]:
        ticker = stock["ticker"]
        thresholds = sorted(stock["alerts"])

        current = get_current_price(ticker)
        ath_from_history = get_all_time_high(ticker)

        rec = records.get(ticker, {"all_time_high": 0.0, "fired_alerts": []})

        # Update ATH: use max of stored value, historical max, and current price
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

    save_json(RECORD_FILE, records)


if __name__ == "__main__":
    monitor()
