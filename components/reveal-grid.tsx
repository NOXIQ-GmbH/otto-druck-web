"use client";
import { useEffect, useRef } from "react";

export default function RevealGrid({children,className}:{children:React.ReactNode;className:string}) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const root=ref.current;
    if(!root || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const cards=Array.from(root.children);
    root.classList.add('reveal-ready');
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}
    }),{threshold:0.08});
    cards.forEach(card=>observer.observe(card));
    return ()=>{observer.disconnect();root.classList.remove('reveal-ready');};
  },[]);
  return <div ref={ref} className={`${className} reveal-grid`}>{children}</div>;
}
