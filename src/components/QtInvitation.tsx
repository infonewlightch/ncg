import {ArrowUpRight,Globe} from 'lucide-react';
import {useApp} from '../state';

export function QtInvitation(){
 const {t}=useApp();
 return <section className="qt-invitation">
  <div className="qt-invitation-icon" aria-hidden="true"><Globe size={38} strokeWidth={1}/></div>
  <div><span className="eyebrow">{t("전 세계가 함께하는 큐티","GLOBAL QUIET TIME")}</span>
   <h2>{t('같은 말씀, 수많은 언어, 하나의 공동체.','One passage. Many languages. One community.')}</h2>
   <p>{t('말씀을 묵상하고, 삶에 새기고, 서로의 이야기에 귀 기울여요.','Reflect on the Word, put it into practice, and listen to one another.')}</p>
  </div>
  <a href="#/qt" className="button secondary">{t('전 세계 QT','Explore Global QT')}<ArrowUpRight size={18}/></a>
 </section>;
}
