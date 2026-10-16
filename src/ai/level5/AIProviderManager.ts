/**
 * AIProviderManager.ts
 * Abstract AI provider layer. All AI modules interact via this manager;
 * none depend directly on a specific LLM provider.
 *
 * Supports: Cloud LLM, Local LLM, Hybrid, Offline-Rules (pure local inference).
 * Switching providers requires no business logic changes.
 *
 * SAFETY: Read-only. Never modifies investigation records.
 */

import type {
  AIProviderConfig,
  AIProviderRequest,
  AIProviderResponse,
  AIProviderType,
} from './L5Types';

// ── Default offline-rules provider ────────────────────────────────────────────
// This is the always-available fallback: it produces structured reasoning
// from already-computed intelligence engine outputs (no network required).

function offlineRulesInference(req: AIProviderRequest): AIProviderResponse {
  // Strip down prompt to a plain text response skeleton.
  // In production this is where a local ONNX / llama.cpp model would run.
  const content = `[Offline Rules] ${req.prompt.slice(0, 200)}…\n\n` +
    `Advisory generated from local investigation context. ` +
    `Connect to a cloud provider for enhanced analysis.`;
  return {
    content,
    provider:    'offline-rules',
    usedFallback: true,
    latencyMs:   0,
    confidence:  55,
    isOffline:   true,
  };
}

// ── Manager ───────────────────────────────────────────────────────────────────

export class AIProviderManager {
  private static configs: AIProviderConfig[] = [
    {
      type:        'offline-rules',
      name:        'Offline Rules Engine',
      isAvailable: true,
      isDefault:   true,
      timeoutMs:   100,
    },
  ];

  /** Register or update a provider configuration. */
  static registerProvider(config: AIProviderConfig): void {
    const idx = AIProviderManager.configs.findIndex((c) => c.type === config.type);
    if (idx >= 0) {
      AIProviderManager.configs[idx] = config;
    } else {
      AIProviderManager.configs.push(config);
    }
  }

  /** Get all registered providers. */
  static getProviders(): AIProviderConfig[] {
    return [...AIProviderManager.configs];
  }

  /** Get the active default provider. */
  static getDefaultProvider(): AIProviderConfig {
    return (
      AIProviderManager.configs.find((c) => c.isDefault && c.isAvailable) ??
      AIProviderManager.configs.find((c) => c.type === 'offline-rules')!
    );
  }

  /** Set which provider type is default. */
  static setDefaultProvider(type: AIProviderType): void {
    for (const c of AIProviderManager.configs) {
      c.isDefault = c.type === type;
    }
  }

  /** Mark a provider as available / unavailable (e.g. network changed). */
  static setProviderAvailability(type: AIProviderType, available: boolean): void {
    const cfg = AIProviderManager.configs.find((c) => c.type === type);
    if (cfg) cfg.isAvailable = available;
  }

  /**
   * Execute a request through the configured provider.
   * Falls back to offline-rules if primary fails.
   */
  static async execute(req: AIProviderRequest): Promise<AIProviderResponse> {
    const primary = AIProviderManager.getDefaultProvider();

    try {
      if (primary.type === 'offline-rules') {
        return offlineRulesInference(req);
      }

      if (primary.type === 'cloud-llm' || primary.type === 'hybrid') {
        if (!primary.endpoint) throw new Error('Cloud LLM endpoint not configured.');
        const start = Date.now();
        const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
        const res   = await Promise.race([
          fetch(primary.endpoint, {
            method:  'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body:    JSON.stringify({ prompt: req.prompt, context: req.context, max_tokens: req.maxTokens ?? 512 }),
          }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Timeout')), primary.timeoutMs)),
        ]);
        const json    = await (res as Response).json();
        const latency = Date.now() - start;
        return {
          content:      (json as Record<string,unknown>).response as string ?? '',
          provider:     primary.type,
          usedFallback: false,
          latencyMs:    latency,
          confidence:   85,
          isOffline:    false,
        };
      }

      if (primary.type === 'local-llm') {
        // Placeholder for on-device model integration (e.g. llama.cpp WebAssembly)
        return offlineRulesInference(req);
      }

      return offlineRulesInference(req);
    } catch {
      // Fallback
      const fallbackType = primary.fallbackProvider ?? 'offline-rules';
      if (fallbackType === 'offline-rules') return offlineRulesInference(req);

      const fallbackCfg = AIProviderManager.configs.find(
        (c) => c.type === fallbackType && c.isAvailable
      );
      if (!fallbackCfg) return offlineRulesInference(req);

      const fallback = await AIProviderManager.execute({ ...req });
      return { ...fallback, usedFallback: true };
    }
  }

  /** Check whether any online provider is available. */
  static hasOnlineProvider(): boolean {
    return AIProviderManager.configs.some(
      (c) => c.isAvailable && (c.type === 'cloud-llm' || c.type === 'hybrid')
    );
  }
}
