
# StudyGenius AI
https://studyboy-v1.onrender.com

Transform study notes and documents into interactive summaries, flashcards, and board-style quizzes with AI.

## Key Features
- AI-generated study guides with structured sections
- Flashcards with spaced-repetition ratings
- Board-style quiz sessions with history and review
- Past upload library with quick reopen/download
- Domain-specific modes (PA, Nursing, Medical, GenEd)

## Local Setup
```bash
npm install
npm run dev
```

## Environment Variables
Create an environment variable named `API_KEY` (Google Gemini API key).

For Vite builds, the key is injected via `process.env.API_KEY` at build time.

## Deployment (Render)
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

## How it Works
Vite bundles TypeScript/React into optimized assets. During the build, Render’s `API_KEY` environment variable is injected so AI features work on deploy.

## Troubleshooting
- **AI requests failing (503):** transient Gemini overload. Retry after a minute.
- **Styles not loading on Render:** confirm Publish Directory is `dist` and assets are served without rewrites.
