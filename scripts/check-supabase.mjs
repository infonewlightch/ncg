// Read-only deployment checks. Uses the public client key, never a service-role key.
const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key)throw Error('Public Supabase connection is missing');
const checks=[
 ['published QT','/rest/v1/ncg_qt_readings?select=id,date,status&limit=1',200],
 ['published videos','/rest/v1/ncg_videos?select=id,status&limit=1',200],
 ['published community','/rest/v1/ncg_posts?select=id,status&limit=1',200],
 ['private messages','/rest/v1/ncg_messages?select=id&limit=1',401],
 ['admin role table','/rest/v1/ncg_admins?select=user_id&limit=1',401],
];
let failed=false;
for(const [name,path,expected] of checks){const response=await fetch(url+path,{headers:{apikey:key},signal:AbortSignal.timeout(15000)});const ok=response.status===expected;console.log(`${ok?'PASS':'FAIL'} ${name}: HTTP ${response.status}`);if(!ok)failed=true;}
if(failed)process.exitCode=1;
