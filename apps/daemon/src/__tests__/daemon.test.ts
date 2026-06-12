import { describe, expect, it } from 'vitest';
import { LocalApiHttpHandler, type LocalApiUseCases } from '@peercomms/integration-api';
import { ok } from '@peercomms/domain';
import { PeerCommsDaemon, type LoopbackServerPort } from '../daemon.js';

const useCases: LocalApiUseCases = {
  registerExternalApplication: { async execute() { return ok({ appId: 'app_1' }); } },
  createApiToken: { async execute() { return ok({ tokenId: 'tok_1', token: 'secret', scopes: [] }); } },
  exportPublicIdentity: { async execute() { return ok({ peerId: 'pc_peerpeerpeer1234' }); } },
  listContacts: { async execute() { return ok([]); } },
  sendContactRequest: { async execute() { return ok({ requestId: 'crq_1' }); } },
  approveContactRequest: { async execute() { return ok({}); } },
  rejectContactRequest: { async execute() { return ok({}); } },
  blockPeer: { async execute() { return ok({}); } },
  listConversations: { async execute() { return ok([]); } },
  listMessages: { async execute() { return ok([]); } },
  sendMessageFromExternalApp: { async execute() { return ok({ messageId: 'msg_1', envelopeId: 'env_1' }); } },
  subscribeExternalAppToEvents: { async execute() { return ok({ subscriptionId: 'sub_1' }); } }
};

class FakeServer implements LoopbackServerPort {
  started = false;
  async listen(input: { host: '127.0.0.1'; port: number }): Promise<{ url: string }> {
    this.started = true;
    return { url: `http://${input.host}:${input.port}` };
  }
  async close(): Promise<void> { this.started = false; }
}

describe('PeerCommsDaemon', () => {
  it('starts and stops the loopback server port', async () => {
    const server = new FakeServer();
    const daemon = new PeerCommsDaemon({ port: 17345, api: new LocalApiHttpHandler(useCases), server });
    await expect(daemon.start()).resolves.toEqual({ url: 'http://127.0.0.1:17345' });
    expect(server.started).toBe(true);
    await daemon.stop();
    expect(server.started).toBe(false);
  });
});
