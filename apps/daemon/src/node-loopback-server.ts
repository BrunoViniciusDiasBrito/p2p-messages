import { createServer } from 'node:http';
import { LoopbackServerPort } from './daemon.js';

export class NodeLoopbackServer implements LoopbackServerPort {
  private server: any | null = null;

  async listen(input: { host: '127.0.0.1'; port: number; handler: (request: Request) => Promise<Response> }): Promise<{ url: string }> {
    if (this.server) return { url: `http://${input.host}:${input.port}` };
    this.server = createServer(async (nodeRequest: any, nodeResponse: any) => {
      try {
        const request = await toFetchRequest(input.host, input.port, nodeRequest);
        const response = await input.handler(request);
        await writeFetchResponse(nodeResponse, response);
      } catch (error) {
        nodeResponse.statusCode = 500;
        nodeResponse.setHeader('content-type', 'application/json');
        nodeResponse.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected daemon error' }));
      }
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          this.server?.off('error', onError);
          reject(error);
        };
        this.server.once('error', onError);
        this.server.listen(input.port, input.host, () => {
          this.server?.off('error', onError);
          resolve();
        });
      });
    } catch (error) {
      this.server = null;
      throw error;
    }
    return { url: `http://${input.host}:${input.port}` };
  }

  async close(): Promise<void> {
    if (!this.server) return;
    const server = this.server;
    this.server = null;
    await new Promise<void>((resolve, reject) => server.close((error: Error | undefined) => error ? reject(error) : resolve()));
  }
}

async function toFetchRequest(host: string, port: number, nodeRequest: any): Promise<Request> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of nodeRequest) chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk));
  const body = chunks.length > 0 ? new TextDecoder().decode(concat(chunks)) : undefined;
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeRequest.headers as Record<string, string | string[] | undefined>)) {
    if (Array.isArray(value)) headers.set(key, value.join(', '));
    else if (value) headers.set(key, value);
  }
  const url = `http://${host}:${port}${nodeRequest.url ?? '/'}`;
  const init: RequestInit = { method: nodeRequest.method ?? 'GET', headers };
  if (body && nodeRequest.method !== 'GET' && nodeRequest.method !== 'HEAD') init.body = body;
  return new Request(url, init);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

async function writeFetchResponse(nodeResponse: any, response: Response): Promise<void> {
  nodeResponse.statusCode = response.status;
  response.headers.forEach((value, key) => nodeResponse.setHeader(key, value));
  if (!response.body) {
    nodeResponse.end();
    return;
  }
  const reader = response.body.getReader();
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    nodeResponse.write(chunk.value);
  }
  nodeResponse.end();
}
