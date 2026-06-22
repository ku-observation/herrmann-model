import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(express.json());

// Set up Gemini API client lazily inside the handler to prevent startup crashes if key is missing
let ai: GoogleGenAI | null = null;
function getAIClient() {
  if (!ai) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set. Please set it in your environment variables.");
    }
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

app.post('/api/analyze', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const aiClient = getAIClient();

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.1-pro-preview',
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
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
