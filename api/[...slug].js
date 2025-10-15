const bundle = require('./_slug.bundle.js');
module.exports = bundle.default || bundle;
if (bundle.config) module.exports.config = bundle.config;
