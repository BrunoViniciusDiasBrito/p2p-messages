import { describe, expect, it } from 'vitest';
import { FixedWindowLocalRateLimiter } from '../local-rate-limiter.js';

describe('FixedWindowLocalRateLimiter', () => {
  it('limits requests per app and action before resetting the window', async () => {
    let now = 1_000;
    const limiter = new FixedWindowLocalRateLimiter({ maxRequests: 2, windowMs: 100, now: () => now });

    await expect(limiter.consume({ appId: 'app_1', action: 'messages:send' })).resolves.toBe(true);
    await expect(limiter.consume({ appId: 'app_1', action: 'messages:send' })).resolves.toBe(true);
    await expect(limiter.consume({ appId: 'app_1', action: 'messages:send' })).resolves.toBe(false);
    await expect(limiter.consume({ appId: 'app_1', action: 'notifications:subscribe' })).resolves.toBe(true);

    now += 100;
    await expect(limiter.consume({ appId: 'app_1', action: 'messages:send' })).resolves.toBe(true);
  });
});
