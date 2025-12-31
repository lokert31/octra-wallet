# Octra Wallet

Browser wallet extension for [Octra Network](https://octra.org/).

<p>
  <img src="screenshots/dashboard.jpg" width="200" />
  <img src="screenshots/history.jpg" width="200" />
  <img src="screenshots/settings.jpg" width="200" />
  <img src="screenshots/accounts.jpg" width="200" />
</p>

## Install

### Option 1: Download Ready-to-Use

1. Download zip from [Releases](https://github.com/lokert31/octra-wallet/releases)
2. Extract the archive
3. Open `chrome://extensions/` (or `brave://extensions/`, `edge://extensions/`)
4. Enable **Developer mode**
5. Click **Load unpacked** → select extracted folder

### Option 2: Build from Source

```bash
git clone https://github.com/lokert31/octra-wallet.git
cd octra-wallet
npm install
npm run build
```

Then load `dist/` folder as unpacked extension.

## Features

- Create wallet with 12-word seed phrase
- Import wallet (mnemonic / private key)
- Multiple accounts
- Send/receive OCT
- Transaction history
- Auto-lock

## License

MIT
