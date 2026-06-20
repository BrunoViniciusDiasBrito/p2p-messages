import { Result } from '@peercomms/domain';

export interface LocalApiUseCases {
  readonly registerExternalApplication: { execute(input: { name: string }): Promise<Result<{ appId: string }>> };
  readonly createApiToken: { execute(input: { appId: string; scopes: readonly string[] }): Promise<Result<{ tokenId: string; token: string; scopes: readonly string[] }>> };
  readonly exportPublicIdentity: { execute(): Promise<Result<unknown>> };
  readonly listContacts: { execute(): Promise<Result<unknown>> };
  readonly sendContactRequest: { execute(input: { localPeerId: string; remotePeerId: string; message?: string }): Promise<Result<unknown>> };
  readonly approveContactRequest: { execute(input: { requestId: string }): Promise<Result<unknown>> };
  readonly rejectContactRequest: { execute(input: { requestId: string }): Promise<Result<unknown>> };
  readonly blockPeer: { execute(input: { peerId: string }): Promise<Result<unknown>> };
  readonly listConversations: { execute(): Promise<Result<unknown>> };
  readonly listMessages: { execute(input: { conversationId: string }): Promise<Result<unknown>> };
  readonly sendMessageFromExternalApp: { execute(input: { token: string; fromPeerId: string; toPeerId: string; text: string }): Promise<Result<unknown>> };
  readonly listNotifications?: { execute(input?: { limit?: number; unreadOnly?: boolean }): Promise<Result<unknown>> };
  readonly markNotificationAsRead?: { execute(input: { notificationId: string }): Promise<Result<unknown>> };
  readonly listNetworkPeers?: { execute(input?: { limit?: number }): Promise<Result<unknown>> };
  readonly createGroup?: { execute(input: { ownerPeerId: string; name: string }): Promise<Result<unknown>> };
  readonly invitePeerToGroup?: { execute(input: { groupId: string; inviterPeerId: string; inviteePeerId: string }): Promise<Result<unknown>> };
  readonly acceptGroupInvitation?: { execute(input: { invitationId: string; welcomePayload: string }): Promise<Result<unknown>> };
  readonly rejectGroupInvitation?: { execute(input: { invitationId: string }): Promise<Result<unknown>> };
  readonly sendGroupMessage?: { execute(input: { groupId: string; fromPeerId: string; text: string }): Promise<Result<unknown>> };
  readonly subscribeExternalAppToEvents: { execute(input: { token: string; webhookUrl: string; eventTypes: readonly string[] }): Promise<Result<unknown>> };
}

export interface LocalApiEvent {
  readonly type: string;
  readonly data: unknown;
  readonly id?: string;
}

export class LocalSseEventHub {
  private readonly subscribers = new Set<ReadableStreamDefaultController<Uint8Array>>();
  private readonly encoder = new TextEncoder();

  publish(event: LocalApiEvent): void {
    const frame = this.encoder.encode(this.format(event));
    for (const subscriber of this.subscribers) subscriber.enqueue(frame);
  }

  openStream(): ReadableStream<Uint8Array> {
    let activeController: ReadableStreamDefaultController<Uint8Array> | null = null;
    return new ReadableStream<Uint8Array>({
      start: (controller) => {
        activeController = controller;
        this.subscribers.add(controller);
        controller.enqueue(this.encoder.encode(': connected\n\n'));
      },
      cancel: () => {
        if (activeController) this.subscribers.delete(activeController);
      }
    });
  }

  remove(controller: ReadableStreamDefaultController<Uint8Array>): void {
    this.subscribers.delete(controller);
  }

