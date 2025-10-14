#!/bin/bash

# Build frontend
echo "Building frontend..."
npm run build

# Build API for Vercel
echo "Building API for Vercel..."
npx esbuild server/routes.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
npx esbuild api/index.ts --platform=node --packages=external --bundle --format=esm --outdir=api

echo "Build complete!"
