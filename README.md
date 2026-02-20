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
