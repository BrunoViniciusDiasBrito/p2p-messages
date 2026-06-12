import { describe, expect, it } from 'vitest';
import { InMemoryPeerNetwork, InMemoryPeerNodeRuntime } from '../index.js';

class Inbox {
  readonly envelopes: string[] = [];
  async handle(input: { envelopeJson: string }): Promise<void> { this.envelopes.push(input.envelopeJson); }
}

describe('InMemoryPeerNodeRuntime', () => {
  it('discovers, connects, and delivers envelopes between two local nodes', async () => {
    const network = new InMemoryPeerNetwork();
    const inboxA = new Inbox();
    const inboxB = new Inbox();
    const nodeA = new InMemoryPeerNodeRuntime(network, inboxA);
    const nodeB = new InMemoryPeerNodeRuntime(network, inboxB);
    await nodeA.start({ localPeerId: 'pc_nodeapeer12345', mode: 'local_lan' });
    await nodeB.start({ localPeerId: 'pc_nodebpeer12345', mode: 'local_lan' });

    expect(await nodeA.discoverPeers()).toEqual([{ peerId: 'pc_nodebpeer12345', reachability: 'peer_reachable' }]);
    await nodeA.connectToPeer('pc_nodebpeer12345');
    const result = await nodeA.publishEnvelope({ toPeerId: 'pc_nodebpeer12345', envelopeJson: '{"type":"direct_message"}' });

    expect(result).toBe('published');
    expect(inboxB.envelopes).toEqual(['{"type":"direct_message"}']);
  });
});
