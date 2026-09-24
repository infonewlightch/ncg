import schedule from '../data/qt/duranno-schedule.json';
import type {QtReading} from './qt';

// Reference metadata only. Never infer missing dates or copy the publisher's commentary.
export function qtScheduleOn(date:string){return schedule.find(item=>item.date===date);}
export function publishedQtOn(readings:QtReading[],date:string){
 const reference=qtScheduleOn(date);
 return readings.find(item=>item.date===date&&item.status==='published'&&(!reference||item.passage===reference.passage));
}
