// Debug logging utility
const debug = {
    log: (message, data) => {
        console.log(`[Popup Debug] ${message}`, data || '');
    },
    error: (message, error) => {
        console.error(`[Popup Error] ${message}`, error || '');
    }
};

/**
    * PopupUI Class
    * Handles the extension popup interface
 */
class PopupUI {
    constructor() {
        // Initialize properties
        this.currentTab = 'history';
        this.historyList = document.querySelector('.history-list');
        this.template = document.getElementById('history-item-template');

        // Theme setup
        debug.log('Initializing theme system');

        // Set up UI
        this.setupNavigation();
        this.setupEventListeners();
        this.loadContent();
        this.initializeTheme();

        debug.log('PopupUI initialized');
    }

    // Theme handling methods
    async initializeTheme() {
        const settings = await this.getSettings();
        debug.log('Loading theme setting:', settings.theme);
        document.getElementById('themeSelect').value = settings.theme;
        this.applyTheme(settings.theme);
    }

    applyTheme(theme) {
        debug.log('Applying theme:', theme);
        document.documentElement.setAttribute('data-theme', theme);
        debug.log('Theme applied:', theme);
    }

    // Sets up navigation tab handlers
    setupNavigation() {
        const navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                debug.log('Navigation clicked:', tabName);
                this.switchTab(tabName);
            });
        });
    }

    // Sets up event listeners for history items and settings
    setupEventListeners() {
        // Event delegation for history item actions
        this.historyList.addEventListener('click', async (event) => {
            const target = event.target;
            if (!target.matches('button')) return;

            const historyItem = target.closest('.history-item');
            if (!historyItem) return;

            const index = Array.from(this.historyList.children).indexOf(historyItem);
            if (index === -1) return;

            if (target.classList.contains('analytics')) {
                await this.openAnalytics(index);
            } else {
                const isOriginal = target.classList.contains('copy-original');
                await this.copyUrl(index, isOriginal);
            }
        });

        // Settings change handlers
        const settingsElements = [
            'enableQr',
            'useOriginalUrl',
            'qrColor',
            'qrBackground',
            'notificationDuration',
            'autoCopy',
            'themeSelect'
        ];

        settingsElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => this.updateSettings());
            }
        });
    }

    // Switches between history and settings tabs
    switchTab(tabName) {
        debug.log('Switching to tab:', tabName);

        // Update navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });

        this.currentTab = tabName;
    }

    // Loads initial content (history and settings)
    async loadContent() {
        debug.log('Loading content');
        try {
            await Promise.all([
                this.loadHistory(),
                this.loadSettings()
            ]);
        } catch (error) {
            debug.error('Failed to load content:', error);
        }
    }

    // Loads and displays URL history
    async loadHistory() {
        debug.log('Loading history');
        const history = await this.getHistory();

        if (history.length === 0) {
            this.historyList.innerHTML = '<div class="empty-state">No history yet</div>';
            return;
        }

        this.historyList.innerHTML = '';

        history.forEach(item => {
            const historyItem = this.template.content.cloneNode(true);

            // Set up item content
            historyItem.querySelector('.url').textContent = item.shortUrl;
            historyItem.querySelector('.original-url').textContent = item.originalUrl;
            historyItem.querySelector('.timestamp').textContent = this.formatDate(item.timestamp);

            this.historyList.appendChild(historyItem);
        });
    }

    // Loads and applies user settings
    async loadSettings() {
        debug.log('Loading settings');
        const settings = await this.getSettings();

        // Update UI with settings
        document.getElementById('enableQr').checked = settings.enableQr;
        document.getElementById('useOriginalUrl').checked = settings.useOriginalUrl;
        document.getElementById('qrColor').value = this.rgbToHex(settings.qrColor);
        document.getElementById('qrBackground').value = this.rgbToHex(settings.qrBackground);
        document.getElementById('notificationDuration').value = settings.notificationDuration / 1000;
        document.getElementById('autoCopy').checked = settings.autoCopy;
        document.getElementById('themeSelect').value = settings.theme;
        this.applyTheme(settings.theme);
    }

    // Updates and saves user settings
    async updateSettings() {
        debug.log('Updating settings');
        try {
            const settings = {
                enableQr: document.getElementById('enableQr').checked,
                useOriginalUrl: document.getElementById('useOriginalUrl').checked,
                qrColor: this.hexToRgb(document.getElementById('qrColor').value),
                qrBackground: this.hexToRgb(document.getElementById('qrBackground').value),
                notificationDuration: document.getElementById('notificationDuration').value * 1000,
                autoCopy: document.getElementById('autoCopy').checked,
                theme: document.getElementById('themeSelect').value
            };

            await chrome.storage.local.set({ settings });
            debug.log('Settings updated successfully:', settings);

            // Apply theme immediately if it was changed
            if ('theme' in settings) {
                this.applyTheme(settings.theme);
            }
        } catch (error) {
            debug.error('Failed to update settings:', error);
        }
    }

    // Copies URL from history item
    async copyUrl(index, original) {
        const history = await this.getHistory();
        if (index < 0 || index >= history.length) return;

        const url = original ? history[index].originalUrl : history[index].shortUrl;
        debug.log('Copying URL:', url);

        try {
            await navigator.clipboard.writeText(url);
            const button = original ?
                this.historyList.children[index].querySelector('.copy-original') :
                this.historyList.children[index].querySelector('.copy-short');

            this.showCopyFeedback(button);
        } catch (error) {
            debug.error('Failed to copy URL:', error);
        }
    }

    // Shows visual feedback for copy operation
    showCopyFeedback(button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.style.background = '#28a745';

        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '#007bff';
        }, 2000);
    }

    async getHistory() {
        const result = await chrome.storage.local.get('history');
        return result.history || [];
    }

    async getSettings() {
        const result = await chrome.storage.local.get('settings');
        return result.settings || {
            enableQr: true,
            useOriginalUrl: false,
            qrColor: '(0,0,0)',
            qrBackground: '(255,255,255)',
            notificationDuration: 30000,
            autoCopy: true,
            theme: 'light'
        };
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    rgbToHex(rgb) {
        const match = rgb.match(/\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!match) return '#000000';

        const [_, r, g, b] = match;
        return '#' + [r, g, b].map(x => {
            const hex = parseInt(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return '(0,0,0)';

        const r = parseInt(result[1], 16);
        const g = parseInt(result[2], 16);
        const b = parseInt(result[3], 16);

        return `(${r},${g},${b})`;
    }

    async openAnalytics(index) {
        debug.log('Opening analytics for index:', index);
        const history = await this.getHistory();
        if (index < 0 || index >= history.length) return;

        const shortUrl = history[index].shortUrl;
        // Extract the ID from the end of the URL (after the last '/')
        const urlId = shortUrl.split('/').pop();
        const analyticsUrl = `https://spoo.me/stats/${urlId}`;
        chrome.tabs.create({ url: analyticsUrl });
    }
}

// Initialize popup UI
const popupUI = new PopupUI();