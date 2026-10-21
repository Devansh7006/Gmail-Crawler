// Gmail Crawler Pro - Popup Controller (v2.3)

document.addEventListener('DOMContentLoaded', async () => {
    const beacon = document.getElementById('target-beacon');
    const beaconText = document.getElementById('beacon-text');
    const statEmails = document.getElementById('stat-emails');
    const statFolder = document.getElementById('stat-folder');
    const statStatus = document.getElementById('stat-status');
    const btnFull = document.getElementById('btn-crawl-full');
    const btnPage = document.getElementById('btn-crawl-page');
    const pageLimitSelect = document.getElementById('page-limit-select');

    let activeTabId = null;

    function getSelectedFormat() {
        const radio = document.querySelector('input[name="format"]:checked');
        return radio ? radio.value : 'csv';
    }

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        activeTabId = tab ? tab.id : null;

        if (!tab || !tab.url || !tab.url.includes("mail.google.com")) {
            beacon.classList.add('offline');
            beaconText.textContent = 'NO GMAIL LINK';
            statStatus.textContent = 'OFFLINE';
            statStatus.className = 'telemetry-value text-muted';
            btnFull.disabled = true;
            btnPage.disabled = true;
            return;
        }

        const urlHash = tab.url.split('#')[1] || 'inbox';
        const folderName = urlHash.split('/')[0].toUpperCase();
        statFolder.textContent = folderName || 'INBOX';

        chrome.tabs.sendMessage(tab.id, { action: "get_status" }, (res) => {
            if (chrome.runtime.lastError || !res) {
                beaconText.textContent = 'HOOK ATTACHED';
                statEmails.textContent = 'Ready';
                btnFull.disabled = false;
                btnPage.disabled = false;
                return;
            }

            beaconText.textContent = 'TARGET LOCKED';
            statEmails.textContent = res.rowCount || 0;
            btnFull.disabled = false;
            btnPage.disabled = false;
        });

    } catch (e) {
        statStatus.textContent = 'ERROR';
    }

    // Full Historic Crawl
    btnFull.addEventListener('click', () => {
        if (!activeTabId) return;
        const format = getSelectedFormat();
        const maxPages = parseInt(pageLimitSelect.value, 10) || 999;

        btnFull.disabled = true;
        btnFull.innerHTML = '<span>⏳</span> <span>INITIALIZING HISTORICAL CRAWLER...</span>';

        chrome.tabs.sendMessage(activeTabId, { action: "crawl_historic", maxPages, format }, () => {
            window.close(); // Closes popup so user views on-screen live progress HUD
        });
    });

    // Single Page Extract
    btnPage.addEventListener('click', () => {
        if (!activeTabId) return;
        const format = getSelectedFormat();

        btnPage.disabled = true;
        btnPage.textContent = 'Extracting current screen...';

        chrome.tabs.sendMessage(activeTabId, { action: "crawl_page", format }, (res) => {
            btnPage.textContent = '✓ Downloaded!';
            setTimeout(() => window.close(), 1000);
        });
    });
});
