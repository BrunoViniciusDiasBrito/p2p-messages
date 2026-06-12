import { afterEach, describe, expect, it, vi } from 'vitest';
import { PeerCommsApiError, PeerCommsClient } from '../index.js';

interface CapturedRequest {
  readonly url: string;
  readonly init: RequestInit;
}

const installFetch = (handler: (request: CapturedRequest) => { status?: number; body?: unknown }): CapturedRequest[] => {
  const requests: CapturedRequest[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const request = { url: String(url), init: init ?? {} };
    requests.push(request);
    const response = handler(request);
    return new Response(JSON.stringify(response.body ?? {}), { status: response.status ?? 200, headers: { 'content-type': 'application/json' } });
  }));
  return requests;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PeerCommsClient', () => {
  it('registers apps without bearer auth and creates scoped tokens with bearer auth', async () => {
    const requests = installFetch(({ url }) => url.endsWith('/v1/integrations/apps')
      ? { body: { appId: 'app_1' } }
      : { body: { tokenId: 'tok_1', token: 'raw_token', scopes: ['messages:send'] } });
    const client = new PeerCommsClient({ baseUrl: 'http://127.0.0.1:17345', token: 'local-token' });

    await expect(client.integrations.registerApp({ name: 'Bot' })).resolves.toEqual({ appId: 'app_1' });
    await expect(client.integrations.createToken({ appId: 'app_1', scopes: ['messages:send'] })).resolves.toEqual({ tokenId: 'tok_1', token: 'raw_token', scopes: ['messages:send'] });

    expect(requests[0]?.url).toBe('http://127.0.0.1:17345/v1/integrations/apps');
    expect((requests[0]?.init.headers as Record<string, string>).authorization).toBeUndefined();
    expect(requests[1]?.url).toBe('http://127.0.0.1:17345/v1/integrations/tokens');
    expect((requests[1]?.init.headers as Record<string, string>).authorization).toBe('Bearer local-token');
  });

  it('targets documented messaging and group endpoints with JSON bodies', async () => {
    const requests = installFetch(({ url }) => url.endsWith('/v1/messages/direct')
      ? { body: { messageId: 'msg_1', envelopeId: 'env_1' } }
      : { body: { groupId: 'grp_1' } });
    const client = new PeerCommsClient({ baseUrl: 'http://127.0.0.1:17345', token: 'local-token' });

    await expect(client.messages.sendDirect({ fromPeerId: 'pc_senderpeer123456', toPeerId: 'pc_targetpeer123456', text: 'Olá' })).resolves.toEqual({ messageId: 'msg_1', envelopeId: 'env_1' });
    await client.groups.sendMessage('grp_1', { fromPeerId: 'pc_senderpeer123456', text: 'Olá grupo' });

    expect(requests[0]?.url).toBe('http://127.0.0.1:17345/v1/messages/direct');
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({ fromPeerId: 'pc_senderpeer123456', toPeerId: 'pc_targetpeer123456', text: 'Olá' });
    expect(requests[1]?.url).toBe('http://127.0.0.1:17345/v1/groups/grp_1/messages');
    expect(JSON.parse(String(requests[1]?.init.body))).toEqual({ fromPeerId: 'pc_senderpeer123456', text: 'Olá grupo' });
  });

  it('throws typed API errors for non-2xx responses', async () => {
    installFetch(() => ({ status: 403, body: { error: 'Forbidden' } }));
    const client = new PeerCommsClient({ baseUrl: 'http://127.0.0.1:17345', token: 'bad-token' });

    await expect(client.contacts.list()).rejects.toMatchObject({ name: 'PeerCommsApiError', status: 403, message: 'Forbidden' } satisfies Partial<PeerCommsApiError>);
  });
});
