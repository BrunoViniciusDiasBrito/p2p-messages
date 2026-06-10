# Group Flow

1. Creator creates group metadata and an initial key epoch.
2. Creator invites accepted contacts with signed `group_invite` envelopes.
3. Invitee accepts or rejects.
4. Membership changes rotate group key epoch.
5. Messages reference the epoch used at send time.

Production group encryption must be implemented by an MLS/OpenMLS adapter, not custom crypto.
