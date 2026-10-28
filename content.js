// Gmail Crawler Pro - Multi-Section Historical Mailbox Crawler (v2.6)
// Complete traversal of Inbox, All Mail, and Spam with verified pagination transitions & 100% deduplication.

(function () {
    let isRunning = false;
    let abortRequested = false;

    // Detect Account Email (Receiver)
    function getAccountEmail() {
        try {
            const profileEl = document.querySelector('a[aria-label*="@"]') ||
                              document.querySelector('[data-identifier*="@"]') ||
                              document.querySelector('div[aria-label*="Google Account:"]');
            if (profileEl) {
                const raw = profileEl.getAttribute('aria-label') || profileEl.getAttribute('data-identifier') || '';
                const match = raw.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                if (match) return match[1];
            }
        } catch (e) {}
        return "Me";
    }

    // Extract Visible Emails on the Active Screen
    function extractVisibleEmails(myEmail) {
        const allRows = document.querySelectorAll('tr.zA');
        const results = [];
        const len = allRows.length;

        for (let i = 0; i < len; i++) {
            const row = allRows[i];

            // Ignore hidden rows from background/cached tabs
            if (row.offsetParent === null && window.getComputedStyle(row).display === 'none') {
                continue;
            }

            // 1. Sender
            let sender = "";
            const senderEl = row.querySelector('.yX [email]') || 
                             row.querySelector('.yX span.bA4 span') || 
                             row.querySelector('.yP, .zF');
            if (senderEl) {
                const emailAttr = senderEl.getAttribute('email');
                const text = (senderEl.textContent || "").trim();
                sender = emailAttr ? (text && text !== emailAttr ? `${text} <${emailAttr}>` : emailAttr) : text;
            } else {
                const generic = row.querySelector('.yX, .bA4');
                if (generic) sender = (generic.textContent || "").trim();
            }

            // 2. Subject
            let subject = "";
            const subjectEl = row.querySelector('span.bog, .bog span');
            if (subjectEl) {
                subject = (subjectEl.textContent || "").trim();
            }

            // 3. Body snippet preview
            let body = "";
            const snippetEl = row.querySelector('span.y2, .y2');
            if (snippetEl) {
                body = (snippetEl.textContent || "").replace(/^[\s–-]+/, '').trim();
            }

            // 4. Date
            let date = "";
            const dateEl = row.querySelector('.xW span[title]') || row.querySelector('.xW span') || row.querySelector('.xW');
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

    // Detect Gmail's Official Pagination Text (e.g., "1–50 of 2,419" or "51–100 of many")
    function getPaginationInfo() {
        const primary = document.querySelectorAll('.Dj, .amH, span.ts, [aria-live="polite"] span, div.ar5 span');
        for (let i = 0; i < primary.length; i++) {
            const el = primary[i];
            const text = (el.textContent || '').trim();
            const match = text.match(/(\d+)[\s–-]+(\d+)\s+(?:of|\/)\s+([0-9,]+|\S+)/i);
            if (match) {
                return {
                    raw: text,
                    start: parseInt(match[1], 10),
                    end: parseInt(match[2], 10),
                    total: match[3],
                    element: el
                };
            }
        }

        const allSpans = document.querySelectorAll('header span, nav span, .ar5 span, .ar4 span, div[role="main"] span');
        for (let j = 0; j < allSpans.length; j++) {
            const el = allSpans[j];
            const text = (el.textContent || '').trim();
            const match = text.match(/(\d+)[\s–-]+(\d+)\s+of\s+/i);
            if (match) {
                return {
                    raw: text,
                    start: parseInt(match[1], 10),
                    end: parseInt(match[2], 10),
                    total: '',
                    element: el
                };
            }
        }

        return null;
    }

    function isElementVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        try {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
        } catch (e) {
            return true;
        }
    }

    // Strict check if button is disabled
    function isButtonDisabled(btn) {
        if (!btn) return true;
        if (btn.getAttribute('aria-disabled') === 'true') return true;
        if (btn.classList.contains('T-I-J3') || btn.classList.contains('T-I-JW')) return true;
        if (btn.disabled === true || (btn.hasAttribute('disabled') && btn.getAttribute('disabled') !== 'false')) return true;
        try {
            const style = window.getComputedStyle(btn);
            if (style.pointerEvents === 'none' || parseFloat(style.opacity) < 0.4) return true;
        } catch (e) {}
        return false;
    }

    // Locate both Newer (left arrow) and Older (right arrow) pagination buttons
    function getPaginationControls() {
        let newerBtn = null;
        let olderBtn = null;
        let indicatorEl = null;

        // Search 1: via pagination count indicator (.Dj, .amH, etc.)
        const pag = getPaginationInfo();
        if (pag && pag.element) {
            indicatorEl = pag.element;
            const container = pag.element.closest('.ar5, .ar4, .J-J5-Ji') || pag.element.parentElement;
            if (container) {
                const buttons = Array.from(container.querySelectorAll('button, [role="button"], div.T-I')).filter(isElementVisible);
                if (buttons.length >= 2) {
                    newerBtn = buttons[0];
                    olderBtn = buttons[buttons.length - 1];
                }
            }
        }

        // Search 2: Specific Gmail Closure classes (.amI = Newer, .amD = Older)
        if (!olderBtn) {
            const el = document.querySelector('.ar5 .amD, .amD[role="button"], div.amD');
            if (isElementVisible(el)) olderBtn = el;
        }
        if (!newerBtn) {
            const el = document.querySelector('.ar5 .amI, .amI[role="button"], div.amI');
            if (isElementVisible(el)) newerBtn = el;
        }

        // Search 3: By aria-label attribute
        if (!olderBtn) {
            const olderCandidates = document.querySelectorAll('button[aria-label*="Older" i], div[aria-label*="Older" i], [role="button"][aria-label*="Older" i]');
            for (let i = 0; i < olderCandidates.length; i++) {
                const el = olderCandidates[i];
                if (isElementVisible(el) && el.getAttribute('role') !== 'tooltip') {
                    olderBtn = el;
                    break;
                }
            }
        }
        if (!newerBtn) {
            const newerCandidates = document.querySelectorAll('button[aria-label*="Newer" i], div[aria-label*="Newer" i], [role="button"][aria-label*="Newer" i]');
            for (let i = 0; i < newerCandidates.length; i++) {
                const el = newerCandidates[i];
                if (isElementVisible(el) && el.getAttribute('role') !== 'tooltip') {
                    newerBtn = el;
                    break;
                }
            }
        }

        return { newerBtn, olderBtn, indicatorEl };
    }

    // Trigger genuine user interaction to activate Google Closure event listeners
    function triggerClick(btn) {
        if (!btn) return false;

        try { btn.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch(e) {}
        try { btn.focus(); } catch(e) {}

        const rect = btn.getBoundingClientRect();
        const clientX = rect.left + rect.width / 2;
        const clientY = rect.top + rect.height / 2;

        const eventOpts = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: clientX,
            clientY: clientY,
            button: 0,
            buttons: 1
        };

        const child = btn.querySelector('svg, div, span, path') || btn;

        child.dispatchEvent(new PointerEvent('pointerdown', eventOpts));
        child.dispatchEvent(new MouseEvent('mousedown', eventOpts));
        child.dispatchEvent(new PointerEvent('pointerup', eventOpts));
        child.dispatchEvent(new MouseEvent('mouseup', eventOpts));
        child.dispatchEvent(new MouseEvent('click', eventOpts));

        if (child !== btn) {
            btn.dispatchEvent(new MouseEvent('mousedown', eventOpts));
            btn.dispatchEvent(new MouseEvent('mouseup', eventOpts));
            btn.dispatchEvent(new MouseEvent('click', eventOpts));
        }

        if (typeof btn.click === 'function') {
            btn.click();
        }

        try {
            btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            btn.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        } catch(e) {}

        return true;
    }

    // Capture state to verify page transition
    function getPageState() {
        const pag = getPaginationInfo();
        const rows = Array.from(document.querySelectorAll('tr.zA')).filter(r => r.offsetParent !== null);
        
        let firstSig = "";
        let lastSig = "";
        if (rows.length > 0) {
            const f = rows[0];
            const l = rows[rows.length - 1];
            firstSig = (f.querySelector('.yX')?.textContent || '') + '::' + (f.querySelector('.bog')?.textContent || '') + '::' + (f.querySelector('.xW')?.textContent || '');
            lastSig = (l.querySelector('.yX')?.textContent || '') + '::' + (l.querySelector('.bog')?.textContent || '') + '::' + (l.querySelector('.xW')?.textContent || '');
        }

        return {
            start: pag ? pag.start : 0,
            end: pag ? pag.end : 0,
            rawPagination: pag ? pag.raw : '',
            rowCount: rows.length,
            firstSig,
            lastSig
        };
    }

    // Wait until the current page DOM is completely loaded and settled
    async function waitForPageSettled() {
        for (let i = 0; i < 25; i++) {
            if (abortRequested) break;
            const rows = document.querySelectorAll('tr.zA');
            const alertEl = document.querySelector('div[role="alert"]');
            const isLoading = alertEl && (alertEl.textContent || '').toLowerCase().includes('loading');

            if (rows.length > 0 && !isLoading) {
                await sleep(150);
                return;
            }
            await sleep(100);
        }
    }

    // Rewind back to Page 1 (today's newest emails) before crawling section
    async function rewindToFirstPage() {
        const pag = getPaginationInfo();
        if (!pag || pag.start <= 1) {
            return;
        }

        const baseHash = (window.location.hash || '#inbox').split('/p')[0] || '#inbox';
        if (window.location.hash !== baseHash) {
            window.location.hash = baseHash;
            await sleep(600);
        }

        for (let i = 0; i < 25; i++) {
            const pagNow = getPaginationInfo();
            if (pagNow && pagNow.start <= 1) break;

            const controls = getPaginationControls();
            if (!controls.newerBtn || isButtonDisabled(controls.newerBtn)) break;

            triggerClick(controls.newerBtn);
            await sleep(350);
        }

        await waitForPageSettled();
    }

    // Navigate to a specific Gmail section (e.g., #all, #spam, #inbox)
    async function navigateToSection(sectionHash) {
        if (!sectionHash || sectionHash === 'current') return true;

        console.log(`[Gmail Crawler] Navigating to ${sectionHash}...`);
        const currentHash = (window.location.hash || '').split('/')[0];

        if (currentHash !== sectionHash) {
            window.location.hash = sectionHash;
            await sleep(1000);

            // Fallback: Click sidebar navigation item if hash didn't switch
            let sidebarSelector = '';
            if (sectionHash === '#all') {
                sidebarSelector = 'a[href*="#all"], [data-tooltip*="All Mail" i], a[title*="All Mail" i]';
            } else if (sectionHash === '#spam') {
                sidebarSelector = 'a[href*="#spam"], [data-tooltip*="Spam" i], a[title*="Spam" i]';
            } else if (sectionHash === '#inbox') {
                sidebarSelector = 'a[href*="#inbox"], [data-tooltip*="Inbox" i], a[title*="Inbox" i]';
            }

            if (sidebarSelector) {
                const link = document.querySelector(sidebarSelector);
                if (link) {
                    triggerClick(link);
                    await sleep(1000);
                }
            }
        }

        await waitForPageSettled();
        await rewindToFirstPage();
        return true;
    }

    // Wait for the Older button to become ready and enabled
    async function waitForOlderButtonReady(maxWaitMs = 3500) {
        const start = Date.now();
        while (Date.now() - start < maxWaitMs) {
            if (abortRequested) return null;
            const controls = getPaginationControls();
            if (controls.olderBtn && !isButtonDisabled(controls.olderBtn)) {
                return controls.olderBtn;
            }
            await sleep(150);
        }
        return getPaginationControls().olderBtn;
    }

    // Wait for new page load after clicking Older
    async function waitForNewPageLoad(stateBefore, timeoutMs = 6500) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (abortRequested) return false;
            await sleep(150);

            const current = getPageState();

            // 1. Concrete pagination number advanced (e.g. 1 -> 51, 51 -> 101)
            if (stateBefore.start > 0 && current.start > 0 && current.start > stateBefore.start) {
                return true;
            }

            // 2. Pagination raw text changed and row count > 0
            if (stateBefore.rawPagination && current.rawPagination && 
                stateBefore.rawPagination !== current.rawPagination && current.rowCount > 0) {
                return true;
            }

            // 3. Both first and last row signatures changed and rowCount > 0
            if (current.rowCount >= 5 && stateBefore.firstSig && current.firstSig &&
                current.firstSig !== stateBefore.firstSig && current.lastSig !== stateBefore.lastSig) {
                return true;
            }
        }
        return false;
    }

    // Crawls all available pages of a single section backwards in time
    async function crawlSectionPages(sectionLabel, maxPages, allEmails, seenSignatures, phaseInfo = "") {
        let pageNum = 1;
        let consecutiveFailedTransitions = 0;
        const myEmail = getAccountEmail();

        while (pageNum <= maxPages && !abortRequested) {
            await waitForPageSettled();

            const pageData = extractVisibleEmails(myEmail);
            let addedCount = 0;

            for (let i = 0; i < pageData.length; i++) {
                const item = pageData[i];
                const sig = (item.sender + "::" + item.subject + "::" + item.date).toLowerCase();
                if (!seenSignatures.has(sig)) {
                    seenSignatures.add(sig);
                    allEmails.push(item);
                    addedCount++;
                }
            }

            const oldestDate = allEmails.length > 0 ? allEmails[allEmails.length - 1].date : "Scanning...";
            const pag = getPaginationInfo();
            const pagLabel = pag ? pag.raw : `Page ${pageNum}`;

            updateHudOverlay(
                pageNum, 
                maxPages, 
                allEmails.length, 
                `${phaseInfo}[${sectionLabel}: ${pagLabel}] +${addedCount} new // Earliest: ${oldestDate}`
            );

            if (abortRequested) break;
            if (pageNum >= maxPages) {
                console.log(`[Gmail Crawler] Reached configured max pages limit in ${sectionLabel}.`);
                break;
            }

            const stateBefore = getPageState();

            let olderBtn = await waitForOlderButtonReady(3500);
            if (!olderBtn || isButtonDisabled(olderBtn)) {
                await sleep(1500);
                const recheckBtn = getPaginationControls().olderBtn;
                if (!recheckBtn || isButtonDisabled(recheckBtn)) {
                    console.log(`[Gmail Crawler] Older button confirmed disabled in ${sectionLabel}. Reached end of folder.`);
                    break;
                }
                olderBtn = recheckBtn;
            }

            let pageTransitioned = false;
            for (let attempt = 1; attempt <= 4; attempt++) {
                if (abortRequested) break;

                const controls = getPaginationControls();
                const btn = controls.olderBtn;
                if (!btn) {
                    await sleep(400);
                    continue;
                }

                if (isButtonDisabled(btn)) {
                    await sleep(1000);
                    if (isButtonDisabled(getPaginationControls().olderBtn)) {
                        pageTransitioned = false;
                        break;
                    }
                }

                updateHudOverlay(
                    pageNum,
                    maxPages,
                    allEmails.length,
                    `${phaseInfo}Advancing ${sectionLabel} ${pageNum} ➔ ${pageNum + 1}... (Attempt ${attempt}/4)`
                );

                triggerClick(btn);

                if (attempt >= 2) {
                    try {
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', code: 'KeyG', bubbles: true }));
                        await sleep(50);
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', code: 'KeyN', bubbles: true }));
                    } catch(e) {}
                }

                const transitioned = await waitForNewPageLoad(stateBefore, 6000);
                if (transitioned) {
                    pageTransitioned = true;
                    break;
                }

                console.warn(`[Gmail Crawler] ${sectionLabel} page ${pageNum} attempt ${attempt} timed out. Retrying...`);
                await sleep(500);
            }

            if (abortRequested) break;

            if (!pageTransitioned) {
                const finalControls = getPaginationControls();
                if (!finalControls.olderBtn || isButtonDisabled(finalControls.olderBtn)) {
                    console.log(`[Gmail Crawler] Reached end of ${sectionLabel}.`);
                    break;
                }

                consecutiveFailedTransitions++;
                if (consecutiveFailedTransitions >= 2) {
                    console.warn(`[Gmail Crawler] Page did not transition after multiple attempts in ${sectionLabel}.`);
                    break;
                }
            } else {
                consecutiveFailedTransitions = 0;
                pageNum++;
            }
        }
    }

    // 🌐 BULLETPROOF MULTI-SECTION HISTORIC CRAWLER
    async function runHistoricCrawl(maxPages, format, scope = 'all_sweep') {
        if (isRunning) return;
        isRunning = true;
        abortRequested = false;

        const allEmails = [];
        const seenSignatures = new Set();

        showHudOverlay("Connecting to Historical Mailbox Stream...");

        if (scope === 'all_sweep') {
            // Phase 1: All Mail (covers Inbox, Sent, Archive, Categories)
            updateHudOverlay(1, maxPages, 0, "Phase 1/2: Navigating to All Mail (includes Inbox)...");
            await navigateToSection('#all');
            await crawlSectionPages("All Mail", maxPages, allEmails, seenSignatures, "Phase 1/2: ");

            // Phase 2: Spam Folder
            if (!abortRequested) {
                updateHudOverlay(1, maxPages, allEmails.length, "Phase 2/2: Navigating to Spam Folder...");
                await navigateToSection('#spam');
                await crawlSectionPages("Spam", maxPages, allEmails, seenSignatures, "Phase 2/2: ");
            }
        } else if (scope === 'all_mail') {
            updateHudOverlay(1, maxPages, 0, "Navigating to All Mail...");
            await navigateToSection('#all');
            await crawlSectionPages("All Mail", maxPages, allEmails, seenSignatures);
        } else if (scope === 'inbox') {
            updateHudOverlay(1, maxPages, 0, "Navigating to Inbox...");
            await navigateToSection('#inbox');
            await crawlSectionPages("Inbox", maxPages, allEmails, seenSignatures);
        } else if (scope === 'spam') {
            updateHudOverlay(1, maxPages, 0, "Navigating to Spam...");
            await navigateToSection('#spam');
            await crawlSectionPages("Spam", maxPages, allEmails, seenSignatures);
        } else {
            // Current open view
            await rewindToFirstPage();
            await crawlSectionPages("Current View", maxPages, allEmails, seenSignatures);
        }

        removeHudOverlay();
        isRunning = false;

        if (allEmails.length > 0) {
            const filename = scope === 'all_sweep' ? 
                `gmail_complete_all_mail_inbox_and_spam_${allEmails.length}_emails` : 
                `gmail_crawled_${scope}_${allEmails.length}_emails`;
            saveExport(allEmails, format, filename);
        } else {
            alert("No emails found to export in the selected folders.");
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
            width: 400px;
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

    // Message Listener for Extension Popup
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
        const myEmail = getAccountEmail();

        if (req.action === "get_status") {
            const rowCount = document.querySelectorAll('tr.zA').length;
            sendResponse({ rowCount });
        } else if (req.action === "crawl_page") {
            const data = extractVisibleEmails(myEmail);
            if (data.length > 0) {
                saveExport(data, req.format || 'csv', `gmail_single_page_${data.length}_emails`);
            }
            sendResponse({ count: data.length });
        } else if (req.action === "crawl_historic") {
            runHistoricCrawl(req.maxPages || 999, req.format || 'csv', req.scope || 'all_sweep');
            sendResponse({ started: true });
        }
        return true;
    });

    console.log("[Gmail Crawler Pro v2.6] Multi-Section Historic Mailbox Engine active.");
})();
