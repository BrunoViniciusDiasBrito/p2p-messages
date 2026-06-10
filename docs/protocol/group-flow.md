# Group Flow

1. Creator creates group metadata and an initial key epoch.
2. Creator invites accepted contacts with signed `group_invite` envelopes.
3. Invitee accepts or rejects.
4. Membership changes rotate group key epoch.
5. Messages reference the epoch used at send time.

Production group encryption must be implemented by an MLS/OpenMLS adapter, not custom crypto.


## Implemented group membership foundation

The current group slice supports group creation, outbound invitations to accepted contacts, inbound invitation acceptance/rejection, member removal, and key epoch rotation. Cryptographic welcome generation, welcome acceptance, and epoch rotation are represented by `GroupCryptoPort` so production can use MLS/OpenMLS rather than custom group cryptography. Group-message encryption remains pending until the MLS/OpenMLS adapter exists.
