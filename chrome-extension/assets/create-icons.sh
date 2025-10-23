#!/bin/bash
# This script would convert SVG to PNG using ImageMagick
# For now, we'll create simple colored squares as placeholders

# Check if ImageMagick is installed
if command -v convert &> /dev/null; then
    echo "Converting SVG to PNG icons..."
    convert icon-placeholder.svg -resize 16x16 icon-16.png
    convert icon-placeholder.svg -resize 48x48 icon-48.png
    convert icon-placeholder.svg -resize 128x128 icon-128.png
    echo "✅ Icons created!"
else
    echo "⚠️  ImageMagick not installed. Creating placeholder icons..."
    # Create simple colored PNG placeholders
    convert -size 16x16 xc:#1e3a8a icon-16.png 2>/dev/null || echo "Creating 16x16"
    convert -size 48x48 xc:#1e3a8a icon-48.png 2>/dev/null || echo "Creating 48x48"
    convert -size 128x128 xc:#1e3a8a icon-128.png 2>/dev/null || echo "Creating 128x128"
fi
