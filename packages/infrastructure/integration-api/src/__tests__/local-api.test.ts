import { describe, expect, it } from 'vitest';
import { ok } from '@peercomms/domain';
import { LocalApiHttpHandler, type LocalApiUseCases } from '../local-api.js';

const useCases: LocalApiUseCases = {
  registerExternalApplication: { async execute(input) { return ok({ appId: `app_${input.name}` }); } },
  createApiToken: { async execute() { return ok({ tokenId: 'tok_1', token: 'secret', scopes: ['messages:send'] }); } },
  exportPublicIdentity: { async execute() { return ok({ peerId: 'pc_peerpeerpeer1234' }); } },
  listContacts: { async execute() { return ok([]); } },
  sendContactRequest: { async execute() { return ok({ requestId: 'crq_1' }); } },
  approveContactRequest: { async execute(input) { return ok({ requestId: input.requestId }); } },
  rejectContactRequest: { async execute(input) { return ok({ requestId: input.requestId }); } },
  blockPeer: { async execute(input) { return ok({ peerId: input.peerId }); } },
  listConversations: { async execute() { return ok([]); } },
  listMessages: { async execute(input) { return ok({ conversationId: input.conversationId, messages: [] }); } },
  sendMessageFromExternalApp: { async execute(input) { return ok({ messageId: 'msg_1', envelopeId: `env_${input.toPeerId}` }); } },
  createGroup: { async execute() { return ok({ groupId: 'grp_1' }); } },
  invitePeerToGroup: { async execute(input) { return ok({ groupId: input.groupId, invitationId: 'ginv_1' }); } },
  acceptGroupInvitation: { async execute(input) { return ok({ invitationId: input.invitationId }); } },
  rejectGroupInvitation: { async execute(input) { return ok({ invitationId: input.invitationId }); } },
  sendGroupMessage: { async execute(input) { return ok({ groupId: input.groupId }); } },
  subscribeExternalAppToEvents: { async execute() { return ok({ subscriptionId: 'wh_1' }); } }
};

describe('LocalApiHttpHandler', () => {
  it('routes loopback app registration requests', async () => {
    const handler = new LocalApiHttpHandler(useCases);
    const response = await handler.handle(new Request('http://127.0.0.1:17345/v1/integrations/apps', { method: 'POST', body: JSON.stringify({ name: 'Bot' }) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ appId: 'app_Bot' });
  });

  it('rejects non-loopback hosts', async () => {
    const handler = new LocalApiHttpHandler(useCases);
    const response = await handler.handle(new Request('http://example.com/v1/identity/public'));
    expect(response.status).toBe(403);
  });

  it('injects bearer token into external direct message use case', async () => {
    const handler = new LocalApiHttpHandler(useCases);
    const response = await handler.handle(new Request('http://127.0.0.1:17345/v1/messages/direct', {
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
      body: JSON.stringify({ fromPeerId: 'pc_senderpeer123456', toPeerId: 'pc_targetpeer123456', text: 'Olá' })
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ messageId: 'msg_1', envelopeId: 'env_pc_targetpeer123456' });
  });
});
