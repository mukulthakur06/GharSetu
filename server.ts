import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface ExtractedMapPlace {
  title: string;
  uri: string;
  reviewSnippets: string[];
}

function extractMapsPlaces(groundingChunks: unknown): ExtractedMapPlace[] {
  if (!Array.isArray(groundingChunks)) return [];
  const seen: Record<string, boolean> = {};
  const results: ExtractedMapPlace[] = [];

  for (const chunk of groundingChunks) {
    if (!chunk || typeof chunk !== 'object') continue;
    const mapsObj = (chunk as { maps?: Record<string, unknown> }).maps;
    if (!mapsObj || typeof mapsObj !== 'object') continue;

    const uri = typeof mapsObj.uri === 'string' ? mapsObj.uri : '';
    const title = typeof mapsObj.title === 'string' ? mapsObj.title : '';
    if (!uri || seen[uri]) continue;
    seen[uri] = true;

    const snippets: string[] = [];
    const placeAnswerSources = mapsObj.placeAnswerSources as
      | { reviewSnippets?: Array<{ content?: string; text?: string }> }
      | undefined;
    if (Array.isArray(placeAnswerSources?.reviewSnippets)) {
      for (const snip of placeAnswerSources.reviewSnippets) {
        const text =
          typeof snip?.content === 'string'
            ? snip.content
            : typeof snip?.text === 'string'
              ? snip.text
              : '';
        if (text.trim()) {
          snippets.push(text.trim());
        }
      }
    }

    results.push({
      title: title || 'View on Google Maps',
      uri,
      reviewSnippets: snippets.slice(0, 2),
    });
  }

  return results;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/neighborhood-insights', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      const area = typeof body.area === 'string' ? body.area.trim().slice(0, 120) : '';
      const city = typeof body.city === 'string' ? body.city.trim().slice(0, 80) : '';
      const state = typeof body.state === 'string' ? body.state.trim().slice(0, 80) : '';
      const focus =
        body.focus === 'commute' || body.focus === 'family' ? body.focus : 'essentials';
      const language = body.language === 'hinglish' ? 'hinglish' : 'english';

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        res.status(400).json({ error: 'Valid latitude and longitude coordinates are required.' });
        return;
      }

      const locationLabel = [area, city, state].filter(Boolean).join(', ') || 'this area';

      const focusInstruction =
        focus === 'commute'
          ? 'Focus on the nearest metro stations, bus stands, railway connectivity, and major arterial roads for daily commuters.'
          : focus === 'family'
            ? 'Focus on reputed nearby schools, parks, family clinics, and peaceful neighborhood spots suitable for families.'
            : 'Focus on daily essentials nearby: hospitals/clinics, grocery markets, pharmacies, ATMs, and closest transit points.';

      const langNote =
        language === 'hinglish'
          ? 'Write in friendly, clear, concise Hinglish/English easy for Indian home renters to scan (3-4 short bullet points).'
          : 'Write a concise, practical 3-4 bullet summary for prospective home renters.';

      const prompt = `Using up-to-date Google Maps data around ${locationLabel} (${lat.toFixed(5)}, ${lng.toFixed(5)}), give renters an accurate neighborhood snapshot. ${focusInstruction} ${langNote} Include real place names and approximate proximity where known.`;

      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: lat,
                longitude: lng,
              },
            },
          },
        },
      });

      const summary = (response.text || '').trim();
      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const places = extractMapsPlaces(groundingChunks);

      res.json({
        summary,
        places,
      });
    } catch (error) {
      console.error('Neighborhood insights error:', error);
      const message =
        error instanceof Error ? error.message : 'Unable to fetch neighborhood insights.';
      const status =
        message.includes('API_KEY_INVALID') || message.includes('400')
          ? 400
          : message.includes('PERMISSION_DENIED') || message.includes('403')
            ? 403
            : message.includes('RESOURCE_EXHAUSTED') || message.includes('429')
              ? 429
              : 500;
      res.status(status).json({ error: message });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GharSetu server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
