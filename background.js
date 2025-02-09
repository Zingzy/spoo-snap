// Debug logging utility
const debug = {
    log: (message, data) => {
        console.log(`[Debug] ${message}`, data || '');
    },
    error: (message, error) => {
        console.error(`[Error] ${message}`, error || '');
    }
};

/**
    * spoo.me API Client
    * Handles URL shortening operations
 */
class SpooAPI {
    static async shortenUrl(url) {
        debug.log('Shortening URL:', url);
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
            debug.log('URL shortened successfully:', result.short_url);
            return result.short_url;
        } catch (error) {
            debug.error('Failed to shorten URL:', error);
            throw error;
        }
    }
}

/**
    * qr.spoo.me API Client
    * Handles QR code generation
 */
class QrAPI {
    static generateQrCodeUrl(text, style = 'classic', colors = {}) {
        const params = new URLSearchParams({
            text: encodeURIComponent(text)
        });

        const endpoint = style === 'gradient' ? 'gradient' : 'classic';

        if (style === 'gradient') {
            params.append('gradient1', encodeURIComponent(colors.gradient1 || '(117,129,86)'));
            params.append('gradient2', encodeURIComponent(colors.gradient2 || '(103,175,38)'));
        } else {
            params.append('fill', encodeURIComponent(colors.fill || '(0,0,0)'));
            params.append('back', encodeURIComponent(colors.back || '(255,255,255)'));
        }

        const url = `https://qr.spoo.me/${endpoint}?${params.toString()}`;
        debug.log('Generated QR code URL:', url);
        return url;
    }
}

/**
    * Settings Manager
    * Handles extension settings storage and retrieval
 */
class SettingsManager {
    static defaultSettings = {
        enableQr: true,
        useOriginalUrl: false,
        qrStyle: 'classic',
        qrColor: '(0,0,0)',
        qrBackground: '(255,255,255)',
        qrGradient1: '(117,129,86)',
        qrGradient2: '(103,175,38)',
        notificationDuration: 30000,
        autoCopy: true
    };

    static async getSettings() {
        debug.log('Fetching settings');
        const result = await chrome.storage.local.get('settings');
        return result.settings || this.defaultSettings;
    }

    static async saveSettings(settings) {
        debug.log('Saving settings:', settings);
        await chrome.storage.local.set({ settings });
    }
}

/**
    * History Manager
    * Handles URL history storage and retrieval
 */
class HistoryManager {
    // Maximum number of history items to keep
    static MAX_HISTORY_ITEMS = 50;

    static async addToHistory(originalUrl, shortUrl, qrUrl) {
        debug.log('Adding to history:', { originalUrl, shortUrl });
        const history = await this.getHistory();

        history.unshift({
            originalUrl,
            shortUrl,
            qrUrl,
            timestamp: new Date().toISOString()
        });

        history.splice(this.MAX_HISTORY_ITEMS);
        await chrome.storage.local.set({ history });
    }

    static async getHistory() {
        debug.log('Fetching history');
        const result = await chrome.storage.local.get('history');
        return result.history || [];
    }
}


// URL Processing Functions
async function processUrl(url, originalText) {
    debug.log('Processing URL:', { url, originalText });

    try {
        // Get user settings
        const settings = await SettingsManager.getSettings();

        // Shorten URL with the processed URL
        const shortUrl = await SpooAPI.shortenUrl(url);

        // For QR code, use the original text if it's a passive URL, otherwise use the processed URL
        const qrUrl = settings.enableQr ? QrAPI.generateQrCodeUrl(
            settings.useOriginalUrl ? (originalText || url) : shortUrl,
            settings.qrStyle,
            settings.qrStyle === 'gradient' ? {
                gradient1: settings.qrGradient1,
                gradient2: settings.qrGradient2
            } : {
                fill: settings.qrColor,
                back: settings.qrBackground
            }
        ) : null;

        // Save both original and processed URLs to history
        await HistoryManager.addToHistory(originalText || url, shortUrl, qrUrl);

        // Get active tab for notifications
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || tab.url.startsWith('chrome://')) {
            debug.log('No suitable tab found for notification');
            return;
        }

        // Copy shortened URL if enabled
        if (settings.autoCopy) {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (textToCopy) => {
                    navigator.clipboard.writeText(textToCopy)
                        .then(() => console.log('[Debug] URL copied to clipboard'))
                        .catch(error => console.error('[Error] Failed to copy URL:', error));
                },
                args: [shortUrl]
            });
        }

        // Show notification
        await chrome.tabs.sendMessage(tab.id, {
            type: 'show_notification',
            data: {
                shortUrl,
                qrUrl,
                duration: settings.notificationDuration
            }
        });
    } catch (error) {
        debug.error('Failed to process URL:', error);
    }
}

// Extension Initialization
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

// Event Listeners

// URL Formatting Utils
const urlUtils = {
    // Matches domain-like patterns (e.g., example.com, www.example.com)
    domainPattern: /^((?:www\.)?[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.(?:[a-zA-Z]{2,}))(?:\/[^\s]*)?$/,

    // Validates if a string is a valid URL with protocol
    isValidUrlWithProtocol(text) {
        try {
            const url = new URL(text);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    },

    // Validates if a string is a potential passive URL
    isPassiveUrl(text) {
        if (this.isValidUrlWithProtocol(text)) return false;
        return this.domainPattern.test(text);
    },

    // Formats URL with protocol if needed
    formatUrl(text) {
        if (this.isValidUrlWithProtocol(text)) return text;
        if (this.isPassiveUrl(text)) return `https://${text}`;
        return text;
    }
};

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'shortenLink' && info.linkUrl) {
        debug.log('Context menu: shortening link:', info.linkUrl);
        const formattedUrl = urlUtils.formatUrl(info.linkUrl);
        processUrl(formattedUrl, info.linkUrl);
    }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    debug.log('Received message:', message);

    if (message.type === 'process_url') {
        processUrl(message.url, message.originalText);
        sendResponse({ success: true });
    }

    return true;
});