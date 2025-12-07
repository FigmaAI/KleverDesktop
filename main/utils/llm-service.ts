/**
 * LLM Service - Unified interface for LLM calls via Python/LiteLLM
 * 
 * This module provides a TypeScript interface to call the Python llm_service.py,
 * which uses LiteLLM to handle all LLM provider integrations.
 * 
 * Benefits:
 * - Single source of truth for LLM calls (Python/LiteLLM)
 * - No need to maintain provider-specific logic in TypeScript
 * - Automatic model name format handling by LiteLLM
 */

import * as path from 'path';
import { spawnBundledPython, getAppagentPath, checkVenvStatus } from './python-runtime';

/**
 * Request interface for LLM service
 */
export interface LLMServiceRequest {
  action: 'translate' | 'chat';
  text: string;
  target_lang?: string;  // Required for 'translate' action
  model: string;         // LiteLLM model name (e.g., 'openrouter/openai/gpt-4.1-mini')
  api_key?: string;
  base_url?: string;
  temperature?: number;
  max_tokens?: number;
}

/**
 * Response interface from LLM service
 */
export interface LLMServiceResponse {
  success: boolean;
  translated_text?: string;  // For 'translate' action
  content?: string;          // For 'chat' action
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: string;
}

/**
 * Call the Python LLM service
 * 
 * Uses stdin JSON mode to safely pass large texts with special characters.
 * 
 * @param request - LLM service request parameters
 * @returns Promise with LLM service response
 */
export async function callLLMService(request: LLMServiceRequest): Promise<LLMServiceResponse> {
  // Check if Python environment is ready
  const venvStatus = checkVenvStatus();
  if (!venvStatus.valid) {
    return {
      success: false,
      error: 'Python environment not available. Please run Setup Wizard.',
    };
  }

  const appagentDir = getAppagentPath();
  const scriptPath = path.join(appagentDir, 'scripts', 'llm_service.py');

  return new Promise((resolve) => {
    // Use stdin JSON mode to safely pass large texts with special characters
    const args = [
      '-u',  // Unbuffered output
      scriptPath,
      '--model', request.model,  // Model is still required as CLI arg
      '--stdin',  // Read JSON from stdin
    ];

    console.log('[llm-service] Starting Python LLM service...');

    // Spawn Python process
    const proc = spawnBundledPython(args, {
      cwd: appagentDir,
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;

    // Set timeout (60 seconds for LLM calls - translations can be slow for large texts)
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill('SIGTERM');
        console.error('[llm-service] Timeout after 60s');
        resolve({
          success: false,
          error: 'LLM service timeout (60s)',
        });
      }
    }, 60000);

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
      // Log stderr in real-time for debugging
      console.log('[llm-service] stderr:', data.toString().trim());
    });

    proc.on('close', (code) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);

      if (code !== 0) {
        console.error('[llm-service] Process exited with code:', code);
        console.error('[llm-service] stderr:', stderr);
        resolve({
          success: false,
          error: stderr || `Process exited with code ${code}`,
        });
        return;
      }

      // Parse JSON response
      try {
        const response = JSON.parse(stdout.trim());
        console.log('[llm-service] Success:', response.success);
        resolve(response);
      } catch {
        console.error('[llm-service] Failed to parse response:', stdout);
        resolve({
          success: false,
          error: 'Failed to parse LLM service response',
        });
      }
    });

    proc.on('error', (error) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      console.error('[llm-service] Process error:', error);
      resolve({
        success: false,
        error: error.message,
      });
    });

    // Send request as JSON via stdin (avoids shell escaping issues)
    const inputData = JSON.stringify({
      action: request.action,
      text: request.text,
      target_lang: request.target_lang,
      model: request.model,
      api_key: request.api_key,
      base_url: request.base_url,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
    });
    
    proc.stdin?.write(inputData);
    proc.stdin?.end();
  });
}

/**
 * Convenience function for translation
 */
export async function translateWithLLM(
  text: string,
  targetLang: string,
  model: string,
  apiKey?: string,
  baseUrl?: string
): Promise<{ success: boolean; translatedText?: string; error?: string }> {
  const response = await callLLMService({
    action: 'translate',
    text,
    target_lang: targetLang,
    model,
    api_key: apiKey,
    base_url: baseUrl,
  });

  return {
    success: response.success,
    translatedText: response.translated_text,
    error: response.error,
  };
}

