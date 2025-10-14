#!/bin/bash
# Build script for Vercel deployment

echo "Building frontend with Vite..."
vite build

echo "Building API serverless function..."
esbuild api/index.ts --platform=node --packages=external --bundle --format=esm --outfile=api/index.js

echo "Build completed successfully!"
echo "Frontend: dist/public"
echo "API: api/index.js"
