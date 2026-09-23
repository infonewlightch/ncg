import {describe,it,expect,vi} from 'vitest';
import {createGateway,RateLimiter,sourceAddress,type GatewayServices} from './gateway';
import {invokeHandler} from './http-test-utils';
import type {IncomingMessage} from 'node:http';

const env={NCG_PUBLIC_ORIGIN:'http://127.0.0.1:4311',NCG_TRANSLATION_URL:'https://unused.invalid',NCG_TRANSLATION_KEY:'test-only',NCG_TRANSLATION_MODEL:'test'};
const postId='11111111-1111-4111-8111-111111111111';
const token='a'.repeat(30);
const body={text:'A private message',source:'en',target:'ko'};
function setup(overrides:Partial<GatewayServices>={}){
 const services:GatewayServices={
  verify:vi.fn(async()=>'verified-member'),post:vi.fn(async()=>({body:'Actual published words',language:'en',status:'published'})),
  translate:vi.fn(async(_req,res,_env,options)=>{res.writeHead(200);res.end(JSON.stringify(options));}),
  bible:vi.fn(async(req,res)=>{res.writeHead(200);res.end(JSON.stringify({url:req.url}));}),...overrides
 };
 const gateway=createGateway(env,services);
 const request=(value:unknown=body,headers:Record<string,string>={})=>invokeHandler(gateway,{url:'/api/translate',method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(value)});
 return {services,gateway,request};
}
describe('production API authorization and resource limits',()=>{
 it('requires a verified active member for arbitrary or private text',async()=>{
  const {request,services}=setup();expect((await request()).status).toBe(401);
  const result=await request(body,{authorization:`Bearer ${token}`});expect(result.status).toBe(200);
  expect(result.json()).toMatchObject({body,cacheScope:'member:verified-member'});
  expect(services.verify).toHaveBeenCalledWith(token);
  const rejected=setup({verify:vi.fn(async()=>null)});expect((await rejected.request(body,{authorization:`Bearer ${token}`})).status).toBe(401);expect(rejected.services.translate).not.toHaveBeenCalled();
 });
 it('translates only the actual public post text for guests, ignoring substituted text',async()=>{
  const {request,services}=setup();const result=await request({...body,postId,text:'Caller tried to replace the text'});
  expect(result.status).toBe(200);expect(result.json()).toMatchObject({body:{text:'Actual published words',source:'en',target:'ko'},cacheScope:`public:${postId}`});
  expect(services.post).toHaveBeenCalledWith(postId,null);
  const hidden=setup({post:vi.fn(async()=>({body:'Hidden draft',language:'en',status:'pending'}))});expect((await hidden.request({...body,postId})).status).toBe(404);expect(hidden.services.translate).not.toHaveBeenCalled();
 });
 it('passes a verified bearer to RLS and does not expose unavailable posts',async()=>{
  const {request,services}=setup({post:vi.fn(async()=>null)});
  expect((await request({...body,postId},{authorization:`Bearer ${token}`})).status).toBe(404);expect(services.post).toHaveBeenCalledWith(postId,token);
  expect((await request({...body,postId:'-'.repeat(36)})).status).toBe(400);
  const down=setup({post:vi.fn(async()=>{throw Error('internal secret');})});const result=await down.request({...body,postId});expect(result.status).toBe(503);expect(result.text).not.toContain('internal secret');
 });
 it('rejects foreign hosts/origins and malformed content before provider work',async()=>{
  const {request,services}=setup();
  expect((await request(body,{host:'foreign.example'})).status).toBe(421);
  expect((await request(body,{origin:'https://foreign.example'})).status).toBe(403);
  expect((await request(body,{'content-type':'text/plain'})).status).toBe(415);
  expect((await request({text:'x'.repeat(12001)}, {authorization:`Bearer ${token}`})).status).toBe(413);
  expect(services.translate).not.toHaveBeenCalled();
 });
 it('stops after the per-member translation quota and preserves public Bible access',async()=>{
  const {request,gateway,services}=setup();
  for(let i=0;i<30;i++)expect((await request(body,{authorization:`Bearer ${token}`})).status).toBe(200);
  const blocked=await request(body,{authorization:`Bearer ${token}`});expect(blocked.status).toBe(429);expect(blocked.headers['retry-after']).toBe('60');expect(services.translate).toHaveBeenCalledTimes(30);
  const bible=await invokeHandler(gateway,{url:'/api/bible/versions?language=ko'});expect(bible.json()).toEqual({url:'/versions?language=ko'});
 });
 it('ignores client-supplied forwarding unless explicitly trusted through loopback',()=>{
  const req={socket:{remoteAddress:'198.51.100.5'},headers:{'x-forwarded-for':'203.0.113.7'}} as unknown as IncomingMessage;
  expect(sourceAddress(req,true)).toBe('198.51.100.5');const local={socket:{remoteAddress:'127.0.0.1'},headers:{...req.headers}} as IncomingMessage;
  expect(sourceAddress(local)).toBe('127.0.0.1');expect(sourceAddress(local,true)).toBe('203.0.113.7');local.headers['x-forwarded-for']='spoofed';expect(sourceAddress(local,true)).toBe('127.0.0.1');
 });
 it('resets elapsed quota windows without accumulating unlimited identities',()=>{
  const limiter=new RateLimiter();expect(limiter.take('member',1,100,0)).toBe(true);expect(limiter.take('member',1,100,99)).toBe(false);expect(limiter.take('member',1,100,100)).toBe(true);
  for(let i=0;i<10000;i++)limiter.take(`user-${i}`,1,1000,100);expect(limiter.take('overflow',1,1000,100)).toBe(false);expect(limiter.take('overflow',1,1000,1101)).toBe(true);
 });
});
