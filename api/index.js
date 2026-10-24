// Vercel Serverless Function entry point
// Connects Vercel incoming /api requests to the TrustVault Express application
const { createApp } = require('../server/dist/app.js');

let appInstance = null;

module.exports = (req, res) => {
  if (!appInstance) {
    appInstance = createApp();
  }
  return appInstance(req, res);
};
