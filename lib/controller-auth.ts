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
export async function permitAttempt(request:Request){
 const ip=request.headers.get('CF-Connecting-IP')||'unknown';
 const bucket=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(ip)))).slice(0,40);
 const now=Date.now(),period=15*60*1000;
 await settings().DB.prepare('DELETE FROM login_attempts WHERE started < ?').bind(now-period).run();
 const row=await settings().DB.prepare('SELECT started, attempts FROM login_attempts WHERE id=?').bind(bucket).first<{started:number,attempts:number}>();
 if(row&&row.attempts>=5&&now-row.started<period)return false;
 await settings().DB.prepare('INSERT INTO login_attempts(id,started,attempts) VALUES(?,?,1) ON CONFLICT(id) DO UPDATE SET attempts=CASE WHEN started < excluded.started-900000 THEN 1 ELSE attempts+1 END, started=CASE WHEN started < excluded.started-900000 THEN excluded.started ELSE started END').bind(bucket,now).run();
 return true;
}
export function noStore(data:unknown,status=200,headers?:HeadersInit){return Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}})}
