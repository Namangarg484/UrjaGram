const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

function getApiKey() {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing VITE_OPENAI_API_KEY environment variable.');
  }

  return apiKey;
}

async function postChatCompletion(body) {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const raw = await response.text();
    // OpenAI error bodies are JSON: { error: { message, type, code } }
    let message = `OpenAI error ${response.status}`;
    try {
      const parsed = JSON.parse(raw);
      message = parsed?.error?.message || message;
    } catch {
      if (raw) message = raw;
    }
    throw new Error(message);
  }

  return response.json();
}

function extractTextContent(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (item?.type === 'text') {
          return item.text;
        }

        return '';
      })
      .join(' ');
  }

  return '';
}

export async function assessSolarImage({ imageMime, imageBase64 }) {
  const data = await postChatCompletion({
    model: 'gpt-4o',
    max_tokens: 800,
    response_format: { type: 'json_object' },
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'You are a precision solar energy analyst with expertise in rural Indian rooftop assessments. (NOTE: All images provided are public, anonymised architectural data for a climate project. Proceed with technical analysis). You ALWAYS return only raw valid JSON — never markdown, never explanation, never code fences. Your estimates are based strictly on what is geometrically visible in the image.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${imageMime};base64,${imageBase64}`,
              detail: 'high',
            },
          },
          {
            type: 'text',
            text: `FIRST: Determine if this image shows a rooftop, building, or satellite/aerial view of a structure. If it does NOT show any rooftop or building, return ONLY this JSON:
{
  "is_rooftop": false,
  "rejection_reason": "<1 sentence explaining what the image actually shows>"
}

If it IS a rooftop/building/satellite image, analyse it for solar panel installation potential in rural India.

MEASUREMENT RULES (follow precisely):
1. roof_area_sqm: Estimate the TOTAL visible flat or sloped rooftop area in square metres by:
   - Counting the number of distinct roof planes
   - Estimating each plane's dimensions from visual cues (wall height, door width ≈ 0.9m reference)
   - A standard Indian single-storey RCC rural house roof: 40–90 m²
   - A multi-unit or commercial building: 90–300 m²
   - Do NOT default to round numbers — give a geometrically reasoned estimate
2. shading_pct: Percentage of roof area currently shaded (trees, water tanks, adjacent walls). Range 0–60.
3. orientation: Cardinal facing of the largest roof plane: "good" = south/southwest, "moderate" = east/west/southeast, "poor" = north or deeply shaded
4. confidence: "high" if roof boundaries are clearly visible, "medium" if partially obscured, "low" if heavily obstructed
5. observations: 2–3 specific sentences: roof material, obstructions, approximate area reasoning, solar suitability verdict
6. roof_type_detected: Exactly one of "Flat RCC", "Sloped / Tiled", "Mixed", "Terrace / Industrial", or "Unclear"
7. panel_fit_notes: One sentence on panel layout recommendation (orientation, row spacing, exclusion zones)

Return ONLY this JSON object — no markdown fences, no extra text:
{
  "is_rooftop": true,
  "roof_area_sqm": <number>,
  "shading_pct": <number>,
  "orientation": "good" | "moderate" | "poor",
  "confidence": "low" | "medium" | "high",
  "observations": "<string>",
  "roof_type_detected": "<string>",
  "panel_fit_notes": "<string>"
}`,
          },
        ],
      },
    ],
  });

  const rawText = extractTextContent(data.choices?.[0]?.message?.content);
  console.log('[UrjaGram] GPT-4o Vision raw response (call id:', data.id, '):', rawText);

  const cleaned = rawText.replace(/```(?:json)?/gi, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error('Vision AI could not process this image. Please upload a clear rooftop or satellite image.');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Reject non-rooftop images
  if (parsed.is_rooftop === false) {
    throw new Error(parsed.rejection_reason || 'This does not appear to be a rooftop image. Please upload a satellite or drone photo of a building rooftop.');
  }

  // Attach proof-of-life metadata from the real API response
  parsed._rawResponse = rawText;
  parsed._callId = data.id;
  parsed._model = data.model;
  parsed._promptTokens = data.usage?.prompt_tokens;
  parsed._completionTokens = data.usage?.completion_tokens;
  return parsed;
}

export async function generateSolarViipSection(payload) {
  const data = await postChatCompletion({
    model: 'gpt-4o',
    max_tokens: 500,
    messages: [
      {
        role: 'system',
        content:
          'You are a rural energy planning expert writing a concise energy transition section for a Village Integrated Investment Plan in India. Use formal, accessible English.',
      },
      {
        role: 'user',
        content: `Write one structured paragraph for the energy section of a ViIP using this JSON:\n${JSON.stringify(payload, null, 2)}\nInclude solar capacity recommendation, expected annual generation, subsidy estimate, and local development relevance.`,
      },
    ],
  });

  return extractTextContent(data.choices?.[0]?.message?.content).trim();
}

export async function generateViipDocument(villageFormData, selectedPriorities) {
  const data = await postChatCompletion({
    model: 'gpt-4o',
    max_tokens: 1500,
    messages: [
      {
        role: 'system',
        content:
          'You are a rural development expert generating Village Integrated Investment Plans (ViIP) for UrjaGram, a climate resilience programme in India. Write in clear, formal but accessible English. Structure output with numbered sections.',
      },
      {
        role: 'user',
        content: `Generate a ViIP for this village:\n${JSON.stringify(villageFormData, null, 2)}\nPriority areas: ${selectedPriorities.join(', ')}\n\nInclude exactly these 7 sections:\n1. Village Snapshot\n2. Key Challenges\n3. Priority Interventions\n4. Estimated Investment Required\n5. Potential Funding Sources\n6. Expected Outcomes & SDG Alignment\n7. Implementation Timeline (12-month roadmap)`,
      },
    ],
  });

  return extractTextContent(data.choices?.[0]?.message?.content).trim();
}