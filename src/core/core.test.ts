import { describe, it, expect } from 'vitest';
import { parseMedia, mediaEmbed } from './media';
import { shuffleOptions, completeLesson } from './learning';
import { readState, initialState } from './storage';
import ko from '../data/courses/ko.json';
import en from '../data/courses/en.json';
import th from '../data/courses/th.json';

describe('YouTube-first playback', () => {
  for (const url of ['https://youtu.be/Abc_def-123', 'https://www.youtube.com/watch?v=Abc_def-123&t=30', 'https://youtube.com/shorts/Abc_def-123', 'https://youtube.com/live/Abc_def-123', 'https://www.youtube-nocookie.com/embed/Abc_def-123']) {
    it(url, () => expect(parseMedia(url)).toEqual({ kind: 'youtube', id: 'Abc_def-123', url: 'https://www.youtube.com/watch?v=Abc_def-123' }));
  }
  for (const url of ['javascript:alert(1)', 'https://youtube.com.evil.example/watch?v=Abc_def-123', 'https://evil.example/watch?v=Abc_def-123', 'https://youtube.com/watch?v=x', 'http://example.com/a.mp4', 'https://user:pass@example.com/a.mp4']) {
    it('rejects ' + url, () => expect(parseMedia(url)).toBeNull());
  }
  it('supports directly hosted HTTPS video', () => expect(parseMedia('https://cdn.example.com/sermon.mp4')).toEqual({kind:'file',url:'https://cdn.example.com/sermon.mp4'}));
  it('uses safe embedding and requested caption language', () => {
    const media = parseMedia('https://youtu.be/Abc_def-123')!;
    const url = new URL(mediaEmbed(media, 'ar'));
    expect(url.hostname).toBe('www.youtube-nocookie.com');
    expect(url.searchParams.get('cc_lang_pref')).toBe('ar');
  });
});
describe('learning integrity', () => {
  it('preserves correct answer through reordered options', () => {
    const result=shuffleOptions({options:['right','wrong1','wrong2','wrong3'],answer:0}, 3);
    expect(result.options[result.answer]).toBe('right');
    expect(result.options).not.toEqual(['right','wrong1','wrong2','wrong3']);
  });
  it('is idempotent across repeated completion', () => {
    expect(completeLesson(completeLesson([], 'newcomer:1'), 'newcomer:1')).toEqual(['newcomer:1']);
  });
});
describe('storage recovery', () => {
  it('preserves a valid profile, video, QT post and progress on reload',()=>{
    const saved={...initialState,ui:'th',language:'th',profile:{name:'Test',nationality:'Thailand'},videos:[{id:'v1',title:'Test',description:'',url:'https://youtu.be/Abc_def-123',language:'th',category:'sermon',createdAt:'2026-09-23'}],posts:[{id:'p1',body:'Test reflection',language:'th',author:'Test',nationality:'Thailand',category:'story',createdAt:'2026-09-23',topic:'qt-preview'}],bookmarks:['v1'],completed:['newcomer:1']};
    expect(readState(JSON.stringify(saved))).toEqual(saved);
  });
  it('recovers from invalid JSON', () => expect(readState('{oops').bookmarks).toEqual([]));
  it('rejects malformed stored lists', () => expect(readState('{"version":1,"bookmarks":null,"completed":[{}],"videos":[{}]}').videos).toEqual([]));
  it('rejects unsafe persisted video URLs', () => expect(readState(JSON.stringify({version:1,videos:[{id:'x',title:'x',url:'javascript:alert(1)',language:'ko',category:'sermon'}]})).videos).toEqual([]));
});
describe('imported Dabar curriculum',()=>{
  for(const [language,courses] of Object.entries({ko,en,th})){
    it(`${language} has complete lessons and valid answer indexes`,()=>{
      const lessons=courses.flatMap(c=>c.lessons);
      expect(lessons).toHaveLength(28);
      expect(lessons.flatMap(l=>l.questions)).toHaveLength(280);
      for(const lesson of lessons){
        expect(lesson.teaching.length).toBeGreaterThan(0);
        for(const q of lesson.questions){expect(q.options.length).toBeGreaterThan(1);expect(q.options[q.answer]).toBeTruthy();expect(q.explanation).toBeTruthy();}
      }
      expect(courses.map(c=>[c.slug,c.lessons.map(l=>l.id)])).toEqual(ko.map(c=>[c.slug,c.lessons.map(l=>l.id)]));
    });
  }
});
