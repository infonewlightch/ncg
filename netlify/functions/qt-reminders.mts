// @ts-ignore Server-only JavaScript module; no browser bundle includes its environment.
import {runQtPush} from '../../server/push-worker.mjs';

export default async()=>{
 const result=await runQtPush(process.env);
 if(result.skipped)return;
 // Counts only. Never log subscription endpoints, keys, payloads or account identifiers.
 console.log(JSON.stringify(result));
 if(result.acknowledgementFailures)throw Error('QT reminder acknowledgements require review');
};
// Netlify schedules published production deployments only; no public HTTP invocation.
export const config={schedule:'* * * * *'};
