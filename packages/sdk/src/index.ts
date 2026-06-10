export interface PeerCommsClientOptions { readonly baseUrl: string; readonly token: string; }
export interface SendDirectMessageInput { readonly toPeerId: string; readonly text: string; }
export type PeerCommsEventName = 'message.received' | 'message.sent' | 'message.failed' | 'contact.request.received' | 'peer.connected' | 'peer.disconnected';

export class PeerCommsClient {
  readonly messages = {
    sendDirect: async (input: SendDirectMessageInput): Promise<Response> => this.request('/v1/messages/direct', { method: 'POST', body: JSON.stringify(input) })
  };

  readonly events = {
    on: (eventName: PeerCommsEventName, handler: (event: unknown) => void): EventSource => {
      const source = new EventSource(`${this.options.baseUrl}/v1/events/stream`);
      source.addEventListener(eventName, (event) => handler(JSON.parse((event as MessageEvent).data)));
      return source;
    }
  };

  constructor(private readonly options: PeerCommsClientOptions) {}

  private async request(path: string, init: RequestInit): Promise<Response> {
    return fetch(`${this.options.baseUrl}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.options.token}`, ...init.headers }
    });
  }
}
