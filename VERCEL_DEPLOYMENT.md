# Hosting TrustVault on Vercel

TrustVault is configured for deployment on Vercel as a fullstack application:
- **Frontend**: Vite + React Single-Page Application (served from `client/dist` with SPA routing).
- **Backend API**: Express Gateway running as a Vercel Serverless Function via `api/index.js` handling all `/api/*` endpoints.

---

## Method 1: Deploy with GitHub (Recommended)

### Step 1: Commit and Push to GitHub
If you haven't already pushed this repository to GitHub, run the following commands in your terminal:

```bash
git add .
git commit -m "Configure fullstack deployment for Vercel"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

*(Replace `YOUR_USERNAME` and `YOUR_REPOSITORY` with your GitHub username and repository name).*

### Step 2: Import into Vercel
1. Log in to your [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** > **Project**.
3. Select your GitHub repository and click **Import**.
4. Vercel will automatically read [vercel.json](./vercel.json):
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `npm run build`
   - **Output Directory**: `client/dist`

### Step 3: Configure Environment Variables
Under the **Environment Variables** section in the Vercel project setup, add the following variables:

| Variable Name | Value | Purpose |
| :--- | :--- | :--- |
| `VITE_FIREBASE_API_KEY` | `AIzaSyAh7kGgPFlALOkfpoZpgXKCJyDl6gRMcX0` | Client Firebase Auth |
| `VITE_FIREBASE_AUTH_DOMAIN` | `trust-b2d3f.firebaseapp.com` | Client Firebase Auth |
| `VITE_FIREBASE_PROJECT_ID` | `trust-b2d3f` | Client Firebase Auth |
| `VITE_FIREBASE_STORAGE_BUCKET` | `trust-b2d3f.firebasestorage.app` | Client Storage |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `863618608413` | Client Messaging |
| `VITE_FIREBASE_APP_ID` | `1:863618608413:web:817a06d2d9a123115c05f4` | Client App ID |
| `FIREBASE_PROJECT_ID` | `trust-b2d3f` | Server Firestore Project |
| `NODE_ENV` | `production` | Production mode |

> **Optional**: If you have a Google Cloud Service Account JSON for production Firestore persistence, you can add `GOOGLE_APPLICATION_CREDENTIALS_JSON` with the raw JSON content as an environment variable. Without it, the server operates using its in-memory engine.

### Step 4: Click Deploy
Click **Deploy**. Vercel will build both the frontend and serverless API and provide you with a live URL (e.g., `https://trustvault-xyz.vercel.app`).

---

## Method 2: Deploy Directly via Vercel CLI

You can also deploy directly from your local terminal using the Vercel CLI:

1. Log in to Vercel:
   ```bash
   npx vercel login
   ```
2. Link and deploy your project preview:
   ```bash
   npx vercel
   ```
3. Deploy to production:
   ```bash
   npx vercel --prod
   ```

---

## Architecture Summary
- **[vercel.json](./vercel.json)**: Directs `/api/(.*)` to the serverless function `api/index.js` and all other routes `/(.*)` to `client/dist/index.html`.
- **[api/index.js](./api/index.js)**: Serverless wrapper executing the Express application on Vercel's edge/serverless infrastructure.
- **[package.json](./package.json)**: Contains the `vercel-build` and `build` commands which compile both the server TypeScript and Vite React client bundles.
