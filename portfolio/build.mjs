// Bygger film.html: en fristående 1080×1080-scen med appens färger, typsnitt och ikoner.
// Allt styrs av window.seek(t) så att varje bildruta kan renderas exakt.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as P from "@phosphor-icons/react/dist/ssr";
import { writeFileSync } from "node:fs";

const icon = (name, weight, size, color = "currentColor") => renderToStaticMarkup(createElement(P[name], { weight, size, color }));
const words = (s) => s.split(" ").map((w) => `<span class="w">${w}</span>`).join(" ");

// Ringar – samma geometri som src/components/goals/WeekRings.tsx
const SIZE = 84, STROKE = 8, R = (SIZE - STROKE) / 2, GAP = 12 + ((STROKE / R) * 180) / Math.PI;
const arc = (a, b) => {
  const rad = (d) => ((d - 90) * Math.PI) / 180;
  const p = (d) => [SIZE / 2 + R * Math.cos(rad(d)), SIZE / 2 + R * Math.sin(rad(d))].map((n) => n.toFixed(2)).join(",");
  return `M${p(a)} A${R},${R} 0 ${b - a > 180 ? 1 : 0} 1 ${p(b)}`;
};
const segs = (n, color, id) => Array.from({ length: n }, (_, i) => `<path id="${id}${i}" d="${arc((i * 360) / n + GAP / 2, ((i + 1) * 360) / n - GAP / 2)}" fill="none" stroke="${color}" stroke-width="${STROKE}" stroke-linecap="round"/>`).join("");
const ring = (id, color, inner, iconName) => `
  <li><div class="ring" id="${id}">
    <svg viewBox="0 0 ${SIZE} ${SIZE}">${inner}</svg>
    <span class="ico duo" style="color:${color}">${icon(iconName, "duotone", 68)}</span>
    <span class="ico fill" style="color:${color}">${icon(iconName, "fill", 68)}</span>
  </div>`;
const C = 2 * Math.PI * R;

