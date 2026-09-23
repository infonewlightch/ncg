import {useAuth} from '../auth';
import {useApp} from '../state';

export function AuthNotice(){
 const {issue,clearIssue}=useAuth();const {t}=useApp();if(!issue)return null;
 const message=issue==='expired'?t('인증 링크가 만료되었거나 이미 사용되었습니다. 아래에서 새 인증 메일을 요청해주세요.','This sign-in link has expired or was already used. Request a new email below.')
  :issue==='cancelled'?t('로그인이 취소되었습니다. 원하실 때 다시 진행할 수 있습니다.','Sign-in was cancelled. You can try again when ready.')
  :issue==='browser'?t('인증 메일을 요청한 브라우저에서 링크를 열어주세요. 다른 기기라면 이 화면에서 새 인증 메일을 요청할 수 있습니다.','Open the link in the browser where you requested it. On another device, request a new sign-in email here.')
  :issue==='unavailable'?t('인증 서버에 연결하지 못했습니다. 연결을 확인한 뒤 다시 시도해주세요.','Could not reach the sign-in service. Check your connection and try again.')
  :t('인증을 완료하지 못했습니다. 아래에서 로그인을 다시 진행해주세요.','Sign-in could not be completed. Please start again below.');
 return <div className="auth-notice" role="alert"><p>{message}</p><button className="text-link" onClick={clearIssue}>{t('알림 닫기','Dismiss message')}</button></div>;
}
