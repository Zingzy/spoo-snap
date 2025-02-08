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
        this.setupStyles();
        debug.log('NotificationUI initialized');
    }

    // Injects required CSS styles into the page
    setupStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .spoo-notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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
            }
            .spoo-notification.visible {
                opacity: 1;
                transform: translateY(0);
            }
            .spoo-notification .title {
                font-size: 14px;
                font-weight: 600;
                color: #333;
                margin-bottom: 4px;
            }
            .spoo-notification .url-container {
                display: flex;
                align-items: center;
                gap: 8px;
                background: #f5f5f5;
                padding: 8px;
                border-radius: 4px;
                font-size: 13px;
                color: #666;
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
                background: #f5f5f5;
                padding: 8px;
                border-radius: 4px;
                text-align: center;
            }
            .spoo-notification .qr-code {
                width: 100px;
                height: 100px;
                display: block;
                margin: 0 auto;
            }
            .spoo-notification .close-btn {
                position: absolute;
                top: 8px;
                right: 8px;
                background: none;
                border: none;
                color: #999;
                cursor: pointer;
                font-size: 18px;
                line-height: 1;
                padding: 0;
            }
            .spoo-notification .close-btn:hover {
                color: #666;
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
        if (this.container) {
            this.container.classList.remove('visible');
            setTimeout(() => {
                if (this.container && this.container.parentNode) {
                    this.container.parentNode.removeChild(this.container);
                    this.container = null;
                }
            }, 300);
        }
    }
}

// Validates if a string is a valid URL
function isValidUrl(text) {
    try {
        const url = new URL(text);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

// Processes selected text if it's a valid URL
async function processSelectedText() {
    const selection = window.getSelection().toString().trim();
    if (selection && isValidUrl(selection)) {
        debug.log('Valid URL detected in selection:', selection);
        chrome.runtime.sendMessage({ type: 'process_url', url: selection });
    }
}

// Initialize NotificationUI
const notificationUI = new NotificationUI();

// Event Listeners
document.addEventListener('copy', () => {
    debug.log('Copy event detected');
    processSelectedText();
});

// Handle messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    debug.log('Received message:', message);

    if (message.type === 'show_notification') {
        const { shortUrl, qrUrl, duration } = message.data;
        notificationUI.show(shortUrl, qrUrl, duration);
        sendResponse({ success: true });
    }

    return true;
});