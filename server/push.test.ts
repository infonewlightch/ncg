import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {previewQtWeek} from '../src/core/qt';
// The worker is deliberately outside the browser bundle.
// @ts-ignore Node worker module
import {allowedPushEndpoint,deliveryOutcome,pushPayload,dispatchQtPush} from './push-worker.mjs';
let db:PGlite;
const USER='00000000-0000-4000-8000-000000000001',OTHER='00000000-0000-4000-8000-000000000002',ADMIN='00000000-0000-4000-8000-000000000003';
const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test-fixture',keys:{p256dh:'A'.repeat(87),auth:'B'.repeat(22)}};
async function role<T>(name:string,id:string,sql:string,args:unknown[]=[]){await db.exec(`set role ${name}`);try{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);return await db.query<T>(sql,args);}finally{await db.exec('reset role');}}
async function register(id=USER,sub=subscription,zone='America/New_York',time='02:30'){return role<{id:string}>('authenticated',id,'select ncg_register_push($1::jsonb,$2::time,$3,$4) as id',[JSON.stringify(sub),time,zone,'en']);}
async function claim(at:string){return role<{delivery_id:string;lease_id:string;reading_date:string}>('service_role','','select delivery_id,lease_id,reading_date::text from ncg_claim_qt_push(50,$1::timestamptz)',[at]);}
beforeAll(async()=>{db=new PGlite();await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;grant usage on schema auth,public to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;");for(const f of ['001_ncg_members.sql','002_ncg_qt.sql','003_ncg_push.sql'])await db.exec(readFileSync(new URL(`../supabase/migrations/${f}`,import.meta.url),'utf8'));for(const id of [USER,OTHER,ADMIN])await db.query('insert into auth.users(id) values($1)',[id]);await db.query('insert into ncg_admins(user_id) values($1)',[ADMIN]);for(const date of ['2028-03-12','2028-03-13'])await role('authenticated',ADMIN,'select ncg_save_qt_reading($1::jsonb)',[JSON.stringify({...previewQtWeek[0],date,status:'published'})]);},20000);
afterAll(()=>db.close());
describe('Private subscriptions and daily QT delivery',()=>{
 it('isolates endpoint ownership and encryption keys',async()=>{
  await register();expect((await role('authenticated',OTHER,'select id from ncg_push_subscriptions')).rows).toHaveLength(0);
  await expect(role('authenticated',USER,'select p256dh from ncg_push_subscriptions')).rejects.toThrow();
  await expect(register(OTHER)).rejects.toThrow('subscription_owned_by_another_account');
  await expect(role('authenticated',USER,'select * from ncg_claim_qt_push()')).rejects.toThrow();
 });
 it('rejects arbitrary endpoints and invalid time zones',async()=>{
  await expect(register(USER,{...subscription,endpoint:'https://127.0.0.1/private'})).rejects.toThrow('invalid_subscription');
  await expect(register(USER,subscription,'Imaginary/Zone')).rejects.toThrow('invalid_preferences');
 });
 it('waits for local time, crosses a DST gap, and claims only once',async()=>{
  expect((await claim('2028-03-12T06:31:00Z')).rows).toHaveLength(0); // 01:31 EST
  const first=await claim('2028-03-12T07:31:00Z');expect(first.rows).toHaveLength(1); // 03:31 EDT; 02:30 was skipped
  expect(first.rows[0].reading_date).toBe('2028-03-12');
  expect((await claim('2028-03-12T07:32:00Z')).rows).toHaveLength(0);
  const job=first.rows[0];await expect(role('service_role','','select ncg_finish_qt_push($1,$2,$3)',[job.delivery_id,USER,'sent'])).rejects.toThrow('stale_lease');
  await role('service_role','','select ncg_finish_qt_push($1,$2,$3)',[job.delivery_id,job.lease_id,'sent']);
  expect((await claim('2028-03-12T08:00:00Z')).rows).toHaveLength(0);
 });
 it('disables expired endpoints and sends nothing for unpublished days',async()=>{
  expect((await claim('2028-03-14T07:31:00Z')).rows).toHaveLength(0);
  const next=await claim('2028-03-13T07:31:00Z');expect(next.rows).toHaveLength(1);const job=next.rows[0];await role('service_role','','select ncg_finish_qt_push($1,$2,$3)',[job.delivery_id,job.lease_id,'expired']);expect((await role<{enabled:boolean}>('authenticated',USER,'select enabled from ncg_push_subscriptions')).rows[0].enabled).toBe(false);
 });
 it('allows the owner to turn off reminders, but not another member',async()=>{
  const r=await register();await expect(role('authenticated',OTHER,'select ncg_disable_push($1)',[r.rows[0].id])).rejects.toThrow('not_authorized');await role('authenticated',USER,'select ncg_disable_push($1)',[r.rows[0].id]);expect((await claim('2028-03-13T07:35:00Z')).rows).toHaveLength(0);
 });
});
describe('Push worker boundary',()=>{
 it('prevents SSRF and classifies acknowledged versus uncertain failures',()=>{
  for(const u of ['http://fcm.googleapis.com/x','https://fcm.googleapis.com.attacker.test/x','https://user:secret@fcm.googleapis.com/x','https://127.0.0.1/x','https://fcm.googleapis.com:444/x'])expect(allowedPushEndpoint(u)).toBe(false);
  expect(allowedPushEndpoint(subscription.endpoint)).toBe(true);expect(deliveryOutcome({statusCode:410})).toBe('expired');expect(deliveryOutcome({statusCode:429})).toBe('retry');expect(deliveryOutcome(new Error('timeout'))).toBe('uncertain');
 });
 it('uses available editorial language without generated Scripture',()=>{expect(pushPayload({language:'ko-KR',reading_date:'2028-03-12',translations:previewQtWeek[0].translations})).toMatchObject({language:'ko',date:'2028-03-12',body:previewQtWeek[0].translations.ko.title});});
 it('acknowledges provider acceptance and never sends an unsafe endpoint',async()=>{
  const jobs=[{delivery_id:'one',lease_id:'lease1',subscription,language:'en',reading_date:'2028-03-12',translations:previewQtWeek[0].translations},{delivery_id:'two',lease_id:'lease2',subscription:{...subscription,endpoint:'https://127.0.0.1/private'},language:'en',reading_date:'2028-03-12',translations:previewQtWeek[0].translations}];
  const rpc=vi.fn().mockResolvedValueOnce({data:jobs,error:null}).mockResolvedValue({error:null});const send=vi.fn().mockResolvedValue({statusCode:201});
  expect(await dispatchQtPush({client:{rpc},send})).toMatchObject({claimed:2,sent:1,failed:1,acknowledgementFailures:0});expect(send).toHaveBeenCalledTimes(1);expect(rpc).toHaveBeenCalledWith('ncg_finish_qt_push',{delivery_id:'one',lease_id:'lease1',outcome:'sent'});
 });
});
