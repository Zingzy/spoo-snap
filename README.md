# SpooSnap 🚀 - Instant URL Shortening Extension

> Transform long URLs into short, shareable links instantly with this powerful Chrome extension powered by spoo.me

## ✨ Key Features

- 🔄 **Instant URL Shortening**
  - Automatic shortening when URLs are copied
  - Supports custom domains via spoo.me

- 📱 **Smart QR Codes**
  - Real-time QR code generation
  - Customizable designs and colors
  - Perfect for mobile sharing

- 🔔 **Intelligent Notifications**
  - Clean, minimal notification UI
  - Shows shortened URL and QR preview
  - Quick copy functionality

- 📝 **History & Management**
  - Track all shortened URLs
  - Export history (CSV/JSON)
  - Analytics integration

- ⚙️ **Rich Customization**
  - Stealth mode operation
  - Flexible QR code settings
  - Notification preferences
  - Theme options (Light/Dark)

## 🚀 Quick Start

1. **Installation**

   ```bash
   git clone https://github.com/Zingzy/spoo-snap.git
   ```
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable `Developer mode` in the top right corner
5. Click `Load unpacked` and select the cloned extension directory

**Or download directly from Chrome Web Store (coming soon)**

## 🎯 How to Use

1. **Basic Usage**:
   - **Copy any URL** to your clipboard or **right-click** on any url and select `Shorten Link` from the context menu
   - SpooSnap automatically generates a short link and copies it to your clipboard
   - Click notification to copy or scan QR code


2. 🛠️ **Popup Interface**:
   - Click the extension icon in your toolbar
   - View your URL shortening history
   - Access and modify settings

## 🔌 APIs Used

### URL Shortening (spoo.me)
- Supports URL shortening with optional features:
  - Password protection
  - Click limit setting
  - Bot blocking

### QR Code Generation (qr.spoo.me)
- Generates customizable QR codes with options for:
  - Custom colors (fill and background)
  - Various size options

## ⚙️ Configuration Options

| Feature       | Options                           |
| ------------- | --------------------------------- |
| QR Codes      | Enable/Disable, Style, Colors     |
| Notifications | Duration, Auto-copy, Stealth mode |
| Theme         | Light/Dark                        |
| History       | Auto-save, Export formats         |

## 🛠️ Technical Details

Built using:
- Manifest V3
- Chrome Extension APIs (clipboard, storage, notifications)
- [spoo.me](https://spoo.me/api) and [qr.spoo.me](https://qr.spoo.me) REST APIs

## 🌐 Browser Compatibility

Currently supports:
- Google Chrome
- Chromium-based browsers (Edge, Brave, etc.)