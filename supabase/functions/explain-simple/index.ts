/**
 * explain-simple — POST { title, sectionText, category? }
 * Calls Gemini to produce a plain-Hindi explanation of a BNS/SOP/
 * Circular/Court Judgment entry for a Sub-Inspector audience.
 * Returns { explanation: string } on success.
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest'];

const CATEGORY_LABEL: Record<string, string> = {
  'Law': 'BNS/BNSS/BSA ka legal section',
  'SOP': 'Standard Operating Procedure (SOP)',
  'Circular': 'department ka circular/order',
  'Court Judgment': 'adalat ka judgment/case law',
};

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
    console.error('[explain-simple] GEMINI_API_KEY secret is not set');
    return new Response(JSON.stringify({ error: 'Server configuration error: API key missing' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
  let title: string, sectionText: string, category: string;
  try {
    const body = await req.json() as { title?: unknown; sectionText?: unknown; category?: unknown };
    if (typeof body.title !== 'string' || !body.title.trim()) throw new Error('Missing or invalid field: title');
    if (typeof body.sectionText !== 'string' || !body.sectionText.trim()) throw new Error('Missing or invalid field: sectionText');
    title = body.title.trim();
    sectionText = body.sectionText.trim().slice(0, 8000);
    category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'Law';
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Malformed JSON body';
    return new Response(JSON.stringify({ error: `Bad request: ${msg}` }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
  const catLabel = CATEGORY_LABEL[category] ?? 'document';
  const systemPrompt =
    `Tum ek police training assistant ho. Neeche diya gaya ${catLabel} hai. ` +
    'Ise ek Sub-Inspector ke liye saral, rozmarra ki Hindi mein samjhao — legal jargon hata do, 2-4 chhote vaakya mein. ' +
    'Sirf yeh batao: (1) yeh kis situation par lagu hota hai, (2) kya saza/nirdesh hai. ' +
    'Kanuni sateekta na khona, lekin bhasha aam bolchaal jaisi ho.';
  const fullPrompt = `${systemPrompt}\n\nSection: ${title}\n\n${sectionText}`;
  const candidateModels = MODELS;
  let geminiRes: Response | null = null;
  let lastStatus = 0;
  for (const candidate of candidateModels) {
    try {
      const res = await callGemini(apiKey, candidate, {
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { maxOutputTokens: 512 },
      });
      if (res.ok) { geminiRes = res; break; }
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
  const explanation = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  if (!explanation) {
    return new Response(JSON.stringify({ error: 'Empty response from AI model' }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({ explanation }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
});
