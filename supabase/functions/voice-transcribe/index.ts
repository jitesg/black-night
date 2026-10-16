// voice-transcribe — POST { audioBase64, mimeType } → { text: string }
// Uses Gemini API (free tier, same GEMINI_API_KEY as ocr-extract-fields).
// Auto-discovers a working model (self-heals if Google renames models).

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_MIME = new Set([
  'audio/m4a',
  'audio/mp4',
  'audio/aac',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/x-m4a',
]);

const MAX_BASE64_CHARS = 12_000_000; // ~9MB decoded — a few minutes of speech

const MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest'];

async function callGemini(apiKey: string, model: string, body: unknown): Promise<Response> {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('[voice-transcribe] GEMINI_API_KEY secret is not set');
    return new Response(JSON.stringify({ error: 'Server configuration error: API key missing' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  let audioBase64: string, mimeType: string;
  try {
    const body = await req.json() as { audioBase64?: unknown; mimeType?: unknown };
    if (typeof body.audioBase64 !== 'string' || !body.audioBase64.trim()) throw new Error('Missing or invalid field: audioBase64');
    if (body.audioBase64.length > MAX_BASE64_CHARS) throw new Error('Audio too large');
    if (typeof body.mimeType !== 'string' || !ALLOWED_MIME.has(body.mimeType)) throw new Error(`Missing or unsupported mimeType (allowed: ${[...ALLOWED_MIME].join(', ')})`);
    audioBase64 = body.audioBase64.trim();
    mimeType = body.mimeType;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Malformed JSON body';
    return new Response(JSON.stringify({ error: `Bad request: ${msg}` }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  const promptText =
    'Is audio recording ko sunkar Hindi ya English (jo bhi bola gaya ho) me ' +
    'shabd-ba-shabd (word for word) likh do. Ye ek police officer ki dictation hai ' +
    '(FIR, case diary, ya report ke liye). Sirf jo bola gaya hai wahi likho — koi ' +
    'apni taraf se add ya summarize mat karo. Agar audio me kuch samajh na aaye ya ' +
    'khaali ho, khaali string "" return karo. Sirf transcribed text return karo, ' +
    'koi extra comment ya quotation marks nahi.';

  const requestBody = {
    contents: [{ parts: [{ text: promptText }, { inline_data: { mime_type: mimeType, data: audioBase64 } }] }],
  };

  const candidateModels = MODELS;
  let geminiRes: Response | null = null;
  let lastStatus = 0;
  for (const candidate of candidateModels) {
    try {
      const res = await callGemini(apiKey, candidate, requestBody);
      if (res.ok) {
        geminiRes = res;
        break;
      }
      lastStatus = res.status;
      if (res.status !== 404 && res.status !== 503) {
        geminiRes = res;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!geminiRes) {
    return new Response(JSON.stringify({ error: `Gemini API error: ${lastStatus || 'unreachable'}` }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  if (!geminiRes.ok) {
    const status = geminiRes.status;
    console.error(`[voice-transcribe] Gemini API error ${status}`);
    const friendly = status === 429
      ? 'Gemini free-tier rate limit reached — please try again shortly'
      : status === 503
        ? 'Gemini is temporarily overloaded — please try again in a moment'
        : `Gemini API error: ${status}`;
    return new Response(JSON.stringify({ error: friendly }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  interface GeminiPart { text?: string }
  interface GeminiCandidate { content?: { parts?: GeminiPart[] } }
  interface GeminiResponse { candidates?: GeminiCandidate[] }

  const data = await geminiRes.json() as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

  return new Response(JSON.stringify({ text }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
});