  private format(event: LocalApiEvent): string {
    const id = event.id ? `id: ${event.id}\n` : '';
    return `${id}event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
  }
}

export class LocalApiHttpHandler {
  constructor(private readonly useCases: LocalApiUseCases, private readonly events = new LocalSseEventHub()) {}

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (!this.isLoopback(url.hostname)) return this.json({ error: 'Local API only accepts loopback hosts' }, 403, request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: this.corsHeaders(request) });

    try {
      const route = `${request.method} ${url.pathname}`;
      if (route === 'POST /v1/integrations/apps') return this.fromResult(await this.useCases.registerExternalApplication.execute(await this.body<{ name: string }>(request)), request);
      if (route === 'POST /v1/integrations/tokens') return this.fromResult(await this.useCases.createApiToken.execute(await this.body<{ appId: string; scopes: readonly string[] }>(request)), request);
      if (route === 'GET /v1/identity/public') return this.fromResult(await this.useCases.exportPublicIdentity.execute(), request);
      if (route === 'GET /v1/contacts') return this.fromResult(await this.useCases.listContacts.execute(), request);
      if (route === 'POST /v1/contacts/requests') return this.fromResult(await this.useCases.sendContactRequest.execute(await this.body<{ localPeerId: string; remotePeerId: string; message?: string }>(request)), request);
      if (route === 'GET /v1/conversations') return this.fromResult(await this.useCases.listConversations.execute(), request);
      if (route === 'POST /v1/messages/direct') return this.fromResult(await this.useCases.sendMessageFromExternalApp.execute({ ...(await this.body<{ fromPeerId: string; toPeerId: string; text: string }>(request)), token: this.bearerToken(request) }), request);
      if (route === 'GET /v1/notifications' && this.useCases.listNotifications) return this.fromResult(await this.useCases.listNotifications.execute({
        ...(url.searchParams.has('limit') ? { limit: Number(url.searchParams.get('limit')) } : {}),
        ...(url.searchParams.get('unread') === 'true' ? { unreadOnly: true } : {})
      }), request);
      if (route === 'GET /v1/network/peers' && this.useCases.listNetworkPeers) return this.fromResult(await this.useCases.listNetworkPeers.execute({
        ...(url.searchParams.has('limit') ? { limit: Number(url.searchParams.get('limit')) } : {})
      }), request);
      if (route === 'POST /v1/groups' && this.useCases.createGroup) return this.fromResult(await this.useCases.createGroup.execute(await this.body<{ ownerPeerId: string; name: string }>(request)), request);
      if (route === 'POST /v1/events/webhooks') return this.fromResult(await this.useCases.subscribeExternalAppToEvents.execute({ ...(await this.body<{ webhookUrl: string; eventTypes: readonly string[] }>(request)), token: this.bearerToken(request) }), request);
      if (route === 'GET /v1/events/stream') return new Response(this.events.openStream(), { status: 200, headers: { ...this.corsHeaders(request), 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' } });

      const contactRequestMatch = url.pathname.match(/^\/v1\/contacts\/requests\/([^/]+)\/(approve|reject)$/);
      if (request.method === 'POST' && contactRequestMatch?.[1] && contactRequestMatch[2] === 'approve') return this.fromResult(await this.useCases.approveContactRequest.execute({ requestId: decodeURIComponent(contactRequestMatch[1]) }), request);
      if (request.method === 'POST' && contactRequestMatch?.[1] && contactRequestMatch[2] === 'reject') return this.fromResult(await this.useCases.rejectContactRequest.execute({ requestId: decodeURIComponent(contactRequestMatch[1]) }), request);

      const blockMatch = url.pathname.match(/^\/v1\/contacts\/([^/]+)\/block$/);
      if (request.method === 'POST' && blockMatch?.[1]) return this.fromResult(await this.useCases.blockPeer.execute({ peerId: decodeURIComponent(blockMatch[1]) }), request);

      const messagesMatch = url.pathname.match(/^\/v1\/conversations\/([^/]+)\/messages$/);
      if (request.method === 'GET' && messagesMatch?.[1]) return this.fromResult(await this.useCases.listMessages.execute({ conversationId: decodeURIComponent(messagesMatch[1]) }), request);

      const notificationReadMatch = url.pathname.match(/^\/v1\/notifications\/([^/]+)\/read$/);
      if (request.method === 'POST' && notificationReadMatch?.[1] && this.useCases.markNotificationAsRead) return this.fromResult(await this.useCases.markNotificationAsRead.execute({ notificationId: decodeURIComponent(notificationReadMatch[1]) }), request);

      const groupInviteMatch = url.pathname.match(/^\/v1\/groups\/([^/]+)\/invitations$/);
      if (request.method === 'POST' && groupInviteMatch?.[1] && this.useCases.invitePeerToGroup) return this.fromResult(await this.useCases.invitePeerToGroup.execute({ ...(await this.body<{ inviterPeerId: string; inviteePeerId: string }>(request)), groupId: decodeURIComponent(groupInviteMatch[1]) }), request);

      const groupInvitationActionMatch = url.pathname.match(/^\/v1\/groups\/invitations\/([^/]+)\/(accept|reject)$/);
      if (request.method === 'POST' && groupInvitationActionMatch?.[1] && groupInvitationActionMatch[2] === 'accept' && this.useCases.acceptGroupInvitation) return this.fromResult(await this.useCases.acceptGroupInvitation.execute({ ...(await this.body<{ welcomePayload: string }>(request)), invitationId: decodeURIComponent(groupInvitationActionMatch[1]) }), request);
      if (request.method === 'POST' && groupInvitationActionMatch?.[1] && groupInvitationActionMatch[2] === 'reject' && this.useCases.rejectGroupInvitation) return this.fromResult(await this.useCases.rejectGroupInvitation.execute({ invitationId: decodeURIComponent(groupInvitationActionMatch[1]) }), request);

      const groupMessageMatch = url.pathname.match(/^\/v1\/groups\/([^/]+)\/messages$/);
      if (request.method === 'POST' && groupMessageMatch?.[1] && this.useCases.sendGroupMessage) return this.fromResult(await this.useCases.sendGroupMessage.execute({ ...(await this.body<{ fromPeerId: string; text: string }>(request)), groupId: decodeURIComponent(groupMessageMatch[1]) }), request);

      return this.json({ error: 'Not found' }, 404, request);
    } catch (error) {
      return this.json({ error: error instanceof Error ? error.message : 'Unexpected local API error' }, 500, request);
    }
  }

  publishEvent(event: LocalApiEvent): void {
    this.events.publish(event);
  }

  private async body<T extends Record<string, unknown>>(request: Request): Promise<T> {
    if (request.headers.get('content-length') === '0') return {} as T;
    const text = await request.text();
    return text.trim() ? JSON.parse(text) as T : {} as T;
  }

  private bearerToken(request: Request): string {
    const header = request.headers.get('authorization') ?? '';
    return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  }

  private fromResult<T>(result: Result<T>, request: Request): Response {
    return result.ok ? this.json(result.value, 200, request) : this.json({ error: result.error.message }, 400, request);
  }

  private json(body: unknown, status: number, request: Request): Response {
    return new Response(JSON.stringify(body), { status, headers: { ...this.corsHeaders(request), 'content-type': 'application/json' } });
  }

  private corsHeaders(request: Request): Record<string, string> {
    const origin = request.headers.get('origin');
    const allowOrigin = origin && this.isLoopbackOrigin(origin) ? origin : 'http://127.0.0.1';
    return {
      'access-control-allow-origin': allowOrigin,
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      vary: 'origin'
    };
  }

  private isLoopback(hostname: string): boolean {
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]' || hostname === '::1';
  }

  private isLoopbackOrigin(origin: string): boolean {
    if (origin === 'tauri://localhost' || origin === 'http://tauri.localhost') return true;
    try {
      return this.isLoopback(new URL(origin).hostname);
    } catch {
      return false;
    }
  }
}
