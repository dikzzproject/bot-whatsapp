# WhatsApp Automation Bot (Beta 1.1.0)

A Node.js-based WhatsApp bot framework designed for automation, custom command handling, and interactive features. This project is currently in its Beta 1.1.0 testing phase.

## 📂 Project Structure

The repository is organized into the following directories:

* **assets/**: Contains media components, configuration assets, or images used by the bot.
* **minigame/**: Modular scripts handling text-based interactive games for chat users.
* **scripts/**: Core logic handlers, plugin systems, and custom automation commands.
* **session/**: Stores session authentication data (e.g., multi-device credentials) to maintain a persistent connection without re-scanning the QR code.
* **index.js**: The central entry point that initializes the WhatsApp client and boots up event listeners.

## 🛠️ Prerequisites

Ensure you have the following installed on your local environment:
* **Node.js** (v16.x or higher recommended)
* **npm** (Node Package Manager)
* **Git**

## 📦 Installation & Setup

Follow these steps to deploy and run the bot locally:

1. **Clone the Repository**
   ```bash
   git clone https://github.com/dikzzproject/bot-whatsapp.git
   cd bot-whatsapp
   ```

2. **Install Node Dependencies**
   Extract and download all necessary packages specified inside `package.json`:
   ```bash
   npm install
   ```

## 🚀 Running the Bot

To initiate the WhatsApp connection, run the start script:

```bash
npm start
```
Alternatively, launch the entry file directly using:
```bash
node index.js
```

### Linking Your WhatsApp Account
1. Once launched, a secure **QR Code** will be generated in your terminal console.
2. Open WhatsApp on your mobile phone.
3. Tap **Linked Devices** > **Link a Device**.
4. Scan the terminal QR code to authorize the bot session. 

*Note: Session persistence data will be cached automatically inside the `session/` directory.*

## 🧪 Development Status & Contributing

This project is currently marked as a **Test Bot (Beta)**. Bugs, unexpected disconnects, or unfinished modules might occur. 

If you want to contribute, optimize the command triggers inside `scripts/`, or build new modules within `minigame/`, feel free to open an **Issue** or submit a **Pull Request**.
