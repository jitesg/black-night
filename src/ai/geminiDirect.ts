/**
 * geminiDirect.ts — call Google Gemini straight from the phone with the
 * officer's own free API key (aistudio.google.com → "Get API key").
 *
 * Why: the shared server function (Supabase `ai-copilot-provider`) is managed
 * outside this repo and cannot be fixed or redeployed from here; when it fails
 * the Copilot silently fell back to the offline answer. With a key saved in
 * Settings → AI सहायक the Copilot talks to Gemini directly.
 *
 * - The model is picked from the account's own model list (ListModels), so a
 *   renamed / retired model never breaks it; result cached for the session.
 * - All text parts of the answer are joined (thinking models can return
 *   several parts; reading only parts[0] gave empty / cut answers).
 * - Errors come back as short Hindi reasons for the chat.
 * The key stays on this phone (expo-sqlite localStorage, not in backups).
 */

import 'expo-sqlite/localStorage/install';

const KEY_STORAGE = 'investsuite:gemini_api_key';
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

declare const localStorage: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } | undefined;

export function getGeminiKey(): string {
  try { return (typeof localStorage !== 'undefined' && localStorage?.getItem(KEY_STORAGE)) || ''; } catch { return ''; }
}

export function setGeminiKey(key: string): void {
  try {
    const k = key.trim();
    if (typeof localStorage === 'undefined' || !localStorage) return;
    if (k) localStorage.setItem(KEY_STORAGE, k); else localStorage.removeItem(KEY_STORAGE);
    cachedModel = null;
    cachedModels = null;
  } catch { /* storage unavailable */ }
}

export const hasGeminiKey = (): boolean => getGeminiKey().length > 0;

let cachedModel: string | null = null;
let cachedModels: string[] | null = null;

