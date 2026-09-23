import {Suspense} from 'react';
import {useApp} from '../state';
import {Modal} from './Ui';
import {PageBoundary,lazyPage} from './PageBoundary';
const LanguagePicker=lazyPage(()=>import('./LanguagePicker'));
export function LanguageDialog({onClose,onSelect}:{onClose:()=>void;onSelect?:(code:string)=>void}){
 const {t}=useApp();
 return <PageBoundary t={t} onDismiss={onClose}><Suspense fallback={<Modal title={t('언어 선택','Choose a language')} onClose={onClose}><p role="status">{t('잠시만 기다려주세요.','Loading…')}</p></Modal>}><LanguagePicker onClose={onClose} onSelect={onSelect}/></Suspense></PageBoundary>;
}
