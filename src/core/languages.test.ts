import {describe,expect,it} from 'vitest';
import {interfaceLanguage,contentLanguage,hasInterfaceTranslation} from './languages';
import {readState,initialState} from './storage';

describe('one language preference throughout NCG',()=>{
 it('migrates the old English content / Korean interface split',()=>{
  const state=readState(JSON.stringify({...initialState,language:'en',ui:'ko'}));
  expect(state.language).toBe('en');
  expect(state.ui).toBe('en');
 });
 it('uses a regional language variant without falling back to Korean',()=>{
  expect(interfaceLanguage('en-GB')).toBe('en');
  expect(contentLanguage('en-US',['ko','en','th'])).toBe('en');
  expect(contentLanguage('th-TH',['ko','en','th'])).toBe('th');
 });
 it('keeps an unsupported preference and explicitly distinguishes the fallback',()=>{
  const state=readState(JSON.stringify({...initialState,language:'ar'}));
  expect(state.language).toBe('ar');
  expect(state.ui).toBe('ar');
  expect(hasInterfaceTranslation('ar')).toBe(false);
  expect(contentLanguage('ar',['ko','en','th'])).toBe('en');
 });
 it('matches existing translations only, without claiming all languages supported',()=>{
  expect(hasInterfaceTranslation('ko-KR')).toBe(true);
  expect(hasInterfaceTranslation('th')).toBe(false);
 });
});
