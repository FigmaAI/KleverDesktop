/**
 * Hook to fetch and manage LiteLLM providers and models
 */

import { useState, useEffect } from 'react';

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

  const fetchProviders = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await window.electronAPI.fetchLiteLLMModels();
      
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
  };

  // Auto-fetch on mount
  useEffect(() => {
    fetchProviders();
  }, []);

  /**
   * Get provider by ID
   */
  const getProvider = (providerId: string): LiteLLMProvider | undefined => {
    return providers.find(p => p.id === providerId);
  };

  /**
   * Get models for a specific provider
   */
  const getProviderModels = (providerId: string): LiteLLMModel[] => {
    const provider = getProvider(providerId);
    return provider?.models || [];
  };

  /**
   * Search models across all providers
   */
  const searchModels = (query: string): Array<LiteLLMModel & { providerId: string; providerName: string }> => {
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
  };

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

