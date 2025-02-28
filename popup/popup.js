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
        this.exportDropdown = document.querySelector('.export-dropdown');
        this.exportBtn = document.querySelector('.export-btn');
        this.exportMenu = document.querySelector('.export-menu');

        // Theme setup
        debug.log('Initializing theme system');

        // Set up UI
        this.setupNavigation();
        this.setupEventListeners();
        this.setupClearHistory();
        this.setupExport();
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
        // QR style change handler
        const qrStyleSelect = document.getElementById('qrStyle');
        qrStyleSelect.addEventListener('change', (event) => {
            this.toggleQrSettings(event.target.value);
        });

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
            'qrStyle',
            'qrColor',
            'qrBackground',
            'qrGradient1',
            'qrGradient2',
            'notificationDuration',
            'autoCopy',
            'themeSelect',
            'stealthMode'
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
            this.exportDropdown.setAttribute('data-disabled', 'true');
            return;
        }

        this.historyList.innerHTML = '';
        this.exportDropdown.removeAttribute('data-disabled');

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
        document.getElementById('qrStyle').value = settings.qrStyle || 'classic';
        document.getElementById('qrColor').value = this.rgbToHex(settings.qrColor);
        document.getElementById('qrBackground').value = this.rgbToHex(settings.qrBackground);
        document.getElementById('qrGradient1').value = this.rgbToHex(settings.qrGradient1);
        document.getElementById('qrGradient2').value = this.rgbToHex(settings.qrGradient2);
        document.getElementById('notificationDuration').value = settings.notificationDuration / 1000;
        document.getElementById('autoCopy').checked = settings.autoCopy;
        document.getElementById('themeSelect').value = settings.theme;
        document.getElementById('stealthMode').checked = settings.stealthMode;

        // Show/hide QR settings based on style
        this.toggleQrSettings(settings.qrStyle);
        this.applyTheme(settings.theme);
    }

    // Updates and saves user settings
    async updateSettings() {
        debug.log('Updating settings');
        try {
            const settings = {
                enableQr: document.getElementById('enableQr').checked,
                useOriginalUrl: document.getElementById('useOriginalUrl').checked,
                qrStyle: document.getElementById('qrStyle').value,
                qrColor: this.hexToRgb(document.getElementById('qrColor').value),
                qrBackground: this.hexToRgb(document.getElementById('qrBackground').value),
                qrGradient1: this.hexToRgb(document.getElementById('qrGradient1').value),
                qrGradient2: this.hexToRgb(document.getElementById('qrGradient2').value),
                notificationDuration: document.getElementById('notificationDuration').value * 1000,
                autoCopy: document.getElementById('autoCopy').checked,
                theme: document.getElementById('themeSelect').value,
                stealthMode: document.getElementById('stealthMode').checked
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
            qrStyle: 'classic',
            qrColor: '(0,0,0)',
            qrBackground: '(255,255,255)',
            qrGradient1: '(117,129,86)',
            qrGradient2: '(103,175,38)',
            notificationDuration: 30000,
            autoCopy: true,
            theme: 'light',
            stealthMode: false
        };
    }

    // Toggle between classic and gradient QR settings
    toggleQrSettings(style) {
        const classicSettings = document.getElementById('classicQrSettings');
        const gradientSettings = document.getElementById('gradientQrSettings');

        debug.log('Toggling QR settings for style:', style);

        if (style === 'gradient') {
            classicSettings.style.display = 'none';
            gradientSettings.style.display = 'block';
        } else {
            classicSettings.style.display = 'block';
            gradientSettings.style.display = 'none';
        }
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

    setupExport() {
        debug.log('Setting up export functionality');

        // Toggle dropdown on button click
        this.exportBtn.addEventListener('click', () => {
            if (this.exportDropdown.getAttribute('data-disabled') === 'true') return;

            const isExpanded = this.exportBtn.getAttribute('aria-expanded') === 'true';
            this.exportBtn.setAttribute('aria-expanded', !isExpanded);
            this.exportMenu.hidden = isExpanded;
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (event) => {
            if (!this.exportDropdown.contains(event.target)) {
                this.exportBtn.setAttribute('aria-expanded', 'false');
                this.exportMenu.hidden = true;
            }
        });

        // Handle export option clicks
        this.exportMenu.addEventListener('click', async (event) => {
            const button = event.target;
            if (!button.matches('.export-option')) return;

            const format = button.dataset.format;
            await this.exportHistory(format);

            // Hide menu after selection
            this.exportBtn.setAttribute('aria-expanded', 'false');
            this.exportMenu.hidden = true;
        });
    }

    async exportHistory(format) {
        debug.log('Exporting history as:', format);
        const history = await this.getHistory();

        let content;
        let filename;
        let type;

        if (format === 'json') {
            content = JSON.stringify(history, null, 2);
            filename = 'history.json';
            type = 'application/json';
        } else {
            // CSV format
            const headers = ['Short URL', 'Original URL', 'Timestamp'];
            const rows = [headers];

            history.forEach(item => {
                rows.push([
                    item.shortUrl,
                    item.originalUrl,
                    new Date(item.timestamp).toLocaleString()
                ]);
            });

            content = rows.map(row => row.map(cell =>
                `"${cell.replace(/"/g, '""')}"`).join(',')
            ).join('\n');

            filename = 'history.csv';
            type = 'text/csv';
        }

        // Create and trigger download
        const blob = new Blob([content], { type: `${type};charset=utf-8;` });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Show feedback
        const originalText = this.exportBtn.textContent;
        this.exportBtn.textContent = 'Exported!';
        this.exportBtn.style.background = '#28a745';

        setTimeout(() => {
            this.exportBtn.textContent = originalText;
            this.exportBtn.style.background = '';
        }, 2000);
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

    setupClearHistory() {
        debug.log('Setting up clear history functionality');
        const clearBtn = document.querySelector('.clear-history-btn');
        const modal = document.getElementById('clearConfirmModal');
        const modalCancelBtn = modal.querySelector('.cancel');
        const modalConfirmBtn = modal.querySelector('.confirm');

        clearBtn.addEventListener('click', () => {
            debug.log('Clear history button clicked');
            modal.hidden = false;
        });

        modalCancelBtn.addEventListener('click', () => {
            debug.log('Clear history cancelled');
            modal.hidden = true;
        });

        modalConfirmBtn.addEventListener('click', async () => {
            debug.log('Clear history confirmed');
            await this.clearHistory();
            modal.hidden = true;
        });
    }

    async clearHistory() {
        debug.log('Clearing history');
        try {
            await chrome.storage.local.set({ history: [] });
            this.loadHistory(); // Refresh the history view
            debug.log('History cleared successfully');
        } catch (error) {
            debug.error('Failed to clear history:', error);
        }
    }
}

// Initialize popup UI
const popupUI = new PopupUI();