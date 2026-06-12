import { describe, expect, it } from 'vitest';
import { DiscoverPeersUseCase, NoopDomainEventBus, PublishEnvelopeUseCase, StartPeerNodeUseCase, type IdGenerator, type PeerNodeRuntimePort } from '../index.js';

class FixedIds implements IdGenerator {
  private next = 0;
  newId(prefix = 'id'): string { this.next += 1; return `${prefix}_${this.next}`; }
}

class Runtime implements PeerNodeRuntimePort {
  started = false;
  async start(): Promise<void> { this.started = true; }
  async stop(): Promise<void> { this.started = false; }
  async discoverPeers() { return [{ peerId: 'pc_remotepeer1234567', reachability: 'peer_reachable' as const }]; }
  async connectToPeer(): Promise<void> {}
  async publishEnvelope() { return 'published' as const; }
  async getStatus() { return { mode: this.started ? 'local_lan' as const : 'offline' as const, started: this.started }; }
}

describe('p2p use cases', () => {
  it('starts peer nodes and discovers peers through runtime ports', async () => {
    const runtime = new Runtime();
    const ids = new FixedIds();
    const started = await new StartPeerNodeUseCase(runtime, new NoopDomainEventBus(), ids).execute({ localPeerId: 'pc_localpeer1234567' });
    expect(started.ok).toBe(true);
    const peers = await new DiscoverPeersUseCase(runtime, new NoopDomainEventBus(), ids).execute({ localPeerId: 'pc_localpeer1234567' });
    expect(peers.ok && peers.value[0]?.peerId).toBe('pc_remotepeer1234567');
  });

  it('publishes non-empty envelopes', async () => {
    const published = await new PublishEnvelopeUseCase(new Runtime()).execute({ toPeerId: 'pc_remotepeer1234567', envelopeJson: '{"ok":true}' });
    expect(published.ok && published.value.status).toBe('published');
  });
});
