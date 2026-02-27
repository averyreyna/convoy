import { describe, it, expect, beforeEach } from 'vitest';
import { usePreferencesStore } from '@/stores/preferencesStore';

describe('preferencesStore', () => {
  beforeEach(() => {
    usePreferencesStore.setState({
      showCodeByDefault: false,
      preferredExportLanguage: 'python',
      suggestNextSteps: false,
    });
  });

  it('updates showCodeByDefault', () => {
    expect(usePreferencesStore.getState().showCodeByDefault).toBe(false);
    usePreferencesStore.getState().setShowCodeByDefault(true);
    expect(usePreferencesStore.getState().showCodeByDefault).toBe(true);
  });

  it('updates preferredExportLanguage', () => {
    expect(usePreferencesStore.getState().preferredExportLanguage).toBe('python');
    usePreferencesStore.getState().setPreferredExportLanguage('python');
    expect(usePreferencesStore.getState().preferredExportLanguage).toBe('python');
  });

  it('updates suggestNextSteps', () => {
    expect(usePreferencesStore.getState().suggestNextSteps).toBe(false);
    usePreferencesStore.getState().setSuggestNextSteps(true);
    expect(usePreferencesStore.getState().suggestNextSteps).toBe(true);
  });
});
