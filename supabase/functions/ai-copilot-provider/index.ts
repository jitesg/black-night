// ai-copilot-provider — POST { prompt, context, max_tokens } → { response: string }
// Matches the exact contract AIProviderManager.execute() already calls for
// type 'cloud-llm'. Uses Gemini API (free tier, same GEMINI_API_KEY as the
// other 3 functions). Auto-discovers a working model + retries on 404.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest'];
const MAX_PROMPT_CHARS = 4000;
const MAX_CONTEXT_CHARS = 8000;

async function callGemini(apiKey: string, model: string, body: unknown) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error: API key missing' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  let prompt: string, context: string, maxTokens: number;
  try {
    const body = await req.json() as { prompt?: unknown; context?: unknown; max_tokens?: unknown };
    if (typeof body.prompt !== 'string' || !body.prompt.trim()) throw new Error('Missing field: prompt');
    prompt = body.prompt.trim().slice(0, MAX_PROMPT_CHARS);
    context = typeof body.context === 'string' ? body.context.slice(0, MAX_CONTEXT_CHARS) : '';
    maxTokens = typeof body.max_tokens === 'number' && body.max_tokens > 0 ? Math.min(body.max_tokens, 1024) : 512;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Malformed JSON body';
    return new Response(JSON.stringify({ error: `Bad request: ${msg}` }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  const systemPrompt =
    'Tum "AI Copilot" ho, Uttar Pradesh Police officers ke liye ek investigation ' +
    'assistant, InvestSuite app ke andar. Tumhe neeche case/investigation ka ' +
    'context diya jaayega (agar available ho) aur officer ka sawal. Sirf SUJHAV ' +
    'aur JAANKARI do — tum khud koi record CREATE, EDIT, ya DELETE nahi karte, ' +
    'aur kabhi ye mat kaho ki tumne koi action perform kar diya hai. Jawab Hindi ' +
    'me, chhota, seedha aur practical do (police officer field me hai, lamba ' +
    'jawab nahi padh sakta). Agar context me zaroori jaankari nahi hai, saaf ' +
    'bata do ki kya pata nahi hai — kabhi fact banao mat.';

  const fullPrompt = context
    ? `${systemPrompt}\n\n── Case Context ──\n${context}\n\n── Officer ka sawal ──\n${prompt}`
    : `${systemPrompt}\n\n── Officer ka sawal ──\n${prompt}`;

  const candidateModels = MODELS;
  let geminiRes: Response | null = null;
  let lastStatus = 0;
  for (const candidate of candidateModels) {
    try {
      const res = await callGemini(apiKey, candidate, {
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      });
      if (res.ok) {
        geminiRes = res;
        break;
      }
      lastStatus = res.status;
      if (res.status !== 404 && res.status !== 503) { geminiRes = res; break; }
    } catch { continue; }
  }

  if (!geminiRes) {
    return new Response(JSON.stringify({ error: `Gemini API error: ${lastStatus || 'unreachable'}` }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  if (!geminiRes.ok) {
    const friendly = geminiRes.status === 429
      ? 'Gemini free-tier rate limit reached — please try again shortly'
      : geminiRes.status === 503
        ? 'Gemini is temporarily overloaded — please try again in a moment'
        : `Gemini API error: ${geminiRes.status}`;
    return new Response(JSON.stringify({ error: friendly }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  interface GeminiPart { text?: string }
  interface GeminiCandidate { content?: { parts?: GeminiPart[] } }
  interface GeminiResponse { candidates?: GeminiCandidate[] }
  const data = await geminiRes.json() as GeminiResponse;
  const response = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

  return new Response(JSON.stringify({ response }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
});
