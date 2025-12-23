/**
 * Hook to fetch and manage LiteLLM providers and models
 */

import { useState, useCallback } from 'react';

interface LiteLLMModel {
  id: string;
  name: string;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  supportsVision?: boolean;
}

interface LiteLLMProvider {
  id: string;
  name: string;
  requiresBaseUrl: boolean;
  defaultBaseUrl?: string;
  apiKeyUrl: string;
  models: LiteLLMModel[];
  description?: string;
}

export function useLiteLLMProviders() {
  const [providers, setProviders] = useState<LiteLLMProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const fetchProviders = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError('');

    try {
      const result = await window.electronAPI.fetchLiteLLMModels(forceRefresh);

      if (result.success && result.providers) {
        setProviders(result.providers);
      } else {
        setError(result.error || 'Failed to fetch providers');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Providers are loaded lazily when fetchProviders() is called
  // (e.g., when Add Provider dialog opens)

  /**
   * Get provider by ID - memoized to prevent infinite loops
   */
  const getProvider = useCallback((providerId: string): LiteLLMProvider | undefined => {
    return providers.find(p => p.id === providerId);
  }, [providers]);

  /**
   * Get models for a specific provider - memoized to prevent infinite loops
   */
  const getProviderModels = useCallback((providerId: string): LiteLLMModel[] => {
    const provider = providers.find(p => p.id === providerId);
    return provider?.models || [];
  }, [providers]);

  /**
   * Search models across all providers
   */
  const searchModels = useCallback((query: string): Array<LiteLLMModel & { providerId: string; providerName: string }> => {
    const results: Array<LiteLLMModel & { providerId: string; providerName: string }> = [];
    const lowerQuery = query.toLowerCase();

    for (const provider of providers) {
      for (const model of provider.models) {
        if (model.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            ...model,
            providerId: provider.id,
            providerName: provider.name,
          });
        }
      }
    }

    return results;
  }, [providers]);

  return {
    providers,
    loading,
    error,
    fetchProviders,
    getProvider,
    getProviderModels,
    searchModels,
  };
}
