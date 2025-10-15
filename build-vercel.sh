#!/bin/bash
# Build script for Vercel deployment

echo "Building frontend with Vite..."
vite build

echo "Building API serverless functions with esbuild (bundle all dependencies)..."
esbuild api/index.ts --bundle --platform=node --packages=external --format=esm --outfile=api/index.js
esbuild api/[...slug].ts --bundle --platform=node --packages=external --format=esm --outfile=api/[...slug].js

echo "Build completed successfully!"
echo "Frontend: dist/public"
echo "API: api/index.js, api/[...slug].js (bundled)"
