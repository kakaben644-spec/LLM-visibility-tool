type SerperResult = {
  title: string;
  snippet: string;
};

type SerperApiResponse = {
  organic?: SerperResult[];
};

export async function fetchSerperContext(brandName: string): Promise<string> {
  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": process.env.SERPER_API_KEY ?? "",
      },
      body: JSON.stringify({ q: brandName, num: 5, hl: "fr" }),
    });

    if (!response.ok) {
      console.error("[fetchSerperContext] Serper API error:", await response.text());
      return "";
    }

    const data: SerperApiResponse = await response.json() as SerperApiResponse;
    const results = data.organic ?? [];

    return results
      .slice(0, 5)
      .map((r) => `- ${r.title}: ${r.snippet}`)
      .join("\n");
  } catch (e) {
    console.error("[fetchSerperContext] failed:", e);
    return "";
  }
}
