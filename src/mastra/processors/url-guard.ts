import type { Processor, ProcessInputArgs } from "@mastra/core/processors";
import type { MastraDBMessage } from "@mastra/core/memory";

export class AppStoreURLGuard implements Processor {
  id = "app-store-url-guard";

 async processInput({ messages, abort }: ProcessInputArgs): Promise<MastraDBMessage[]> {
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === 'user');

  if (!lastUserMessage) return messages;

  const content = JSON.stringify(lastUserMessage.content);

  const looksLikeURL = content.includes('http');

  if (looksLikeURL && !content.match(/apps\.apple\.com\/[a-z]{2}\/app\/.+\/id\d+/)) {
    abort(
      "That doesn't look like a valid App Store URL. Please paste a URL in the format:\nhttps://apps.apple.com/us/app/app-name/id123456789"
    );
  }

  return messages;
}
}
