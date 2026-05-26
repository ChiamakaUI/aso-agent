import { createWorkflow, createStep } from "@mastra/core/workflows";
import FirecrawlApp from "@mendable/firecrawl-js";
import { z } from "zod";

// ─── Shared schema ────────────────────────────────────────────────────────────

const metadataSchema = z.object({
  url: z.string(),
  name: z.string(),
  developer: z.string(),
  category: z.string(),
  country: z.string(),
  appId: z.string(),
  iconUrl: z.string(),
  averageRating: z.number(),
  ratingCount: z.number(),
});

// ─── Step 1: Fetch metadata ───────────────────────────────────────────────────

const fetchMetadataStep = createStep({
  id: "fetch-metadata",
  inputSchema: z.object({ url: z.string().url() }),
  outputSchema: metadataSchema,
  execute: async ({ inputData }) => {
    const { url } = inputData;

    const match = url.match(
      /apps\.apple\.com\/([a-z]{2})\/app\/[^/]+\/id(\d+)/,
    );
    if (!match) throw new Error("Not a valid App Store URL.");

    const country = match[1];
    const appId = match[2];

    const response = await fetch(
      `https://itunes.apple.com/lookup?id=${appId}&country=${country}`,
    );
    const data = await response.json();

    if (!data.results?.length) throw new Error(`No app found for ID ${appId}.`);

    const app = data.results[0];

    return {
      url,
      name: app.trackName,
      developer: app.artistName,
      category: app.primaryGenreName,
      country: country.toUpperCase(),
      appId,
      iconUrl: app.artworkUrl512 ?? app.artworkUrl100,
      averageRating: app.averageUserRating ?? 0,
      ratingCount: app.userRatingCount ?? 0,
    };
  },
});

// ─── Step 2: Suspend for user confirmation (HITL) ─────────────────────────────

const confirmationStep = createStep({
  id: "await-confirmation",
  inputSchema: metadataSchema,
  outputSchema: metadataSchema,
  resumeSchema: z.object({ confirmed: z.boolean() }),
  suspendSchema: z.object({ metadata: metadataSchema }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return await suspend({ metadata: inputData });
    }
    if (!resumeData.confirmed) {
      throw new Error("Audit cancelled by user.");
    }
    return inputData;
  },
});

// ─── Step 3: Scrape full listing ──────────────────────────────────────────────

const fetchFullPageStep = createStep({
  id: 'fetch-full-page',
  inputSchema: metadataSchema,
  outputSchema: z.object({
    metadata: metadataSchema,
    markdown: z.string(),
  }),
  execute: async ({ inputData }) => {
    const firecrawl = new FirecrawlApp({
      apiKey: process.env.FIRECRAWL_API_KEY!,
    });

    const result = await firecrawl.scrapeUrl(inputData.url, {
      formats: ['markdown'],
    });

    if (!result.markdown) throw new Error('Firecrawl returned no content.');

    // Truncate to first 12k chars — captures all visible listing content
    // without pulling in footer/legal boilerplate that bloats the LLM call
    const markdown = result.markdown.slice(0, 12000);

    return { metadata: inputData, markdown };
  },
});

// ─── Step 4: Run ASO audit ────────────────────────────────────────────────────

export const auditWorkflow = createWorkflow({
  id: 'aso-audit-workflow',
  inputSchema: z.object({ url: z.string().url() }),
  outputSchema: z.object({
    metadata: metadataSchema,
    markdown: z.string(),
  }),
})
  .then(fetchMetadataStep)
  .then(confirmationStep)
  .then(fetchFullPageStep)
  .commit();