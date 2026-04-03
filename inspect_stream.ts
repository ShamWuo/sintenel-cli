
import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import * as dotenv from "dotenv";

dotenv.config();

async function testStream() {
  const model = google("gemini-1.5-flash"); // Using a stable one for inspection
  const result = await streamText({
    model,
    prompt: "Say hi",
  });

  console.log("Chunk types received:");
  for await (const chunk of result.fullStream) {
    console.log(`- ${chunk.type}`);
    if (chunk.type === 'text-delta') {
        console.log(`  Content: "${chunk.textDelta}"`);
    }
  }
}

testStream().catch(console.error);
