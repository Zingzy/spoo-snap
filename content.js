// Debug helper
const debug = {
    log: (message) => {
        console.log(`[Content Debug] ${message}`);
    },
    error: (message) => {
        console.error(`[Content Error] ${message}`);
    }
};

class NotificationUI {
    constructor() {
        this.container = null;
        this.timeout = null;
        this.setupStyles();
        debug.log('NotificationUI initialized');
    }

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
    }

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

    async show(shortUrl, qrUrl, duration) {
        debug.log('Showing notification');
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }

        const container = this.container || this.createContainer();
        container.innerHTML = '';

        // Title
        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = 'URL Shortened!';
        container.appendChild(title);

        // Short URL container
        const urlContainer = document.createElement('div');
        urlContainer.className = 'url-container';

        const urlText = document.createElement('div');
        urlText.className = 'url-text';
        urlText.textContent = shortUrl;

        const copyButton = document.createElement('button');
        copyButton.className = 'copy-btn';
        copyButton.textContent = 'Copy';
        copyButton.addEventListener('click', async () => {
            debug.log('Copy button clicked');
            try {
                await navigator.clipboard.writeText(shortUrl);
                copyButton.textContent = 'Copied!';
                copyButton.style.background = '#28a745';
                setTimeout(() => {
                    copyButton.textContent = 'Copy';
                    copyButton.style.background = '';
                }, 2000);
            } catch (error) {
                debug.error(`Failed to copy: ${error.message}`);
                copyButton.textContent = 'Error';
                copyButton.style.background = '#dc3545';
            }
        });

        urlContainer.appendChild(urlText);
        urlContainer.appendChild(copyButton);
        container.appendChild(urlContainer);

        // QR Code (if provided)
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

        // Close button
        const closeButton = document.createElement('button');
        closeButton.className = 'close-btn';
        closeButton.innerHTML = '×';
        closeButton.addEventListener('click', () => {
            debug.log('Close button clicked');
            this.hide();
        });
        container.appendChild(closeButton);

        // Auto-hide after duration
        this.timeout = setTimeout(() => {
            debug.log('Auto-hiding notification');
            this.hide();
        }, duration);
    }

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

// Create notification UI instance
const notificationUI = new NotificationUI();

// Helper function to check if a string is a valid URL
function isValidUrl(text) {
    try {
        new URL(text);
        return text.startsWith('http://') || text.startsWith('https://');
    } catch {
        return false;
    }
}

// Function to process selected text
async function processSelectedText() {
    const selection = window.getSelection().toString().trim();
    if (selection && isValidUrl(selection)) {
        debug.log('Valid URL detected in selection:', selection);
        chrome.runtime.sendMessage({ type: 'process_url', url: selection });
    }
}

// Listen for copy events
document.addEventListener('copy', (event) => {
    debug.log('Copy event detected');
    processSelectedText();
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    debug.log(`Received message: ${message.type}`);

    if (message.type === 'show_notification') {
        const { shortUrl, qrUrl, duration } = message.data;
        notificationUI.show(shortUrl, qrUrl, duration);
        sendResponse({ success: true });
    }

    return true;
});