type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: { message?: string };
};

export async function generateWithOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You write conservation blog posts." },
          { role: "user", content: prompt }
        ]
      })
    });

    const data = (await res.json()) as OpenAIChatCompletionResponse;
    if (!res.ok) {
      throw new Error(data.error?.message ?? `OpenAI request failed (${res.status})`);
    }

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("OpenAI returned an empty response");
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

