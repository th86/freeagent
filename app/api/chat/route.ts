import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

export const runtime = "edge";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

// Google Search Helper
async function googleSearch(query: string) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY!;
  const cx = process.env.GOOGLE_SEARCH_CX!;

  const res = await fetch(
    `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(
      query
    )}`
  );

  const data = await res.json();
  if (!data.items) return "No search results.";

  // Return a short structured text summary of top results
  return data.items.slice(0, 3).map((item: any) => {
    return `Title: ${item.title}\nSnippet: ${item.snippet}\nLink: ${item.link}`;
  }).join("\n\n");
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Convert UI messages to OpenRouter format
    const formatted = messages.map((m: any) => ({
      role: m.role,
      content: m.text,
    }));

    const userMessage = formatted[formatted.length - 1].content;

    // 🔍 Perform search using latest user message
    const searchResults = await googleSearch(userMessage);

    // Add search result context as a system message
    const model = openrouter("deepseek/deepseek-r1-0528-qwen3-8b:free");

    const result = await generateText({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful AI assistant. The following web search results " +
            "may assist in answering the user's question. When responding, " +
            "integrate the relevant information naturally, and cite URLs only if helpful.\n\n" +
            searchResults,
        },
        ...formatted,
      ],
    });

    return new Response(JSON.stringify({ text: result.text }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("API Error:", err);
    return new Response(
      JSON.stringify({ text: "Something went wrong." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
