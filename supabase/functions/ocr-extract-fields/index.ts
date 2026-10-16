// ocr-extract-fields — POST { imageBase64, mimeType, fields } → { fields: Record<string,string> }
// Uses Gemini API (free tier). Setup: get key at aistudio.google.com/apikey,
// add as Supabase secret GEMINI_API_KEY. Auto-discovers a working model
// (self-heals if Google renames/retires model strings).

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BASE64_CHARS = 8_000_000;

interface FieldSpec { key: string; label: string }

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
    console.error('[ocr-extract-fields] GEMINI_API_KEY secret is not set');
    return new Response(JSON.stringify({ error: 'Server configuration error: API key missing' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  let imageBase64: string, mimeType: string, fields: FieldSpec[];
  try {
    const body = await req.json() as { imageBase64?: unknown; mimeType?: unknown; fields?: unknown };
    if (typeof body.imageBase64 !== 'string' || !body.imageBase64.trim()) throw new Error('Missing or invalid field: imageBase64');
    if (body.imageBase64.length > MAX_BASE64_CHARS) throw new Error('Image too large');
    if (typeof body.mimeType !== 'string' || !ALLOWED_MIME.has(body.mimeType)) throw new Error(`Missing or unsupported mimeType (allowed: ${[...ALLOWED_MIME].join(', ')})`);
    if (!Array.isArray(body.fields) || body.fields.length === 0) throw new Error('Missing or empty field: fields');
    for (const f of body.fields) {
      if (typeof f !== 'object' || f === null || typeof (f as FieldSpec).key !== 'string' || typeof (f as FieldSpec).label !== 'string') {
        throw new Error('Each entry in fields must be { key: string; label: string }');
      }
    }
    imageBase64 = body.imageBase64.trim();
    mimeType = body.mimeType;
    fields = body.fields as FieldSpec[];
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Malformed JSON body';
    return new Response(JSON.stringify({ error: `Bad request: ${msg}` }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  const fieldList = fields.map((f) => `- "${f.key}": ${f.label}`).join('\n');
  const promptText =
    'Tum ek OCR aur data-extraction assistant ho, jo Uttar Pradesh Police ke liye ' +
    'scanned documents (ID cards, likhe hue notes, forms) padhta hai. Image me jo ' +
    'Hindi ya English text dikhta hai use padho, aur neeche diye gaye fields ke liye ' +
    'sahi values nikaalo. Agar koi field image me nahi milta, uski value khaali ' +
    'string "" rakho — kabhi guess mat karo. Naam aur pata jaise Hindi fields ki ' +
    'spelling wahi rakho jo image me likhi hai.\n\n' +
    `Fields nikaalni hain:\n${fieldList}\n\n` +
    `Sirf ek JSON object return karo, is shape me: {${fields.map((f) => `"${f.key}": "..."`).join(', ')}}`;

  const requestBody = {
    contents: [{ parts: [{ text: promptText }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
    generationConfig: { response_mime_type: 'application/json' },
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
    console.error(`[ocr-extract-fields] Gemini API error ${status}`);
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
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

  if (!raw) {
    console.error('[ocr-extract-fields] Empty response from Gemini');
    return new Response(JSON.stringify({ error: 'Empty response from AI model' }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  let extracted: Record<string, unknown>;
  try {
    extracted = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.error('[ocr-extract-fields] Could not parse model output as JSON:', raw.slice(0, 300));
    return new Response(JSON.stringify({ error: 'Could not parse extracted data' }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  const resultFields: Record<string, string> = {};
  for (const f of fields) {
    const v = extracted[f.key];
    resultFields[f.key] = typeof v === 'string' ? v.trim() : '';
  }

  return new Response(JSON.stringify({ fields: resultFields }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
});
