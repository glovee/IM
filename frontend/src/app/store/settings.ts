import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppSettings {
  theme: 'light' | 'dark';
  itemsPerPage: number;
  setTheme: (theme: 'light' | 'dark') => void;
  setItemsPerPage: (count: number) => void;
}

function withDisabledTransitions(applyTheme: () => void) {
  if (typeof document === 'undefined') {
    applyTheme();
    return;
  }

  const style = document.createElement('style');
  style.appendChild(
    document.createTextNode('*,*::before,*::after{transition:none !important;}')
  );
  document.head.appendChild(style);

  applyTheme();
  void window.getComputedStyle(document.body);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      style.remove();
    });
  });
}

function applyThemeClass(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export const useAppSettings = create<AppSettings>()(
  persist(
    (set) => ({
      theme: 'light',
      itemsPerPage: 20,
      setTheme: (theme) => {
        set({ theme });
        withDisabledTransitions(() => applyThemeClass(theme));
      },
      setItemsPerPage: (itemsPerPage) => set({ itemsPerPage }),
    }),
    {
      name: 'app-settings',
      onRehydrateStorage: () => (state) => {
        applyThemeClass(state?.theme ?? 'light');
      },
    }
  )
);
