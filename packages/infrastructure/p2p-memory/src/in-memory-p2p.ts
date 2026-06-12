import { IncomingEnvelopeProcessorPort, PeerNodeRuntimePort } from '@peercomms/application';

export interface InMemoryPeerNetworkMessage {
  readonly fromPeerId: string;
  readonly toPeerId?: string;
  readonly envelopeJson: string;
}

export class InMemoryPeerNetwork {
  private readonly nodes = new Map<string, InMemoryPeerNodeRuntime>();

  register(node: InMemoryPeerNodeRuntime): void {
    this.nodes.set(node.localPeerId, node);
  }

  unregister(peerId: string): void {
    this.nodes.delete(peerId);
  }

  discover(excludingPeerId: string): Array<{ peerId: string; reachability: 'peer_reachable' }> {
    return [...this.nodes.keys()]
      .filter((peerId) => peerId !== excludingPeerId)
      .map((peerId) => ({ peerId, reachability: 'peer_reachable' }));
  }

  async deliver(message: InMemoryPeerNetworkMessage): Promise<'published' | 'peer_unreachable'> {
    if (message.toPeerId) {
      const target = this.nodes.get(message.toPeerId);
      if (!target) return 'peer_unreachable';
      await target.receive(message);
      return 'published';
    }
    const targets = [...this.nodes.values()].filter((node) => node.localPeerId !== message.fromPeerId);
    await Promise.all(targets.map((target) => target.receive(message)));
    return targets.length > 0 ? 'published' : 'peer_unreachable';
  }
}

export class InMemoryPeerNodeRuntime implements PeerNodeRuntimePort {
  private started = false;
  private connectedPeers = new Set<string>();
  private peerId: string | null = null;

  constructor(private readonly network: InMemoryPeerNetwork, private readonly incoming: IncomingEnvelopeProcessorPort) {}

  get localPeerId(): string {
    if (!this.peerId) throw new Error('In-memory peer node is not started');
    return this.peerId;
  }

  async start(input: { localPeerId: string }): Promise<void> {
    this.peerId = input.localPeerId;
    this.started = true;
    this.network.register(this);
  }

  async stop(): Promise<void> {
    if (this.peerId) this.network.unregister(this.peerId);
    this.started = false;
    this.peerId = null;
    this.connectedPeers = new Set();
  }

  async discoverPeers(): Promise<Array<{ peerId: string; reachability: 'peer_reachable' }>> {
    this.assertStarted();
    return this.network.discover(this.localPeerId);
  }

  async connectToPeer(peerId: string): Promise<void> {
    this.assertStarted();
    const discovered = await this.discoverPeers();
    if (!discovered.some((peer) => peer.peerId === peerId)) throw new Error('Peer is unreachable');
    this.connectedPeers.add(peerId);
  }

  async publishEnvelope(input: { toPeerId?: string; envelopeJson: string }): Promise<'published' | 'peer_unreachable'> {
    this.assertStarted();
    if (input.toPeerId && !this.connectedPeers.has(input.toPeerId)) return 'peer_unreachable';
    return this.network.deliver({ fromPeerId: this.localPeerId, ...input });
  }

  async receive(message: InMemoryPeerNetworkMessage): Promise<void> {
    this.assertStarted();
    await this.incoming.handle({ envelopeJson: message.envelopeJson, receivedAt: new Date() });
  }

  async getStatus(): Promise<{ mode: 'offline' | 'local_lan'; started: boolean }> {
    return { mode: this.started ? 'local_lan' : 'offline', started: this.started };
  }

  private assertStarted(): void {
    if (!this.started || !this.peerId) throw new Error('In-memory peer node is not started');
  }
}
