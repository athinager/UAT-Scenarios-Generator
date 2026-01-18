# UAT Scenarios Generator

A static GitHub Pages web app for generating comprehensive User Acceptance Test (UAT) scenarios from UI screenshots. Built with Vite + React + TypeScript.

## Features

- **Dark "Sizzey" UI**: Neon accents, subtle gradients, glass cards, rounded, spacious design
- **Image Upload**: Drag & drop or file picker for PNG/JPG/WebP images
- **Image Management**: Reorder images (drag & drop or up/down buttons), remove, clear
- **OCR Analysis**: Extracts text from images using tesseract.js
- **UI Element Detection**: Lightweight computer vision heuristics to detect buttons, forms, headers, navigation, modals, tables, lists, and more
- **Scenario Generation**: Creates comprehensive UAT scenarios including:
  - Screen-specific scenarios with labels
  - Cross-screen flow scenarios (happy path + negative/edge cases)
  - Validation, accessibility, responsiveness, and i18n scenarios
- **Output Options**: Copy individual scenarios, copy all, or export to .txt file
- **WCAG Compliant**: Semantic HTML, keyboard navigation, focus indicators, skip link, high contrast support

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

Build for production:

```bash
npm run build
```

The output will be in the `dist/` directory.

### Preview Production Build

Preview the production build locally:

```bash
npm run preview
```

## Deployment to GitHub Pages

### Option 1: GitHub Actions (Recommended)

The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically deploys to GitHub Pages when you push to the `main` branch.

**Before deploying:**

1. Update the `repoName` in `vite.config.ts` to match your repository name (if different)
2. Enable GitHub Pages in your repository settings:
   - Go to Settings → Pages
   - Source: GitHub Actions
   - Save

The workflow will automatically build and deploy your app to GitHub Pages on every push to `main`.

### Option 2: Manual Deploy

1. Update the `repoName` in `vite.config.ts` to match your repository name
2. Build the project: `npm run build`
3. Push the `dist/` folder contents to the `gh-pages` branch or use the GitHub Pages settings to deploy from the `dist` folder

## Project Structure

```
├── src/
│   ├── components/       # React components
│   │   ├── ImageUploader.tsx
│   │   ├── ImageGallery.tsx
│   │   ├── ScenarioGenerator.tsx
│   │   └── Toast.tsx
│   ├── utils/            # Utility functions
│   │   ├── imageAnalysis.ts    # OCR and UI element detection
│   │   └── scenarioGenerator.ts # UAT scenario generation logic
│   ├── App.tsx           # Main app component
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles
├── .github/
│   └── workflows/
│       └── deploy.yml    # GitHub Pages deployment workflow
├── vite.config.ts        # Vite configuration
└── package.json
```

## How It Works

1. **Upload Images**: Users upload UI screenshots (PNG/JPG/WebP) via drag & drop or file picker
2. **Reorder Images**: Images can be reordered to match the user flow
3. **Analysis**: Each image is analyzed using:
   - **OCR (tesseract.js)**: Extracts text content
   - **CV Heuristics**: Detects UI elements using canvas sampling and edge detection
4. **Scenario Generation**: Based on the analysis, generates comprehensive UAT scenarios covering:
   - Screen-specific test cases
   - Cross-screen flows (happy path and edge cases)
   - Validation scenarios
   - Accessibility scenarios
   - Responsiveness scenarios
5. **Output**: Users can copy individual scenarios, copy all, or export to a .txt file

## Technologies

- **Vite**: Fast build tool and dev server
- **React 18**: UI framework
- **TypeScript**: Type safety
- **tesseract.js**: OCR for text extraction
- **react-beautiful-dnd**: Drag and drop for image reordering
- **CSS**: Custom dark theme with neon accents

## Browser Support

Modern browsers that support:
- ES2020 features
- CSS Grid and Flexbox
- Clipboard API
- Canvas API
- File API

## License

MIT

