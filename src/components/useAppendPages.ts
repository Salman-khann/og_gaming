'use client';
import {useEffect,useState} from 'react';
export function useAppendPages<T extends {id?:string;faceit_id?:string|null}>(scope:string,page:number,items:T[]|undefined){
 const [stored,setStored]=useState<{scope:string;pages:Record<number,T[]>}|null>(null);
 useEffect(()=>{if(!items)return;const timer=setTimeout(()=>setStored(previous=>({scope,pages:{...(previous?.scope===scope?previous.pages:{}),[page]:items}})),0);return()=>clearTimeout(timer);},[scope,page,items]);
 const pages=stored?.scope===scope?{...stored.pages,...(items?{[page]:items}:{})}:items?{[page]:items}:{};
 return [...new Map(Object.values(pages).flat().map(item=>[item.id||item.faceit_id,item])).values()];
}
