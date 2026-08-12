# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

## iPhone testing (Capacitor)

1. Start API server on your Mac:

```bash
npm run api
```

2. Find your Mac LAN IP (example: `192.168.1.50`).

3. Build and sync iOS app:

```bash
npm run build:ios
```

4. Open iOS project:

```bash
npm run ios:open
```

5. In Xcode, run on your iPhone.

6. In login screen on iPhone, set:

`API Server URL` = `http://<YOUR_MAC_IP>:4000`

Then tap `Save API URL`, and login.

## Public deployment for all devices (computer + phone)

The server now serves both API and web UI from one URL in production.

### Option A: Deploy on Render (free tier to start)

1. Push this repo to GitHub.
2. In Render, create a new Blueprint and select this repo.
3. Render will use `render.yaml` automatically.
4. After deploy, open:
   - `https://<your-app>.onrender.com` (web app)
   - `https://<your-app>.onrender.com/api/health` (API health)

### Notes

- Data is stored in `server/db.json` on the server filesystem. On free tiers, storage may reset on redeploy/restart.
- For real production use, move data to a managed database (Postgres/MySQL).

## Telegram alert for Inventory OUT approval

When maintenance staff submits Stock OUT with `PENDING` approval, the server can send Telegram alert.

## Windows desktop live server setup

If you want to replace Render and run the live app from your Windows desktop, use a local `.env` file.

### Where to put it

Create this file on the Windows desktop server:

```text
G:\it-control-center\.env
```

The server reads `.env` automatically on startup.

### GitHub push -> auto update on Windows live server

If you want your Windows live server to update from GitHub after you push code, this repo now includes two helper scripts:

- `npm run live:start:windows`
- `npm run live:update:windows`

What they do:

- `live:start:windows`
  - stops the old Node live server
  - starts `npm run start:prod`

- `live:update:windows`
  - fetches branch `hotfix-live-main` from GitHub
  - pulls new code if there is a new commit
  - runs `npm install` if package files changed
  - runs `npm run build`
  - restarts the live server

Recommended setup on the Windows live server:

1. Keep the live folder as the real production folder.
2. Make sure that folder is a Git clone of this repo.
3. Test once manually:

```bash
npm run live:update:windows
```

4. Then use Windows Task Scheduler to run:

```bash
npm run live:update:windows
```

every 5 minutes.

This gives you near-automatic deployment from GitHub to your Windows live server.

### How to prepare it

1. Copy [.env.local-server.example](.env.local-server.example) to `.env`.
2. Edit the values for your Windows desktop:
   - `DATA_ROOT=G:\\it-control-center\\server`
   - `PUBLIC_APP_URL=http://<YOUR_WINDOWS_IP>:4000`
   - all Telegram bot tokens and chat IDs
3. Restart the server.

### Important note about Telegram on local network

Telegram alert sending works from the Windows desktop as long as that desktop has internet access.

However, some Telegram features in this app use `PUBLIC_APP_URL` to build image/preview links.

- Text alerts: work locally
- Many image alerts: work locally
- Any Telegram preview that needs Telegram's servers to fetch a URL may not work if `PUBLIC_APP_URL` is only a private LAN address like `http://192.168.1.84:4000`

If you want Telegram previews to behave exactly like Render for all cases, you need a public HTTPS URL that Telegram can reach.

### Local setup

1. Copy env template:

```bash
cp .env.example .env
```

2. Edit `.env` and set:
- `TELEGRAM_ALERT_ENABLED=true`
- `TELEGRAM_BOT_TOKEN=<your bot token>`
- `TELEGRAM_CHAT_ID=<your chat id>`
- optional `TELEGRAM_CHAT_IDS=<comma-separated chat ids>` for multiple groups/chats
- optional `TELEGRAM_DISCOVER_CHAT_IDS=true` to auto-detect chat IDs from bot updates

3. Restart server:

```bash
npm run start
```

### Render setup

`render.yaml` already includes:
- `TELEGRAM_ALERT_ENABLED=true`
- `TELEGRAM_BOT_TOKEN` (secret env var)
- `TELEGRAM_CHAT_ID` (secret env var)
- `TELEGRAM_CHAT_IDS` (secret env var, optional)
- `TELEGRAM_DISCOVER_CHAT_IDS=true` (optional, auto-detect targets from bot updates)

### Telegram test API

You can verify bot delivery from server with:

```bash
curl -X POST "$API_BASE/api/alerts/telegram/test" \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"text":"ECO Telegram test"}'
```
