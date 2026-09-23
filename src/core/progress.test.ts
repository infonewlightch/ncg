import {describe,it,expect} from 'vitest';
import {progressDelta,applyProgressDelta,pullProgress,acknowledgeProgress} from './progress';
import {initialState,readState} from './storage';
describe('offline progress reconciliation',()=>{
 it('preserves independent work on another device while sending local completion and undo',()=>{
  const baseline=['newcomer:1','qt:yesterday'],current=['newcomer:1','qt:today'];
  const delta=progressDelta(baseline,current);expect(delta).toEqual({added:['qt:today'],removed:['qt:yesterday']});
  expect(applyProgressDelta([...baseline,'catechism:5'],delta)).toEqual(['newcomer:1','catechism:5','qt:today']);
 });
 it('does not resurrect locally undone milestones when reconnecting',()=>{
  const result=pullProgress(['qt:one','catechism:2'],[],{baseline:['qt:one'],pending:null,revision:0});expect(result.completed).toEqual(['catechism:2']);expect(result.progressSync.baseline).toEqual(['qt:one','catechism:2']);
 });
 it('keeps edits made during a request and replays unknown acknowledgements with the same operation',()=>{
  const pending={id:'00000000-0000-4000-8000-000000000001',added:['qt:one'],removed:[],sent:['qt:one']};
  const state=readState(JSON.stringify({...initialState,completed:['catechism:3'],progressSync:{baseline:[],pending,revision:0}}));
  expect(pullProgress(['qt:one'],state.completed,state.progressSync).progressSync.pending?.id).toBe(pending.id);
  const result=acknowledgeProgress(['qt:one','newcomer:1'],state.completed,pending);expect(result.completed).toEqual(['newcomer:1','catechism:3']);expect(result.progressSync.pending).toBeNull();
 });
 it('ignores a response from an older snapshot after a newer acknowledgement',()=>{
  const sync={baseline:['catechism:2'],pending:null,revision:7};
  expect(pullProgress(['qt:one'],['catechism:2'],sync,6).completed).toEqual(['catechism:2']);
 });
 it('imports pre-sync local milestones once without inventing removals',()=>{
  const state=readState(JSON.stringify({...initialState,progressSync:undefined,completed:['newcomer:1']}));
  expect(pullProgress(['catechism:2'],state.completed,state.progressSync).completed).toEqual(['catechism:2','newcomer:1']);
 });
});
