import { describe, expect, it } from 'vitest';
import { groupInvitePayloadSchema, keyRotationPayloadSchema } from '../index.js';

describe('group protocol schemas', () => {
  it('validates group invite payloads with MLS welcome data placeholder', () => {
    const parsed = groupInvitePayloadSchema.parse({
      invitationId: 'ginv_1',
      groupId: 'grp_1',
      groupName: 'Core Team',
      inviterPeerId: 'pc_inviterpeer1234',
      inviteePeerId: 'pc_inviteepeer1234',
      keyEpoch: 0,
      welcomePayload: 'welcome_payload_for_mls_adapter'
    });
    expect(parsed.keyEpoch).toBe(0);
  });

  it('rejects non-incrementing key rotations', () => {
    expect(() => keyRotationPayloadSchema.parse({ groupId: 'grp_1', previousEpoch: 2, nextEpoch: 2, reason: 'manual' })).toThrow();
  });
});
