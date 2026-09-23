import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {brotliDecompressSync} from 'node:zlib';
import {createProductionHandler,preferredEncoding} from './production';
import {invokeHandler} from './http-test-utils';

let directory:string,dist:string;
const document='<html>'+('Safe public content '.repeat(100))+'</html>';
beforeAll(async()=>{
 directory=await mkdtemp(join(tmpdir(),'ncg-http-test-'));dist=join(directory,'dist');await mkdir(join(dist,'assets'),{recursive:true});
 await Promise.all([writeFile(join(dist,'index.html'),document),writeFile(join(dist,'admin.html'),document),writeFile(join(dist,'sw.js'),'/* worker */'),writeFile(join(dist,'assets','app.js'),'/* public asset */'),writeFile(join(directory,'secret.txt'),'Private outside directory'),writeFile(join(dist,'.env'),'Private dot file')]);
 await symlink(join(directory,'secret.txt'),join(dist,'escape.txt'));
});
afterAll(async()=>{await rm(directory,{recursive:true,force:true});});
const handler=()=>createProductionHandler({NCG_PUBLIC_ORIGIN:'http://127.0.0.1:4311',VITE_SUPABASE_URL:'https://test.supabase.co'},dist);
describe('production static file and browser boundaries',()=>{
 it('serves public navigation with CSP, uncached shells and immutable built assets',async()=>{
  const result=await invokeHandler(handler());expect(result.status).toBe(200);expect(result.text).toBe(document);expect(result.headers['cache-control']).toBe('no-store');
  expect(result.headers['content-security-policy']).toContain("script-src 'self'");expect(result.headers['content-security-policy']).toContain('https://test.supabase.co wss://test.supabase.co');
  expect((await invokeHandler(handler(),{url:'/auth/callback?code=test'})).text).toBe(document);
  const admin=await invokeHandler(handler(),{url:'/admin.html'});expect(admin.headers['x-robots-tag']).toBe('noindex, nofollow');expect(admin.headers['cache-control']).toBe('no-store');
  expect((await invokeHandler(handler(),{url:'/sw.js'})).headers['cache-control']).toBe('no-store');expect((await invokeHandler(handler(),{url:'/assets/app.js'})).headers['cache-control']).toContain('immutable');
 });
 it('does not serve traversal, symlink escapes, hidden config or another host',async()=>{
  for(const url of ['/escape.txt','/.env','/%2e%2e%2fsecret.txt','/%5csecret.txt']){const result=await invokeHandler(handler(),{url});expect(result.status).toBeGreaterThanOrEqual(400);expect(result.text).not.toContain('Private');}
  expect((await invokeHandler(handler(),{headers:{host:'attacker.example'}})).status).toBe(421);
  expect((await invokeHandler(handler(),{url:'https://attacker.example/index.html'})).status).toBe(403);
  expect((await invokeHandler(handler(),{method:'POST'})).status).toBe(405);
 });
 it('compresses accepted text, respects q=0, and returns correct HEAD metadata',async()=>{
  const app=handler();const result=await invokeHandler(app,{headers:{'accept-encoding':'gzip;q=0.6, br'}});expect(result.headers['content-encoding']).toBe('br');expect(brotliDecompressSync(result.output).toString()).toBe(document);
  expect((await invokeHandler(app,{headers:{'accept-encoding':'br;q=0,gzip;q=0'}})).headers['content-encoding']).toBeUndefined();
  const head=await invokeHandler(app,{method:'HEAD'});expect(head.output.length).toBe(0);expect(head.headers['content-length']).toBe(Buffer.byteLength(document));expect(head.headers.vary).toBe('Accept-Encoding');
  expect(preferredEncoding('br;q=0.1, gzip;q=0.9')).toBe('gzip');expect(preferredEncoding('xbr, not-gzip')).toBe('');
 });
});
