import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8787;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_API_TOKEN || '';

app.use(cors());
app.use(express.json({ limit: '5mb' }));

if (!OPENAI_API_KEY) {
  console.warn('[AI Proxy] OPENAI_API_KEY not set. External AI calls will fail with 503.');
}

app.post('/api/ai/chat', async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(503).json({ error: 'External AI not configured. Set OPENAI_API_KEY on the server.' });
    }

    const { prompt, model = 'gpt-4o-mini', system = 'You are a helpful assistant.', max_tokens = 400 } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ],
        max_tokens,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'OpenAI error', details: errText });
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return res.json({ text });
  } catch (err) {
    console.error('AI proxy error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Vision extraction: accepts { imageUrl? , imageBase64? }
app.post('/api/ai/vision', async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(503).json({ error: 'External AI not configured. Set OPENAI_API_KEY on the server.' });
    }

    const { imageUrl, imageBase64 } = req.body || {};
    if (!imageUrl && !imageBase64) {
      return res.status(400).json({ error: 'Provide imageUrl or imageBase64' });
    }

    const content = [];
    if (imageUrl) content.push({ type: 'image_url', image_url: { url: imageUrl } });
    if (imageBase64) content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } });

    const system = 'You extract structured product data from images. Return ONLY a strict JSON object with keys: name, brand, category, barcode, sku, price, costPrice, unit, description, expiryDate (YYYY-MM-DD if visible). Missing fields should be null.';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: [
            { type: 'text', text: 'Extract product fields as JSON. Be precise and do not hallucinate.' },
            ...content
          ] }
        ],
        max_tokens: 500,
        temperature: 0
      })
    });

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content || '';
    // Attempt to parse JSON from the response
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    let payload = {};
    if (jsonStart !== -1 && jsonEnd !== -1) {
      try { payload = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)); } catch {}
    }
    return res.json({ result: payload, raw });
  } catch (err) {
    console.error('AI vision error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[AI Proxy] listening on http://localhost:${PORT}`);
});






