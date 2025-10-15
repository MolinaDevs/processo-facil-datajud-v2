#!/bin/bash
# Build script for Vercel deployment

echo "Building frontend with Vite..."
vite build

echo "Building API serverless functions with esbuild (bundle dependencies)..."
# Bundle everything EXCEPT @neondatabase/serverless which Vercel provides
esbuild api/index.ts \
  --bundle \
  --minify \
  --platform=node \
  --target=node18 \
  --format=esm \
  --tree-shaking=true \
  --external:@neondatabase/serverless \
  --outfile=api/index.js

esbuild api/[...slug].ts \
  --bundle \
  --minify \
  --platform=node \
  --target=node18 \
  --format=esm \
  --tree-shaking=true \
  --external:@neondatabase/serverless \
  --outfile=api/[...slug].js

echo "Build completed successfully!"
echo "Frontend: dist/public"
echo "API: api/index.js, api/[...slug].js (bundled)"
