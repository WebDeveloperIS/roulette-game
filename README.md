# Roulette Game with Backend

This project now includes a simple Express backend for:
- shared user authentication
- persistent balances
- a shared leaderboard

## Run locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```
3. Open the browser at:
   ```
   http://localhost:3000
   ```

## Notes
- `server.js` serves the static game files and provides `/api/*` endpoints.
- User data persists in `users.json` on the Render instance.
- The frontend now uses AJAX requests to `/api` instead of localStorage-only auth.

## Deploy to Render
1. Push this folder to a Git repository (GitHub, GitLab, etc.).
2. Create a new Web Service on Render.
3. Connect your repository and choose the root folder.
4. Set the environment to `Node`.
5. Use these commands:
   - Build Command: `npm install`
   - Start Command: `npm start`
6. Deploy and open the generated URL.

### Important
- `users.json` will be stored on the deployed instance and may reset if the app is redeployed.
- For production persistence, use a database or Render Persistent Disks.
