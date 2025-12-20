import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/api";
import { listSources, getSourceById } from "@/lib/storage/sources";
import { generateWithAzureOpenAI } from "@/lib/ai/providers/azure";
import { generateWithOpenAI } from "@/lib/ai/providers/openai";

const SuggestSchema = z.object({
  idea: z.string().optional(),
  mode: z.enum(["from-idea", "surprise-me"]).default("from-idea"),
  includeSourceAnalysis: z.boolean().default(true)
});

export async function POST(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  const json = await request.json();
  const parsed = SuggestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }

  const { idea, mode, includeSourceAnalysis } = parsed.data;

  try {
    // Get knowledge base sources
    const sources = await listSources();
    let contextText = "";
    let relevantSourceIds: string[] = [];

    if (includeSourceAnalysis && sources.length > 0) {
      // For "from-idea" mode, try to find relevant sources
      // For "surprise-me" mode, use all sources to find interesting topics
      const sourcesToAnalyze = sources.slice(0, 10); // Limit to avoid token overload

      const sourceContents = await Promise.all(
        sourcesToAnalyze.map(async (s) => {
          try {
            const source = await getSourceById(s.id);
            return { id: s.id, title: s.title, text: source?.contentText?.slice(0, 2000) || "" };
          } catch {
            return { id: s.id, title: s.title, text: "" };
          }
        })
      );

      contextText = sourceContents
        .filter(s => s.text)
        .map(s => `Source: ${s.title}\n${s.text}`)
        .join("\n\n---\n\n");

      relevantSourceIds = sourceContents.map(s => s.id);
    }

    // Build the prompt based on mode
    let prompt = "";

    if (mode === "surprise-me") {
      prompt = `You are a wildlife conservation blog post strategist. Based on the following knowledge base sources, suggest an interesting, timely, and engaging blog post idea.

${contextText ? `Knowledge base context:\n${contextText}\n\n` : ""}

Generate a complete blog post outline with:
1. A compelling title (50-60 characters)
2. 3-5 subtitle/section ideas (one per line)
3. Target keywords (5-8 keywords, comma-separated)
4. Detailed idea/notes (2-3 sentences explaining what the post should cover)
5. Target audience (1-2 words)
6. Call to action (1-2 words)

Focus on topics that are:
- Relevant to wildlife conservation
- Timely and engaging
- Educational but accessible
- Action-oriented

Format your response as JSON:
{
  "title": "...",
  "subtitles": ["...", "...", "..."],
  "keywords": ["...", "...", "..."],
  "idea": "...",
  "targetAudience": "...",
  "callToAction": "..."
}`;
    } else {
      // from-idea mode
      if (!idea || idea.trim().length < 5) {
        return NextResponse.json({ error: "Please provide an idea (at least 5 characters)" }, { status: 400 });
      }

      prompt = `You are a wildlife conservation blog post strategist. A user wants to write a blog post about: "${idea}"

${contextText ? `Relevant knowledge base context:\n${contextText}\n\n` : ""}

Based on this idea${contextText ? " and the knowledge base context" : ""}, generate a complete blog post outline with:
1. A compelling title (50-60 characters, SEO-optimized)
2. 3-5 subtitle/section ideas (one per line, logical flow)
3. Target keywords (5-8 keywords, comma-separated, include the main topic)
4. Detailed idea/notes (2-3 sentences expanding on what the post should cover, including key facts or angles)
5. Target audience (who should read this? e.g., "wildlife supporters", "students", "donors")
6. Call to action (what should readers do after reading? e.g., "donate", "volunteer", "share")

Make it:
- Engaging and accessible
- SEO-friendly
- Action-oriented
- Well-structured

Format your response as JSON:
{
  "title": "...",
  "subtitles": ["...", "...", "..."],
  "keywords": ["...", "...", "..."],
  "idea": "...",
  "targetAudience": "...",
  "callToAction": "..."
}`;
    }

    // Generate suggestions using AI
    const azureConfigured =
      Boolean(process.env.AZURE_OPENAI_ENDPOINT?.trim()) &&
      Boolean(process.env.AZURE_OPENAI_API_KEY?.trim()) &&
      Boolean(process.env.AZURE_OPENAI_DEPLOYMENT?.trim());

    const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());

    let response: string;
    if (azureConfigured) {
      response = await generateWithAzureOpenAI(prompt);
    } else if (openaiConfigured) {
      response = await generateWithOpenAI(prompt);
    } else {
      // Fallback to a simple template-based suggestion
      return NextResponse.json({
        title: idea ? `Understanding ${idea.slice(0, 50)}` : "Wildlife Conservation Insights",
        subtitles: ["Introduction", "Key Facts", "What You Can Do"],
        keywords: idea ? idea.split(' ').slice(0, 5) : ["wildlife", "conservation", "nature"],
        idea: idea || "Explore important topics in wildlife conservation",
        targetAudience: "wildlife supporters",
        callToAction: "learn more",
        sources: relevantSourceIds.slice(0, 3)
      });
    }

    // Parse the AI response
    let suggestions;
    try {
      // Try to extract JSON from the response (in case it's wrapped in markdown)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : response;
      suggestions = JSON.parse(jsonText);
    } catch (err) {
      console.error("Failed to parse AI response:", response);
      throw new Error("Failed to parse AI suggestions");
    }

    // Validate the structure
    if (!suggestions.title || !suggestions.subtitles || !suggestions.keywords) {
      throw new Error("Invalid suggestion structure from AI");
    }

    return NextResponse.json({
      title: suggestions.title,
      subtitles: Array.isArray(suggestions.subtitles) ? suggestions.subtitles : [suggestions.subtitles],
      keywords: Array.isArray(suggestions.keywords) ? suggestions.keywords : suggestions.keywords.split(',').map((k: string) => k.trim()),
      idea: suggestions.idea || "",
      targetAudience: suggestions.targetAudience || "",
      callToAction: suggestions.callToAction || "",
      sources: relevantSourceIds
    });
  } catch (err) {
    console.error("Suggestion error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
