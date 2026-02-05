
# StudyGenius AI - Render Deployment Guide

This project is configured for easy deployment as a **Static Site** on [Render.com](https://render.com).

## Deployment Steps

1.  **GitHub**: Push your code to a GitHub repository.
2.  **Render Dashboard**:
    *   Click **New +** and select **Static Site**.
    *   Connect your repository.
3.  **Build Configuration**:
    *   **Build Command**: `npm install && npm run build`
    *   **Publish Directory**: `dist`
4.  **Environment Variables**:
    *   Go to the **Environment** tab in your Render service settings.
    *   Add a new Secret File or Variable:
        *   **Key**: `API_KEY`
        *   **Value**: (Your Google Gemini API Key)
5.  **Save & Deploy**: Render will trigger a build and your site will be live at a custom `.onrender.com` URL.

## Local Setup
```bash
npm install
npm run dev
```

## How it Works
The build process uses Vite to bundle your TypeScript and React code into optimized HTML/JS/CSS. During the build, Render's environment variable `API_KEY` is injected into the application code so the AI features work immediately upon deployment.
