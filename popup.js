// Gmail Crawler Pro - Popup Controller (v2.1)

document.addEventListener('DOMContentLoaded', async () => {
    const beacon = document.getElementById('target-beacon');
    const beaconText = document.getElementById('beacon-text');
    const statEmails = document.getElementById('stat-emails');
    const statEmailsSub = document.getElementById('stat-emails-sub');
    const statFolder = document.getElementById('stat-folder');
    const statStatus = document.getElementById('stat-status');
    const terminalLog = document.getElementById('terminal-log');
    const btnClearLog = document.getElementById('btn-clear-log');
    const btnStart = document.getElementById('btn-crawl-start');
    const crawlBtnText = document.getElementById('crawl-btn-text');
    const optBulk = document.getElementById('opt-bulk');
    const optPage = document.getElementById('opt-page');
    const limitRow = document.getElementById('limit-row');
    const pageLimitSelect = document.getElementById('page-limit-select');

    let currentMode = 'bulk'; // Default to BULK MULTI-PAGE
    let activeTabId = null;

    function addLog(tag, msg, isCyan = false) {
        const time = new Date().toTimeString().slice(0, 8);
        const div = document.createElement('div');
        div.className = `log-line ${isCyan ? 'text-cyan' : ''}`;
        div.innerHTML = `<span class="log-ts">[${time} ${tag}]</span> ${msg}`;
        terminalLog.appendChild(div);
        terminalLog.scrollTop = terminalLog.scrollHeight;
    }

    btnClearLog.addEventListener('click', () => {
        terminalLog.innerHTML = '';
        addLog('SYS', 'Telemetry stream reset.');
    });

    // Handle radio toggles
    document.querySelectorAll('input[name="crawl_scope"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentMode = e.target.value;
            if (currentMode === 'bulk') {
                optBulk.classList.add('active');
                optPage.classList.remove('active');
                limitRow.style.display = 'flex';
                crawlBtnText.textContent = 'START MULTI-PAGE CRAWL';
                addLog('MODE', 'Selected: Multi-Page Bulk (Auto-Page Stepper).', true);
            } else {
                optPage.classList.add('active');
                optBulk.classList.remove('active');
                limitRow.style.display = 'none';
                crawlBtnText.textContent = 'EXTRACT SINGLE PAGE (50)';
                addLog('MODE', 'Selected: Current View only (50 mails).');
            }
        });
    });

    function getSelectedFormat() {
        const radio = document.querySelector('input[name="format"]:checked');
        return radio ? radio.value : 'csv';
    }

    // Connect with active Gmail tab
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        activeTabId = tab ? tab.id : null;

        if (!tab || !tab.url || !tab.url.includes("mail.google.com")) {
            beacon.classList.add('offline');
            beaconText.textContent = 'NO GMAIL LINK';
            statStatus.textContent = 'OFFLINE';
            statStatus.className = 'telemetry-value text-muted';
            btnStart.disabled = true;
            addLog('ERR', 'Active tab is not mail.google.com', false);
            addLog('HELP', 'Open Gmail in your browser tab to begin.', true);
            return;
        }

        // Detect folder from URL
        const urlHash = tab.url.split('#')[1] || 'inbox';
        const folderName = urlHash.split('/')[0].toUpperCase();
        statFolder.textContent = folderName || 'INBOX';

        // Query status from content script
        chrome.tabs.sendMessage(tab.id, { action: "get_status" }, (res) => {
            if (chrome.runtime.lastError || !res) {
                beaconText.textContent = 'HOOK ATTACHED';
                statEmails.textContent = 'Ready';
                btnStart.disabled = false;
                addLog('HOOK', 'Attached to Gmail tab.');
                return;
            }

            beaconText.textContent = 'TARGET LOCKED';
            statEmails.textContent = res.rowCount || 0;
            statEmailsSub.textContent = res.isEmail ? 'Single Thread' : 'on current page';
            btnStart.disabled = false;
            addLog('SCAN', `Detected ${res.rowCount || 0} emails on current screen.`);
        });

    } catch (e) {
        addLog('ERR', `Socket failure: ${e.message}`);
    }

    // Start Crawl
    btnStart.addEventListener('click', () => {
        if (!activeTabId) return;

        const format = getSelectedFormat();
        const maxPages = parseInt(pageLimitSelect.value, 10) || 999;

        btnStart.disabled = true;
        crawlBtnText.textContent = 'LAUNCHING CRAWLER...';

        if (currentMode === 'bulk') {
            addLog('EXEC', `Starting multi-page crawl (Limit: ${maxPages === 999 ? 'ALL' : maxPages} pages)...`, true);
            chrome.tabs.sendMessage(activeTabId, { action: "crawl_bulk", maxPages, format }, () => {
                // Close popup so user sees the on-screen live progress HUD on the Gmail page
                window.close();
            });
        } else {
            addLog('EXEC', `Extracting single page into .${format.toUpperCase()}...`, true);
            chrome.tabs.sendMessage(activeTabId, { action: "crawl_page", format }, (res) => {
                btnStart.disabled = false;
                crawlBtnText.textContent = '✓ DOWNLOADED!';
                addLog('DONE', `Captured ${res ? res.count : 0} emails.`, true);
                setTimeout(() => window.close(), 1200);
            });
        }
    });
});
