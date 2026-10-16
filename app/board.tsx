'use client';

import {useEffect,useRef,useState} from 'react';


type Call={bus:number,at:number,id:string};
type State={day:string,revision:number,calls:Call[],screens?:{revision:number,seen:number}[]};

const buses=[51,52,53,54,55,56,57,58,59,60];
const time=(n:number)=>new Date(n).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'});

function CharacterHeader({connected,hasState}:{connected:boolean,hasState:boolean}){
 return <header className="phone-header">
 <a href="/" className="phone-brand" aria-label="Derby Middle School display"/>
 <div className="phone-pillars" role="img" aria-label="Character Counts: Trustworthiness, Respect, Responsibility, Fairness, Caring, Citizenship"/>
 <span className={'connection '+(connected?'online':'offline')}><i/>{connected?'Connected':hasState?'Connection lost':'Connecting…'}</span>
 </header>
}

export default function Board({controller}:{controller:boolean}){
 const [pinStatus,setPinStatus]=useState<'checking'|'locked'|'unlocked'>(controller?'locked':'unlocked'),[pin,setPin]=useState(''),[pinError,setPinError]=useState(''),[pinBusy,setPinBusy]=useState(false);
 const [state,setState]=useState<State|null>(null),[connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[,setNow]=useState(0),[rtt,setRtt]=useState(0),[reset,setReset]=useState(false),[sound,setSound]=useState(false);
 const tokenRef=useRef('');
 const current=useRef<State|null>(null),lastGood=useRef(0),lastSeen=useRef(0),screenId=useRef(''),audio=useRef<AudioContext|null>(null),soundRef=useRef(false),first=useRef(true),pollRef=useRef<()=>Promise<void>>(async()=>{});
 async function unlock(e:React.FormEvent){e.preventDefault();setPinBusy(true);setPinError('');try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})});const v=await r.json() as {error?:string;token?:string};if(!r.ok)throw Error(v.error||'Could not unlock');tokenRef.current=v.token||'';setPin('');setPinStatus('unlocked')}catch(e){setPinError(e instanceof Error?e.message:'Unable to unlock')}finally{setPinBusy(false)}}
 async function lock(){await fetch('/api/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+tokenRef.current}}).catch(()=>{});tokenRef.current='';setPinStatus('locked');setState(null);current.current=null}
 function apply(s:State){if(current.current&&current.current.day===s.day&&s.revision<current.current.revision)return;current.current=s;setState(s)}
 useEffect(()=>{
  if(controller&&pinStatus!=='unlocked')return;
  screenId.current=crypto.randomUUID();let done=false,timer:ReturnType<typeof setTimeout>,fetching=false;
  const poll=async()=>{if(fetching||done)return;fetching=true;const start=performance.now();
   try{const res=await fetch('/api/state'+(controller?'?controller=1':''),{headers:controller?{Authorization:'Bearer '+tokenRef.current}:{},cache:'no-store',signal:AbortSignal.timeout(3500)});if(res.status===401&&controller){setPinStatus('locked');throw Error('Unauthorized')}if(!res.ok)throw Error();const s=await res.json() as State;
    if(done)return;
    const prev=current.current?.calls.at(-1)?.id;apply(s);lastGood.current=Date.now();setConnected(true);setRtt(Math.round(performance.now()-start));
    if(!first.current&&s.calls.at(-1)?.id&&s.calls.at(-1)?.id!==prev&&soundRef.current&&!controller){try{const a=audio.current!;const o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.frequency.value=660;g.gain.setValueAtTime(0,a.currentTime);g.gain.linearRampToValueAtTime(.055,a.currentTime+.03);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+1);o.start();o.stop(a.currentTime+1)}catch{}}
    first.current=false;
    if(!controller&&document.visibilityState==='visible'&&(Date.now()-lastSeen.current>2500||s.revision!==lastSeenRevision)){
     lastSeen.current=Date.now();lastSeenRevision=s.revision;
     void fetch('/api/seen',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:screenId.current,day:s.day,revision:s.revision}),signal:AbortSignal.timeout(3500)}).catch(()=>{});
    }
   }catch{if(!done&&Date.now()-lastGood.current>4000)setConnected(false)}finally{fetching=false}
  };
  let lastSeenRevision=-1;pollRef.current=poll;
  const loop=async()=>{await poll();if(!done)timer=setTimeout(loop,750)};void loop();
  const tick=setInterval(()=>{setNow(Date.now());if(Date.now()-lastGood.current>4000)setConnected(false)},500);
  const visible=()=>{if(document.visibilityState==='visible'){lastSeen.current=0;void poll()}};document.addEventListener('visibilitychange',visible);
  return()=>{done=true;clearTimeout(timer);clearInterval(tick);document.removeEventListener('visibilitychange',visible)};
 },[controller]);
 async function send(action:string,bus?:number){if(!current.current||busy||!connected)return;setBusy(true);setNotice('Sending…');setReset(false);const s=current.current;
  try{const r=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokenRef.current},body:JSON.stringify({action,bus,day:s.day,revision:s.revision,id:crypto.randomUUID()}),signal:AbortSignal.timeout(5000)});const data=await r.json() as State&{error?:string};if(!r.ok)throw Error(data.error||'Could not send.');apply({...data,screens:current.current?.screens});setNotice(action==='call'?'Bus '+bus+' sent and locked.':'Board cleared for the next dismissal.');void pollRef.current()}
  catch(e){setNotice(e instanceof Error&&e.name==='TimeoutError'?'Confirmation timed out. Check the board before trying again.':e instanceof Error?e.message:'Could not send. Check your connection.');void pollRef.current()}
  finally{setBusy(false)}
 }
 const storedCalls=(state?.calls||[]).filter(c=>buses.includes(c.bus));
 // A classroom display must never keep showing stale dismissals. Controllers retain
 // their last known state for recovery, while a disconnected display fails blank.
 const calls=controller||connected?storedCalls:[],latest=calls.at(-1),called=new Set(calls.map(c=>c.bus)),previous=[...calls].reverse().filter((c,i,arr)=>c.bus!==latest?.bus&&arr.findIndex(a=>a.bus===c.bus)===i),screens=state?.screens||[],received=screens.filter(s=>s.revision>=(state?.revision??0)).length;
 return <main className={controller?'controller':'display'}>
  <div className="page">
   {controller&&<CharacterHeader connected={connected} hasState={!!state}/>}
   {!connected&&state&&<div className="warning" role="alert">Connection lost — bus information may be out of date. Check with school staff.</div>}
   {controller?<>
    {pinStatus!=='unlocked'?<section className="control-panel" style={{maxWidth:420,margin:'40px auto',padding:24}}><h1>Dismissal controller</h1>{pinStatus==='checking'?<p>Checking this device…</p>:<form onSubmit={unlock}><p>Enter your 4-digit PIN. Enter your PIN each time you open the controller.</p><input autoFocus aria-label="Four-digit controller PIN" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))} style={{fontSize:24,width:'100%',padding:12}}/><p role="alert">{pinError}</p><button type="submit" disabled={pinBusy||pin.length!==4}>{pinBusy?'Checking…':'Unlock controller'}</button></form>}</section>:<>
    <section className="control-title"><p className="eyebrow">DISMISSAL CONTROL</p><h1>Bus dismissal</h1><p>Tap a bus as it arrives. Every connected display follows.</p></section>
    <section className="control-panel">
     <div className="control-top"><span className="eyebrow">CALL A BUS</span><a href="/" target="_blank" rel="noreferrer">Open display ↗</a></div>
     <div className="controller-current" aria-live="polite">{called.size===buses.length?<>All buses <strong>COMPLETE</strong></>:latest?<>Now dismissing <strong>BUS {latest.bus}</strong></>:"Ready for the first bus"}</div><div className="bus-buttons">{buses.map(bus=>{const isCalled=called.has(bus);return <button key={bus} disabled={!connected||busy||isCalled} aria-pressed={isCalled} className={'bus-button '+(isCalled?'called':'')} onClick={()=>void send('call',bus)}><span className="bus-label">BUS</span><strong>{bus}</strong><span className="bus-status">{isCalled?'Called ✓':'Call bus →'}</span></button>})}</div>
     <div className="receipt" aria-live="polite"><span className="receipt-symbol">{busy?'…':received?'✓':'○'}</span><div><strong>{busy?'Sending bus call…':screens.length?(received===screens.length?'Received by '+received+' display'+(received===1?'':'s'):'Waiting for display confirmation…'):'No active classroom display'}</strong><small>{notice||'Open the display on a second device to test.'}</small></div></div>
     <div className={'control-actions '+(called.size?'clearable':'')}><span>{called.size===buses.length?'Dismissal complete.':called.size?'Clear resets every called bus.':'Call a bus to begin dismissal.'}</span><button disabled={!connected||busy||called.size===0} onClick={()=>setReset(true)}>Clear board</button></div>
     {reset&&<div className="reset-confirm" role="alert"><p>Clear the board and unlock every bus button?</p><button onClick={()=>void send('reset')}>Clear and reset</button><button onClick={()=>setReset(false)}>Cancel</button></div>}
    </section>
    <section className="activity"><div><p className="eyebrow">TODAY’S CALLS</p><span>{called.size} of {buses.length} buses called</span></div>{calls.length?<ol>{[...calls].reverse().slice(0,12).map(c=><li key={c.id}><strong>Bus {c.bus}</strong><span>{time(c.at)}</span></li>)}</ol>:<p className="muted">A fresh start. No buses called yet.</p>}</section>
    <button type="button" onClick={lock} style={{marginTop:16}}>Lock controller</button>
    <p className="technical">{connected?'Server round trip: '+rtt+' ms · Checks every 0.75 seconds':'Waiting for a connection'}<br/>Authorized for this open controller tab.</p>
   </> }</>:<>
    <div className="art-board">
     <img className="board-art" src="/art/dismissal-board.jpg" alt="Derby Middle School. Character Counts: Trustworthiness, Respect, Responsibility, Fairness, Caring, Citizenship. Already called. Still waiting. Have a great afternoon." fetchPriority="high"/>
     <section className={'board-live '+(!connected&&state?'stale':'')} aria-live="polite" aria-atomic="true">
      <h1 className="live-heading">{latest?(connected?'NOW DISMISSING':'LAST RECEIVED CALL'):connected?'DISMISSAL READY':'CONNECTING'}</h1>
      <div className="live-current" key={latest?.id||'waiting'}>
       {latest?<><span className="live-bus-label">BUS</span><strong className="live-number">{latest.bus}</strong><p className="live-instruction">{connected?'Please make your way to your bus.':'Check with school staff.'}</p></>:<div className="live-empty"><strong>Waiting for<br/>the first bus.</strong><p>Your bus will appear here.</p></div>}
      </div>
      <div className="live-history" aria-label="Already called">{Array.from({length:8},(_,i)=>{const entries=i===7?previous.slice(7):previous[i]?[previous[i]]:[];return <div className={'history-slot '+(entries.length>1?'history-pair':'')} key={i}>{entries.map(call=><strong key={call.bus}>{call.bus}</strong>)}</div>})}</div>
      <div className="live-waiting" aria-label="Still waiting">{buses.filter(bus=>!called.has(bus)).map(bus=><span key={bus}>{bus}</span>)}{called.size===buses.length&&<span className="all-called">All buses called</span>}</div>
     </section>
    </div>
    <nav className="display-tools"><span className={'connection '+(connected?'online':'offline')}><i/>{connected?'Connected':state?'Connection lost':'Connecting…'}</span><span className="tool-spacer"/><button onClick={()=>{if(!sound){audio.current??=new AudioContext();void audio.current.resume()}soundRef.current=!sound;setSound(!sound)}}>{sound?'Chime on':'Chime off'}</button><button onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else if(document.documentElement.requestFullscreen)void document.documentElement.requestFullscreen().catch(()=>setNotice('Fullscreen is unavailable on this device.'));else setNotice('Use your browser’s full-screen mode.')}}>Full screen</button><a href="/controller">Controller ↗</a></nav>
    {notice&&<p role="status" className="display-notice">{notice}</p>}
   </>}
  </div>
 </main>
}
