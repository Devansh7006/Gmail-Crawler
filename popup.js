// Cyber Void HUD - Gmail Crawler Popup Controller

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const beacon = document.getElementById('target-beacon');
    const beaconText = document.getElementById('beacon-text');
    const statEmails = document.getElementById('stat-emails');
    const statEmailsSub = document.getElementById('stat-emails-sub');
    const statFolder = document.getElementById('stat-folder');
    const statStatus = document.getElementById('stat-status');
    const scopeTabs = document.querySelectorAll('.scope-tab');
    const bulkSettings = document.getElementById('bulk-settings');
    const depthSlider = document.getElementById('depth-slider');
    const depthVal = document.getElementById('depth-val');
    const modeTag = document.getElementById('selected-mode-tag');
    const terminalLog = document.getElementById('terminal-log');
    const btnClearLog = document.getElementById('btn-clear-log');
    const btnStart = document.getElementById('btn-crawl-start');
    const btnStop = document.getElementById('btn-crawl-stop');
    const crawlBtnText = document.getElementById('crawl-btn-text');

    let currentMode = 'page'; // 'page' | 'bulk' | 'deep'
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

    // Handle Depth Slider
    depthSlider.addEventListener('input', (e) => {
        const p = e.target.value;
        depthVal.textContent = `${p} Pages (~${p * 50} Mails)`;
    });

    // Handle Mode Tabs
    scopeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            scopeTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentMode = tab.dataset.mode;

            if (currentMode === 'page') {
                modeTag.textContent = 'PAGE MODE';
                bulkSettings.style.display = 'none';
                crawlBtnText.textContent = 'CRAWL CURRENT VIEW';
                addLog('CONFIG', 'Switched to Single Page Scan mode.');
            } else if (currentMode === 'bulk') {
                modeTag.textContent = 'BULK CRAWLER';
                bulkSettings.style.display = 'block';
                crawlBtnText.textContent = 'LAUNCH BULK CRAWLER';
                addLog('CONFIG', 'Switched to Multi-Page Auto Crawler.');
            } else if (currentMode === 'deep') {
                modeTag.textContent = 'DEEP INSPECTOR';
                bulkSettings.style.display = 'none';
                crawlBtnText.textContent = 'EXECUTE DEEP CRAWLER';
                addLog('CONFIG', 'Switched to Full-Body Deep Thread mode.');
            }
        });
    });

    // Format selection
    function getSelectedFormat() {
        const radio = document.querySelector('input[name="format"]:checked');
        return radio ? radio.value : 'csv';
    }

    // Connect with active tab
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        activeTabId = tab ? tab.id : null;

        if (!tab || !tab.url || !tab.url.includes("mail.google.com")) {
            beacon.classList.add('offline');
            beaconText.textContent = 'NO GMAIL LINK';
            statStatus.textContent = 'IDLE';
            statStatus.className = 'telemetry-value text-muted';
            btnStart.disabled = true;
            addLog('ERR', 'Active tab is not mail.google.com', false);
            addLog('HELP', 'Open Gmail in active tab to begin.', true);
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
            statEmailsSub.textContent = res.isEmail ? 'Thread open' : 'in current view';
            btnStart.disabled = false;
            addLog('SCAN', `Located ${res.rowCount || 0} message node(s) in DOM.`);
        });

    } catch (e) {
        addLog('ERR', `Socket failure: ${e.message}`);
    }

    // Start Crawl
    btnStart.addEventListener('click', () => {
        if (!activeTabId) return;

        const format = getSelectedFormat();
        const maxPages = parseInt(depthSlider.value, 10) || 10;

        btnStart.disabled = true;
        btnStart.classList.add('crawling');
        crawlBtnText.textContent = 'CRAWLING ACTIVE...';
        statStatus.textContent = 'BUSY';
        statStatus.className = 'telemetry-value text-cyan';

        if (currentMode === 'page') {
            addLog('EXEC', `Extracting page rows into .${format.toUpperCase()}...`, true);
            chrome.tabs.sendMessage(activeTabId, { action: "crawl_page", format }, (res) => {
                finishCrawl(res ? res.count : 0);
            });
        } else if (currentMode === 'bulk') {
            addLog('EXEC', `Auto-flipping up to ${maxPages} pages...`, true);
            btnStop.style.display = 'block';
            chrome.tabs.sendMessage(activeTabId, { action: "crawl_bulk", maxPages, format }, (res) => {
                // Bulk crawler overlay handles on-page progress
                window.close();
            });
        } else if (currentMode === 'deep') {
            addLog('EXEC', 'Executing deep full-body crawler...', true);
            btnStop.style.display = 'block';
            chrome.tabs.sendMessage(activeTabId, { action: "crawl_deep", format }, (res) => {
                window.close();
            });
        }
    });

    function finishCrawl(count) {
        btnStart.disabled = false;
        btnStart.classList.remove('crawling');
        crawlBtnText.textContent = 'CRAWL FINISHED';
        statStatus.textContent = 'READY';
        statStatus.className = 'telemetry-value text-emerald';
        addLog('DONE', `Captured ${count} emails. File downloaded.`, true);
        setTimeout(() => {
            crawlBtnText.textContent = 'EXECUTE CRAWLER';
        }, 2000);
    }
});
