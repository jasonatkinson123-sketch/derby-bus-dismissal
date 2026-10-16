import {authorized, noStore} from '../../../../lib/controller-auth';
export async function GET(request:Request){return noStore({authorized:await authorized(request)})}
