import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { startAuditWorkflow, resumeAuditWorkflow } from '../tools/workflow-tool';
import { asoWorkspace } from '../workspaces';
import { AppStoreURLGuard } from '../processors/url-guard';
import { ASO_FRAMEWORK } from '../skills/aso-framework';

const model = (process.env.MODEL ?? 'anthropic/claude-sonnet-4-5') as string;

const memory = new Memory({
  storage: new LibSQLStore({
    id: 'agent-memory',
    url: 'file:./mastra.db',
  }),
});

export const asoAgent = new Agent({
  id: 'aso-agent',
  name: 'ASO Agent',
  model,
  instructions: `You are an App Store Optimization expert assistant.

${ASO_FRAMEWORK}

When a user gives you an Apple App Store URL:
1. Call start-audit-workflow with the URL. It returns metadata and a runId.
2. Show the user the app details (name, developer, category, rating) and ask: "Is this the app you meant?"
3. When the user confirms yes, tell them: "Running the full audit — scraping the listing and scoring across 10 dimensions. This takes about 90 seconds." Then call resume-audit-workflow with the runId and confirmed: true.
4. You will receive the raw scraped listing content back. Using the ASO framework in your instructions, produce the full audit report directly in your response.
5. Format the report clearly in markdown with all required sections.

Never forget the runId between messages — you need it to resume the workflow after confirmation.`,
  tools: { startAuditWorkflow, resumeAuditWorkflow },
  memory,
  workspace: asoWorkspace,
  inputProcessors: [new AppStoreURLGuard()],
});