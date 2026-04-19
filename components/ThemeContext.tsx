import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeColor, ThemeConfig } from '../types';

// Theme configurations
export const THEMES: ThemeConfig[] = [
  {
    id: 'light',
    name: 'Light',
    icon: '☀️',
    preview: { primary: '#6366f1', secondary: '#f8fafc', accent: '#818cf8' }
  },
  {
    id: 'dark',
    name: 'Dark',
    icon: '🌙',
    preview: { primary: '#818cf8', secondary: '#0f172a', accent: '#6366f1' }
  },
  {
    id: 'pink',
    name: 'Pink Glossy',
    icon: '💖',
    preview: { primary: '#ec4899', secondary: '#fdf2f8', accent: '#f472b6' }
  },
  {
    id: 'ocean',
    name: 'Ocean',
    icon: '🌊',
    preview: { primary: '#0ea5e9', secondary: '#f0f9ff', accent: '#38bdf8' }
  },
  {
    id: 'emerald',
    name: 'Emerald',
    icon: '🌿',
    preview: { primary: '#10b981', secondary: '#f0fdf4', accent: '#34d399' }
  }
];

interface ThemeContextType {
  theme: ThemeColor;
  setTheme: (theme: ThemeColor) => void;
  themes: ThemeConfig[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeColor>(() => {
    const saved = localStorage.getItem('crosscheck-theme');
    return (saved as ThemeColor) || 'dark';
  });

  const setTheme = (newTheme: ThemeColor) => {
    setThemeState(newTheme);
    localStorage.setItem('crosscheck-theme', newTheme);
  };

  useEffect(() => {
    // Remove all theme classes
    document.documentElement.classList.remove('theme-light', 'theme-dark', 'theme-pink', 'theme-ocean', 'theme-emerald');
    // Add current theme class
    document.documentElement.classList.add(`theme-${theme}`);
    
    // Set color scheme for browser UI
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
