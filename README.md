
# StudyGenius AI
https://studyboy-v1.onrender.com
[![Live Demo](https://img.shields.io/badge/Live-Demo-indigo)](https://studyboy-v1.onrender.com)

Transform study notes and documents into interactive summaries, flashcards, and board-style quizzes with medical-grade AI synthesis. Optimized for PANCE, USMLE, and complex clinical board preparation.

## 🚀 Advanced Features
- **Multi-Document Synthesis**: Upload multiple PDFs, images, and text files simultaneously. The AI synthesizes all sources into one cohesive, cross-referenced study guide.
- **Visual Learning (Image Questioning)**: AI analyzes medical diagrams and charts. Supports high-res image analysis for anatomy and pathology.
- **Targeted Remediation**: When you fail a question, the AI analyzes the specific clinical concept you missed and generates targeted practice questions to fix that weak point.
- **Smart Image Labeling**: Automatically detects anatomical structures in your diagrams and generates interactive labeling questions with accurate coordinate mapping.
- **Supabase Persistence**: Complete data durability. Your study sessions, uploads, and achievement trophies are synced to the cloud and available across devices.
- **Multi-Key API Balancing**: Advanced failover logic across multiple Gemini API keys to handle high-volume batch processing and prevent rate limits.

## 📋 Domain-Specific Modes
Customized AI instructions for:
- **Physician Assistant (PA)**: Focused on PANCE Blueprints.
- **Nursing**: NCLEX-style critical thinking.
- **Medical**: USMLE Step-level clinical reasoning.
- **General Education**: Comprehensive academic synthesis.

## 🛠️ Local Setup
1. **Clone and Install**:
```bash
npm install
```

2. **Configure Environment**:
Create a `.env.local` file with:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
VITE_GEMINI_API_KEY=your_primary_gemini_key
VITE_GEMINI_API_KEY_1=optional_backup_key
VITE_GEMINI_API_KEY_2=optional_backup_key
```

3. **Run Dev**:
```bash
npm run dev
```

## 🏗️ Architecture Optimizations
- **Hybrid Storage Strategy**: Large binary/image sources are moved to Supabase JSONB storage, while lightweight metadata is kept in local browser storage for a snappy, offline-first UI experience.
- **Exponential Backoff & Jitter**: AI requests use intelligent retry logic to ensure 99.9% completion rates during heavy multi-document synthesis.
- **Auto-Repair JSON**: Robust AI output parsing with built-in "self-healing" for malformed LLM responses.

## 🚀 Deployment
Deployed via **Vite** on [Render.com](https://render.com) with **Supabase** for the backend database tier.
