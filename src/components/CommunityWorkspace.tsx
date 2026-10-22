'use client';
import Image from 'next/image';
import Link from 'next/link';
import {useResource} from './useResource';
import {useAuth} from './AuthProvider';
import {youtubeEmbed} from '@/lib/community-media';
type Content={id:string;kind:'sponsor'|'gallery'|'stream';title:string;url:string;image_url:string|null};
export function CommunityWorkspace(){
 const {profile}=useAuth();
 const {data,error,loading}=useResource<{content:Content[]}>('/api/community');
 return <main className="wrap arena-main"><p className="eyebrow">OG GAMING / COMMUNITY</p><h1>Play. Compete. Come back.</h1><div className="actions"><Link className="button" href="/teams">Your teams</Link>{profile?.role==='admin'&&<Link className="button secondary" href="/players">Player profiles</Link>}</div>{error&&<p role="alert" className="error-message">{error}</p>}{loading&&<p role="status">Loading community...</p>}
 {(['stream','gallery','sponsor'] as const).map(kind=><section className="mt-6" key={kind}><h2>{kind==='stream'?'Watch the action':kind==='gallery'?'From the floor':'Our sponsors'}</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-6">{data?.content.filter(item=>item.kind===kind).map(item=><article key={item.id} className="admin-section"><h3>{item.title}</h3>{kind==='stream'&&youtubeEmbed(item.url)?<iframe className="stream-frame" src={youtubeEmbed(item.url)!} title={item.title} sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture" allowFullScreen/>:item.image_url&&<Image src={item.image_url} width={640} height={400} unoptimized alt={item.title} className="community-image"/>}<a className="text-link" href={item.url} target="_blank" rel="noopener noreferrer">{kind==='sponsor'?'Visit sponsor':'Open original'}</a></article>)}</div>{!loading&&!error&&!data?.content.some(item=>item.kind===kind)&&<p className="muted">Updates will appear here when published.</p>}</section>)}
 </main>;
}
