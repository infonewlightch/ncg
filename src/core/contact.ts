export const contactKinds=['suggestion','problem','thanks','other'] as const;
export type ContactKind=typeof contactKinds[number];
export type ContactDraft={kind:ContactKind;name:string;email:string;message:string;language:string;website:string};
export function contactHostAvailable(host:string){return host==='newlightchurchglobal.com'||host==='www.newlightchurchglobal.com'||host==='ncg-newlight.netlify.app';}
export function contactPayload(draft:ContactDraft){
 const name=draft.name.trim(),email=draft.email.trim(),message=draft.message.trim();
 if(!contactKinds.includes(draft.kind)||name.length>80||email.length>254||message.length<5||message.length>4000||draft.website||!/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/.test(draft.language))throw Error('invalid_contact');
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('invalid_email');
 return new URLSearchParams({'form-name':'ncg-contact',category:draft.kind,name,email,message,language:draft.language,website:''});
}
export async function submitContact(draft:ContactDraft,origin:string,send:typeof fetch=fetch){
 const url=new URL(origin);
 if(url.protocol!=='https:'||!contactHostAvailable(url.hostname))throw Error('contact_unavailable');
 const body=contactPayload(draft);
 const response=await send(new URL('/',url.origin),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString(),credentials:'same-origin',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error(response.status===429?'rate_limited':'contact_failed');
}
