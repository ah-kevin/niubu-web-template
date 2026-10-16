export type RuntimeConfig = Readonly<{ schemaVersion: 1; apiURL: string }>;
export type RuntimeConfigDescriptor = Readonly<{
  fileName: '_app.config.js';
  schemaVersion: 1;
  defaults: RuntimeConfig;
}>;

export class RuntimeConfigError extends Error {
  readonly code: string;
  readonly field: string;
  readonly reason: string;

  constructor(code: string, field: string, reason: string) {
    super(`${code}: ${field}: ${reason}`);
    this.name = 'RuntimeConfigError';
    this.code = code;
    this.field = field;
    this.reason = reason;
  }
}

const scriptPrefix = 'globalThis.__APP_RUNTIME_CONFIG__=';
const scriptSuffix = ';\n';

function invalid(field: string, reason: string): never {
  throw new RuntimeConfigError('RUNTIME_CONFIG_INVALID', field, reason);
}

function isPlainPrototype(prototype: object | null): boolean {
  if (prototype === null || prototype === Object.prototype) return true;
  if (Object.getPrototypeOf(prototype) !== null) return false;
  // A sandbox has its own Object.prototype; accept it without accepting custom inheritance.
  const constructor: unknown = Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value;
  return (
    typeof constructor === 'function' &&
    Object.getOwnPropertyDescriptor(constructor, 'prototype')?.value === prototype &&
    Function.prototype.toString.call(constructor) === Function.prototype.toString.call(Object)
  );
}

/** Check raw syntax before URL normalization can discard credentials, paths or controls. */
function parseOrigin(value: unknown, field: 'apiURL' | 'origin'): URL {
  if (
    typeof value !== 'string' ||
    !/^https?:\/\/[^/?#\\@\s]+\/?$/i.test(value) ||
    Array.from(value).some(char => {
      const code = char.charCodeAt(0);
      return code < 32 || (code >= 127 && code <= 159);
    })
  ) {
    invalid(field, 'Expected an absolute HTTP(S) origin with an optional root slash');
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    invalid(field, 'Expected a valid HTTP(S) origin');
  }
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    invalid(field, 'Only an HTTP(S) origin without credentials, query or fragment is allowed');
  }
  return url;
}

export function validateRuntimeConfig(value: unknown): RuntimeConfig {
  if (value === undefined) {
    throw new RuntimeConfigError('RUNTIME_CONFIG_MISSING', 'config', 'Runtime configuration is required');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalid('config', 'Expected a plain configuration record');
  }
  let properties: PropertyDescriptorMap;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (!isPlainPrototype(prototype)) {
      invalid('config', 'Expected a plain configuration record');
    }
    properties = Object.getOwnPropertyDescriptors(value);
  } catch {
    invalid('config', 'Expected an inspectable plain configuration record');
  }
  const keys = Reflect.ownKeys(properties);
  if (keys.some(key => key !== 'schemaVersion' && key !== 'apiURL')) {
    invalid('config', 'Only schemaVersion and apiURL are allowed');
  }
  const version = properties.schemaVersion;
  if (!version || !('value' in version) || version.value !== 1) {
    invalid('schemaVersion', 'Expected schema version 1');
  }
  const api = properties.apiURL;
  if (!api || !('value' in api) || typeof api.value !== 'string') {
    invalid('apiURL', 'Expected a root API address');
  }
  const apiURL: string = api.value;
  if (apiURL !== '/') parseOrigin(apiURL, 'apiURL');
  return Object.freeze({ schemaVersion: 1, apiURL });
}

export function serializeRuntimeConfig(value: RuntimeConfig): string {
  const { schemaVersion, apiURL } = validateRuntimeConfig(value);
  return `${scriptPrefix}${JSON.stringify({ schemaVersion, apiURL })}${scriptSuffix}`;
}

export function parseRuntimeConfigScript(source: string): RuntimeConfig {
  if (typeof source !== 'string' || !source.startsWith(scriptPrefix) || !source.endsWith(scriptSuffix)) {
    throw new RuntimeConfigError(
      'RUNTIME_CONFIG_SCRIPT_INVALID',
      'script',
      'Expected the canonical configuration script',
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(source.slice(scriptPrefix.length, -scriptSuffix.length));
  } catch {
    throw new RuntimeConfigError('RUNTIME_CONFIG_SCRIPT_INVALID', 'script', 'Expected a JSON configuration record');
  }
  const config = validateRuntimeConfig(value);
  if (serializeRuntimeConfig(config) !== source) {
    throw new RuntimeConfigError(
      'RUNTIME_CONFIG_SCRIPT_INVALID',
      'script',
      'Configuration script must use canonical bytes',
    );
  }
  return config;
}

export function resolveRuntimeConfig(value: unknown, origin: string): Readonly<{ apiBaseURL: string }> {
  const config = validateRuntimeConfig(value);
  const base = parseOrigin(origin, 'origin');
  return Object.freeze({ apiBaseURL: new URL(config.apiURL, base).href });
}
