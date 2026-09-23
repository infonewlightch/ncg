import {useEffect,useState} from 'react';
import {Bell,BellOff,Clock3} from 'lucide-react';
import {supabase,useAuth} from '../auth';
import {useApp} from '../state';
const vapidKey=import.meta.env.VITE_VAPID_PUBLIC_KEY as string|undefined;
const ready=Boolean(supabase&&vapidKey&&import.meta.env.PROD);
type Reminder={id:string;local_time:string;time_zone:string;language:string;enabled:boolean};
export function QtReminder(){
 const {state,t}=useApp();const {session}=useAuth();const supported=typeof Notification!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window&&window.isSecureContext;
 const [time,setTime]=useState('07:00');const [zone,setZone]=useState(()=>Intl.DateTimeFormat().resolvedOptions().timeZone);const [row,setRow]=useState<Reminder|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [permission,setPermission]=useState(supported?Notification.permission:'default');
 useEffect(()=>{let alive=true;setRow(null);if(!session||!supported||!ready)return;
  (async()=>{const registration=await navigator.serviceWorker.getRegistration('/');const subscription=await registration?.pushManager.getSubscription();if(!subscription)return;const result=await supabase!.from('ncg_push_subscriptions').select('id,local_time,time_zone,language,enabled').eq('endpoint',subscription.endpoint).maybeSingle();if(!alive)return;if(result.error)throw Error();if(result.data){setRow(result.data);setTime(result.data.local_time.slice(0,5));setZone(result.data.time_zone);}})().catch(()=>{if(alive)setError(t('이 기기의 알림 설정을 확인하지 못했습니다.','Unable to check reminders on this device.'));});return()=>{alive=false;};
 },[session?.user.id,supported]);
 async function enable(){
  if(!ready||!supabase||!session||busy||!supported)return;setError('');setNotice('');setBusy(true);
  let created:PushSubscription|null=null;
  try{
   try{new Intl.DateTimeFormat('en',{timeZone:zone});}catch{throw Error('invalid_time_zone');}
   if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('invalid_time');
   const consent=await Notification.requestPermission();setPermission(consent);if(consent!=='granted')throw Error('permission_denied');
   await navigator.serviceWorker.register('/sw.js');const registration=await navigator.serviceWorker.ready;
   const existing=await registration.pushManager.getSubscription();const subscription=existing||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidKey});if(!existing)created=subscription;
   const {data,error}=await supabase.rpc('ncg_register_push',{subscription:subscription.toJSON(),preferred_time:time,preferred_zone:zone,preferred_language:state.language});if(error)throw error;
   setRow({id:data,local_time:time,time_zone:zone,language:state.language,enabled:true});setNotice(t('이 기기에서 매일 QT 알림을 받도록 설정했습니다.','Daily QT reminders are enabled on this device.'));
  }catch(e){if(created)await created.unsubscribe().catch(()=>{});const code=e instanceof Error?e.message:'';setError(code==='permission_denied'?t('브라우저에서 알림이 허용되지 않았습니다. 사이트 설정에서 허용할 수 있어요.','Notifications were not allowed. You can allow them in your browser’s site settings.'):code==='invalid_time_zone'?t('올바른 시간대를 입력해주세요. 예: Asia/Seoul','Enter a valid time zone, for example Asia/Seoul.'):t('알림을 설정하지 못했습니다. 서버 연결과 브라우저 설정을 확인해주세요.','Unable to enable reminders. Check the server connection and browser settings.'));}finally{setBusy(false);}
 }
 async function disable(){if(!supabase||!row||busy)return;setBusy(true);setError('');setNotice('');try{const {error}=await supabase.rpc('ncg_disable_push',{subscription_id:row.id});if(error)throw error;setRow({...row,enabled:false});const registration=await navigator.serviceWorker.getRegistration('/');await (await registration?.pushManager.getSubscription())?.unsubscribe();setNotice(t('이 기기의 QT 알림을 껐습니다.','QT reminders are off on this device.'));}catch{setError(t('알림 설정을 변경하지 못했습니다. 다시 시도해주세요.','Unable to change reminder settings. Please try again.'));}finally{setBusy(false);}}
 const enabled=row?.enabled&&permission==='granted';
 return <section className="qt-reminder"><div className="qt-reminder-heading"><Bell size={22}/><div><h3>{t('매일 말씀으로 시작해요','A daily moment with the Word')}</h3><p>{t('원하는 시간에 오늘의 QT를 알려드려요.','A gentle reminder for today’s QT, at your chosen time.')}</p></div></div><div className="form-row"><label><Clock3 size={14}/>{t('알림 시간','Reminder time')}<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label><label>{t('내 시간대','My time zone')}<input value={zone} onChange={e=>setZone(e.target.value)} placeholder="Asia/Seoul" list="qt-time-zones"/><datalist id="qt-time-zones">{['Asia/Seoul','Asia/Bangkok','Asia/Tokyo','Asia/Kolkata','Asia/Shanghai','Europe/London','Europe/Paris','Africa/Nairobi','America/New_York','America/Los_Angeles','America/Sao_Paulo','Australia/Sydney','Pacific/Auckland'].map(z=><option value={z} key={z}/>)}</datalist></label></div>
  {!supported?<p className="tiny muted">{t('이 브라우저에서는 웹 푸시를 사용할 수 없습니다. iPhone·iPad에서는 홈 화면에 추가한 앱에서 확인해주세요.','Web push is unavailable here. On iPhone or iPad, try opening the app added to your Home Screen.')}</p>:!ready?<p className="tiny muted">{t('매일 발송할 알림 서버를 연결 중입니다. 아직 알림이 켜진 상태는 아닙니다.','The daily reminder service is being connected. Notifications are not enabled yet.')}</p>:!session?<p className="tiny muted">{t('로그인한 뒤 이 기기에서 알림을 켤 수 있어요.','Sign in to enable reminders on this device.')}</p>:<p className="tiny muted">{enabled?`${t('알림 켜짐','Reminders on')} · ${row.local_time.slice(0,5)} · ${row.time_zone}`:t('이 기기의 알림이 꺼져 있습니다.','Reminders are off on this device.')}</p>}
  <div className="button-row"><button className="button secondary" disabled={!supported||!ready||!session||busy} onClick={()=>void enable()}><Bell size={16}/>{busy?t('설정 중…','Saving…'):enabled?t('시간 · 언어 저장','Save time & language'):t('QT 알림 켜기','Enable QT reminders')}</button>{row?.enabled&&<button className="text-link" disabled={busy} onClick={()=>void disable()}><BellOff size={15}/>{t('끄기','Turn off')}</button>}{ready&&!session&&<a className="text-link" href="#/profile">{t('로그인','Sign in')}</a>}</div>{notice&&<p className="tiny" role="status">{notice}</p>}{error&&<p className="error" role="alert">{error}</p>}
 </section>;
}
