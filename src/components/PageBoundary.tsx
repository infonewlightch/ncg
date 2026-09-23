import {Component,lazy,type ComponentType,type ReactNode} from 'react';
import {Modal} from './Ui';

class PageFileError extends Error{}
// Tag only module-loading failures. Errors thrown by a loaded screen remain render errors.
export function lazyPage<T extends ComponentType<any>>(loader:()=>Promise<{default:T}>){
 return lazy(async()=>{try{return await loader();}catch(cause){throw new PageFileError('Screen file unavailable',{cause});}});
}
type Props={children:ReactNode;t:(ko:string,en:string)=>string;onDismiss?:()=>void;onReload?:()=>void};
type State={failure:'load'|'render'|null;online:boolean;reloading:boolean};
export class PageBoundary extends Component<Props,State>{
 state:State={failure:null,online:navigator.onLine!==false,reloading:false};
 private reloadStarted=false;
 static getDerivedStateFromError(error:unknown){return {failure:error instanceof PageFileError?'load':'render'};}
 private connection=()=>this.setState({online:navigator.onLine!==false});
 componentDidMount(){window.addEventListener('online',this.connection);window.addEventListener('offline',this.connection);}
 componentWillUnmount(){window.removeEventListener('online',this.connection);window.removeEventListener('offline',this.connection);}
 private reload=()=>{
  if(this.reloadStarted||navigator.onLine===false)return;
  this.reloadStarted=true;this.setState({reloading:true});(this.props.onReload||(()=>location.reload()))();
 };
 render(){
  if(!this.state.failure)return this.props.children;
  const {t,onDismiss}=this.props;
  const title=this.state.failure==='load'?t('화면을 다시 불러와야 합니다.','This screen needs to be reloaded.'):t('화면을 불러오지 못했습니다.','Unable to load this page.');
  const content=<div role="alert"><p>{!this.state.online?t('인터넷 연결이 끊겨 있습니다. 연결한 뒤 다시 불러와 주세요.','You are offline. Reconnect before reloading.'):this.state.failure==='load'?t('연결이 끊겼거나 앱이 업데이트되었을 수 있어요. 새로고침하면 현재 주소를 다시 엽니다.','The connection may have been interrupted or the app updated. Reload to reopen this address.'):t('연결을 확인한 뒤 다시 시도해주세요.','Check your connection and try again.')}</p>{onDismiss&&<p className="tiny muted">{t('새로고침하면 저장하지 않은 입력은 사라질 수 있습니다. 이 창을 닫으면 기존 화면으로 돌아갑니다.','Reloading may discard unsaved input. Close this dialog to return to your screen.')}</p>}<div className="button-row"><button className="button" disabled={!this.state.online||this.state.reloading} onClick={this.reload}>{this.state.reloading?t('다시 불러오는 중…','Reloading…'):t('다시 불러오기','Reload')}</button>{!onDismiss&&<a className="button secondary" href="#/">{t('홈으로','Go home')}</a>}</div></div>;
  return onDismiss?<Modal title={title} onClose={onDismiss}>{content}</Modal>:<section className="empty-state"><h2>{title}</h2>{content}</section>;
 }
}
