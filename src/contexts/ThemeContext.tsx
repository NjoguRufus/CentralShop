import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

export type Theme = 'light' | 'dark';
export type ColorScheme = 'blue' | 'green' | 'purple' | 'red' | 'orange' | 'pink' | 'indigo' | 'teal';

interface ThemeSettings {
  mode: Theme;
  colorScheme: ColorScheme;
  primaryColor: string;
  customColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

interface ThemeContextType {
  theme: Theme;
  colorScheme: ColorScheme;
  primaryColor: string;
  customColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  toggleTheme: () => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setPrimaryColor: (color: string) => void;
  setCustomColors: (colors: { primary: string; secondary: string; accent: string }) => void;
  applyTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Color schemes with their corresponding CSS variables
const colorSchemes: Record<ColorScheme, { primary: string; secondary: string; accent: string }> = {
  blue: {
    primary: '#3b82f6',
    secondary: '#1e40af',
    accent: '#60a5fa'
  },
  green: {
    primary: '#10b981',
    secondary: '#047857',
    accent: '#34d399'
  },
  purple: {
    primary: '#8b5cf6',
    secondary: '#6d28d9',
    accent: '#a78bfa'
  },
  red: {
    primary: '#ef4444',
    secondary: '#dc2626',
    accent: '#f87171'
  },
  orange: {
    primary: '#f97316',
    secondary: '#ea580c',
    accent: '#fb923c'
  },
  pink: {
    primary: '#ec4899',
    secondary: '#db2777',
    accent: '#f472b6'
  },
  indigo: {
    primary: '#6366f1',
    secondary: '#4f46e5',
    accent: '#818cf8'
  },
  teal: {
    primary: '#14b8a6',
    secondary: '#0d9488',
    accent: '#5eead4'
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as Theme) || 'dark';
  });
  
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() => {
    const saved = localStorage.getItem('colorScheme');
    return (saved as ColorScheme) || 'blue';
  });
  
  const [primaryColor, setPrimaryColorState] = useState<string>(() => {
    const saved = localStorage.getItem('primaryColor');
    return saved || colorSchemes[colorScheme].primary;
  });
  
  const [customColors, setCustomColorsState] = useState<{ primary: string; secondary: string; accent: string } | undefined>(() => {
    const saved = localStorage.getItem('customColors');
    return saved ? JSON.parse(saved) : undefined;
  });

  // Load theme settings from Firebase
  useEffect(() => {
    const loadThemeSettings = async () => {
      if (!currentUser?.shopId) return;
      
      try {
        const settingsDoc = await getDoc(doc(db, 'shops', currentUser.shopId, 'settings', 'general'));
        if (settingsDoc.exists()) {
          const settings = settingsDoc.data();
          const themeSettings = settings.themeSettings;
          
          if (themeSettings) {
            setTheme(themeSettings.mode || 'dark');
            setColorSchemeState(themeSettings.colorScheme || 'blue');
            setPrimaryColorState(themeSettings.primaryColor || colorSchemes[themeSettings.colorScheme || 'blue'].primary);
            if (themeSettings.customColors) {
              setCustomColorsState(themeSettings.customColors);
            }
          }
        }
      } catch (error) {
        console.error('Error loading theme settings:', error);
      }
    };

    loadThemeSettings();
  }, [currentUser?.shopId]);

  // Apply theme to document
  useEffect(() => {
    applyTheme();
  }, [theme, colorScheme, primaryColor, customColors]);

  const applyTheme = () => {
    // Apply dark/light mode
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Apply color scheme
    const colors = customColors || colorSchemes[colorScheme];
    
    // Use the selected primary color as the main primary color
    const mainPrimaryColor = primaryColor || colors.primary;
    
    // Set CSS custom properties
    document.documentElement.style.setProperty('--color-primary', mainPrimaryColor);
    document.documentElement.style.setProperty('--color-secondary', colors.secondary);
    document.documentElement.style.setProperty('--color-accent', colors.accent);
    
    // Set primary color for reference
    document.documentElement.style.setProperty('--color-primary-custom', mainPrimaryColor);
    
    // Save to localStorage
    localStorage.setItem('theme', theme);
    localStorage.setItem('colorScheme', colorScheme);
    localStorage.setItem('primaryColor', primaryColor);
    if (customColors) {
      localStorage.setItem('customColors', JSON.stringify(customColors));
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const setColorScheme = (scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    setPrimaryColorState(colorSchemes[scheme].primary);
    setCustomColorsState(undefined);
  };

  const setPrimaryColor = (color: string) => {
    setPrimaryColorState(color);
  };

  const setCustomColors = (colors: { primary: string; secondary: string; accent: string }) => {
    setCustomColorsState(colors);
  };

  // Save theme settings to Firebase
  const saveThemeSettings = async (themeSettings: ThemeSettings) => {
    if (!currentUser?.shopId) return;
    
    try {
      await setDoc(doc(db, 'shops', currentUser.shopId, 'settings', 'general'), {
        themeSettings
      }, { merge: true });
    } catch (error) {
      console.error('Error saving theme settings:', error);
    }
  };

  // Auto-save theme changes
  useEffect(() => {
    if (currentUser?.shopId) {
      const themeSettings: ThemeSettings = {
        mode: theme,
        colorScheme,
        primaryColor,
        ...(customColors && { customColors })
      };
      saveThemeSettings(themeSettings);
    }
  }, [theme, colorScheme, primaryColor, customColors, currentUser?.shopId]);

  const value: ThemeContextType = {
    theme,
    colorScheme,
    primaryColor,
    customColors,
    toggleTheme,
    setColorScheme,
    setPrimaryColor,
    setCustomColors,
    applyTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

























