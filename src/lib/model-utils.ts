/**
 * Utility functions for handling model names and providers.
 */

/**
 * Removes the provider prefix from a model ID (e.g., 'openai/gpt-4' -> 'gpt-4')
 */
export function removeProviderPrefix(modelId: string): string {
  if (!modelId) return '';
  const prefixMatch = modelId.match(/^[^/]+\/(.+)$/);
  return prefixMatch ? prefixMatch[1] : modelId;
}

/**
 * Shortens a model name for display by removing version dates and common suffixes.
 * Also cleans up the name for better readability.
 * 
 * Examples:
 * - 'claude-3-5-sonnet-20241022' -> 'Claude 3.5 Sonnet'
 * - 'gpt-4o-2024-08-06' -> 'GPT-4o'
 * - 'llama3.2-vision:latest' -> 'Llama 3.2 Vision'
 */
export function formatModelName(modelId: string): string {
  if (!modelId) return '';
  
  // 1. Remove provider prefix
  let name = removeProviderPrefix(modelId);
  
  // 2. Remove ':latest' or other tags
  name = name.split(':')[0];
  
  // 3. Remove date suffixes (e.g., -20241022, -0613)
  name = name.replace(/-?\d{4,8}$/, '');
  name = name.replace(/-?\d{2,4}-\d{2}-\d{2}$/, '');
  
  // 4. Special handling for common models to make them look premium
  
  // Claude
  if (name.toLowerCase().includes('claude')) {
    name = name.replace(/claude-?(\d)-?(\d)/i, 'Claude $1.$2');
    name = name.replace(/sonnet/i, 'Sonnet');
    name = name.replace(/opus/i, 'Opus');
    name = name.replace(/haiku/i, 'Haiku');
  }
  
  // GPT
  else if (name.toLowerCase().startsWith('gpt')) {
    name = name.replace(/gpt-?(\d)([a-z])?/i, (_match, v, suffix) => {
      return `GPT-${v}${suffix || ''}`;
    });
  }
  
  // Llama
  else if (name.toLowerCase().includes('llama')) {
    name = name.replace(/llama-?(\d)\.?(\d)?/i, 'Llama $1.$2');
    name = name.replace(/vision/i, 'Vision');
  }
  
  // Clean up: replace hyphens with spaces and title case if it's not a known brand
  if (name === removeProviderPrefix(modelId).split(':')[0].replace(/-?\d{4,8}$/, '')) {
     // If no special handling was applied, just do basic cleanup
     name = name.replace(/-/g, ' ');
     name = name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  return name.trim();
}
