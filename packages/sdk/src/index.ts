export interface PeerCommsClientOptions { readonly baseUrl: string; readonly token?: string; }
export interface RegisterAppInput { readonly name: string; }
export interface CreateTokenInput { readonly appId: string; readonly scopes: readonly string[]; }
export interface SendDirectMessageInput { readonly fromPeerId: string; readonly toPeerId: string; readonly text: string; }
export interface SendContactRequestInput { readonly localPeerId: string; readonly remotePeerId: string; readonly message?: string; }
export interface CreateGroupInput { readonly ownerPeerId: string; readonly name: string; }
export interface InvitePeerToGroupInput { readonly inviterPeerId: string; readonly inviteePeerId: string; }
export interface SubscribeWebhookInput { readonly webhookUrl: string; readonly eventTypes: readonly PeerCommsEventName[]; }
export type PeerCommsEventName =
  | 'contact.request.received'
  | 'contact.request.approved'
  | 'message.received'
  | 'message.sent'
  | 'message.failed'
  | 'group.invitation.received'
  | 'group.member.added'
  | 'notification.created'
  | 'peer.connected'
  | 'peer.disconnected';

export class PeerCommsApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'PeerCommsApiError';
  }
}

export class PeerCommsClient {
  readonly integrations = {
    registerApp: (input: RegisterAppInput): Promise<{ appId: string }> => this.post('/v1/integrations/apps', input, false),
    createToken: (input: CreateTokenInput): Promise<{ tokenId: string; token: string; scopes: readonly string[] }> => this.post('/v1/integrations/tokens', input)
  };

  readonly identity = {
    public: (): Promise<unknown> => this.get('/v1/identity/public')
  };

  readonly contacts = {
    list: (): Promise<unknown> => this.get('/v1/contacts'),
    sendRequest: (input: SendContactRequestInput): Promise<unknown> => this.post('/v1/contacts/requests', input),
    approveRequest: (requestId: string): Promise<unknown> => this.post(`/v1/contacts/requests/${encodeURIComponent(requestId)}/approve`, {}),
    rejectRequest: (requestId: string): Promise<unknown> => this.post(`/v1/contacts/requests/${encodeURIComponent(requestId)}/reject`, {}),
    block: (peerId: string): Promise<unknown> => this.post(`/v1/contacts/${encodeURIComponent(peerId)}/block`, {})
  };

  readonly conversations = {
    list: (): Promise<unknown> => this.get('/v1/conversations'),
    messages: (conversationId: string): Promise<unknown> => this.get(`/v1/conversations/${encodeURIComponent(conversationId)}/messages`)
  };

  readonly messages = {
    sendDirect: (input: SendDirectMessageInput): Promise<{ messageId: string; envelopeId: string }> => this.post('/v1/messages/direct', input)
  };

  readonly groups = {
    create: (input: CreateGroupInput): Promise<unknown> => this.post('/v1/groups', input),
    invite: (groupId: string, input: InvitePeerToGroupInput): Promise<unknown> => this.post(`/v1/groups/${encodeURIComponent(groupId)}/invitations`, input),
    acceptInvitation: (invitationId: string, welcomePayload: string): Promise<unknown> => this.post(`/v1/groups/invitations/${encodeURIComponent(invitationId)}/accept`, { welcomePayload }),
    rejectInvitation: (invitationId: string): Promise<unknown> => this.post(`/v1/groups/invitations/${encodeURIComponent(invitationId)}/reject`, {})
  };

  readonly events = {
    subscribeWebhook: (input: SubscribeWebhookInput): Promise<unknown> => this.post('/v1/events/webhooks', input),
    on: (eventName: PeerCommsEventName, handler: (event: unknown) => void): EventSource => {
      const source = new EventSource(`${this.options.baseUrl}/v1/events/stream`);
      source.addEventListener(eventName, (event) => handler(JSON.parse((event as MessageEvent).data)));
      return source;
    }
  };

  constructor(private readonly options: PeerCommsClientOptions) {}

  private get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  private post<T>(path: string, body: unknown, authenticated = true): Promise<T> {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) }, authenticated);
  }

  private async request<T>(path: string, init: RequestInit, authenticated = true): Promise<T> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (authenticated && this.options.token) headers.authorization = `Bearer ${this.options.token}`;
    const response = await fetch(`${this.options.baseUrl}${path}`, { ...init, headers: { ...headers, ...init.headers } });
    const payload = await response.json().catch(() => undefined) as unknown;
    if (!response.ok) {
      const message = typeof payload === 'object' && payload !== null && 'error' in payload ? String((payload as { error: unknown }).error) : `PeerComms API request failed with ${response.status}`;
      throw new PeerCommsApiError(response.status, message);
    }
    return payload as T;
  }
}
