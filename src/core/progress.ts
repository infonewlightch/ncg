export type ProgressDelta={added:string[];removed:string[]};
export type ProgressPending=ProgressDelta&{id:string;sent:string[]};
export type ProgressSync={baseline:string[];pending:ProgressPending|null;revision:number};
export function progressDelta(baseline:string[],current:string[]):ProgressDelta{
 const before=new Set(baseline),after=new Set(current);
 return {added:[...after].filter(key=>!before.has(key)),removed:[...before].filter(key=>!after.has(key))};
}
export function applyProgressDelta(remote:string[],delta:ProgressDelta){
 const result=new Set(remote);for(const key of delta.removed)result.delete(key);for(const key of delta.added)result.add(key);return [...result];
}
export function pullProgress(remote:string[],current:string[],sync:ProgressSync,revision=0){
 if(sync.pending||revision<sync.revision)return {completed:current,progressSync:sync};
 return {completed:applyProgressDelta(remote,progressDelta(sync.baseline,current)),progressSync:{baseline:remote,pending:null,revision}};
}
export function acknowledgeProgress(remote:string[],current:string[],pending:ProgressPending,revision=0){
 // Preserve edits made while the request was in flight, including unmarking a completion.
 return {completed:applyProgressDelta(remote,progressDelta(pending.sent,current)),progressSync:{baseline:remote,pending:null,revision}};
}
