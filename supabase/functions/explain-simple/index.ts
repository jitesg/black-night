/**
 * explain-simple — POST { title, sectionText, category? }
 * Calls Anthropic Claude to produce a plain-Hindi explanation of a BNS/SOP/
 * Circular/Court Judgment entry for a Sub-Inspector audience.
 * Returns { explanation: string } on success.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Per-category label used in the system prompt
const CATEGORY_LABEL: Record<string, string> = {
  'Law':           'BNS/BNSS/BSA ka legal section',
  'SOP':           'Standard Operating Procedure (SOP)',
  'Circular':      'department ka circular/order',
  'Court Judgment':'adalat ka judgment/case law',
};

Deno.serve(async (req: Request) => {
  // ── CORS pre-flight ──────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // ── API key guard ────────────────────────────────────────────────────────
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.error('[explain-simple] ANTHROPIC_API_KEY secret is not set');
    return new Response(
      JSON.stringify({ error: 'Server configuration error: API key missing' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // ── Parse + validate body ────────────────────────────────────────────────
  let title: string;
  let sectionText: string;
  let category: string;
  try {
    const body = await req.json() as { title?: unknown; sectionText?: unknown; category?: unknown };
    if (typeof body.title !== 'string' || !body.title.trim()) {
      throw new Error('Missing or invalid field: title');
    }
    if (typeof body.sectionText !== 'string' || !body.sectionText.trim()) {
      throw new Error('Missing or invalid field: sectionText');
    }
    title       = body.title.trim();
    sectionText = body.sectionText.trim();
    category    = typeof body.category === 'string' && body.category.trim()
      ? body.category.trim()
      : 'Law';
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Malformed JSON body';
    return new Response(
      JSON.stringify({ error: `Bad request: ${msg}` }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // ── Build category-aware system prompt ───────────────────────────────────
  const catLabel = CATEGORY_LABEL[category] ?? 'document';
  const systemPrompt =
    `Tum ek police training assistant ho. Neeche diya gaya ${catLabel} hai. ` +
    'Ise ek Sub-Inspector ke liye saral, rozmarra ki Hindi mein samjhao — legal jargon hata do, 2-4 chhote vaakya mein. ' +
    'Sirf yeh batao: (1) yeh kis situation par lagu hota hai, (2) kya saza/nirdesh hai. ' +
    'Kanuni sateekta na khona, lekin bhasha aam bolchaal jaisi ho.';

  const userMessage = `Section: ${title}\n\n${sectionText}`;

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[explain-simple] Anthropic fetch error:', msg);
    return new Response(
      JSON.stringify({ error: `Anthropic API unreachable: ${msg}` }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  if (!anthropicRes.ok) {
    const errBody = await anthropicRes.text().catch(() => '');
    console.error(`[explain-simple] Anthropic API error ${anthropicRes.status}:`, errBody);

    // ─────────────────────────────────────────────────────────────────────────
    // TEMPORARY DEBUG — remove before production release.
    // Echoes the raw Anthropic error body back to the client for debugging.
    // SAFETY: errBody contains only Anthropic's JSON error — no API key values.
    // TODO: revert once root cause is confirmed; uncomment production block below.
    return new Response(
      JSON.stringify({
        error: `Anthropic API error: ${anthropicRes.status}`,
        debug_anthropic_status: anthropicRes.status,
        debug_anthropic_body: errBody,
      }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
    // END TEMPORARY DEBUG — restore for production:
    // return new Response(
    //   JSON.stringify({ error: `Anthropic API error: ${anthropicRes.status}` }),
    //   { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    // );
    // ─────────────────────────────────────────────────────────────────────────
  }

  // ── Extract text from response ───────────────────────────────────────────
  interface AnthropicContent { type: string; text?: string }
  interface AnthropicResponse { content: AnthropicContent[] }
  const data = await anthropicRes.json() as AnthropicResponse;
  const explanation = data.content
    ?.filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('')
    .trim();

  if (!explanation) {
    console.error('[explain-simple] Empty explanation from Anthropic');
    return new Response(
      JSON.stringify({ error: 'Empty response from AI model' }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({ explanation }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  );
});
