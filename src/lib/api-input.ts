export class ApiError extends Error {
  constructor(message: string, public status = 400, public headers: Record<string, string> = {}) { super(message); }
}

export function rejectBotField(body: Record<string, unknown>) {
  if (body.company_website !== undefined && body.company_website !== null && body.company_website !== '') throw new ApiError('Unable to submit this form.', 400);
}

export async function jsonObject(request: Request): Promise<Record<string, unknown>> {
  const maximum=65536;
  if(Number(request.headers.get('content-length'))>maximum)throw new ApiError('Request is too large.',413);
  let body: unknown;
  try {
    if(!request.body)throw new Error('Empty request');
    const reader=request.body.getReader(),decoder=new TextDecoder();let text='',bytes=0;
    try {for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maximum){await reader.cancel();throw new ApiError('Request is too large.',413);}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
    finally{reader.releaseLock();}
    body=JSON.parse(text);
  } catch(error) {if(error instanceof ApiError)throw error;throw new ApiError('Send a valid JSON object.');}
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError('Send a valid JSON object.');
  return body as Record<string, unknown>;
}

export function textField(value: unknown, label: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new ApiError('Invalid ' + label + '.');
  return value.trim();
}

export function uuidField(value: unknown, label: string): string {
  const id = textField(value, label, 36);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new ApiError('Invalid ' + label + '.');
  return id;
}

export function integer(value: unknown, min: number, max: number) {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) throw new ApiError('Expected a number between ' + min + ' and ' + max + '.');
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new ApiError('Expected a number between ' + min + ' and ' + max + '.');
  return number;
}

export function money(value: unknown, maximum = 99999999): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) throw new ApiError('Enter a valid amount in PKR.');
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > maximum || Math.abs(Math.round(amount * 100) - amount * 100) > 0.000001) throw new ApiError('Enter a valid amount in PKR.');
  return amount;
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new ApiError('Invalid request origin.', 403);
}
