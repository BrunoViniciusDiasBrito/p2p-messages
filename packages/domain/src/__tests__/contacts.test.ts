import { describe, expect, it } from 'vitest';
import { ContactRequest, ContactRequestId, PeerId } from '../index.js';

describe('ContactRequest', () => {
  it('allows approving inbound pending requests', () => {
    const now = new Date();
    const request = ContactRequest.inbound({
      id: ContactRequestId.create('crq_1'),
      localPeerId: PeerId.create('pc_localpeer12345677'),
      remotePeerId: PeerId.create('pc_remotepeer1234567'),
      createdAt: now,
      updatedAt: now
    }, 'evt_1');

    request.approve(now, 'evt_2');

    expect(request.snapshot.status).toBe('accepted');
    expect(request.pullDomainEvents().map((event) => event.name)).toContain('ContactRequestApproved');
  });

  it('rejects approving outbound requests locally', () => {
    const now = new Date();
    const request = ContactRequest.outbound({
      id: ContactRequestId.create('crq_2'),
      localPeerId: PeerId.create('pc_localpeer12345677'),
      remotePeerId: PeerId.create('pc_remotepeer1234567'),
      createdAt: now,
      updatedAt: now
    }, 'evt_1');

    expect(() => request.approve(now, 'evt_2')).toThrow('Only inbound pending requests');
  });
});
