# 🕷️ Gmail-Crawler

<div align="center">
  <img src="logo.png" width="128" height="128" alt="Gmail Crawler Logo" />
  <h3>High-Performance Automated Mailbox & Thread Scraper for Google Chrome & Edge</h3>
  <p>Production-grade Manifest V3 browser extension engineered for zero-overhead, multi-page email extraction.</p>
</div>

---

## 🚀 Key Features

* **⚡ Current View Scan:** Instantly extracts all 50 visible emails in your current inbox view in under 1 second.
* **🌐 Multi-Page Bulk Crawler:** Automatically flips through pagination (Page 1, 2, 3...) to aggregate 500, 1,000, or 5,000+ emails across **Inbox**, **Spam**, **Sent**, or **All Mail** into a single structured file.
* **🔍 Deep Thread Inspector:** Sequential crawler that automatically opens each conversation thread, extracts full message bodies, and navigates back seamlessly.
* **📊 Dual Export Engine:** Clean UTF-8 CSV (optimized with BOM for Microsoft Excel) and JSON export support.
* **🛡️ Zero-Overhead Passive Design:** Completely eliminates heavy mutation observers. Consumes **0% idle CPU** and will never freeze or block Gmail's rendering engine.
* **🎨 Cyber Void HUD UI/UX:** High-tech telemetry dashboard featuring live status beacons, terminal logs, and live on-screen progress monitoring.

---

## 📋 Extracted Schema

Every exported record maps directly to the following 5 structured attributes:

| Column | Type | Description |
| :--- | :--- | :--- |
| `sender` | `string` | Display name and verified sender email address |
| `receiver` | `string` | Recipient email address(es) |
| `date` | `string` | Parsed timestamp of the message |
| `subject` | `string` | Full email conversation subject line |
| `body` | `string` | Unabridged body text (or snippet in list view) |

---

## 🛠️ Installation Guide (Takes 30 Seconds)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/Devansh7006/Gmail-Crawler.git
   ```
2. Open your browser's extensions page:
   * **Google Chrome:** `chrome://extensions`
   * **Microsoft Edge:** `edge://extensions`
   * **Brave Browser:** `brave://extensions`
3. Toggle on **"Developer mode"** in the top-right corner.
4. Click **"Load unpacked"** in the top-left corner.
5. Select the `Gmail-Crawler` folder.
6. Pin the crawler icon to your browser toolbar!

---

## 📖 How to Use

1. Navigate to **[Gmail](https://mail.google.com)** (open your **Inbox**, **Spam**, **Trash**, or **All Mail**).
2. Click the **Gmail Crawler** icon in your browser toolbar.
3. Choose your crawl scope:
   * **Current View:** Instant 1-click scan of the visible 50 emails.
   * **Multi-Page Bulk:** Select target depth (e.g., 10 pages for ~500 emails) and click **"Launch Bulk Crawler"**.
   * **Deep Body:** Performs automated sequential thread opening to capture full email text.
4. An on-screen progress HUD will display real-time extraction metrics with an **"Abort & Export"** option.
5. Your `.csv` or `.json` file will automatically download upon completion.

---

## 🏗️ Architecture

```
Gmail-Crawler/
├── manifest.json       # Manifest V3 configuration & permission boundaries
├── popup.html          # Cyber Void HUD telemetry dashboard
├── popup.css           # High-tech cyberpunk styling and micro-interactions
├── popup.js            # Controller handling telemetry and content script bridge
├── content.js          # Passive DOM crawler, multi-page stepper, and export generator
├── content.css         # Minimal styling for the on-screen progress overlay
├── icons/              # Multi-resolution icon set (16px, 32px, 48px, 128px)
├── logo.png            # High-resolution brand logo
└── README.md           # Documentation
```

---

## 📄 License

MIT License. Free for personal, academic, and commercial research use.
