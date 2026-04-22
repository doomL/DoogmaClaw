#!/usr/bin/env python3
"""
Fetch emails from the last 24h from configured Gmail accounts via IMAP.
Outputs structured text for Claude to summarize and forward to Telegram.

Setup:
  1. Enable 2FA on each Gmail account
  2. Generate an App Password: myaccount.google.com/apppasswords
  3. Copy email_config.template.json -> email_config.json and fill in credentials
  4. pip install (no extra deps — uses stdlib only)
"""

import imaplib
import email
import json
import sys
from datetime import datetime, timedelta, timezone
from email.header import decode_header
from pathlib import Path

CONFIG_PATH = Path(__file__).parent / "email_config.json"
MAX_BODY_CHARS = 800
MAX_EMAILS_PER_ACCOUNT = 40


def decode_str(s):
    if s is None:
        return ""
    if isinstance(s, bytes):
        return s.decode("utf-8", errors="replace")
    parts = decode_header(s)
    result = []
    for part, charset in parts:
        if isinstance(part, bytes):
            result.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            result.append(part)
    return " ".join(result)


def get_body(msg):
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            cd = str(part.get("Content-Disposition", ""))
            if ct == "text/plain" and "attachment" not in cd:
                try:
                    payload = part.get_payload(decode=True)
                    charset = part.get_content_charset() or "utf-8"
                    body = payload.decode(charset, errors="replace")
                    break
                except Exception:
                    pass
    else:
        try:
            payload = msg.get_payload(decode=True)
            charset = msg.get_content_charset() or "utf-8"
            body = payload.decode(charset, errors="replace") if payload else ""
        except Exception:
            pass
    lines = [l.strip() for l in body.splitlines() if l.strip()]
    return "\n".join(lines)[:MAX_BODY_CHARS]


def fetch_emails(account: dict) -> list[dict]:
    results = []
    try:
        mail = imaplib.IMAP4_SSL(account["imap_host"], account["imap_port"])
        mail.login(account["email"], account["password"])
        mail.select("INBOX")

        since_date = (datetime.now(timezone.utc) - timedelta(hours=24)).strftime("%d-%b-%Y")
        status, data = mail.search(None, f'SINCE "{since_date}"')
        if status != "OK":
            return results

        uids = data[0].split()
        uids = uids[-MAX_EMAILS_PER_ACCOUNT:]

        for uid in reversed(uids):
            try:
                status, msg_data = mail.fetch(uid, "(RFC822)")
                if status != "OK":
                    continue
                raw = msg_data[0][1]
                msg = email.message_from_bytes(raw)

                results.append({
                    "subject": decode_str(msg.get("Subject", "(no subject)")),
                    "from": decode_str(msg.get("From", "")),
                    "date": decode_str(msg.get("Date", "")),
                    "body_preview": get_body(msg),
                })
            except Exception as e:
                results.append({"error": str(e), "uid": uid.decode()})

        mail.logout()
    except Exception as e:
        results.append({"error": f"Connection failed: {e}"})

    return results


def main():
    if not CONFIG_PATH.exists():
        print(f"ERROR: config not found at {CONFIG_PATH}", file=sys.stderr)
        print("Copy email_config.template.json to email_config.json and fill in your credentials.", file=sys.stderr)
        sys.exit(1)

    with open(CONFIG_PATH) as f:
        config = json.load(f)

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    print(f"=== EMAIL DIGEST — last 24h (since {cutoff.strftime('%Y-%m-%d %H:%M UTC')}) ===\n")

    for account in config["accounts"]:
        print(f"\n{'='*60}")
        print(f"ACCOUNT: {account['label']} <{account['email']}>")
        print(f"{'='*60}\n")

        emails = fetch_emails(account)

        if not emails:
            print("  No emails in the last 24 hours.\n")
            continue

        errors = [e for e in emails if "error" in e]
        valid = [e for e in emails if "error" not in e]

        for err in errors:
            print(f"  [ERROR] {err['error']}\n")

        if not valid:
            print("  No valid emails.\n")
            continue

        print(f"  Total emails: {len(valid)}\n")

        for i, em in enumerate(valid, 1):
            print(f"--- Email #{i} ---")
            print(f"From:     {em['from']}")
            print(f"Subject:  {em['subject']}")
            print(f"Date:     {em['date']}")
            if em["body_preview"]:
                print(f"Preview:\n{em['body_preview']}")
            print()

    print("\n=== END DIGEST ===")


if __name__ == "__main__":
    main()
