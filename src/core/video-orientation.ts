type VideoOrientation={lock?:(direction:'landscape')=>Promise<void>;unlock?:()=>void};
let latestRequest=0;

// Browser support varies: orientation failure must never stop video fullscreen.
export function requestVideoLandscape(orientation?:VideoOrientation){
 const request=++latestRequest;let released=false,needsUnlock=false;
 const unlock=()=>{if(request!==latestRequest||!needsUnlock)return;try{orientation?.unlock?.();}catch{ /* Some webviews also reject unlock. */ }};
 if(orientation?.lock){
  needsUnlock=true;
  try{Promise.resolve(orientation.lock('landscape')).then(()=>{if(released)unlock();},()=>{needsUnlock=false;});}
  catch{needsUnlock=false;}
 }
 return()=>{if(released)return;released=true;unlock();};
}
