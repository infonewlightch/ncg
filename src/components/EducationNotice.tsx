import {useApp} from '../state';
import {languageName} from '../core/languages';

export function EducationNotice({language,loading=false,error,onRetry,onOriginal}:{language:string;loading?:boolean;error?:string;onRetry?:()=>void;onOriginal?:()=>void}){
 const {state,t}=useApp();
 const message=error==='unsupported_language'?t('이 언어로 신뢰할 수 있는 자동번역을 제공하지 못했습니다. 다른 언어나 영어 원문을 선택해주세요.','A reliable automatic translation could not be provided in this language. Choose another language or read the English source.')
 :error==='translation_daily_limit'?t('오늘의 새 참고 번역 요청이 모두 사용되었습니다. 영어 원문은 계속 읽을 수 있으며, 다음 날 다시 번역을 요청할 수 있습니다.','New reference translations have reached today’s limit. You can keep reading English and request another translation tomorrow.')
 :error==='translation_busy'?t('번역 요청이 많습니다. 잠시 후 다시 시도해주세요.','Translation is busy. Please try again later.')
 :error?t('지금은 번역을 불러오지 못했습니다. 영어 원문을 읽거나 나중에 다시 시도해주세요.','Translation is unavailable right now. Read the English source or try again later.')
 :loading?t('내 언어로 번역 중…','Translating into your language…'):t('자동번역 · 검수 전','Automatic translation · Unreviewed');
 return <div className="callout education-notice" role={error?'alert':'status'} aria-live="polite"><span><b>{languageName(language,state.ui)}</b> · {message}</span>{!error&&!loading&&<small>{t('영어 원문 기반 참고 번역','English-source translation aid')}</small>}<div className="button-row">{error&&onRetry&&<button className="text-link" onClick={onRetry}>{t('다시 시도','Retry')}</button>}{onOriginal&&<button className="text-link" disabled={loading} onClick={onOriginal}>{t('원문 보기','Show original')}</button>}</div></div>;
}
