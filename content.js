// Gmail Crawler Pro - Perfected Multi-Page Historic Mailbox Crawler (v2.3)
// Guarantees 100% unique emails from beginning to end with verified page transitions & hash-router fallback.

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

        return results;
    }

    // Identifies the signature of the top row to detect when the page actually transitions
    function getTopRowSignature() {
        const firstRow = document.querySelector('tr.zA');
        if (!firstRow) return "";
        const sender = firstRow.querySelector('.yX') ? firstRow.querySelector('.yX').textContent.trim() : "";
        const subject = firstRow.querySelector('.bog') ? firstRow.querySelector('.bog').textContent.trim() : "";
        const date = firstRow.querySelector('.xW') ? firstRow.querySelector('.xW').textContent.trim() : "";
        return `${sender}||${subject}||${date}`;
    }

    // Locate the active "Older" / "Next Page" pagination button
    function getOlderButton() {
        const selectors = [
            'div[aria-label="Older"]',
            'div[data-tooltip="Older"]',
            'div[aria-label*="Older"]',
            'div[data-tooltip*="Older"]',
            'div[aria-label="Next"]',
            'div[data-tooltip="Next"]',
            'div[aria-label*="Purane"]',
            'div[data-tooltip*="Purane"]',
            'div[act="20"]'
        ];

        for (let i = 0; i < selectors.length; i++) {
            const elements = document.querySelectorAll(selectors[i]);
            for (let j = 0; j < elements.length; j++) {
                const el = elements[j];
                const rect = el.getBoundingClientRect();
                const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
                const isDisabled = el.getAttribute('aria-disabled') === 'true' || 
                                   el.classList.contains('T-I-J3') || 
                                   el.getAttribute('disabled') !== null;
                if (isVisible && !isDisabled) {
                    return el;
                }
            }
        }

        // Fallback: Find the pagination indicator container (e.g., "1–50 of ...")
        const allSpans = Array.from(document.querySelectorAll('span.Dj, span.amH, span, div'));
        for (let i = 0; i < allSpans.length; i++) {
            const span = allSpans[i];
            const text = span.textContent ? span.textContent.trim() : '';
            if (/^\d+[\s–-]+\d+\s+of\s+/i.test(text)) {
                const parent = span.closest('.J-J5-Ji') || span.parentElement;
                if (parent) {
                    const buttons = Array.from(parent.querySelectorAll('div[role="button"], span[role="button"]'));
                    if (buttons.length >= 2) {
                        const olderBtn = buttons[buttons.length - 1]; // Right button is Older
                        const rect = olderBtn.getBoundingClientRect();
                        const isVisible = rect.width > 0 && rect.height > 0;
                        const isDisabled = olderBtn.getAttribute('aria-disabled') === 'true' || olderBtn.classList.contains('T-I-J3');
                        if (isVisible && !isDisabled) {
                            return olderBtn;
                        }
                    }
                }
            }
        }

        return null;
    }

    // Trigger full mouse and pointer sequence to activate Google Closure event listeners
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

    function getBaseSection() {
        const hash = (window.location.hash || "").replace(/^#/, '');
        const section = hash.split('/p')[0] || "inbox";
        return section || "inbox";
    }

    // 🌐 BULLETPROOF HISTORIC CRAWLER: Crawls all pages backwards in time from beginning to end
    async function runHistoricCrawl(maxPages, format) {
        if (isRunning) return;
        isRunning = true;
        abortRequested = false;

        const myEmail = getAccountEmail();
        const allEmails = [];
        const seenSignatures = new Set();
        let pageNum = 1;

        showHudOverlay("Initializing Mailbox Historical Crawler...");

        while (pageNum <= maxPages && !abortRequested) {
            // Extract emails currently on screen
            const pageData = extractPageEmails(myEmail);
            let addedCount = 0;

            for (let i = 0; i < pageData.length; i++) {
                const item = pageData[i];
                // Strict composite signature to guarantee ZERO duplicate rows
                const sig = (item.sender + "::" + item.subject + "::" + item.date).toLowerCase();
                if (!seenSignatures.has(sig)) {
                    seenSignatures.add(sig);
                    allEmails.push(item);
                    addedCount++;
                }
            }

            // Find oldest date reached so far
            let oldestDate = "";
            if (allEmails.length > 0) {
                oldestDate = allEmails[allEmails.length - 1].date;
            }

            updateHudOverlay(
                pageNum, 
                maxPages, 
                allEmails.length, 
                `Page ${pageNum} (+${addedCount} unique) // Earliest: ${oldestDate || 'Scanning...'}`
            );

            if (abortRequested) break;

            // If a page yielded 0 new unique emails on page > 1, verify if we reached the end
            if (pageNum > 1 && addedCount === 0) {
                console.log("[Gmail Crawler] No new emails on this page. Mailbox end reached.");
                updateHudOverlay(pageNum, maxPages, allEmails.length, "Reached end of mailbox! Finalizing...");
                await sleep(600);
                break;
            }

            // Record signature before flipping page
            const signatureBefore = getTopRowSignature();

            // Try Button Click first
            const nextBtn = getOlderButton();
            if (nextBtn) {
                simulateRealClick(nextBtn);
            }

            // Wait for DOM to update with new emails
            let pageChanged = false;
            for (let t = 0; t < 25; t++) {
                await sleep(100);
                if (getTopRowSignature() !== signatureBefore) {
                    pageChanged = true;
                    break;
                }
            }

            // If button click did not trigger page load, use Gmail's Hash Router fallback
            if (!pageChanged) {
                const section = getBaseSection();
                const nextHash = `#${section}/p${pageNum + 1}`;
                console.log(`[Gmail Crawler] Attempting Hash Navigation to ${nextHash}`);
                window.location.hash = nextHash;

                for (let t2 = 0; t2 < 25; t2++) {
                    await sleep(100);
                    if (getTopRowSignature() !== signatureBefore) {
                        pageChanged = true;
                        break;
                    }
                }
            }

            // If the page STILL did not change after both methods, we are at the very end of the mailbox!
            if (!pageChanged) {
                console.log("[Gmail Crawler] Mailbox end reached (no further pages available).");
                updateHudOverlay(pageNum, maxPages, allEmails.length, "End of mailbox reached. Compiling CSV...");
                await sleep(800);
                break;
            }

            pageNum++;
        }

        removeHudOverlay();
        isRunning = false;

        if (allEmails.length > 0) {
            saveExport(allEmails, format, `gmail_complete_crawled_${allEmails.length}_unique_emails`);
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

    // Cyber Void HUD On-Screen Overlay
    function showHudOverlay(title) {
        removeHudOverlay();
        const div = document.createElement('div');
        div.id = 'gmail-crawler-hud-box';
        div.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999999;
            background: #0a0d14;
            color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            border: 1px solid #00f0ff;
            border-radius: 8px;
            padding: 16px 20px;
            width: 360px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.9), 0 0 25px rgba(0, 240, 255, 0.4);
        `;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px;">
                <span style="font-size:13px; font-weight:700; color:#00f0ff; letter-spacing:0.5px;">GMAIL CRAWLER ACTIVE</span>
                <span id="hud-page-count" style="font-size:12px; font-family:monospace; color:#8ab4f8;">Page 1</span>
            </div>
            <div id="hud-status" style="font-size:11px; color:#cbd5e1; margin-bottom:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${title}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span id="hud-total-count" style="font-size:13px; color:#10b981; font-weight:700; font-family:monospace;">0 Unique Emails</span>
                <button id="hud-abort-btn" style="background:#ef4444; color:#fff; border:none; padding:7px 14px; border-radius:4px; font-size:11px; font-weight:700; cursor:pointer;">
                    STOP & DOWNLOAD CSV
                </button>
            </div>
        `;
        document.body.appendChild(div);
        document.getElementById('hud-abort-btn').onclick = () => {
            abortRequested = true;
            document.getElementById('hud-status').textContent = "Stopping crawler and generating CSV...";
        };
    }

    function updateHudOverlay(current, max, total, msg) {
        const pageEl = document.getElementById('hud-page-count');
        const statusEl = document.getElementById('hud-status');
        const totalEl = document.getElementById('hud-total-count');

        if (pageEl) pageEl.textContent = `Page ${current} ${max < 999 ? '/ ' + max : ''}`;
        if (statusEl) statusEl.textContent = msg;
        if (totalEl) totalEl.textContent = `${total} Unique Emails`;
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
            sendResponse({ rowCount });
        } else if (req.action === "crawl_page") {
            const data = extractPageEmails(myEmail);
            if (data.length > 0) {
                saveExport(data, req.format || 'csv', `gmail_single_page_${data.length}_emails`);
            }
            sendResponse({ count: data.length });
        } else if (req.action === "crawl_historic") {
            runHistoricCrawl(req.maxPages || 999, req.format || 'csv');
            sendResponse({ started: true });
        }
        return true;
    });

    console.log("[Gmail Crawler Pro v2.3] Historical Mailbox Engine loaded.");
})();
