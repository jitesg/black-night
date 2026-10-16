// ai-expand-text — POST { shortText } → { expandedText: string }
// Uses Gemini API (free tier, same GEMINI_API_KEY as ocr-extract-fields /
// voice-transcribe). Auto-discovers a working model.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_CHARS = 20_000;
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
    console.error('[ai-expand-text] GEMINI_API_KEY secret is not set');
    return new Response(JSON.stringify({ error: 'Server configuration error: API key missing' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  let shortText: string;
  try {
    const body = await req.json() as { shortText?: unknown };
    if (typeof body.shortText !== 'string' || !body.shortText.trim()) throw new Error('Missing or invalid field: shortText');
    if (body.shortText.length > MAX_CHARS) throw new Error('Text too long');
    shortText = body.shortText.trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Malformed JSON body';
    return new Response(JSON.stringify({ error: `Bad request: ${msg}` }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  const promptText =
    'Tum ek senior Uttar Pradesh Police officer ho jo naye officers ki likhi ' +
    'huyi chhoti/shorthand notes ko poori, formal police-report Hindi bhasha ' +
    'me likhte ho (jaisi FIR, case diary, ya panchnama me likhi jaati hai). ' +
    'Neeche di gayi notes ko poore, vyakaran-sahi, third-person aupcharik Hindi ' +
    'vaakyon me expand karo. SIRF diye gaye facts use karo — koi naya fact, ' +
    'naam, tareekh, ya sankhya apni taraf se mat jodo. Agar kuch English me ' +
    'likha ho to use bhi formal Hindi me dhaalo, jab tak wo koi fixed term/naam ' +
    'na ho. Sirf expanded paragraph return karo — koi extra comment, heading, ' +
    'ya quotation marks nahi.\n\n' +
    `Notes:\n${shortText}`;

  const requestBody = { contents: [{ parts: [{ text: promptText }] }] };

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
    console.error(`[ai-expand-text] Gemini API error ${status}`);
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
  const expandedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

  return new Response(JSON.stringify({ expandedText }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
});
