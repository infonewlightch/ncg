import {useEffect,useState} from 'react';
import {supabase} from '../auth';
type ReviewPost={id:string;body:string;author:string;nationality:string;language:string;created_at:string;topic_id:string|null};
export function AdminCommunity(){
 const [posts,setPosts]=useState<ReviewPost[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 async function load(){const {data,error}=await supabase!.from('ncg_posts').select('id,body,author,nationality,language,created_at,topic_id').eq('status','pending').order('created_at').limit(100);if(error)setError('공동체 검토 목록을 불러오지 못했습니다. 004 마이그레이션과 서버 연결을 확인해주세요.');else{setPosts(data||[]);setError('');}}
 useEffect(()=>{void load();},[]);
 async function review(id:string,decision:string){if(busy)return;setBusy(true);const {error}=await supabase!.rpc('ncg_review_post',{post:id,decision});if(error)setError('나눔 검토를 처리하지 못했습니다.');else await load();setBusy(false);}
 return <section className="panel"><div className="section-head"><h2>공동체 · QT 나눔 검토</h2><button className="text-link" onClick={()=>void load()} disabled={busy}>새로고침</button></div><p className="muted">모든 공개 나눔은 검토 대기로 접수됩니다. 이름·국적·언어와 함께 공개할 내용인지 확인하세요. 처음 100건을 표시하며 처리하면 다음 글이 이어집니다.</p>{!posts.length&&!error&&<p>검토할 나눔이 없습니다.</p>}{posts.map(post=><article className="admin-review" key={post.id}><b dir="auto">{post.author} · {post.nationality} · {post.language}</b><small>{post.created_at} · {post.topic_id?'QT':'공동체'}</small><p className="post-body" dir="auto">{post.body}</p><div className="button-row"><button className="button" disabled={busy} onClick={()=>void review(post.id,'published')}>공개 허용</button><button className="button secondary" disabled={busy} onClick={()=>void review(post.id,'rejected')}>공개 제한</button></div></article>)}{error&&<p className="error" role="alert">{error}</p>}</section>;
}
export function ReportedPost({id}:{id:string}){const [body,setBody]=useState('불러오는 중…');useEffect(()=>{supabase?.from('ncg_posts').select('body').eq('id',id).single().then(({data,error})=>setBody(error?'나눔을 불러오지 못했습니다.':data.body));},[id]);return <blockquote dir="auto">{body}</blockquote>;}
