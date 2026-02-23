import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Guard against placeholder or empty URL to avoid crashing at startup
const isValidUrl = (url: string) => {
    try {
        return url && url.startsWith('http') && !url.includes('YOUR_SUPABASE_URL') && !url.includes('your-project');
    } catch {
        return false;
    }
};

export const supabase = isValidUrl(supabaseUrl)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : {
        from: () => ({
            upsert: () => Promise.resolve({ error: { message: 'Supabase URL not configured' } }),
            select: () => ({ match: () => Promise.resolve({ data: [], error: null }) })
        })
    } as any;
