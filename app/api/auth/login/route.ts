import {isValidPin, issueSession, permitAttempt, recordFailedAttempt, clearFailedAttempts, noStore} from '../../../../lib/controller-auth';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return noStore({error:'Invalid origin'},403);
 if(!(await permitAttempt(request)))return noStore({error:'Too many attempts. Try again in 15 minutes.'},429);
 let body:unknown;try{body=await request.json()}catch{return noStore({error:'Invalid request'},400)}
 if(!body||typeof body!=='object'||!('pin' in body)||!isValidPin((body as {pin:unknown}).pin)){
  await recordFailedAttempt(request);
  return noStore({error:'Incorrect PIN'},401);
 }
 await clearFailedAttempts(request);
 return noStore({ok:true,token:await issueSession()});
}
