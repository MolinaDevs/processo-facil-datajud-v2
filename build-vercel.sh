#!/bin/bash
# Build script for Vercel deployment

echo "Building frontend with Vite..."
vite build

echo "Build completed successfully!"
echo "Frontend: dist/public"
echo "API: api/index.ts (Vercel will compile automatically)"
