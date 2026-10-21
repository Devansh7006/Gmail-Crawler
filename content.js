// Gmail Crawler Pro - Bulletproof Multi-Page & All-Folder Crawler
// Safely advances across pages (50, 100, 500, 1000+ mails) and compiles into one single CSV.

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

            // Body (Snippet preview in inbox list view)
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

    // Robust selector for Gmail's "Older" / "Next Page" pagination button
    function getOlderButton() {
        // Strategy 1: Look for aria-label or data-tooltip containing Older/Next
        const candidates = Array.from(document.querySelectorAll(
            'div[aria-label*="Older"], div[data-tooltip*="Older"], ' +
            'div[aria-label*="Next"], div[data-tooltip*="Next"], ' +
            'span[aria-label*="Older"], span[data-tooltip*="Older"]'
        ));

        for (const el of candidates) {
            const rect = el.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            const isDisabled = el.getAttribute('aria-disabled') === 'true' || 
                               el.classList.contains('T-I-J3') || 
                               el.getAttribute('disabled') !== null;
            if (isVisible && !isDisabled) {
                return el;
            }
        }

        // Strategy 2: Find the range indicator (e.g., "1–50 of ...") and get the next sibling button
        const allSpans = Array.from(document.querySelectorAll('span.Dj, span.amH, span, div'));
        for (const span of allSpans) {
            const text = span.textContent ? span.textContent.trim() : '';
            if (/^\d+[\s–-]+\d+\s+of\s+/i.test(text)) {
                const parent = span.closest('.J-J5-Ji') || span.parentElement;
                if (parent) {
                    const buttons = Array.from(parent.querySelectorAll('div[role="button"], span[role="button"]'));
                    if (buttons.length >= 2) {
                        const olderBtn = buttons[buttons.length - 1]; // Right button is "Older"
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

    // Triggers real pointer/mouse events to properly activate Google Closure UI buttons
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
        const sub = firstRow.querySelector('.bog') ? firstRow.querySelector('.bog').innerText : "";
        const date = firstRow.querySelector('.xW') ? firstRow.querySelector('.xW').innerText : "";
        return (sub + "_" + date).trim();
    }

    // MULTI-PAGE BULK CRAWLER ENGINE
    async function runBulkCrawl(maxPages, format) {
        if (isRunning) return;
        isRunning = true;
        abortRequested = false;

        const myEmail = getAccountEmail();
        const allEmails = [];
        const seenSignatures = new Set();
        let pageNum = 1;

        showHudOverlay("Initializing Multi-Page Crawler...");

        while (pageNum <= maxPages && !abortRequested) {
            updateHudOverlay(pageNum, maxPages, allEmails.length, `Reading page ${pageNum}...`);
            await sleep(500);

            // Extract emails from current page
            const pageData = extractPageEmails(myEmail);
            let addedCount = 0;

            for (const item of pageData) {
                const sig = (item.sender + "||" + item.subject + "||" + item.date).toLowerCase();
                if (!seenSignatures.has(sig)) {
                    seenSignatures.add(sig);
                    allEmails.push(item);
                    addedCount++;
                }
            }

            updateHudOverlay(pageNum, maxPages, allEmails.length, `Page ${pageNum} complete (+${addedCount} emails).`);

            // If user clicked abort
            if (abortRequested) {
                break;
            }

            // Find Next Page button
            const nextBtn = getOlderButton();
            if (!nextBtn) {
                updateHudOverlay(pageNum, maxPages, allEmails.length, "Reached last page of this section.");
                await sleep(1000);
                break;
            }

            // Remember first email before clicking to verify the page actually flips
            const signatureBefore = getFirstRowSignature();

            updateHudOverlay(pageNum, maxPages, allEmails.length, "Advancing to next page...");
            simulateRealClick(nextBtn);

            // Wait for DOM to load next page (up to 4.5 seconds)
            let pageChanged = false;
            for (let t = 0; t < 15; t++) {
                await sleep(300);
                if (getFirstRowSignature() !== signatureBefore) {
                    pageChanged = true;
                    break;
                }
            }

            if (!pageChanged) {
                // Try clicking once more
                simulateRealClick(nextBtn);
                await sleep(1200);
            }

            pageNum++;
        }

        removeHudOverlay();
        isRunning = false;

        if (allEmails.length > 0) {
            saveExport(allEmails, format, `gmail_bulk_crawl_${allEmails.length}_emails`);
        } else {
            alert("No emails found to export.");
        }
    }

    // Export Handler
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

    // High-Tech Cyber HUD On-Screen Overlay
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
            font-family: 'Segoe UI', system-ui, sans-serif;
            border: 1px solid #00f0ff;
            border-radius: 8px;
            padding: 16px 20px;
            width: 340px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(0, 240, 255, 0.3);
            animation: fadeIn 0.2s ease;
        `;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px;">
                <span style="font-size:13px; font-weight:700; color:#00f0ff; letter-spacing:0.5px;">GMAIL CRAWLER ACTIVE</span>
                <span id="hud-page-count" style="font-size:12px; font-family:monospace; color:#8ab4f8;">Page 1</span>
            </div>
            <div id="hud-status" style="font-size:12px; color:#cbd5e1; margin-bottom:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${title}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span id="hud-total-count" style="font-size:13px; color:#10b981; font-weight:700; font-family:monospace;">0 Emails</span>
                <button id="hud-abort-btn" style="background:#ef4444; color:#fff; border:none; padding:8px 14px; border-radius:4px; font-size:11px; font-weight:700; cursor:pointer;">
                    STOP & DOWNLOAD CSV
                </button>
            </div>
        `;
        document.body.appendChild(div);
        document.getElementById('hud-abort-btn').onclick = () => {
            abortRequested = true;
            document.getElementById('hud-status').textContent = "Stopping and compiling CSV file...";
        };
    }

    function updateHudOverlay(current, max, total, msg) {
        const pageEl = document.getElementById('hud-page-count');
        const statusEl = document.getElementById('hud-status');
        const totalEl = document.getElementById('hud-total-count');

        if (pageEl) pageEl.textContent = `Page ${current} ${max < 999 ? '/ ' + max : ''}`;
        if (statusEl) statusEl.textContent = msg;
        if (totalEl) totalEl.textContent = `${total} Emails Captured`;
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
            const data = extractPageEmails(myEmail);
            if (data.length > 0) {
                saveExport(data, req.format || 'csv', `gmail_single_page_${data.length}_emails`);
            }
            sendResponse({ count: data.length });
        } else if (req.action === "crawl_bulk") {
            runBulkCrawl(req.maxPages || 999, req.format || 'csv');
            sendResponse({ started: true });
        }
        return true;
    });

    console.log("[Gmail Crawler Pro v2.1] Multi-page engine loaded.");
})();
