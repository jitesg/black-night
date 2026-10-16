/**
 * ocrService.ts — Client-side service to interact with `ocr-extract-fields` Supabase Edge Function.
 * Sends base64 image data and a list of target field keys/labels to extract Hindi/English text.
 */

import { supabase } from '@/client/supabase';

export interface FieldSpec {
  key: string;
  label: string;
}

export interface OcrExtractResponse {
  fields?: Record<string, string>;
  error?: string;
  isRateLimit?: boolean;
  isMissingKey?: boolean;
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BASE64_CHARS = 8_000_000;

/**
 * Normalizes MIME type from image extension or picker result
 */
export function normalizeMimeType(uri: string, rawMime?: string | null): string {
  if (rawMime && ALLOWED_MIME.has(rawMime.toLowerCase())) {
    return rawMime.toLowerCase();
  }
  const cleanUri = uri.split('?')[0].toLowerCase();
  if (cleanUri.endsWith('.png')) return 'image/png';
  if (cleanUri.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/**
 * Extracts form field values from a base64 encoded image using Gemini through the Edge Function.
 */
export async function extractFieldsFromImage(
  imageBase64: string,
  mimeType: string,
  fields: FieldSpec[]
): Promise<OcrExtractResponse> {
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '').trim();

  if (!cleanBase64) {
    return { error: 'No image data provided for OCR extraction.' };
  }

  if (cleanBase64.length > MAX_BASE64_CHARS) {
    return { error: 'Image exceeds maximum size (8MB). Please choose a smaller image.' };
  }

  const normalizedMime = ALLOWED_MIME.has(mimeType) ? mimeType : 'image/jpeg';

  try {
    const { data, error: fnError } = await supabase.functions.invoke('ocr-extract-fields', {
      body: {
        imageBase64: cleanBase64,
        mimeType: normalizedMime,
        fields,
      },
    });

    if (fnError) {
      let errorMsg = fnError.message || 'Failed to process document with OCR.';
      let isRateLimit = false;
      let isMissingKey = false;

      // Extract details if available from response body
      const ctx = (fnError as { context?: unknown }).context;
      if (ctx && typeof (ctx as { json?: unknown }).json === 'function') {
        try {
          const errBody = await (ctx as { json: () => Promise<{ error?: string }> }).json();
          if (errBody?.error) {
            errorMsg = errBody.error;
          }
        } catch {
          // ignore json parse failure
        }
      }

      if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('rate limit')) {
        isRateLimit = true;
      }
      if (errorMsg.toLowerCase().includes('api key missing') || errorMsg.includes('GEMINI_API_KEY')) {
        isMissingKey = true;
      }

      return {
        error: errorMsg,
        isRateLimit,
        isMissingKey,
      };
    }

    if (data && typeof data.fields === 'object') {
      return { fields: data.fields as Record<string, string> };
    }

    return { error: 'Unexpected response from OCR extraction service.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error during OCR extraction.';
    return { error: message };
  }
}
