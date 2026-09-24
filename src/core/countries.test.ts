import {describe,expect,it} from 'vitest';
import {countries,countryName,resolveCountry,searchCountries} from './countries';

describe('country catalogue',()=>{
 it('uses unique codes and keeps both Koreas distinct',()=>{
  expect(new Set(countries.map(country=>country.code)).size).toBe(250);
  expect(resolveCountry('대한민국')).toBe('KR');expect(resolveCountry('한국')).toBe('KR');expect(resolveCountry('북한')).toBe('KP');
  expect(resolveCountry(' kr ')).toBe('KR');expect(resolveCountry('Canada')).toBe('CA');
 });
 it('searches Korean, English, selected language and codes without accepting arbitrary values',()=>{
  expect(searchCountries('대한민국','es').map(country=>country.code)).toEqual(['KR']);
  expect(searchCountries('south korea','ko').map(country=>country.code)).toEqual(['KR']);
  expect(searchCountries('España','en').map(country=>country.code)).toEqual(['ES']);
  expect(searchCountries('USA','ko').map(country=>country.code)).toEqual(['US']);
  expect(countryName('CA','ko')).toBe('캐나다');
  for(const value of ['', 'my own country','United','<script>','ZZ'])expect(resolveCountry(value)).toBeUndefined();
 });
});
