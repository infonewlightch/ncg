import {describe,it,expect} from 'vitest';
import {interfacePacks,translateInterface,interfaceDirection} from './interface';
import {interfaceLanguage,contentLanguage,hasInterfaceTranslation} from './languages';
import source from '../i18n/source.json';

describe('complete interface language packs',()=>{
 it('contains every collected screen, form, error, accessibility label and book name',()=>{
  for(const [locale,pack] of Object.entries(interfacePacks)){
   const missing=source.filter(row=>!pack.messages[row.en]?.trim()).map(row=>row.en);expect(missing,locale).toEqual([]);
   for(const {en} of source)expect((pack.messages[en].match(/\{[A-Za-z0-9_]+\}/g)||[]).sort(),`${locale}: ${en}`).toEqual((en.match(/\{[A-Za-z0-9_]+\}/g)||[]).sort());
  }
 });
 it('applies Spanish region preferences to all UI without changing the content fallback into Korean',()=>{
  expect(hasInterfaceTranslation('es-MX')).toBe(true);expect(interfaceLanguage('es-MX')).toBe('es');expect(contentLanguage('es-MX',['ko','en','th'])).toBe('en');expect(interfaceDirection('es')).toBe('ltr');
  for(const [en,expected] of [['Home','Inicio'],['Sign in','Entrar'],['Try again','Intentar de nuevo'],['Book','Libro'],['John','Juan']])expect(translateInterface('한국어',en,'es')).toBe(expected);
  expect(translateInterface('문','Question {number}','es').replace('{number}','107')).toBe('Pregunta 107');
 });
 it('preserves the actual source language when the requested UI or content is not available',()=>{
  expect(interfaceLanguage('ar')).toBe('en');expect(contentLanguage('th-TH',['ko','en','th'])).toBe('th');expect(translateInterface('한국어','Future message','es')).toBe('Future message');
 });
});
