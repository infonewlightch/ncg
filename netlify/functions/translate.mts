// A shared quota store and provider credentials are required before activating
// translation across multiple serverless instances. Fail closed in the preview.
export default function handler(){return Response.json({error:'translation_not_configured'},{status:503,headers:{'Cache-Control':'no-store'}});}
export const config={path:'/api/translate'};
