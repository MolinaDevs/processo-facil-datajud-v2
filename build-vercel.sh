#!/bin/bash
# Build script for Vercel deployment

echo "Building frontend with Vite..."
vite build

echo "Building API serverless functions with esbuild (bundle dependencies)..."
# Bundle everything EXCEPT @neondatabase/serverless which Vercel provides
# Use CommonJS format for Vercel compatibility
# Build to temporary files, then create wrappers

# Build index.ts to temp file
esbuild api/index.ts \
  --bundle \
  --minify \
  --platform=node \
  --target=node18 \
  --format=cjs \
  --tree-shaking=true \
  --external:@neondatabase/serverless \
  --outfile=api/_index.bundle.js

# Create wrapper for index.js
cat > api/index.js << 'EOF'
const bundle = require('./_index.bundle.js');
module.exports = bundle.default || bundle;
if (bundle.config) module.exports.config = bundle.config;
EOF

# Build [...slug].ts to temp file
esbuild api/[...slug].ts \
  --bundle \
  --minify \
  --platform=node \
  --target=node18 \
  --format=cjs \
  --tree-shaking=true \
  --external:@neondatabase/serverless \
  --outfile=api/_slug.bundle.js

# Create wrapper for [...slug].js
cat > api/[...slug].js << 'EOF'
const bundle = require('./_slug.bundle.js');
module.exports = bundle.default || bundle;
if (bundle.config) module.exports.config = bundle.config;
EOF

echo "Build completed successfully!"
echo "Frontend: dist/public"
echo "API: api/index.js (wrapper + _index.bundle.js)"
echo "     api/[...slug].js (wrapper + _slug.bundle.js)"
