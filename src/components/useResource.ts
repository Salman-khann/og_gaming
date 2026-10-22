'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
export function useResource<T>(url: string | null) {
  const [stored,setData]=useState<{url:string;value:T}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const controller=useRef<AbortController|null>(null);
  const reload=useCallback(async()=>{
    controller.current?.abort(); if(!url) return;
    const request=new AbortController(); controller.current=request; setLoading(true);setError('');
    try {const response=await fetch(url,{signal:request.signal,cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to load.');if(!request.signal.aborted)setData({url,value:result});}
    catch(error){if(!request.signal.aborted)setError(error instanceof Error?error.message:'Unable to connect.');}
    finally{if(!request.signal.aborted)setLoading(false);}
  },[url]);
  useEffect(()=>{const timer=setTimeout(()=>void reload(),0);const refresh=()=>{if(document.visibilityState==='visible')void reload();};const interval=setInterval(refresh,60000);window.addEventListener('focus',refresh);return()=>{clearTimeout(timer);clearInterval(interval);window.removeEventListener('focus',refresh);controller.current?.abort();};},[reload]);
  return {data:stored?.url===url?stored.value:null,error,loading,reload};
}
export async function sendAction<T = {success:boolean}>(url:string,body:unknown,method='POST'):Promise<T>{
  const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await response.json();
  if(!response.ok)throw new Error(data.error||'Unable to save.');return data;
}
