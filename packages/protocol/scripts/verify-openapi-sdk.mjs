import { readFile } from 'node:fs/promises';

const openApiUrl = new URL('../openapi/local-api.v1.yaml', import.meta.url);
const sdkSourceUrl = new URL('../../sdk/src/generated/local-api.ts', import.meta.url);
const openApi = await readFile(openApiUrl, 'utf8');
const sdkSource = await readFile(sdkSourceUrl, 'utf8');

const openApiOperations = readOpenApiOperations(openApi);
const sdkOperations = readSdkOperations(sdkSource);
const missingFromSdk = difference(openApiOperations, sdkOperations);
const undocumentedInOpenApi = difference(sdkOperations, openApiOperations);

if (missingFromSdk.length > 0 || undocumentedInOpenApi.length > 0) {
  const details = [
    missingFromSdk.length > 0 ? `Missing from SDK: ${missingFromSdk.join(', ')}` : '',
    undocumentedInOpenApi.length > 0 ? `Missing from OpenAPI: ${undocumentedInOpenApi.join(', ')}` : ''
  ].filter(Boolean).join('\n');
  throw new Error(`Local API contract verification failed.\n${details}`);
}

console.log(`OpenAPI/SDK contract verified (${openApiOperations.size} operations).`);

function readOpenApiOperations(document) {
  const operations = new Set();
  let path = null;
  for (const line of document.split(/\r?\n/)) {
    const pathMatch = line.match(/^  (\/v1\/[^:]+):\s*$/);
    if (pathMatch) {
      path = pathMatch[1];
      continue;
    }
    const methodMatch = line.match(/^    (get|post):\s*$/i);
    if (path && methodMatch) operations.add(toOperation(methodMatch[1], path));
  }
  if (operations.size === 0) throw new Error('No local API operations were found in the OpenAPI document');
  return operations;
}

function readSdkOperations(source) {
  const operations = new Set();
  let path = null;
  for (const line of source.split(/\r?\n/)) {
    const pathMatch = line.match(/^\s+"(\/v1\/[^"{]+(?:\{[^}]+\}[^"{]*)*)":\s*\{$/);
    if (pathMatch) {
      path = pathMatch[1];
      continue;
    }
    const methodMatch = line.match(/^\s{8}(get|post):\s*\{$/i);
    if (path && methodMatch) operations.add(toOperation(methodMatch[1], path));
  }
  if (operations.size === 0) throw new Error('No local API operations were found in the generated SDK source');
  return operations;
}

function toOperation(method, path) {
  return `${method.toUpperCase()} ${normalizePath(path)}`;
}

function normalizePath(path) {
  return path
    .replace(/\$\{[^}]+\}/g, '{param}')
    .replace(/\{[^}]+\}/g, '{param}');
}

function difference(left, right) {
  return [...left].filter((item) => !right.has(item)).sort();
}
