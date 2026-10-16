import { env } from 'cloudflare:workers';

const encoder = new TextEncoder();
const settings = () => env as unknown as { CONTROLLER_PIN?:string; SESSION_SECRET?:string; DB: NonNullable<typeof env.DB> };
const cookieName = 'derby_controller';
const maxAge = 30 * 24 * 60 * 60;
function hex(bytes:Uint8Array){return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function key(){
 const secret=settings().SESSION_SECRET;
 if(!secret || secret.length<32) throw new Error('SESSION_SECRET must be configured (32+ characters)');
 return crypto.subtle.importKey('raw',encoder.encode(secret),'HMAC',false,['sign']);
}
async function signature(payload:string){
 const k=await key();
 return hex(new Uint8Array(await crypto.subtle.sign('HMAC',k,encoder.encode(payload))));
}
async function secureEqual(a:string,b:string){
 if(a.length!==b.length)return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 return diff===0;
}
export function sessionCookie(value:string,maxAgeSeconds=maxAge){
 return `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}`;
}
export async function issueSession(){
 const expiry=Date.now()+maxAge*1000;
 // Tying signatures to the current PIN invalidates cookies when the PIN changes.
 const nonce=crypto.randomUUID();
 const data=`${expiry}.${nonce}.${settings().CONTROLLER_PIN || ''}`;
 return `${expiry}.${nonce}.${await signature(data)}`;
}
export async function authorized(request:Request){
 const cookie=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 if(!cookie)return false;
 const parts=cookie.split('.');
 if(parts.length!==3)return false;
 const [expiry,nonce,sig]=parts;
 if(!/^\d{13}$/.test(expiry)||!/^[-a-f0-9]{36}$/.test(nonce)||!new RegExp('^[a-f0-9]{64}$').test(sig))return false;
 if(Number(expiry)<=Date.now()||Number(expiry)>Date.now()+maxAge*1000+60000)return false;
 const expected=await signature(`${expiry}.${nonce}.${settings().CONTROLLER_PIN||''}`);
 return secureEqual(sig,expected);
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
