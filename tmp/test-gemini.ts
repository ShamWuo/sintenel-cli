import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import "dotenv/config";

async function test() {
  try {
    console.log("Using Key:", process.env.GOOGLE_GENERATIVE_AI_API_KEY?.slice(0, 10) + "...");
    const model = google("gemini-3-flash");
    const { text } = await generateText({
      model,
      prompt: "Hello, respond with 'SUCCESS' if you read this.",
    });
    console.log("Gemini 3 Flash Response:", text);

    const subModel = google("gemini-3.1-flash-lite");
    const { text: subText } = await generateText({
      model: subModel,
      prompt: "Hello, sub-agent check.",
    });
    console.log("Gemini 3.1 Flash Lite Response:", subText);
  } catch (err) {
    console.error("Gemini Error:", err);
  }
}

test();
