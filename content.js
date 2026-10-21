// Gmail Crawler Pro - Production Content Script
// High-performance, zero-overhead passive execution.

(function () {
    let isRunning = false;
    let abortRequested = false;

    function getAccountEmail() {
        try {
            const profileEl = document.querySelector('a[aria-label*="@"]') ||
                              document.querySelector('[data-identifier*="@"]');
            if (profileEl) {
                const match = (profileEl.getAttribute('aria-label') || profileEl.getAttribute('data-identifier') || '').match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                if (match) return match[1];
            }
        } catch (e) {}
        return "Me";
    }

    function extractPageEmails(myEmail) {
        const rows = document.querySelectorAll('tr.zA');
        const results = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            // Sender
            let sender = "";
            const senderEl = row.querySelector('.yX [email]') || 
                             row.querySelector('.yX span.bA4 span') || 
                             row.querySelector('.yP, .zF');
            if (senderEl) {
                const emailAttr = senderEl.getAttribute('email');
                const text = (senderEl.innerText || "").trim();
                sender = emailAttr ? (text && text !== emailAttr ? `${text} <${emailAttr}>` : emailAttr) : text;
            }

            // Subject
            let subject = "";
            const subjectEl = row.querySelector('span.bog');
            if (subjectEl) {
                subject = (subjectEl.innerText || "").trim();
            }

            // Body (Snippet preview in inbox/spam list view)
            let body = "";
            const snippetEl = row.querySelector('span.y2');
            if (snippetEl) {
                body = (snippetEl.innerText || "").replace(/^[\s–-]+/, '').trim();
            }

            // Date
            let date = "";
            const dateEl = row.querySelector('.xW span[title]') || row.querySelector('.xW span');
            if (dateEl) {
                date = dateEl.getAttribute('title') || (dateEl.innerText || "").trim();
            }

            results.push({
                sender: sender || "Unknown",
                receiver: myEmail,
                date: date || new Date().toLocaleDateString(),
                subject: subject || "(No Subject)",
                body: body || ""
            });
        }

        return results;
    }

    function extractOpenEmail(myEmail) {
        const subjectEl = document.querySelector('h2.hP') || document.querySelector('[data-thread-perm-id]');
        const subject = subjectEl ? (subjectEl.innerText || "").trim() : (document.title || "").replace(/ - Gmail$/, '').trim();

        let messageCards = document.querySelectorAll('div.adn.ads');
        if (!messageCards || messageCards.length === 0) {
            messageCards = document.querySelectorAll('div[data-message-id]');
        }

        const results = [];

        if (messageCards && messageCards.length > 0) {
            messageCards.forEach((card) => {
                const senderEl = card.querySelector('span.gD') || card.querySelector('[email]');
                const dateEl = card.querySelector('span.g3') || card.querySelector('.gH span[title]');
                const bodyEl = card.querySelector('div.a3s.aiL') || card.querySelector('div.ii.gt');
                const recEl = card.querySelector('span.g2');

                let sender = "";
                if (senderEl) {
                    const em = senderEl.getAttribute('email');
                    const nm = (senderEl.innerText || "").trim();
                    sender = em ? (nm ? `${nm} <${em}>` : em) : nm;
                }

                let receiver = recEl ? (recEl.getAttribute('email') || (recEl.innerText || "").trim()) : myEmail;
                let date = dateEl ? (dateEl.getAttribute('title') || (dateEl.innerText || "").trim()) : "";
                let body = bodyEl ? (bodyEl.innerText || "").trim() : "";

                if (sender || body) {
                    results.push({
                        sender: sender || "Unknown",
                        receiver: receiver || myEmail,
                        date: date || new Date().toISOString(),
                        subject: subject || "No Subject",
                        body: body || ""
                    });
                }
            });
        } else {
            const bodyEl = document.querySelector('div.a3s.aiL') || document.querySelector('div.ii.gt');
            if (bodyEl) {
                const senderEl = document.querySelector('span.gD') || document.querySelector('[email]');
                const dateEl = document.querySelector('span.g3') || document.querySelector('.gH span');
                results.push({
                    sender: senderEl ? (senderEl.getAttribute('email') || senderEl.innerText) : "Unknown",
                    receiver: myEmail,
                    date: dateEl ? (dateEl.getAttribute('title') || dateEl.innerText) : new Date().toLocaleString(),
                    subject: subject || "Gmail Export",
                    body: (bodyEl.innerText || "").trim()
                });
            }
        }

        return results;
    }

    // MULTI-PAGE BULK CRAWLER
    async function runBulkCrawl(maxPages, format) {
        if (isRunning) return;
        isRunning = true;
        abortRequested = false;

        const myEmail = getAccountEmail();
        const allEmails = [];
        let pageNum = 1;

        showHudOverlay("Initializing Multi-Page Crawl...");

        while (pageNum <= maxPages && !abortRequested) {
            updateHudOverlay(pageNum, maxPages, allEmails.length, "Extracting page data...");
            await sleep(400);

            const pageData = extractPageEmails(myEmail);
            if (pageData.length > 0) {
                allEmails.push(...pageData);
                updateHudOverlay(pageNum, maxPages, allEmails.length, `Captured ${allEmails.length} emails.`);
            }

            // Find the "Older" / "Next" pagination button
            const nextBtn = document.querySelector('div[aria-label*="Older"]') ||
                            document.querySelector('div[data-tooltip*="Older"]') ||
                            document.querySelector('div[aria-label*="Next"]') ||
                            document.querySelector('div[data-tooltip*="Next"]');

            if (!nextBtn || nextBtn.getAttribute('aria-disabled') === 'true') {
                updateHudOverlay(pageNum, maxPages, allEmails.length, "Reached end of mailbox section.");
                await sleep(800);
                break;
            }

            updateHudOverlay(pageNum, maxPages, allEmails.length, "Advancing to next page...");
            nextBtn.click();
            await sleep(1500);
            pageNum++;
        }

        removeHudOverlay();
        isRunning = false;

        if (allEmails.length > 0) {
            saveExport(allEmails, format, `gmail_bulk_crawl_${allEmails.length}_emails`);
        }
    }

    // DEEP FULL-BODY CRAWLER
    async function runDeepCrawl(format) {
        if (isRunning) return;
        isRunning = true;
        abortRequested = false;

        const myEmail = getAccountEmail();
        const rows = Array.from(document.querySelectorAll('tr.zA'));
        if (rows.length === 0) {
            alert("No email rows detected in current view.");
            isRunning = false;
            return;
        }

        showHudOverlay(`Deep Scanning ${rows.length} Threads...`);
        const allEmails = [];

        for (let i = 0; i < rows.length; i++) {
            if (abortRequested) break;

            updateHudOverlay(i + 1, rows.length, allEmails.length, `Opening thread ${i + 1}...`);

            const currentRow = document.querySelectorAll('tr.zA')[i];
            if (!currentRow) continue;

            const clickTarget = currentRow.querySelector('.bog') || currentRow.querySelector('.yX') || currentRow;
            clickTarget.click();

            await waitFor(() => !!document.querySelector('div.a3s.aiL'), 3000);
            await sleep(400);

            const emailData = extractOpenEmail(myEmail);
            if (emailData.length > 0) {
                allEmails.push(...emailData);
                updateHudOverlay(i + 1, rows.length, allEmails.length, `Extracted: ${emailData[0].subject.slice(0, 30)}...`);
            }

            const backBtn = document.querySelector('div[aria-label*="Back"]') ||
                            document.querySelector('div[data-tooltip*="Back"]') ||
                            document.querySelector('div[act="19"]');
            if (backBtn) {
                backBtn.click();
            } else {
                window.history.back();
            }

            await waitFor(() => document.querySelectorAll('tr.zA').length > 0, 3000);
            await sleep(300);
        }

        removeHudOverlay();
        isRunning = false;

        if (allEmails.length > 0) {
            saveExport(allEmails, format, `gmail_deep_crawl_${allEmails.length}_emails`);
        }
    }

    // Export Handler: CSV or JSON
    function saveExport(data, format, baseFilename) {
        if (!data || data.length === 0) return;

        let content = "";
        let mime = "";
        let ext = "";

        if (format === 'json') {
            content = JSON.stringify(data, null, 2);
            mime = "application/json;charset=utf-8;";
            ext = "json";
        } else {
            // Default CSV
            const headers = ["sender", "receiver", "date", "subject", "body"];
            const rows = [headers.join(",")];
            data.forEach(item => {
                rows.push([
                    escapeCSV(item.sender),
                    escapeCSV(item.receiver),
                    escapeCSV(item.date),
                    escapeCSV(item.subject),
                    escapeCSV(item.body)
                ].join(","));
            });
            content = "\uFEFF" + rows.join("\r\n");
            mime = "text/csv;charset=utf-8;";
            ext = "csv";
        }

        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseFilename}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function escapeCSV(val) {
        if (!val) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
    }

    function sleep(ms) {
        return new Promise(res => setTimeout(res, ms));
    }

    function waitFor(predicate, timeout = 3000) {
        return new Promise(resolve => {
            const start = Date.now();
            const interval = setInterval(() => {
                if (predicate() || Date.now() - start > timeout) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        });
    }

    // High-Tech Cyber HUD On-Screen Overlay
    function showHudOverlay(title) {
        removeHudOverlay();
        const div = document.createElement('div');
        div.id = 'gmail-crawler-hud-box';
        div.style.cssText = `
            position: fixed;
            top: 24px;
            right: 24px;
            z-index: 9999999;
            background: #0a0d14;
            color: #f8fafc;
            font-family: 'Segoe UI', system-ui, sans-serif;
            border: 1px solid rgba(0, 240, 255, 0.4);
            border-radius: 8px;
            padding: 16px;
            width: 320px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(0, 240, 255, 0.2);
            animation: fadeIn 0.2s ease;
        `;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
                <span style="font-size:12px; font-weight:700; color:#00f0ff; letter-spacing:0.5px;">G-CRAWLER ACTIVE</span>
                <span id="hud-page-count" style="font-size:11px; font-family:monospace; color:#94a3b8;">Page 1</span>
            </div>
            <div id="hud-status" style="font-size:11px; color:#cbd5e1; margin-bottom:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${title}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span id="hud-total-count" style="font-size:11px; color:#10b981; font-family:monospace;">0 Emails</span>
                <button id="hud-abort-btn" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:4px; font-size:11px; font-weight:600; cursor:pointer;">
                    ABORT & EXPORT
                </button>
            </div>
        `;
        document.body.appendChild(div);
        document.getElementById('hud-abort-btn').onclick = () => {
            abortRequested = true;
            document.getElementById('hud-status').textContent = "Aborting and saving extracted data...";
        };
    }

    function updateHudOverlay(current, max, total, msg) {
        const pageEl = document.getElementById('hud-page-count');
        const statusEl = document.getElementById('hud-status');
        const totalEl = document.getElementById('hud-total-count');

        if (pageEl) pageEl.textContent = `Page ${current} / ${max}`;
        if (statusEl) statusEl.textContent = msg;
        if (totalEl) totalEl.textContent = `${total} Captured`;
    }

    function removeHudOverlay() {
        const el = document.getElementById('gmail-crawler-hud-box');
        if (el) el.remove();
    }

    // Message Listener for Popup
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
        const myEmail = getAccountEmail();

        if (req.action === "get_status") {
            const isEmail = !!(document.querySelector('div.a3s.aiL') || document.querySelector('h2.hP'));
            const rowCount = document.querySelectorAll('tr.zA').length;
            sendResponse({ isEmail, rowCount });
        } else if (req.action === "crawl_page") {
            let data = [];
            const isEmail = !!(document.querySelector('div.a3s.aiL') || document.querySelector('h2.hP'));
            if (isEmail) {
                data = extractOpenEmail(myEmail);
            } else {
                data = extractPageEmails(myEmail);
            }
            if (data.length > 0) {
                saveExport(data, req.format || 'csv', `gmail_crawl_${data.length}_emails`);
            }
            sendResponse({ count: data.length });
        } else if (req.action === "crawl_bulk") {
            runBulkCrawl(req.maxPages || 10, req.format || 'csv');
            sendResponse({ started: true });
        } else if (req.action === "crawl_deep") {
            runDeepCrawl(req.format || 'csv');
            sendResponse({ started: true });
        }
        return true;
    });

    console.log("[Gmail Crawler Pro] Engine ready.");
})();
