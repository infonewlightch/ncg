import {Readable} from 'node:stream';
import type {IncomingMessage,ServerResponse} from 'node:http';

export async function invokeHandler(
 handler:(req:IncomingMessage,res:ServerResponse)=>unknown,
 options:{url?:string;method?:string;headers?:Record<string,string>;body?:string|Buffer[];address?:string}={}
){
 const req=Object.assign(Readable.from(Array.isArray(options.body)?options.body:[options.body||'']),{
  method:options.method||'GET',url:options.url||'/',
  headers:{host:'127.0.0.1:4311',...options.headers},socket:{remoteAddress:options.address||'127.0.0.1'}
 }) as IncomingMessage;
 const headers:Record<string,string|number>={};let output=Buffer.alloc(0);
 const res={statusCode:200,headersSent:false,
  setHeader(name:string,value:string|number){headers[name.toLowerCase()]=value;},
  writeHead(status:number,values:Record<string,string|number>={}){this.statusCode=status;this.headersSent=true;for(const [name,value] of Object.entries(values))this.setHeader(name,value);},
  end(data?:string|Buffer){output=data?Buffer.from(data):Buffer.alloc(0);this.headersSent=true;}
 };
 await handler(req,res as unknown as ServerResponse);
 return {status:res.statusCode,headers,output,text:output.toString(),json:()=>JSON.parse(output.toString())};
}
