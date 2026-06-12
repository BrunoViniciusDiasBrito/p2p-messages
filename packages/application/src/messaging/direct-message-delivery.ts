import { err, ok, type Result } from '@peercomms/domain';
import type { IncomingEnvelopeProcessorPort, PeerNodeRuntimePort } from '../ports/p2p-ports.js';
import type { EnvelopePublisherPort } from '../ports/messaging-ports.js';
import { type DirectMessageEnvelopeDto, ReceiveDirectMessageUseCase } from './messaging-use-cases.js';

interface RoutableEnvelope {
  readonly protocolVersion: '1.0';
  readonly envelopeId: string;
  readonly type: string;
  readonly fromPeerId: string;
  readonly toPeerId?: string;
  readonly conversationId?: string;
  readonly createdAt: string;
  readonly expiresAt?: string;
  readonly nonce: string;
  readonly payload: string;
  readonly signature: string;
}

const parseRoutableEnvelope = (envelopeJson: string): RoutableEnvelope => {
  const value = JSON.parse(envelopeJson) as Partial<RoutableEnvelope>;
  if (value.protocolVersion !== '1.0') throw new Error('Unsupported protocol version');
  for (const key of ['envelopeId', 'type', 'fromPeerId', 'createdAt', 'nonce', 'payload', 'signature'] as const) {
    if (typeof value[key] !== 'string' || !value[key]?.trim()) throw new Error(`Envelope missing ${key}`);
  }
  if (value.toPeerId !== undefined && typeof value.toPeerId !== 'string') throw new Error('Envelope toPeerId must be a string');
  if (value.conversationId !== undefined && typeof value.conversationId !== 'string') throw new Error('Envelope conversationId must be a string');
  if (value.expiresAt !== undefined && typeof value.expiresAt !== 'string') throw new Error('Envelope expiresAt must be a string');
  return value as RoutableEnvelope;
};

export class PeerNodeEnvelopePublisher implements EnvelopePublisherPort {
  constructor(private readonly peerNode: PeerNodeRuntimePort) {}

  async publish(envelopeJson: string): Promise<'published' | 'peer_unreachable'> {
    const parsed = this.parseRecipient(envelopeJson);
    if (!parsed.ok) return 'peer_unreachable';
    return this.peerNode.publishEnvelope({ ...(parsed.value.toPeerId ? { toPeerId: parsed.value.toPeerId } : {}), envelopeJson });
  }

  private parseRecipient(envelopeJson: string): Result<{ toPeerId?: string }> {
    try {
      const envelope = parseRoutableEnvelope(envelopeJson);
      return ok(envelope.toPeerId ? { toPeerId: envelope.toPeerId } : {});
    } catch (error) {
      return err(error instanceof Error ? error : new Error('Invalid transport envelope'));
    }
  }
}

export class DirectMessageIncomingEnvelopeProcessor implements IncomingEnvelopeProcessorPort {
  constructor(
    private readonly localPeerId: string,
    private readonly receiveDirectMessage: ReceiveDirectMessageUseCase
  ) {}

  async handle(input: { envelopeJson: string; receivedAt: Date }): Promise<void> {
    const envelope = parseRoutableEnvelope(input.envelopeJson);
    if (envelope.type !== 'direct_message') return;
    if (!envelope.toPeerId || !envelope.conversationId) throw new Error('Direct message envelopes require toPeerId and conversationId');

    const result = await this.receiveDirectMessage.execute({
      localPeerId: this.localPeerId,
      envelope: {
        protocolVersion: envelope.protocolVersion,
        envelopeId: envelope.envelopeId,
        type: 'direct_message',
        fromPeerId: envelope.fromPeerId,
        toPeerId: envelope.toPeerId,
        conversationId: envelope.conversationId,
        createdAt: envelope.createdAt,
        ...(envelope.expiresAt ? { expiresAt: envelope.expiresAt } : {}),
        nonce: envelope.nonce,
        payload: envelope.payload,
        signature: envelope.signature
      } satisfies DirectMessageEnvelopeDto
    });
    if (!result.ok) throw result.error;
  }
}
