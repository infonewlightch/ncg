import {expect,it,vi} from 'vitest';
import {requestVideoLandscape} from './video-orientation';

it('requests landscape and releases it without forcing portrait',async()=>{
 const orientation={lock:vi.fn().mockResolvedValue(undefined),unlock:vi.fn()};
 const release=requestVideoLandscape(orientation);await Promise.resolve();
 expect(orientation.lock).toHaveBeenCalledWith('landscape');release();
 expect(orientation.unlock).toHaveBeenCalledOnce();expect(orientation.lock).toHaveBeenCalledOnce();
});
it('tolerates unsupported, rejected and throwing browser APIs',async()=>{
 expect(()=>requestVideoLandscape(undefined)()).not.toThrow();
 const rejected={lock:vi.fn().mockRejectedValue(new Error('NotSupportedError')),unlock:vi.fn()};
 const release=requestVideoLandscape(rejected);await Promise.resolve();release();expect(rejected.unlock).not.toHaveBeenCalled();
 expect(()=>requestVideoLandscape({lock:()=>{throw new Error('SecurityError');}})()).not.toThrow();
});
it('releases a lock that finishes after fullscreen has already ended',async()=>{
 let finish!:()=>void;const orientation={lock:()=>new Promise<void>(resolve=>{finish=resolve;}),unlock:vi.fn()};
 const release=requestVideoLandscape(orientation);release();orientation.unlock.mockClear();finish();await Promise.resolve();
 expect(orientation.unlock).toHaveBeenCalledOnce();
});
it('does not let an old request unlock a newer fullscreen session',async()=>{
 let finish!:()=>void;const old={lock:()=>new Promise<void>(resolve=>{finish=resolve;}),unlock:vi.fn()};
 const releaseOld=requestVideoLandscape(old);releaseOld();old.unlock.mockClear();
 const current={lock:vi.fn().mockResolvedValue(undefined),unlock:vi.fn()};const releaseCurrent=requestVideoLandscape(current);
 finish();await Promise.resolve();expect(old.unlock).not.toHaveBeenCalled();expect(current.unlock).not.toHaveBeenCalled();
 releaseCurrent();expect(current.unlock).toHaveBeenCalledOnce();
});
