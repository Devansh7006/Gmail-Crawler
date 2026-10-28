# 🕷️ Gmail Crawler Pro

<div align="center">
  <img src="logo.png" width="128" height="128" alt="Gmail Crawler Logo" />
  <h3>High-Performance Automated Mailbox & Thread Scraper for Google Chrome & Edge</h3>
  <p>Production-grade Manifest V3 browser extension engineered for complete, zero-overhead, multi-section email extraction across <strong>Inbox</strong>, <strong>All Mail</strong>, and <strong>Spam</strong>.</p>

  <p>
    <img src="https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?logo=googlechrome&logoColor=white" alt="Manifest V3" />
    <img src="https://img.shields.io/badge/Version-2.6.0_PRO-00F0FF" alt="Version 2.6.0" />
    <img src="https://img.shields.io/badge/License-MIT-10B981" alt="License MIT" />
    <img src="https://img.shields.io/badge/Deduplication-100%25_Guaranteed-success" alt="Deduplication" />
    <img src="https://img.shields.io/badge/Dependencies-Zero-blueviolet" alt="Zero Dependencies" />
  </p>
</div>

---

## 🚀 Key Features

* **🌐 2-Phase Full Mailbox Sweep:** Seamlessly sweeps across **All Mail** (covering your active Inbox, Archived emails, Sent mail, and all Category tabs) and automatically advances to **Spam** to ensure not a single email is missed.
* **🔄 Mathematically Verified Pagination:** Real-time parser for Gmail's internal range tokens (`1–50` ➔ `51–100` ➔ `101–150`...). Guarantees uninterrupted continuous crawling from today back to the beginning of your mailbox.
* **⏮️ Automatic Page-1 Rewind:** Never starts in the middle of your mailbox. Automatically returns to Page 1 (today's newest emails) before starting historical traversal.
* **🛡️ 100% Composite Deduplication:** Multi-attribute signature hashing (`sender:::subject:::date`) prevents duplicates across folders and multi-thread conversations.
* **📊 Dual Export Engine:** Clean UTF-8 CSV (optimized with `\uFEFF` BOM for instant compatibility with Microsoft Excel, LibreOffice, and Google Sheets) and structured JSON.
* **⚡ Passive Non-Blocking Engine:** Operates without continuous mutation observers or polling loops. Consumes **0% idle CPU** and never freezes Gmail's web client.
* **🎨 Cyber Void HUD UI/UX:** High-tech HUD telemetry overlay with live page counters, real-time email tallies, earliest date reached, and an on-demand **STOP & DOWNLOAD** safety trigger.

---

## 📋 Extracted Schema

Every exported record maps to 5 clean, production-ready attributes:

| Column | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `sender` | `string` | Display name and verified sender address | `Amazon Web Services <no-reply-aws@amazon.com>` |
| `receiver` | `string` | Authenticated account recipient email | `user@gmail.com` |
| `date` | `string` | High-precision localized timestamp | `Wed, 28 Oct 2026, 20:39` |
| `subject` | `string` | Full conversation subject line | `Security update applied to instance` |
| `body` | `string` | Message body preview / snippet text | `Your instance configuration was updated...` |

---

## 🎯 Target Scopes

The extension provides dedicated crawl modes accessible directly from the popup:

| Scope Option | Target Sections | Best For |
| :--- | :--- | :--- |
| **🌐 Full Sweep** *(Default)* | **All Mail** (`#all`) + **Spam** (`#spam`) | Complete historical backup of your entire Google account |
| **📬 All Mail** | **All Mail** (`#all`) | All non-spam mail (Inbox, Archive, Sent, Categories) |
| **📥 Inbox Only** | **Inbox** (`#inbox`) | Primary Inbox messages only |
| **🚫 Spam Only** | **Spam** (`#spam`) | Scrapes all flagged spam and junk mail |
| **⚡ Current View** | Current Screen (`50`) | Instant 1-second capture of the currently displayed page |

---

## 🛠️ Quick Installation (Takes Under 1 Minute)

1. **Clone or Download this repository:**
   ```bash
   git clone https://github.com/Devansh7006/Gmail-Crawler.git
   ```
2. **Open Extensions in your Chromium browser:**
   * **Google Chrome:** Navigate to `chrome://extensions`
   * **Microsoft Edge:** Navigate to `edge://extensions`
   * **Brave Browser:** Navigate to `brave://extensions`
3. Enable **"Developer mode"** via the toggle in the top-right corner.
4. Click **"Load unpacked"** in the top-left corner.
5. Select the `gmail-full-exporter` folder.
6. Pin the **Gmail Crawler** icon to your browser toolbar!

---

## 📖 How to Run

1. Open **[Gmail](https://mail.google.com)** in your browser.
2. Click the **Gmail Crawler** icon in your browser toolbar.
3. Choose your configuration:
   * **Target Folders:** Keep set to **Full Sweep: All Mail + Inbox + Spam** *(Recommended)* or pick a specific folder.
   * **Crawl Depth:** Select **All Available Pages** or cap at 10, 20, 50, or 100 pages.
   * **Format:** Choose **CSV** or **JSON**.
4. Click **"CRAWL ALL PAGES (FULL MAILBOX)"**.
5. Watch the on-screen **Cyber Void HUD** track the crawl in real time:
   * Automatic rewind to Page 1
   * `Phase 1/2: All Mail & Inbox` traversal
   * `Phase 2/2: Spam Folder` sweep
6. The compiled file downloads automatically when traversal is complete (or whenever you click **STOP & DOWNLOAD CSV**).

---

## 🔒 Security & Privacy Notice

* **100% Local Execution:** All parsing and compilation runs locally inside your browser's content script sandbox.
* **Zero External Telemetry:** No third-party servers, tracking scripts, analytics, or remote API endpoints are ever called.
* **No Authentication Stored:** Does not read, log, or transmit your passwords, cookies, session tokens, or credentials.

---

## 🏗️ Architecture

```
gmail-full-exporter/
├── manifest.json       # Manifest V3 configuration & permission boundaries
├── popup.html          # Cyber Void HUD telemetry dashboard
├── popup.css           # High-tech cyberpunk styling and micro-interactions
├── popup.js            # Scope controller & content script messaging bridge
├── content.js          # Multi-section traversal engine & mathematical paginator
├── content.css         # Styling for the on-screen progress HUD
├── icons/              # Multi-resolution icon set (16px, 32px, 48px, 128px)
├── logo.png            # High-resolution brand logo
└── README.md           # Production documentation
```

---

## 📄 License

Distributed under the **MIT License**. Free for personal, academic, and commercial research use.
