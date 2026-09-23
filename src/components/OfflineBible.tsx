import {useEffect,useRef,useState} from 'react';
import {CheckCircle2,Download,WifiOff} from 'lucide-react';
import {useApp} from '../state';
import {downloadOfflineBible,offlineBibleManifest,offlineStatus,offlineSupported,type OfflineProgress} from '../core/offline-bible';

export function OfflineBible(){
 const {state,t}=useApp();const [status,setStatus]=useState<OfflineProgress>({books:0,total:66,bytes:0,shellReady:false});const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [checking,setChecking]=useState(true);const controller=useRef<AbortController|null>(null);
 const supported=import.meta.env.PROD&&offlineSupported()&&'serviceWorker' in navigator;
 const complete=status.books===66&&status.shellReady;
 useEffect(()=>{let active=true;const refresh=()=>{if(controller.current)return;offlineStatus().then(result=>{if(active)setStatus(result);}).catch(()=>{}).finally(()=>{if(active)setChecking(false);});};refresh();const visible=()=>{if(document.visibilityState==='visible')refresh();};document.addEventListener('visibilitychange',visible);return()=>{active=false;controller.current?.abort();document.removeEventListener('visibilitychange',visible);};},[]);
 async function download(){
  const current=new AbortController();controller.current=current;setBusy(true);setError('');
  try{
   await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('offline_unavailable')),10000);current.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(current.signal.reason);},{once:true});navigator.serviceWorker.ready.finally(()=>clearTimeout(timer));})]);
   await downloadOfflineBible(current.signal,setStatus);
  }catch(e){if(!current.signal.aborted)setError(e instanceof DOMException&&e.name==='QuotaExceededError'?'space':e instanceof Error&&e.message==='offline_integrity'?'integrity':'connection');}
  finally{if(controller.current===current){controller.current=null;setBusy(false);offlineStatus().then(setStatus).catch(()=>{});}}
 }
 const size=new Intl.NumberFormat(state.ui,{maximumFractionDigits:1}).format(offlineBibleManifest.bytes/1_000_000);
 return <details className="offline-reader"><summary>{complete?<CheckCircle2 size={19}/>:<WifiOff size={19}/>}<span>{t('인터넷 없이 성경 읽기','Read the Bible offline')}<small>{complete?t('66권 기기 저장 완료','All 66 books saved on this device'):t('영어 WEB 성경 · 무료 저장','English WEB Bible · Free download')}</small></span></summary><div className="offline-reader-body">
  <p>{t('공식 원문 66권을 이 기기에 저장합니다. 저장한 성경은 연결을 기다리지 않고 열립니다.','Save all 66 books from the official source on this device. Saved Scripture opens without waiting for a connection.')}</p>
  <small className="muted">{t('저장 공간 약 {size} MB + 앱 화면. Wi-Fi에서 저장하는 것을 권장합니다.','About {size} MB of storage, plus the app. We recommend downloading over Wi-Fi.').replace('{size}',size)}</small>
  {busy&&<progress value={status.books} max={66} aria-label={t('성경 저장 진행률','Bible download progress')}/>}
  <p role="status" aria-live="polite">{checking?t('저장 상태 확인 중…','Checking saved files…'):complete?t('저장 완료 · 인터넷 없이 66권을 읽을 수 있습니다.','Saved · All 66 books are available offline.'):status.books===66&&busy?t('성경 저장 완료 · 앱 화면을 준비하고 있습니다.','Scripture saved · Preparing the app for offline use.'):status.books>0?t('{count} / 66권 저장됨 · 이어서 저장할 수 있습니다.','{count} / 66 books saved · You can resume the download.').replace('{count}',String(status.books)):''}</p>
  {error&&<p className="form-error" role="alert">{error==='space'?t('기기의 저장 공간이 부족합니다. 공간을 확보한 뒤 다시 시도해주세요.','There is not enough storage. Free up space and try again.'):error==='integrity'?t('원문 파일을 확인하지 못했습니다. 연결 후 다시 저장해주세요.','The source files could not be verified. Reconnect and try again.'):t('저장을 완료하지 못했습니다. 연결 후 이어서 저장해주세요.','The download did not finish. Reconnect to resume.')}</p>}
  {busy?<button className="button secondary" onClick={()=>controller.current?.abort()}>{t('저장 잠시 멈추기','Pause download')}</button>:!complete&&<button className="button secondary" disabled={!supported||checking} onClick={download}><Download size={16}/>{status.books?t('이어서 저장','Resume download'):t('66권 저장하기','Download all 66 books')}</button>}
  {!supported&&<p className="muted small">{t('오프라인 저장은 설치 가능한 서비스에서 제공됩니다.','Offline downloads are available in the installable app.')}</p>}
  <p className="muted small">{t('브라우저 데이터를 지우거나 저장 공간이 정리되면 다시 저장해야 합니다. 다른 역본의 오프라인 제공은 출판사 허가에 따라 달라집니다.','If browser data is cleared or storage is reclaimed, download again. Offline availability of other versions depends on publisher permission.')}</p>
 </div></details>;
}
