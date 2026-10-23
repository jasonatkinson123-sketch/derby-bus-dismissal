import {authorized} from '../../../lib/controller-auth';
import { env } from 'cloudflare:workers';
export const dynamic = 'force-dynamic';
const VALID_BUSES:(number|string)[]=[51,52,53,54,55,56,57,58,59,60,'Walkers and Riders','Cross Country'];
const dayNow = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const response = (data:unknown,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store, max-age=0'}});
async function state(day:string) {
 const row = await env.DB!.prepare('SELECT * FROM dismissal WHERE day = ?').bind(day).first<any>();
 return {day, revision:row?.revision ?? 0, calls:JSON.parse(row?.calls ?? '[]').filter((call:any)=>VALID_BUSES.includes(call.bus)), requests:JSON.parse(row?.requests ?? '[]')};
}
export async function GET(request:Request) {
 const controller=new URL(request.url).searchParams.has('controller');
 if(controller && !(await authorized(request)))return response({error:'Unauthorized'},401);
 const s=await state(dayNow());
 const screens=controller ? (await env.DB!.prepare('SELECT revision, seen FROM screens WHERE day = ? AND seen > ?').bind(s.day,Date.now()-30000).all()).results : [];
 return response({day:s.day,revision:s.revision,calls:s.calls,screens,serverTime:Date.now()});
}
export async function POST(request:Request) {
 if(request.headers.get('origin')!==new URL(request.url).origin) return response({error:'Invalid origin'},403);
 if(!(await authorized(request)))return response({error:'Unauthorized'},401);
 // This shared prototype is protected by the Site's owner-only access policy.
 let body:any;try{body=await request.json()}catch{return response({error:'Invalid request'},400)}
 if(!['call','reset'].includes(body.action)||!Number.isInteger(body.revision)||typeof body.id!=='string'||body.id.length>80) return response({error:'Invalid action'},400);
 if(body.action==='call'&&!VALID_BUSES.includes(body.bus))return response({error:'Invalid bus'},400);
 const day=dayNow();if(body.day!==day)return response({error:'A new school day has started. Please try again.'},409);
 await env.DB!.prepare("INSERT OR IGNORE INTO dismissal (day, revision, calls, requests) VALUES (?,0,'[]','[]')").bind(day).run();
 const s=await state(day);
 if(s.requests.includes(body.id))return response({day:s.day,revision:s.revision,calls:s.calls});
 if(body.revision!==s.revision)return response({error:'The board changed. Check the latest state and try again.'},409);
 let calls=s.calls;
 if(body.action==='call'){
  if(calls.some((call:any)=>call.bus===body.bus))return response({error:`${typeof body.bus==='number'?'Bus ':''}${body.bus} has already been called.`},409);
  calls=[...calls,{bus:body.bus,at:Date.now(),id:body.id}];
 }
 if(body.action==='reset')calls=[];
 const result=await env.DB!.prepare('UPDATE dismissal SET revision = revision + 1, calls = ?, requests = ? WHERE day = ? AND revision = ?').bind(JSON.stringify(calls),JSON.stringify([...s.requests,body.id].slice(-100)),day,s.revision).run();
 if(result.meta.changes!==1)return response({error:'Another update arrived. Please try again.'},409);
 return response({day,revision:s.revision+1,calls});
}