const html = `<!doctype html><meta charset="utf-8"><title>Portfolio film</title>
<style>
:root{--bg:#f2f3ef;--fg:#121410;--card:#fff;--primary:#c8ec3c;--primary2:#9fd23a;--pfg:#141a05;--brand:#1d7f33;--muted:#646a60;--secondary:#eceee8;--border:#e2e5dd;--run:#1c86d0;--gym:#dd760f;--streak:#e5541b}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1080px;overflow:hidden;background:var(--bg);color:var(--fg);font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
#stage{position:relative;width:1080px;height:1080px;overflow:hidden}
.scene{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 100px;gap:36px;will-change:transform,opacity}
.card{background:var(--card);border:2px solid var(--border);border-radius:48px;box-shadow:0 3px 6px rgb(18 20 16/.05),0 2px 3px rgb(18 20 16/.03)}
.avatar{display:flex;align-items:center;justify-content:center;border-radius:999px;background:linear-gradient(135deg,var(--primary),var(--primary2));color:var(--pfg);flex:none}
.who{display:flex;align-items:center;gap:22px}
.who b{font-size:42px;font-weight:800;letter-spacing:-.02em;display:block}
.who small{font-size:28px;color:var(--muted);font-weight:500}
.user{align-self:flex-end;background:var(--primary);color:var(--pfg);font-size:38px;font-weight:600;padding:28px 40px;border-radius:44px 44px 12px 44px;transform-origin:100% 100%}
.bubble{align-self:flex-start;width:820px;overflow:hidden;border-radius:44px 44px 44px 12px;transform-origin:0 100%}
.bubble p{padding:40px 44px;font-size:42px;line-height:58px;font-weight:500}
.bubble b{font-weight:800}
.w{opacity:0;white-space:nowrap}
.chip{display:flex;align-items:center;gap:16px;font-size:30px;font-weight:600;color:var(--muted)}
.hero{border-radius:50px;padding:52px;color:var(--pfg);background:radial-gradient(120% 140% at 100% 0%,var(--primary2) 0%,transparent 55%),linear-gradient(135deg,var(--primary),var(--primary2))}
.hero .row{display:flex;justify-content:space-between;align-items:center;font-size:29px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.82;height:44px}
.hero .row span{display:flex;align-items:center;gap:12px}
.status{position:relative;width:340px;height:44px}
.status span{position:absolute;right:0;top:0;height:44px;white-space:nowrap;transform-origin:100% 50%}
.hero h1{margin-top:30px;font-size:70px;line-height:1.08;font-weight:800;letter-spacing:-.03em}
.hero .stats{margin-top:34px;display:flex;align-items:flex-end;gap:52px}
.num{font-size:54px;font-weight:800;letter-spacing:-.02em;line-height:1}
.num i{font-style:normal;font-size:26px;font-weight:800;letter-spacing:.02em;margin-left:8px;opacity:.7}
.int{font-size:32px;font-weight:650;opacity:.82;padding-bottom:5px}
.sync{display:flex;align-items:center;gap:28px;padding:34px 40px}
.badge{position:relative;width:92px;height:92px;border-radius:999px;background:rgb(28 134 208/.14);color:var(--run);display:flex;align-items:center;justify-content:center;flex:none}
.badge em{position:absolute;inset:0;border-radius:999px;border:5px solid var(--run)}
.sync b{display:block;font-size:38px;font-weight:750;letter-spacing:-.01em}
.sync small{font-size:30px;color:var(--muted);font-weight:500}
.sync .ok{margin-left:auto;color:var(--brand);display:flex}
#rings{position:absolute;left:100px;width:880px;padding:52px 44px 48px;transform-origin:50% 50%}
#rings h2{display:flex;align-items:center;gap:14px;font-size:36px;font-weight:650;color:var(--brand);padding:0 8px}
#rings ul{list-style:none;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:40px}
#rings li{display:flex;flex-direction:column;align-items:center;text-align:center;gap:20px}
.ring{position:relative;width:220px;height:220px}
.ring>svg{width:220px;height:220px;display:block}
.ico{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.ico svg{width:92px;height:92px}
.val{font-size:52px;font-weight:800;letter-spacing:-.02em;line-height:1.1;font-variant-numeric:tabular-nums}
.val i{font-style:normal;font-size:26px;font-weight:800;text-transform:uppercase;color:var(--muted);margin-left:8px}
.lab{font-size:31px;font-weight:650;margin-top:4px}
#medal{position:absolute;left:445px;top:70px;width:190px;height:190px}
#title{position:absolute;left:0;right:0;top:284px;text-align:center;font-size:62px;font-weight:800;letter-spacing:-.03em}
#last{position:absolute;left:100px;right:100px;top:828px;display:flex;align-items:flex-end;gap:22px}
#last .bubble{width:auto;flex:1}
#last .bubble p{font-size:38px;line-height:52px;padding:32px 40px}
#confetti{position:absolute;inset:0;pointer-events:none}
#confetti i{position:absolute;left:0;top:0;width:18px;height:11px;border-radius:3px;opacity:0}
</style>
<div id="stage">
  <div class="scene" id="sA">
    <div class="who" id="who"><div class="avatar" style="width:84px;height:84px">${icon("ChatCircleText", "fill", 46)}</div><div><b>Coach</b><small>Weekly check-in</small></div></div>
    <div class="user" id="user">What's the plan this week?</div>
    <div class="card bubble" id="b1"><p>${words("This week we build speed.")} <b>${words("Today: intervals, 6 × 800 m")}</b> ${words("at 4:50–5:00/km. Easy warm-up first.")}</p></div>
  </div>

  <div class="scene" id="sB">
    <div class="chip" id="chip"><div class="avatar" style="width:52px;height:52px">${icon("ChatCircleText", "fill", 28)}</div>Planned by your coach</div>
    <div class="hero" id="hero">
      <div class="row"><span>${icon("PersonSimpleRun", "bold", 34)}Today</span>
        <div class="status"><span id="st1">Session 5 of 5</span><span id="st2">${icon("CheckCircle", "fill", 38)}Done</span></div></div>
      <h1>Intervals<br>6 × 800 m</h1>
      <div class="stats"><div class="num">8<i>KM</i></div><div class="num">48<i>MIN</i></div><div class="int">4:50–5:00/km</div></div>
    </div>
    <div class="card sync" id="sync">
      <div class="badge"><em id="pulse"></em>${icon("Watch", "duotone", 50)}</div>
      <div><b>Synced from watch</b><small>8.1 km · 4:54/km · 162 bpm</small></div>
      <span class="ok" id="ok">${icon("CheckCircle", "fill", 58)}</span>
    </div>
  </div>

  <div class="card" id="rings">
    <h2>${icon("Target", "duotone", 42)}This week's rings</h2>
    <ul>
      ${ring("rRun", "var(--run)", `<circle cx="42" cy="42" r="${R}" fill="none" stroke="var(--run)" stroke-opacity=".18" stroke-width="${STROKE}"/><circle id="runArc" cx="42" cy="42" r="${R}" fill="none" stroke="var(--run)" stroke-width="${STROKE}" stroke-linecap="round" transform="rotate(-90 42 42)"/>`, "PersonSimpleRun")}
        <div><div class="val"><span id="km">24</span>/32<i>km</i></div><div class="lab" style="color:var(--run)">Running</div></div></li>
      ${ring("rGym", "var(--gym)", segs(2, "var(--gym)", "g"), "Barbell")}
        <div><div class="val">2/2<i>gym</i></div><div class="lab" style="color:var(--gym)">Strength</div></div></li>
      ${ring("rPlan", "var(--brand)", segs(5, "var(--brand)", "p"), "ListChecks")}
        <div><div class="val"><span id="pl">4</span>/5<i>done</i></div><div class="lab" style="color:var(--brand)">The plan</div></div></li>
    </ul>
  </div>

  <svg id="medal" viewBox="0 0 64 64"><defs><linearGradient id="mg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#c8ec3c"/><stop offset="100%" stop-color="#9fd23a"/></linearGradient></defs>
    <circle cx="32" cy="32" r="30" fill="url(#mg)"/><circle cx="32" cy="32" r="24.5" fill="none" stroke="#141a05" stroke-opacity=".28" stroke-width="1.5"/>
    <path d="M14 22 A21 21 0 0 1 30 11" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="3" stroke-linecap="round"/>
    <text x="32" y="33" text-anchor="middle" dominant-baseline="central" font-size="19" font-weight="800" fill="#141a05" style="letter-spacing:-.03em">5/5</text></svg>
  <div id="title">All rings closed!</div>
  <div id="last"><div class="avatar" style="width:76px;height:76px">${icon("ChatCircleText", "fill", 42)}</div>
    <div class="card bubble" id="b2"><p>${words("Strong work. Next week we stretch the long run.")}</p></div></div>
  <div id="confetti"></div>
</div>
<script>
const $=(id)=>document.getElementById(id);
const cl=(x)=>Math.max(0,Math.min(1,x)), p=(t,a,b)=>cl((t-a)/(b-a));
const out=(x)=>1-Math.pow(1-x,3), io=(x)=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
const back=(x)=>{const c=1.70158+1;return 1+c*Math.pow(x-1,3)+1.70158*Math.pow(x-1,2)};
const lerp=(a,b,x)=>a+(b-a)*x;
const C=${C};

// Ord som skrivs fram; bubblan växer rad för rad.
function typer(id,t0,t1){
  const el=$(id), ws=[...el.querySelectorAll(".w")], pEl=el.querySelector("p");
  const cs=getComputedStyle(pEl), pad=parseFloat(cs.paddingTop), lh=parseFloat(cs.lineHeight);
  const tops=[...new Set(ws.map(w=>w.offsetTop))].sort((a,b)=>a-b);
  const time=(i)=>lerp(t0,t1,i/ws.length);
  const lineStart=tops.map(tp=>time(ws.findIndex(w=>w.offsetTop===tp)));
  return (t)=>{
    ws.forEach((w,i)=>w.style.opacity=p(t,time(i),time(i)+.14));
    let lines=0; lineStart.forEach((ts,i)=>lines+=i===0?1:io(p(t,ts-.08,ts+.2)));
    el.style.height=(pad*2+lines*lh+4)+"px";
  };
}
let type1,type2;

// Konfetti: fasta partiklar med enkel kastbana, så att varje bildruta blir densamma.
let seed=7; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const COLORS=["#c8ec3c","#9fd23a","#1c86d0","#dd760f","#e5541b"];
const parts=Array.from({length:110},(_,i)=>{
  const side=i%3; const el=document.createElement("i"); el.style.background=COLORS[i%5]; $("confetti").appendChild(el);
  const ang=(side===0?lerp(-80,-40,rnd()):side===1?lerp(-140,-100,rnd()):lerp(-150,-30,rnd()))*Math.PI/180, sp=lerp(700,1500,rnd());
  return {el,x:side===0?60:side===1?1020:540,y:side===2?170:800,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,rot:rnd()*360,vr:lerp(-500,500,rnd()),d:side===2?.25:rnd()*.12,s:lerp(.7,1.3,rnd())};
});

const RH=()=>$("rings").offsetHeight;
window.seek=(t)=>{
  // A: coachen svarar
  let o=1-io(p(t,4.2,4.8));
  $("sA").style.opacity=o; $("sA").style.transform="translateY("+(-90*io(p(t,4.2,4.8)))+"px)";
  $("who").style.opacity=out(p(t,.1,.6)); $("who").style.transform="translateY("+lerp(24,0,out(p(t,.1,.6)))+"px)";
  $("user").style.opacity=p(t,.5,.75); $("user").style.transform="scale("+lerp(.7,1,back(p(t,.5,1)))+")";
  $("b1").style.opacity=p(t,1.25,1.5); $("b1").style.transform="scale("+lerp(.85,1,out(p(t,1.25,1.6)))+")";
  type1(t);

  // B + C: dagens pass, klockan synkar, klart
  const inB=io(p(t,4.6,5.4)), outB=io(p(t,10.2,10.8));
  $("sB").style.opacity=inB*(1-outB);
  $("sB").style.transform="translateY("+(lerp(110,0,inB)-110*outB)+"px) scale("+(lerp(.94,1,inB)+.02*p(t,5.4,10.2))+")";
  $("chip").style.opacity=out(p(t,5.3,5.8));
  $("hero").style.transform="scale("+(1+.03*Math.sin(Math.PI*p(t,9.0,9.55)))+")";
  $("st1").style.opacity=1-p(t,8.9,9.15);
  $("st2").style.opacity=p(t,9.05,9.3); $("st2").style.transform="scale("+lerp(.6,1,back(p(t,9.05,9.5)))+")";
  const sy=out(p(t,7.5,8.1)); $("sync").style.opacity=p(t,7.5,7.9); $("sync").style.transform="translateY("+lerp(50,0,sy)+"px)";
  const ph=t>7.7&&t<9.1?((t-7.7)%.7)/.7:1; $("pulse").style.opacity=.55*(1-ph); $("pulse").style.transform="scale("+lerp(1,1.75,out(ph))+")";
  $("ok").style.opacity=p(t,8.55,8.75); $("ok").style.transform="scale("+lerp(.3,1,back(p(t,8.55,8.95)))+")";

  // D: ringarna stängs
  const inR=io(p(t,10.6,11.3)), toEnd=io(p(t,14.3,15.1)), sc=lerp(1,.8,toEnd);
  const cy=lerp(540,578,toEnd)+lerp(90,0,inR);
  $("rings").style.opacity=p(t,10.6,11.1); $("rings").style.top=(cy-RH()/2)+"px"; $("rings").style.transform="scale("+sc+")";
  const run=lerp(.75,1,io(p(t,11.5,12.6)));
  $("runArc").setAttribute("stroke-dasharray",(C*run)+" "+C); $("km").textContent=Math.round(32*run);
  for(let i=0;i<2;i++)$("g"+i).setAttribute("stroke-opacity",1);
  for(let i=0;i<5;i++)$("p"+i).setAttribute("stroke-opacity",i<4?1:lerp(.18,1,p(t,12.9,13.2)));
  $("pl").textContent=t>=13.05?5:4;
  const pulse=(a)=>1+.09*Math.sin(Math.PI*p(t,a,a+.45));
  const fill=(id,a,done)=>{const r=$(id);r.style.transform="scale("+pulse(a)*pulse(13.7)+")";r.querySelector(".fill").style.opacity=done?1:p(t,a,a+.2);r.querySelector(".duo").style.opacity=done?0:1-p(t,a,a+.2)};
  fill("rRun",12.6); fill("rGym",0,true); fill("rPlan",13.2);

  // E: medalj och konfetti
  const m=p(t,14.8,15.4); $("medal").style.opacity=p(t,14.8,14.95); $("medal").style.transform="scale("+back(m)+") rotate("+lerp(-25,0,out(m))+"deg)";
  $("title").style.opacity=p(t,15.2,15.6); $("title").style.transform="translateY("+lerp(26,0,out(p(t,15.2,15.7)))+"px)";
  for(const c of parts){const u=t-14.95-c.d; if(u<=0){c.el.style.opacity=0;continue}
    const x=c.x+c.vx*u*Math.exp(-.35*u), y=c.y+c.vy*u+.5*1250*u*u;
    c.el.style.opacity=1-p(u,1.9,2.7); c.el.style.transform="translate("+x+"px,"+y+"px) rotate("+(c.rot+c.vr*u)+"deg) scale("+c.s+")";}

  // F: coachen får sista ordet
  const l=out(p(t,17.2,17.8)); $("last").style.opacity=p(t,17.2,17.6); $("last").style.transform="translateY("+lerp(60,0,l)+"px)";
  type2(t);
};
document.fonts.ready.then(()=>{type1=typer("b1",1.5,3.7);type2=typer("b2",17.6,18.5);window.seek(+(new URLSearchParams(location.search).get("t")||0));window.ready=true});
</script>`;
writeFileSync(new URL("./film.html", import.meta.url), html);
console.log("film.html", html.length);
