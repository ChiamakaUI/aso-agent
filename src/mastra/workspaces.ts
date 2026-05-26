import { Workspace, LocalFilesystem } from "@mastra/core/workspace";

export const asoWorkspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: "./" }),
  skills: ["src/mastra/public/skills"],
});
