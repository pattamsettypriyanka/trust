import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';

const PORT = parseInt(process.env.PORT || '5000', 10);
const app = createApp();

app.listen(PORT, () => {
  console.log(`[TrustVault API Gateway] Running securely on http://localhost:${PORT}`);
  console.log(`[Mode] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Storage] Binary document storage: Cloud Firestore 'documentContents' (Bytes)`);
});
