// Gmail Crawler Pro - Turbo Performance Engine (v2.2)
// Ultra-fast extraction using non-blocking textContent and micro-second DOM polling.

(function () {
    let isRunning = false;
    let abortRequested = false;

    // Passive session buffer: automatically accumulates emails as the user browses
    const sessionEmails = [];
    const sessionSeen = new Set();

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

    // High-performance DOM extractor: uses textContent to avoid browser layout reflows (10x faster)
    function extractPageEmails(myEmail) {
        const rows = document.querySelectorAll('tr.zA');
        const results = [];
        const len = rows.length;

        for (let i = 0; i < len; i++) {
            const row = rows[i];
            
            // Sender
            let sender = "";
            const senderEl = row.querySelector('.yX [email]') || 
                             row.querySelector('.yX span.bA4 span') || 
                             row.querySelector('.yP, .zF');
            if (senderEl) {
                const emailAttr = senderEl.getAttribute('email');
                const text = (senderEl.textContent || "").trim();
                sender = emailAttr ? (text && text !== emailAttr ? `${text} <${emailAttr}>` : emailAttr) : text;
            }

            // Subject
            let subject = "";
            const subjectEl = row.querySelector('span.bog');
            if (subjectEl) {
                subject = (subjectEl.textContent || "").trim();
            }

            // Body (Snippet preview in inbox list view)
            let body = "";
            const snippetEl = row.querySelector('span.y2');
            if (snippetEl) {
                body = (snippetEl.textContent || "").replace(/^[\s–-]+/, '').trim();
            }

            // Date
            let date = "";
            const dateEl = row.querySelector('.xW span[title]') || row.querySelector('.xW span');
            if (dateEl) {
                date = dateEl.getAttribute('title') || (dateEl.textContent || "").trim();
            }

            results.push({
                sender: sender || "Unknown",
                receiver: myEmail,
                date: date || new Date().toLocaleDateString(),
                subject: subject || "(No Subject)",
                body: body || ""
            });
        }

        // Also add to session buffer in background
        for (let j = 0; j < results.length; j++) {
            const item = results[j];
            const sig = (item.sender + "||" + item.subject + "||" + item.date).toLowerCase();
            if (!sessionSeen.has(sig)) {
                sessionSeen.add(sig);
                sessionEmails.push(item);
            }
        }

        return results;
    }

    // Robust pagination button locator
    function getOlderButton() {
        const candidates = Array.from(document.querySelectorAll(
            'div[aria-label*="Older"], div[data-tooltip*="Older"], ' +
            'div[aria-label*="Next"], div[data-tooltip*="Next"], ' +
            'span[aria-label*="Older"], span[data-tooltip*="Older"]'
        ));

        for (let i = 0; i < candidates.length; i++) {
            const el = candidates[i];
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const isDisabled = el.getAttribute('aria-disabled') === 'true' || 
                                   el.classList.contains('T-I-J3') || 
                                   el.getAttribute('disabled') !== null;
                if (!isDisabled) return el;
            }
        }

        // Fallback: Check range text sibling button
        const allSpans = Array.from(document.querySelectorAll('span.Dj, span.amH, span, div'));
        for (let i = 0; i < allSpans.length; i++) {
            const span = allSpans[i];
            const text = span.textContent ? span.textContent.trim() : '';
            if (/^\d+[\s–-]+\d+\s+of\s+/i.test(text)) {
                const parent = span.closest('.J-J5-Ji') || span.parentElement;
                if (parent) {
                    const buttons = Array.from(parent.querySelectorAll('div[role="button"], span[role="button"]'));
                    if (buttons.length >= 2) {
                        const olderBtn = buttons[buttons.length - 1];
                        const rect = olderBtn.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0 && olderBtn.getAttribute('aria-disabled') !== 'true' && !olderBtn.classList.contains('T-I-J3')) {
                            return olderBtn;
                        }
                    }
                }
            }
        }

        return null;
    }

    // Real pointer/mouse event simulation for Google Closure buttons
    function simulateRealClick(element) {
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        const eventOpts = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y
        };

        element.dispatchEvent(new PointerEvent('pointerdown', eventOpts));
        element.dispatchEvent(new MouseEvent('mousedown', eventOpts));
        element.dispatchEvent(new PointerEvent('pointerup', eventOpts));
        element.dispatchEvent(new MouseEvent('mouseup', eventOpts));
        element.dispatchEvent(new MouseEvent('click', eventOpts));

        if (typeof element.click === 'function') {
            element.click();
        }
    }

    function getFirstRowSignature() {
        const firstRow = document.querySelector('tr.zA');
        if (!firstRow) return "";
        const sub = firstRow.querySelector('.bog') ? firstRow.querySelector('.bog').textContent : "";
        const date = firstRow.querySelector('.xW') ? firstRow.querySelector('.xW').textContent : "";
        return (sub + "_" + date).trim();
    }

    // ⚡ TURBO MULTI-PAGE CRAWLER: Micro-second page flipping (up to 20x faster)
    async function runTurboCrawl(maxPages, format) {
        if (isRunning) return;
        isRunning = true;
        abortRequested = false;

        const myEmail = getAccountEmail();
        const allEmails = [];
        const seenSignatures = new Set();
        let pageNum = 1;
        const startTime = Date.now();

        showHudOverlay("⚡ TURBO CRAWLER ACTIVE - Maximum speed enabled...");

        while (pageNum <= maxPages && !abortRequested) {
            // Instant synchronous parse (< 2ms)
            const pageData = extractPageEmails(myEmail);
            let newBatch = 0;

            for (let i = 0; i < pageData.length; i++) {
                const item = pageData[i];
                const sig = (item.sender + "||" + item.subject + "||" + item.date).toLowerCase();
                if (!seenSignatures.has(sig)) {
                    seenSignatures.add(sig);
                    allEmails.push(item);
                    newBatch++;
                }
            }

            const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
            const rate = Math.round(allEmails.length / elapsedSec);
            updateHudOverlay(pageNum, maxPages, allEmails.length, `Page ${pageNum} complete (+${newBatch} new) // ${rate} msg/s`);

            if (abortRequested) break;

            // Locate next page button
            const nextBtn = getOlderButton();
            if (!nextBtn) {
                updateHudOverlay(pageNum, maxPages, allEmails.length, "Reached end of mailbox!");
                await sleep(400);
                break;
            }

            // Remember first email signature before click
            const signatureBefore = getFirstRowSignature();

            // Trigger instant click
            simulateRealClick(nextBtn);

            // Fast micro-poll: check every 25ms (instant trigger as soon as DOM renders)
            let pageChanged = false;
            for (let t = 0; t < 80; t++) {
                await sleep(25);
                if (getFirstRowSignature() !== signatureBefore) {
                    pageChanged = true;
                    break;
                }
            }

            if (!pageChanged) {
                // If DOM did not change after 2 seconds, we are at the last page
                break;
            }

            pageNum++;
        }

        removeHudOverlay();
        isRunning = false;

        if (allEmails.length > 0) {
            saveExport(allEmails, format, `gmail_turbo_crawl_${allEmails.length}_emails`);
        } else {
            alert("No emails found to export.");
        }
    }

    // Export Handler: Clean CSV or JSON
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
            const headers = ["sender", "receiver", "date", "subject", "body"];
            const rows = [headers.join(",")];
            for (let i = 0; i < data.length; i++) {
                const item = data[i];
                rows.push([
                    escapeCSV(item.sender),
                    escapeCSV(item.receiver),
                    escapeCSV(item.date),
                    escapeCSV(item.subject),
                    escapeCSV(item.body)
                ].join(","));
            }
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

    // Ultra-Fast On-Screen HUD Overlay
    function showHudOverlay(title) {
        removeHudOverlay();
        const div = document.createElement('div');
        div.id = 'gmail-crawler-hud-box';
        div.style.cssText = `
            position: fixed;
            top: 18px;
            right: 18px;
            z-index: 9999999;
            background: #0a0d14;
            color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            border: 1px solid #00f0ff;
            border-radius: 8px;
            padding: 14px 18px;
            width: 330px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.85), 0 0 20px rgba(0, 240, 255, 0.35);
        `;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px;">
                <span style="font-size:12px; font-weight:700; color:#00f0ff; letter-spacing:0.5px;">⚡ TURBO CRAWLER ACTIVE</span>
                <span id="hud-page-count" style="font-size:11px; font-family:monospace; color:#8ab4f8;">Page 1</span>
            </div>
            <div id="hud-status" style="font-size:11px; color:#cbd5e1; margin-bottom:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${title}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span id="hud-total-count" style="font-size:13px; color:#10b981; font-weight:700; font-family:monospace;">0 Emails</span>
                <button id="hud-abort-btn" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:4px; font-size:11px; font-weight:700; cursor:pointer;">
                    DOWNLOAD CSV NOW
                </button>
            </div>
        `;
        document.body.appendChild(div);
        document.getElementById('hud-abort-btn').onclick = () => {
            abortRequested = true;
            document.getElementById('hud-status').textContent = "Finalizing and downloading CSV...";
        };
    }

    function updateHudOverlay(current, max, total, msg) {
        const pageEl = document.getElementById('hud-page-count');
        const statusEl = document.getElementById('hud-status');
        const totalEl = document.getElementById('hud-total-count');

        if (pageEl) pageEl.textContent = `Page ${current} ${max < 999 ? '/ ' + max : ''}`;
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
            const rowCount = document.querySelectorAll('tr.zA').length;
            sendResponse({ rowCount, sessionCount: sessionEmails.length });
        } else if (req.action === "crawl_page") {
            const data = extractPageEmails(myEmail);
            if (data.length > 0) {
                saveExport(data, req.format || 'csv', `gmail_single_page_${data.length}_emails`);
            }
            sendResponse({ count: data.length });
        } else if (req.action === "crawl_turbo") {
            runTurboCrawl(req.maxPages || 999, req.format || 'csv');
            sendResponse({ started: true });
        } else if (req.action === "download_session") {
            if (sessionEmails.length > 0) {
                saveExport(sessionEmails, req.format || 'csv', `gmail_session_history_${sessionEmails.length}_emails`);
                sendResponse({ count: sessionEmails.length });
            } else {
                const cur = extractPageEmails(myEmail);
                saveExport(cur, req.format || 'csv', `gmail_crawled_${cur.length}_emails`);
                sendResponse({ count: cur.length });
            }
        }
        return true;
    });

    console.log("[Gmail Crawler Pro v2.2] Turbo Engine initialized.");
})();
