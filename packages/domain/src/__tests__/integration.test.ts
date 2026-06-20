import { describe, expect, it } from 'vitest';
import { ApiToken, PermissionGrant, WebhookSubscription } from '../index.js';

describe('Integration domain', () => {
  it('does not allow storing raw API tokens as tokenHash', () => {
    expect(() => ApiToken.issue({
      id: 'tok_1',
      appId: 'app_1',
      tokenHash: 'raw-secret',
      permissions: PermissionGrant.create(['messages:send']),
      createdAt: new Date()
    })).toThrow('API token hash');
  });

  it('restricts webhooks to loopback urls', () => {
    expect(() => WebhookSubscription.create({
      id: 'wh_1',
      appId: 'app_1',
      url: 'https://example.com/hook',
      eventTypes: ['message.received'],
      createdAt: new Date()
    })).toThrow('loopback');
    expect(() => WebhookSubscription.create({
      id: 'wh_2',
      appId: 'app_1',
      url: 'http://127.0.0.1.attacker.invalid/hook',
      eventTypes: ['message.received'],
      createdAt: new Date()
    })).toThrow('loopback');
  });
});
