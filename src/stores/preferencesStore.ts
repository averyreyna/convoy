/**
 * Phase 4: Light preferences — show code by default, default script language,
 * optionally suggest next steps. Persisted to localStorage (convoy.preferences).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const STORAGE_KEY = 'convoy.preferences';

export type PreferredExportLanguage = 'python';

interface PreferencesState {
  showCodeByDefault: boolean;
  preferredExportLanguage: PreferredExportLanguage;
  suggestNextSteps: boolean;

  setShowCodeByDefault: (value: boolean) => void;
  setPreferredExportLanguage: (value: PreferredExportLanguage) => void;
  setSuggestNextSteps: (value: boolean) => void;
}

const defaultState = {
  showCodeByDefault: false,
  preferredExportLanguage: 'python' as PreferredExportLanguage,
  suggestNextSteps: false,
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...defaultState,
      setShowCodeByDefault: (value) => set({ showCodeByDefault: value }),
      setPreferredExportLanguage: (value) =>
        set({ preferredExportLanguage: value }),
      setSuggestNextSteps: (value) => set({ suggestNextSteps: value }),
    }),
    { name: STORAGE_KEY }
  )
);
