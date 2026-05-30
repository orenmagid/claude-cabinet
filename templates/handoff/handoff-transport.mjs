import { writeFile, readFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const EMAIL_MCP_SIGNATURES = [
  { provider: 'gmail', toolPattern: /gmail/i },
  { provider: 'outlook', toolPattern: /outlook|microsoft/i },
];

export function detectEmailProvider(availableTools) {
  if (!availableTools?.length) return null;
  for (const sig of EMAIL_MCP_SIGNATURES) {
    if (availableTools.some(t => sig.toolPattern.test(t))) return sig.provider;
  }
  return null;
}

export function buildEmailInstruction(envelope, transportConfig, provider, recipient) {
  const envelopeId = typeof envelope === 'object' ? envelope.envelope_id : transportConfig.envelope_id;
  const serialized = typeof envelope === 'string'
    ? envelope
    : Buffer.from(JSON.stringify(envelope)).toString('base64');

  return {
    type: 'email',
    provider,
    to: recipient,
    subject: `[Handoff] ${envelopeId || 'delivery'}`,
    body: serialized,
  };
}

export function buildMcpInstruction(envelope, transportConfig) {
  const serialized = typeof envelope === 'string'
    ? envelope
    : Buffer.from(JSON.stringify(envelope)).toString('base64');

  return {
    type: 'mcp',
    tool: transportConfig.tool_name,
    params: {
      [transportConfig.payload_param || 'payload']: serialized,
      ...(transportConfig.extra_params || {}),
    },
  };
}

export async function sendViaFile(envelope, config) {
  const outdir = config?.outdir || './handoff-out';
  await mkdir(outdir, { recursive: true });

  const id = envelope.envelope_id || `env_${Date.now().toString(36)}`;
  const filepath = join(outdir, `${id}.enc`);
  const serialized = typeof envelope === 'string'
    ? envelope
    : Buffer.from(JSON.stringify(envelope)).toString('base64');

  await writeFile(filepath, serialized);
  return { type: 'file', delivered: true, ref: id, path: filepath };
}

export async function readFromFile(envelopeId, config) {
  const outdir = config?.outdir || './handoff-out';
  return readFile(join(outdir, `${envelopeId}.enc`), 'utf-8');
}

export async function listFiles(config) {
  const outdir = config?.outdir || './handoff-out';
  try {
    const files = await readdir(outdir);
    return files.filter(f => f.endsWith('.enc')).map(f => f.replace('.enc', ''));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function send(envelope, transportConfig, context) {
  const type = transportConfig.type || 'file';

  switch (type) {
    case 'email': {
      const provider = context?.emailProvider || detectEmailProvider(context?.availableTools);
      if (!provider) {
        process.stderr.write(
          'Warning: No email MCP connected — falling back to file transport.\n' +
          'Transfer files manually or connect an email MCP server.\n',
        );
        return { ...(await sendViaFile(envelope, transportConfig)), fallback: true };
      }
      const recipient = context?.side === 'consultant'
        ? transportConfig.client
        : transportConfig.consultant;
      return buildEmailInstruction(envelope, transportConfig, provider, recipient);
    }

    case 'mcp':
      return buildMcpInstruction(envelope, transportConfig);

    case 'file':
      return sendViaFile(envelope, transportConfig);

    default:
      throw new Error(`Unknown transport type: ${type}`);
  }
}
