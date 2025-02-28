// Debug logging utility
const debug = {
    log: (message, data) => {
        console.log(`[Content Debug] ${message}`, data || '');
    },
    error: (message, error) => {
        console.error(`[Content Error] ${message}`, error || '');
    }
};

/**
    * NotificationUI Class
    * Handles the creation and management of floating notifications
 */
class NotificationUI {
    constructor() {
        this.container = null;
        this.timeout = null;
        this.darkMode = false;
        this.setupStyles();
        this.initializeTheme();
        debug.log('NotificationUI initialized');
    }

    async initializeTheme() {
        try {
            const result = await chrome.storage.local.get('settings');
            const settings = result.settings || {};
            this.updateTheme(settings.theme === 'dark');

            // Listen for settings changes
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'local' && changes.settings?.newValue?.theme) {
                    this.updateTheme(changes.settings.newValue.theme === 'dark');
                }
            });
        } catch (error) {
            debug.error('Failed to initialize theme:', error);
        }
    }

    updateTheme(isDark) {
        this.darkMode = isDark;
        document.documentElement.classList.toggle('spoo-dark-theme', isDark);
        debug.log('Theme updated:', isDark ? 'dark' : 'light');
    }

    // Injects required CSS styles into the page
    setupStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .spoo-notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: var(--spoo-bg-color, white);
                border-radius: 8px;
                box-shadow: var(--spoo-shadow, 0 4px 12px rgba(0, 0, 0, 0.15));
                padding: 16px;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                max-width: 300px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                opacity: 0;
                transform: translateY(20px);
                transition: all 0.3s ease;
                color: var(--spoo-text-color, #333);
            }
            .spoo-notification.visible {
                opacity: 1;
                transform: translateY(0);
            }
            .spoo-notification .title {
                font-size: 14px;
                font-weight: 600;
                color: var(--spoo-title-color, inherit);
                margin-bottom: 4px;
            }
            .spoo-notification .url-container {
                display: flex;
                align-items: center;
                gap: 8px;
                background: var(--spoo-container-bg, #f5f5f5);
                padding: 8px;
                border-radius: 4px;
                font-size: 13px;
                color: var(--spoo-text-secondary, #666);
            }
            .spoo-notification .url-text {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .spoo-notification .copy-btn {
                background: #007bff;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                cursor: pointer;
                font-size: 12px;
                transition: background 0.2s;
            }
            .spoo-notification .copy-btn:hover {
                background: #0056b3;
            }
            .spoo-notification .qr-container {
                background: var(--spoo-container-bg, #f5f5f5);
                padding: 8px;
                border-radius: 4px;
                text-align: center;
            }
            .spoo-notification .qr-code {
                width: 100px;
                height: 100px;
                display: block;
                margin: 0 auto;
                border-radius: 4px;
            }
            .spoo-notification .close-btn {
                position: absolute;
                top: 8px;
                right: 8px;
                background: none;
                border: none;
                color: var(--spoo-text-secondary, #999);
                cursor: pointer;
                font-size: 18px;
                line-height: 1;
                padding: 0;
            }
            .spoo-notification .close-btn:hover {
                color: var(--spoo-text-hover, #666);
            }

            /* Dark mode styles */
            :root.spoo-dark-theme .spoo-notification {
                --spoo-bg-color: #2d2d2d;
                --spoo-text-color: #e1e1e1;
                --spoo-title-color: #ffffff;
                --spoo-container-bg: #3d3d3d;
                --spoo-text-secondary: #b0b0b0;
                --spoo-text-hover: #ffffff;
                --spoo-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }
        `;
        document.head.appendChild(style);
        debug.log('Notification styles injected');
    }

    // Creates the notification container
    createContainer() {
        debug.log('Creating notification container');
        const container = document.createElement('div');
        container.className = 'spoo-notification';
        document.body.appendChild(container);
        this.container = container;

        // Force reflow to enable animation
        container.offsetHeight;
        container.classList.add('visible');

        return container;
    }

    // Shows the notification with the shortened URL and QR code
    async show(shortUrl, qrUrl, duration) {
        debug.log('Showing notification', { shortUrl, qrUrl, duration });

        // Get current settings to check stealth mode
        const result = await chrome.storage.local.get('settings');
        const settings = result.settings || {};

        // Skip showing notification if in stealth mode
        if (settings.stealthMode) {
            debug.log('Stealth mode active, skipping notification');
            return;
        }

        return new Promise(resolve => {
            // Clear existing timeout if any
            if (this.timeout) {
                clearTimeout(this.timeout);
                this.timeout = null;
            }

            const container = this.container || this.createContainer();
            container.innerHTML = '';

            // Add title
            const title = document.createElement('div');
            title.className = 'title';
            title.textContent = 'URL Shortened!';
            container.appendChild(title);

            // Add URL container
            const urlContainer = document.createElement('div');
            urlContainer.className = 'url-container';

            const urlText = document.createElement('div');
            urlText.className = 'url-text';
            urlText.textContent = shortUrl;

            const copyButton = document.createElement('button');
            copyButton.className = 'copy-btn';
            copyButton.textContent = 'Copy';
            copyButton.addEventListener('click', () => this.handleCopyClick(copyButton, shortUrl));

            urlContainer.appendChild(urlText);
            urlContainer.appendChild(copyButton);
            container.appendChild(urlContainer);

            // Add QR code if provided
            if (qrUrl) {
                debug.log('Adding QR code to notification');
                const qrContainer = document.createElement('div');
                qrContainer.className = 'qr-container';

                const qrImage = document.createElement('img');
                qrImage.className = 'qr-code';
                qrImage.src = qrUrl;
                qrImage.alt = 'QR Code';

                qrContainer.appendChild(qrImage);
                container.appendChild(qrContainer);
            }

            // Add close button
            const closeButton = document.createElement('button');
            closeButton.className = 'close-btn';
            closeButton.innerHTML = '×';
            closeButton.addEventListener('click', () => this.hide());
            container.appendChild(closeButton);

            // Set auto-hide timeout
            this.timeout = setTimeout(() => {
                debug.log('Auto-hiding notification');
                this.hide();
            }, duration);

            // Wait for the next frame to ensure DOM updates and animations are properly sequenced
            requestAnimationFrame(() => {
                // Resolve once the showing animation starts
                container.addEventListener('transitionend', () => {
                    resolve();
                }, { once: true });

                // Force reflow and trigger animation
                container.offsetHeight;
                container.classList.add('visible');
            });
        });
    }

    // Handles the copy button click
    async handleCopyClick(button, text) {
        debug.log('Copy button clicked');
        try {
            await navigator.clipboard.writeText(text);
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            button.style.background = '#28a745';
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '';
            }, 2000);
        } catch (error) {
            debug.error('Failed to copy text:', error);
            button.textContent = 'Error';
            button.style.background = '#dc3545';
        }
    }

    // Hides the notification with animation
    hide() {
        debug.log('Hiding notification');
        return new Promise(resolve => {
            if (this.container) {
                this.container.classList.remove('visible');
                setTimeout(() => {
                    if (this.container && this.container.parentNode) {
                        this.container.parentNode.removeChild(this.container);
                        this.container = null;
                    }
                    resolve();
                }, 300);
            } else {
                resolve();
            }
        });
    }
}

// URL validation and processing utilities
const urlUtils = {
    // Common TLDs for validating domain-like strings
    commonTLDs: ['com', 'org', 'net', 'edu', 'gov', 'io', 'me', 'dev', 'app'],

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

// Validates if a string is a valid URL or passive URL
function isValidUrl(text) {
    return urlUtils.isValidUrlWithProtocol(text) || urlUtils.isPassiveUrl(text);
}

// Processes selected text if it's a valid URL or passive URL
async function processSelectedText() {
    try {
        const selection = window.getSelection().toString().trim();
        if (selection && isValidUrl(selection)) {
            debug.log('URL detected in selection:', selection);
            const formattedUrl = urlUtils.formatUrl(selection);
            debug.log('Formatted URL:', formattedUrl);

            // Check if extension context is still valid
            if (chrome.runtime?.id) {
                await chrome.runtime.sendMessage({
                    type: 'process_url',
                    url: formattedUrl,
                    originalText: selection
                });
            } else {
                debug.error('Extension context invalidated');
                // Refresh the page to reinitialize the extension context
                window.location.reload();
            }
        }
    } catch (error) {
        debug.error('Error processing selected text:', error);
    }
}

// Initialize NotificationUI
const notificationUI = new NotificationUI();

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && notificationUI.container) {
        notificationUI.hide();
    }
});

// Handle page unload
window.addEventListener('unload', () => {
    if (notificationUI.container) {
        notificationUI.hide();
    }
});

// Event Listeners
document.addEventListener('copy', () => {
    debug.log('Copy event detected');
    processSelectedText();
});

// Handle messages from background script with error handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    debug.log('Received message:', message);

    (async () => {
        try {
            if (message.type === 'show_notification') {
                const { shortUrl, qrUrl, duration } = message.data;
                // Remove any existing notification before showing new one
                if (notificationUI.container) {
                    await notificationUI.hide();
                }
                await notificationUI.show(shortUrl, qrUrl, duration);
                sendResponse({ success: true });
            }
        } catch (error) {
            debug.error('Error processing message:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true; // Keep the message channel open for the async response
});

// Handle port disconnection
chrome.runtime.onDisconnect.addListener(() => {
    debug.log('Port disconnected, cleaning up...');
    if (notificationUI.container) {
        notificationUI.hide();
    }
});
