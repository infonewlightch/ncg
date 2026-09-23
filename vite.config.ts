import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import {translationHandler} from './server/translation.ts';
import {bibleHandler} from './server/bible.ts';
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),'NCG_');
 return {plugins:[react(),{name:'ncg-local-services',configureServer(server){server.middlewares.use('/api/translate',(req,res)=>{void translationHandler(req,res,env);});server.middlewares.use('/api/bible',(req,res)=>{void bibleHandler(req,res,env);});},configurePreviewServer(server){server.middlewares.use('/api/translate',(req,res)=>{void translationHandler(req,res,env);});server.middlewares.use('/api/bible',(req,res)=>{void bibleHandler(req,res,env);});}}],build:{manifest:true,target:'es2022',rollupOptions:{input:{main:'index.html',admin:'admin.html'}}}};
});
