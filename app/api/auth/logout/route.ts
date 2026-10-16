import {sessionCookie,noStore} from '../../../../lib/controller-auth';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return noStore({error:'Invalid origin'},403);
 return noStore({ok:true},200,{'Set-Cookie':sessionCookie('',0)});
}
