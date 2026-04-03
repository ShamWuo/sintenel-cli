import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

async function list() {
  try {
    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
    const genAI = new GoogleGenerativeAI(key);
    // There isn't a direct listModels in the genAI object easily, but we can try to fetch from the URL if needed.
    // However, usually we can just brute force a few guesses or use the list endpoint if we create a client.
    
    // Let's try the common ones as of 2026.
    const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash", "gemini-2.5-flash", "gemini-3-flash", "gemini-3.1-pro", "gemini-2.0-flash-exp"];
    
    for (const m of models) {
      try {
         const model = genAI.getGenerativeModel({ model: m });
         const result = await model.generateContent("test");
         console.log(`[OK] ${m}`);
         break; // Found one!
      } catch (e: any) {
         console.log(`[FAIL] ${m}: ${e.message}`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

list();
