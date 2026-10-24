const app = require("../server/index");

module.exports = app;

// Node.js serverless runtime on Vercel
module.exports.config = {
  maxDuration: 30,
};
