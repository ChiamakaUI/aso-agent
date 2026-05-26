import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { asoAgent } from './agents/aso-agent';
import { auditWorkflow } from './workflows/audit-workflow';

export const mastra = new Mastra({
  agents: { asoAgent },
  workflows: { auditWorkflow },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:./mastra.db',
  }),
});