import type { LocalIntegrationRateLimiter } from '@peercomms/application';

export interface LocalRateLimiterOptions {
  readonly maxRequests?: number;
  readonly windowMs?: number;
  readonly now?: () => number;
}

interface WindowState {
  readonly startedAt: number;
  readonly count: number;
}

export class FixedWindowLocalRateLimiter implements LocalIntegrationRateLimiter {
  private readonly windows = new Map<string, WindowState>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(options: LocalRateLimiterOptions = {}) {
    this.maxRequests = options.maxRequests ?? 60;
    this.windowMs = options.windowMs ?? 60_000;
    this.now = options.now ?? Date.now;
    if (!Number.isSafeInteger(this.maxRequests) || this.maxRequests < 1) throw new Error('Rate limit maximum must be a positive integer');
    if (!Number.isSafeInteger(this.windowMs) || this.windowMs < 1) throw new Error('Rate limit window must be a positive integer in milliseconds');
  }

  async consume(input: { appId: string; action: string }): Promise<boolean> {
    const key = JSON.stringify([input.appId, input.action]);
    const now = this.now();
    const previous = this.windows.get(key);
    if (!previous || now - previous.startedAt >= this.windowMs) {
      this.windows.set(key, { startedAt: now, count: 1 });
      return true;
    }
    if (previous.count >= this.maxRequests) return false;
    this.windows.set(key, { startedAt: previous.startedAt, count: previous.count + 1 });
    return true;
  }
}
