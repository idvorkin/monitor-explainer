# Monitor Dimension Explainer

An interactive web app that explains monitor dimensions, aspect ratios, resolutions, and the confusing "p" vs "K" terminology.

**[🚀 Live Demo](https://monitor-explorer.surge.sh)**

## Features

- **Visual comparison** of different monitor sizes and aspect ratios
- **Interactive selector** to compare monitors side-by-side
- **Clear explanations** of the three dimensions:
  1. Aspect ratio (16:9, 21:9, 32:9, 3:2, 16:18)
  2. Physical size (height classes)
  3. Resolution (1440p through 2880p)
- **Terminology decoder** for "p" vs "K" confusion
- **Key insights** about monitor selection

## Running Locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

## Building for Production

```bash
npm run build
npm run preview
```

## Data Source

Monitor specifications and insights from [Igor's IRL blog](https://idvorkin.github.io/irl#monitors).

## Tech Stack

- React
- TypeScript
- Vite
- SVG for visualizations
