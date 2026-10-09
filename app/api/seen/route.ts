import {env} from 'cloudflare:workers';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return new Response('',{status:403});
 let b:any;try{b=await request.json()}catch{return new Response('',{status:400})}
 if(typeof b.id!=='string'||b.id.length>80||typeof b.day!=='string'||b.day.length>12||!Number.isInteger(b.revision))return new Response('',{status:400});
 await env.DB!.batch([
 env.DB!.prepare('INSERT INTO screens (id,day,revision,seen) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET day=excluded.day,revision=excluded.revision,seen=excluded.seen').bind(b.id,b.day,b.revision,Date.now()),
 env.DB!.prepare('DELETE FROM screens WHERE seen < ?').bind(Date.now()-86400000)
 ]);
 return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
}