/** Rank "flash" models: newest version first, plain flash before lite. */
function rankModel(name: string): number {
  const n = name.replace(/^models\//, '');
  const v = /gemini-(\d+(?:\.\d+)?)/.exec(n);
  let score = v ? parseFloat(v[1]) * 100 : 0;
  if (n === 'gemini-flash-latest') score = 100000;
  if (/lite/.test(n)) score -= 50;
  if (/preview|exp/.test(n)) score -= 20;
  return score;
}

/** Models to try, best first (the one that last worked leads). */
async function modelCandidates(key: string, signal?: AbortSignal): Promise<string[]> {
  if (!cachedModels) {
    let names: string[] = [];
    try {
      const res = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': key }, signal });
      if (res.ok) {
        const json = await res.json() as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
        names = (json.models ?? [])
          .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
          .map((m) => m.name.replace(/^models\//, ''))
          .filter((n) => /flash/.test(n) && !/image|tts|audio|live|embedding|vision|thinking-exp/.test(n));
        names.sort((a, b) => rankModel(b) - rankModel(a));
      } else if (res.status === 400 || res.status === 401 || res.status === 403) {
        throw new Error(await errorReason(res));
      }
    } catch (e) {
      if (e instanceof Error && /API key|key|अनुमति/.test(e.message)) throw e;
    }
    cachedModels = names.length ? names : ['gemini-flash-latest'];
  }
  const list = cachedModel ? [cachedModel, ...cachedModels.filter((m) => m !== cachedModel)] : cachedModels;
  return list.slice(0, 3);
}

async function errorReason(res: Response): Promise<string> {
  let msg = '';
  try { msg = ((await res.json()) as { error?: { message?: string } }).error?.message ?? ''; } catch { /* no body */ }
  if (res.status === 429) return 'Gemini की मुफ़्त सीमा (free limit) अभी पूरी हो गई है — थोड़ी देर बाद पूछें';
  if (res.status === 400 && /api key/i.test(msg)) return 'Gemini API key गलत है — Settings → AI सहायक में सही key डालें';
  if (res.status === 401 || res.status === 403) return 'Gemini API key को अनुमति नहीं है — key जाँचें';
  if (res.status === 503) return 'Gemini अभी व्यस्त है — थोड़ी देर बाद पूछें';
  return `Gemini त्रुटि ${res.status}${msg ? `: ${msg.slice(0, 120)}` : ''}`;
}

export const COPILOT_SYSTEM_PROMPT =
  'तुम "AI Copilot" हो — उत्तर प्रदेश पुलिस के विवेचकों के लिए InvestSuite app के अंदर विवेचना सहायक। ' +
  'नीचे केस / कानून का context (अगर हो) और पिछली बातचीत दी जाएगी, फिर अधिकारी का सवाल। ' +
  'सिर्फ़ सुझाव और जानकारी दो — तुम खुद कोई record बनाते, बदलते या हटाते नहीं, और कभी मत कहो कि तुमने कोई काम कर दिया। ' +
  'जवाब हिंदी में, साफ़, सीधा और काम का दो; ज़रूरत हो तो छोटे बिंदुओं में। धारा बताते समय अधिनियम (BNS / BNSS / BSA आदि) ज़रूर लिखो। ' +
  'जो context में या पक्का पता न हो, साफ़ कहो कि पता नहीं — कोई तथ्य, धारा या निर्णय अपनी तरफ़ से मत गढ़ो।';

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

/** Ask Gemini. Throws Error(Hindi reason) on failure. */
export async function askGemini(opts: {
  prompt: string; context?: string; history?: ChatTurn[]; maxTokens?: number; timeoutMs?: number;
}): Promise<string> {
  const key = getGeminiKey();
  if (!key) throw new Error('Gemini API key नहीं है');
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = setTimeout(() => ctrl?.abort(), opts.timeoutMs ?? 45000);
  try {
    const contents = [
      ...(opts.history ?? []).slice(-6).map((t) => ({
        role: t.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: t.content.slice(0, 1500) }],
      })),
      {
        role: 'user',
        parts: [{ text: opts.context?.trim() ? `── Context ──\n${opts.context.slice(0, 12000)}\n\n── सवाल ──\n${opts.prompt}` : opts.prompt }],
      },
    ];
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: COPILOT_SYSTEM_PROMPT }] },
      contents,
      // Room for the model's own "thinking" plus a full Hindi answer.
      generationConfig: { maxOutputTokens: Math.max(opts.maxTokens ?? 0, 4096), temperature: 0.3 },
    });
    // Free-tier limits are per model: on "limit reached" / "not found" / "busy" try the next model.
    let res: Response | null = null;
    for (const model of await modelCandidates(key, ctrl?.signal)) {
      res = await fetch(`${BASE}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
        signal: ctrl?.signal,
        body,
      });
      if (res.ok) { cachedModel = model; break; }
      if (![404, 429, 503].includes(res.status)) break;
    }
    if (!res) throw new Error('Gemini model नहीं मिला');
    if (!res.ok) throw new Error(await errorReason(res));
    const json = await res.json() as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };
    if (json.promptFeedback?.blockReason) throw new Error('Gemini ने यह सवाल रोक दिया (सुरक्षा नियम) — शब्द बदलकर पूछें');
    const cand = json.candidates?.[0];
    const text = (cand?.content?.parts ?? []).filter((p) => !p.thought && p.text).map((p) => p.text).join('').trim();
    if (!text) throw new Error(cand?.finishReason === 'SAFETY' ? 'Gemini ने जवाब रोक दिया (सुरक्षा नियम)' : 'Gemini से खाली जवाब मिला');
    return cand?.finishReason === 'MAX_TOKENS' ? `${text}…` : text;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('Gemini ने समय पर जवाब नहीं दिया (इंटरनेट धीमा?)');
    if (e instanceof TypeError) throw new Error('इंटरनेट से जुड़ नहीं पाए');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Quick check for the Settings screen: returns the model name or throws. */
export async function testGeminiKey(key: string): Promise<string> {
  const old = getGeminiKey();
  setGeminiKey(key);
  try {
    await askGemini({ prompt: 'सिर्फ़ "ठीक है" लिखो।', maxTokens: 64, timeoutMs: 30000 });
    return cachedModel ?? '';
  } catch (e) {
    setGeminiKey(old);
    throw e;
  }
}
