import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS対策（Vercel上で他のドメインから呼び出される場合）
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    
    // プロンプトに含まれる情報量が大きくなる可能性があるため、タイムアウトを気にする場合はVercelのProプラン以上を推奨します。
    // https://vercel.com/docs/functions/serverless-functions/runtimes/node-js#execution-timeout
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Flashモデルの方が無料枠の制限（クォータ）が緩く、本番運用に向いています
    // クォータエラーが頻発する場合は 'gemini-3.1-flash' への変更をご検討ください
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview', // より速く安定した応答が必要な場合は 'gemini-3.1-flash' に変更
      contents: prompt,
    });

    res.json({ analysis: response.text });
  } catch (error: any) {
    console.error("API error:", error);
    const errorMessage = error?.message || String(error);
    if (errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429')) {
      res.status(429).json({ error: "quota exceeded", message: errorMessage });
    } else {
      res.status(500).json({ error: "analysis failed", message: errorMessage });
    }
  }
}
