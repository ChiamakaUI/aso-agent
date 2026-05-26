import { createTool } from "@mastra/core/tools";
import type { Mastra } from "@mastra/core/mastra";
import { z } from "zod";

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

type Metadata = z.infer<typeof metadataSchema>;

export const startAuditWorkflow = createTool({
  id: "start-audit-workflow",
  description:
    "Starts the ASO audit workflow for an App Store URL. Fetches app metadata and pauses for user confirmation. Returns the metadata and a runId.",
  inputSchema: z.object({ url: z.string().url() }),
  outputSchema: z.object({
    runId: z.string(),
    metadata: metadataSchema,
  }),
  execute: async ({ url }): Promise<{ runId: string; metadata: Metadata }> => {
    const { mastra } = (await import("../index")) as { mastra: Mastra };
    const workflow = mastra.getWorkflow("auditWorkflow");
    const run = await workflow.createRun();
    const result = await run.start({ inputData: { url } });

    if (result.status !== "suspended") {
      throw new Error(`Expected workflow to suspend, got: ${result.status}`);
    }

    const fetchStep = result.steps["fetch-metadata"];
    if (!fetchStep || !("output" in fetchStep)) {
      throw new Error("Could not read metadata from workflow.");
    }

    const metadata = fetchStep.output as Metadata;
    return { runId: run.runId, metadata };
  },
});

export const resumeAuditWorkflow = createTool({
  id: "resume-audit-workflow",
  description:
    "Resumes the ASO audit workflow after user confirms the app. Returns the scraped listing content for you to analyse.",
  inputSchema: z.object({
    runId: z.string(),
    confirmed: z.preprocess(
      (val) => val === true || val === "true" || val === "True",
      z.boolean(),
    ),
  }),
  outputSchema: z.object({
    metadata: metadataSchema,
    markdown: z.string(),
  }),
  execute: async ({
    runId,
    confirmed,
  }): Promise<{ metadata: Metadata; markdown: string }> => {
    const { mastra } = (await import("../index")) as { mastra: Mastra };
    const workflow = mastra.getWorkflow("auditWorkflow");
    const run = await workflow.createRun({ runId });

    const result = await run.resume({
      step: "await-confirmation",
      resumeData: { confirmed },
    });

    if (result.status !== "success") {
      throw new Error(`Workflow did not complete. Status: ${result.status}`);
    }

    const output = result.result as { metadata: Metadata; markdown: string };
    return { metadata: output.metadata, markdown: output.markdown };
  },
});
