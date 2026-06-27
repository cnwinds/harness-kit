export type HarnessAuthState = {
  user: { id: string; username?: string; role?: 'admin' | 'member' } | null;
  ready: boolean;
  onUnauthorized?: () => void;
};
