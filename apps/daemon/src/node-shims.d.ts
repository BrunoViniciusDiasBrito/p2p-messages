declare module 'node:http' {
  export function createServer(listener: (request: any, response: any) => void): any;
}
