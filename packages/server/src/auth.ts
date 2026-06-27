import type { IncomingMessage } from 'node:http';
import type { ChatUser } from '@harnesskit/protocol';

export interface AuthResolver {
  resolve(request: IncomingMessage): Promise<ChatUser | null>;
}

export const anonymousAuth: AuthResolver = {
  resolve: async () => ({ id: 'anonymous', username: 'anonymous', role: 'member' }),
};
