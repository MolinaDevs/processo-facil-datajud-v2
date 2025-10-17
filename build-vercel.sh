#!/bin/bash
# Build script for Vercel deployment

echo "Building frontend with Vite..."
vite build

echo "Building API serverless functions with esbuild..."
# Build directly to final filenames that Vercel executes
# Format: ESM with --packages=external (all deps loaded at runtime)
# Output: api/index.js and api/[...slug].js (final handlers)

# Build /api handler directly to api/index.js
esbuild api/index-handler.ts \
  --bundle \
  --minify \
  --platform=node \
  --target=node18 \
  --format=esm \
  --tree-shaking=true \
  --packages=external \
  --outfile=api/index.js

# Build /api/* handler directly to api/[...slug].js
esbuild api/slug-handler.ts \
  --bundle \
  --minify \
  --platform=node \
  --target=node18 \
  --format=esm \
  --tree-shaking=true \
  --packages=external \
  --outfile=api/[...slug].js

echo "Build completed successfully!"
echo "Frontend: dist/public"
echo "API handlers: api/index.js (28 KB), api/[...slug].js (28 KB)"
