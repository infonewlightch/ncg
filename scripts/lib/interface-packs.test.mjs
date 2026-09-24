import {expect,it} from 'vitest';
import {interfaceSource,interfaceBatch,interfaceRevision} from '../../src/core/interface-catalogue.ts';
import {validPackMessages,pendingPackBatches,acceptedBatch,generationAction} from './interface-packs.mjs';
it('reuses valid source-keyed translations across catalogue ordering/revisions',()=>{
 const row=interfaceSource.find(row=>row.en==='Home');
 expect(validPackMessages({revision:'previous',messages:{Home:'Accueil',Removed:'Retiré'}})).toEqual({Home:'Accueil'});
 expect(validPackMessages({messages:{Home:'Accueil'},sourceContext:{Home:'changed meaning'}})).toEqual({});
 expect(validPackMessages({messages:{Home:'Accueil'},sourceContext:{Home:row.ko}})).toEqual({Home:'Accueil'});
 const complete=Object.fromEntries(interfaceSource.map(row=>[row.en,row.en]));expect(pendingPackBatches(complete)).toEqual([]);
});
it('accepts only exact language, current revision and complete valid batch',()=>{
 const batch=0,data={language:'fr',batch,revision:interfaceRevision,messages:interfaceBatch(batch).map(row=>({id:row.id,text:row.en}))};
 expect(acceptedBatch(data,'fr',0,interfaceRevision)).toBe(true);
 expect(acceptedBatch(data,'de',0,interfaceRevision)).toBe(false);
 expect(acceptedBatch({...data,messages:data.messages.slice(1)},'fr',0,interfaceRevision)).toBe(false);
});
it('stops globally on quota or revision mismatch, skips unsupported languages',()=>{
 expect(generationAction(409,'interface_updated')).toBe('stop');expect(generationAction(429,'translation_daily_limit')).toBe('stop');
 expect(generationAction(422,'unsupported_language')).toBe('skip-language');expect(generationAction(502,'translation_unavailable')).toBe('retry');
});
