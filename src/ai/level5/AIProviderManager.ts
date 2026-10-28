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
import { askGemini, hasGeminiKey } from '../geminiDirect';

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
        const start = Date.now();
        // The officer's own Gemini key (Settings → AI सहायक): talk to Gemini directly.
        if (hasGeminiKey()) {
          const content = await askGemini({
            prompt: req.prompt, context: req.context, history: req.history, maxTokens: req.maxTokens,
            timeoutMs: Math.max(primary.timeoutMs ?? 0, 45000),
          });
          return { content, provider: primary.type, usedFallback: false, latencyMs: Date.now() - start, confidence: 85, isOffline: false };
        }
        if (!primary.endpoint) throw new Error('ऑनलाइन AI सेट नहीं है');
        const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
        let res: Response;
        try {
          res = await Promise.race([
            fetch(primary.endpoint, {
              method:  'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              },
              body:    JSON.stringify({ prompt: req.prompt, context: req.context, max_tokens: Math.max(req.maxTokens ?? 0, 1024) }),
            }),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('ऑनलाइन AI ने समय पर जवाब नहीं दिया')), Math.max(primary.timeoutMs ?? 0, 40000))),
          ]);
        } catch (e) {
          throw new Error(e instanceof Error && /समय/.test(e.message) ? e.message : 'ऑनलाइन AI सर्वर से जुड़ नहीं पाए');
        }
        let json: Record<string, unknown> = {};
        try { json = await res.json() as Record<string, unknown>; } catch { /* not JSON */ }
        // A server error used to come back as an empty "answer" and was shown as if offline.
        if (!res.ok || typeof json.error === 'string') {
          const msg = String(json.error ?? '');
          throw new Error(/429|rate limit/i.test(msg) ? 'Gemini की मुफ़्त सीमा अभी पूरी हो गई है'
            : /API key missing/i.test(msg) ? 'सर्वर पर Gemini key सेट नहीं है'
            : `ऑनलाइन AI त्रुटि ${res.status}${msg ? ` (${msg.slice(0, 80)})` : ''}`);
        }
        const content = typeof json.response === 'string' ? json.response.trim() : '';
        if (!content) throw new Error('ऑनलाइन AI से खाली जवाब मिला');
        return {
          content,
          provider:     primary.type,
          usedFallback: false,
          latencyMs:    Date.now() - start,
          confidence:   85,
          isOffline:    false,
        };
      }

      if (primary.type === 'local-llm') {
        // Placeholder for on-device model integration (e.g. llama.cpp WebAssembly)
        return offlineRulesInference(req);
      }

      return offlineRulesInference(req);
    } catch (err) {
      // Fallback (the reason travels with it so the Copilot can say why)
      const error = err instanceof Error ? err.message : String(err);
      const fallbackType = primary.fallbackProvider ?? 'offline-rules';
      if (fallbackType === 'offline-rules') return { ...offlineRulesInference(req), usedFallback: true, error };

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
