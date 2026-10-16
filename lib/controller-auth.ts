import {env} from 'cloudflare:workers';
const encoder=new TextEncoder();
const settings=()=>env as unknown as {CONTROLLER_PIN?:string; DB: NonNullable<typeof env.DB>};
function hex(bytes:Uint8Array){return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function hashed(token:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(token))))}
export async function issueSession(){
 const token=hex(crypto.getRandomValues(new Uint8Array(32)));
 await settings().DB.prepare('INSERT INTO controller_sessions (token_hash,expires) VALUES (?,?)').bind(await hashed(token),Date.now()+8*60*60*1000).run();
 return token;
}
export async function authorized(request:Request){
 const authorization=request.headers.get('Authorization')||'';
 if(!/^Bearer [a-f0-9]{64}$/.test(authorization))return false;
 const token=authorization.slice(7);
 const row=await settings().DB.prepare('SELECT expires FROM controller_sessions WHERE token_hash=?').bind(await hashed(token)).first<{expires:number}>();
 return !!row && row.expires>Date.now();
}
export async function revokeSession(request:Request){
 const authorization=request.headers.get('Authorization')||'';
 if(/^Bearer [a-f0-9]{64}$/.test(authorization))await settings().DB.prepare('DELETE FROM controller_sessions WHERE token_hash=?').bind(await hashed(authorization.slice(7))).run();
}
export function isValidPin(pin:unknown){const configured=settings().CONTROLLER_PIN;
 if(!configured||!/^\d{4}$/.test(configured))throw new Error('CONTROLLER_PIN must be a four-digit secret');
 return typeof pin==='string' && /^\d{4}$/.test(pin) && configured===pin;
}
const LOGIN_WINDOW_MS=15*60*1000;
const MAX_FAILED_LOGINS=5;
async function clientBucket(request:Request){
 const ip=request.headers.get('CF-Connecting-IP')||'unknown';
 return (await hashed(ip)).slice(0,40);
}
export async function permitAttempt(request:Request){
 const bucket=await clientBucket(request);
 const now=Date.now();
 const row=await settings().DB.prepare('SELECT started,attempts FROM login_attempts WHERE id=?').bind(bucket).first<{started:number,attempts:number}>();
 return !row || now-row.started>=LOGIN_WINDOW_MS || row.attempts<MAX_FAILED_LOGINS;
}
export async function recordFailedAttempt(request:Request){
 const bucket=await clientBucket(request);
 const now=Date.now(), cutoff=now-LOGIN_WINDOW_MS;
 await settings().DB.prepare(`INSERT INTO login_attempts(id,started,attempts) VALUES(?,?,1)
 ON CONFLICT(id) DO UPDATE SET
 attempts=CASE WHEN started<=? THEN 1 ELSE attempts+1 END,
 started=CASE WHEN started<=? THEN ? ELSE started END`)
 .bind(bucket,now,cutoff,cutoff,now).run();
}
export async function clearFailedAttempts(request:Request){
 await settings().DB.prepare('DELETE FROM login_attempts WHERE id=?').bind(await clientBucket(request)).run();
}
export function noStore(data:unknown,status=200,headers?:HeadersInit){return Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}})}
