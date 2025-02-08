// Debug helper
const debug = {
    log: (message) => {
        console.log(`[Debug] ${message}`);
    },
    error: (message) => {
        console.error(`[Error] ${message}`);
    }
};

// API client for spoo.me
class SpooAPI {
    static async shortenUrl(url) {
        debug.log(`Attempting to shorten URL: ${url}`);
        const data = new URLSearchParams();
        data.append('url', url);

        try {
            const response = await fetch('https://spoo.me/', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: data
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const result = await response.json();
            debug.log(`Successfully shortened URL: ${result.short_url}`);
            return result.short_url;
        } catch (error) {
            debug.error(`Failed to shorten URL: ${error.message}`);
            throw error;
        }
    }
}

// API client for qr.spoo.me
class QrAPI {
    static generateQrCodeUrl(text, fill = '(0,0,0)', back = '(255,255,255)') {
        const params = new URLSearchParams({
            text: encodeURIComponent(text),
            fill: encodeURIComponent(fill),
            back: encodeURIComponent(back)
        });
        const url = `https://qr.spoo.me/classic?${params.toString()}`;
        debug.log(`Generating QR code with URL: ${url}`);
        return url;
    }
}

// Settings manager
class SettingsManager {
    static defaultSettings = {
        enableQr: true,
        useOriginalUrl: false,
        qrColor: '(0,0,0)',
        qrBackground: '(255,255,255)',
        notificationDuration: 30000, // Increased to 30 seconds
        autoCopy: true
    };

    static async getSettings() {
        debug.log('Fetching settings');
        const result = await chrome.storage.local.get('settings');
        return result.settings || this.defaultSettings;
    }

    static async saveSettings(settings) {
        debug.log('Saving settings');
        await chrome.storage.local.set({ settings });
    }
}

// History manager
class HistoryManager {
    static async addToHistory(originalUrl, shortUrl, qrUrl) {
        debug.log('Adding URL to history');
        const history = await this.getHistory();
        history.unshift({
            originalUrl,
            shortUrl,
            qrUrl,
            timestamp: new Date().toISOString()
        });

        // Keep only last 50 items
        history.splice(50);
        await chrome.storage.local.set({ history });
    }

    static async getHistory() {
        debug.log('Fetching history');
        const result = await chrome.storage.local.get('history');
        return result.history || [];
    }
}

// URL processing
async function processUrl(url) {
    debug.log('Processing URL:', url);

    try {
        const settings = await SettingsManager.getSettings();
        const shortUrl = await SpooAPI.shortenUrl(url);
        const qrUrl = settings.enableQr ?
            QrAPI.generateQrCodeUrl(settings.useOriginalUrl ? url : shortUrl, settings.qrColor, settings.qrBackground) :
            null;

        // Store in history
        await HistoryManager.addToHistory(url, shortUrl, qrUrl);

        // Copy shortened URL to clipboard
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && !tab.url.startsWith('chrome://')) {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (textToCopy) => {
                    navigator.clipboard.writeText(textToCopy);
                },
                args: [shortUrl]
            });
            debug.log('Shortened URL copied to clipboard');
        }

        // Show notification in the active tab
        if (tab && !tab.url.startsWith('chrome://')) {
            await chrome.tabs.sendMessage(tab.id, {
                type: 'show_notification',
                data: {
                    shortUrl,
                    qrUrl,
                    duration: settings.notificationDuration
                }
            });
            debug.log('Notification sent to active tab');
        }
    } catch (error) {
        debug.error(`Error processing URL: ${error.message}`);
    }
}

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
    debug.log('Extension installed/updated');

    // Initialize settings
    const settings = await SettingsManager.getSettings();
    if (!settings) {
        await SettingsManager.saveSettings(SettingsManager.defaultSettings);
    }

    // Create context menu
    chrome.contextMenus.create({
        id: 'shortenLink',
        title: 'Shorten Link',
        contexts: ['link']
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'shortenLink' && info.linkUrl) {
        debug.log('Context menu: shortening link:', info.linkUrl);
        processUrl(info.linkUrl);
    }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    debug.log(`Received message: ${message.type}`);

    if (message.type === 'process_url') {
        debug.log('Processing URL from content script:', message.url);
        processUrl(message.url);
        sendResponse({ success: true });
    }

    return true;
});