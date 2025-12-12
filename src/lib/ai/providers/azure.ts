type AzureChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: { message?: string };
};

export async function generateWithAzureOpenAI(prompt: string) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT?.trim();
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION?.trim() || "2024-02-15-preview";
  if (!endpoint || !apiKey || !deployment) throw new Error("Missing Azure OpenAI env vars");

  const url = `${endpoint.replace(/\/+$/, "")}/openai/deployments/${encodeURIComponent(
    deployment
  )}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "api-key": apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You write conservation blog posts." },
          { role: "user", content: prompt }
        ]
      })
    });

    const data = (await res.json()) as AzureChatCompletionResponse;
    if (!res.ok) {
      throw new Error(data.error?.message ?? `Azure OpenAI request failed (${res.status})`);
    }

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Azure OpenAI returned an empty response");
    return content;
  } finally {
    clearTimeout(timeout);
  }
}
