import {educationTranslationNode} from './server/education-translation.ts';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import {videoTranslationNode} from './server/video-translation.ts';
import {interfaceTranslationNode} from './server/interface-translation.ts';
import {translationHandler} from './server/translation.ts';
import {bibleTranslationNode} from './server/bible-translation.ts';
import {bibleSourceHandler} from './server/bible-source.ts';
import {bibleHandler} from './server/bible.ts';
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),'');
 return {plugins:[react(),{name:'ncg-local-services',configureServer(server){server.middlewares.use('/api/video-translation',(req,res)=>{void videoTranslationNode(req,res,{...process.env,...env} as Record<string,string>);});server.middlewares.use('/api/education-translation',(req,res)=>{void educationTranslationNode(req,res,{...process.env,...env} as Record<string,string>);});server.middlewares.use('/api/interface-translation',(req,res)=>{void interfaceTranslationNode(req,res,{...process.env,...env} as Record<string,string>);});server.middlewares.use('/api/translate',(req,res)=>{void translationHandler(req,res,env);});server.middlewares.use('/api/bible-translation',(req,res)=>{void bibleTranslationNode(req,res,{...process.env,...env} as Record<string,string>);});server.middlewares.use('/api/bible-source',(req,res)=>{void bibleSourceHandler(req,res);});server.middlewares.use('/api/bible',(req,res)=>{void bibleHandler(req,res,env);});},configurePreviewServer(server){server.middlewares.use('/api/video-translation',(req,res)=>{void videoTranslationNode(req,res,{...process.env,...env} as Record<string,string>);});server.middlewares.use('/api/education-translation',(req,res)=>{void educationTranslationNode(req,res,{...process.env,...env} as Record<string,string>);});server.middlewares.use('/api/interface-translation',(req,res)=>{void interfaceTranslationNode(req,res,{...process.env,...env} as Record<string,string>);});server.middlewares.use('/api/translate',(req,res)=>{void translationHandler(req,res,env);});server.middlewares.use('/api/bible-translation',(req,res)=>{void bibleTranslationNode(req,res,{...process.env,...env} as Record<string,string>);});server.middlewares.use('/api/bible-source',(req,res)=>{void bibleSourceHandler(req,res);});server.middlewares.use('/api/bible',(req,res)=>{void bibleHandler(req,res,env);});}}],build:{manifest:true,target:'es2022',rollupOptions:{input:{main:'index.html',admin:'admin.html'}}}};
});
