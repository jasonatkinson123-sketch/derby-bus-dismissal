'use client';

import {useEffect,useRef,useState} from 'react';


type Call={bus:number|string,at:number,id:string};
type State={day:string,revision:number,calls:Call[],screens?:{revision:number,seen:number}[]};

const buses:(number|string)[]=[51,52,53,54,55,56,57,58,59,60,'Walkers and Riders','Cross Country'];
const label=(bus:number|string)=>typeof bus==='number'?'Bus '+bus:bus;
const time=(n:number)=>new Date(n).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'});
// Classroom devices may stay open all day. Use Derby's local time, including DST.
const dismissalWindow=()=>{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
 const value=(type:string)=>parts.find(part=>part.type===type)?.value||'';
 const weekday=value('weekday');
 const minutes=Number(value('hour'))*60+Number(value('minute'));
 return weekday!=='Sat'&&weekday!=='Sun'&&minutes>=14*60+45&&minutes<15*60+20;
};

function CharacterHeader({connected,hasState,showConnection}:{connected:boolean,hasState:boolean,showConnection:boolean}){
 return <header className="phone-header">
 <a href="/" className="phone-brand" aria-label="Derby Middle School display"/>
 <div className="phone-pillars" role="img" aria-label="Character Counts: Trustworthiness, Respect, Responsibility, Fairness, Caring, Citizenship"/>
 {showConnection&&<span className={'connection '+(connected?'online':'offline')}><i/>{connected?'Connected':hasState?'Connection lost':'Connecting…'}</span>}
 </header>
}

export default function Board({controller}:{controller:boolean}){
 const [pinStatus,setPinStatus]=useState<'checking'|'locked'|'unlocked'>(controller?'locked':'unlocked'),[pin,setPin]=useState(''),[pinError,setPinError]=useState(''),[pinBusy,setPinBusy]=useState(false);
 const [connectionError,setConnectionError]=useState(''),[screenStatusError,setScreenStatusError]=useState('');
 const [demo,setDemo]=useState(false),[state,setState]=useState<State|null>(null),[dismissalActive,setDismissalActive]=useState(dismissalWindow),[connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[,setNow]=useState(0),[rtt,setRtt]=useState(0),[reset,setReset]=useState(false),[sound,setSound]=useState(false);
 const tokenRef=useRef(''),demoStarted=useRef(0);
 useEffect(()=>{if(new URLSearchParams(window.location.search).get('demo')==='1'){demoStarted.current=Date.now();setDemo(true)}},[]);
 const current=useRef<State|null>(null),lastGood=useRef(0),lastSeen=useRef(0),screenId=useRef(''),audio=useRef<AudioContext|null>(null),soundRef=useRef(false),first=useRef(true),pollRef=useRef<()=>Promise<void>>(async()=>{});
 async function unlock(e:React.FormEvent){e.preventDefault();setPinBusy(true);setPinError('');try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})});const v=await r.json() as {error?:string;token?:string};if(!r.ok)throw Error(v.error||'Could not unlock');tokenRef.current=v.token||'';setPin('');setConnectionError('');setPinStatus('unlocked')}catch(e){setPinError(e instanceof Error?e.message:'Unable to unlock')}finally{setPinBusy(false)}}
 async function lock(){await fetch('/api/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+tokenRef.current}}).catch(()=>{});tokenRef.current='';setPinStatus('locked');setConnectionError('');setConnected(false);setState(null);current.current=null}
 function apply(s:State){if(current.current&&current.current.day===s.day&&s.revision<current.current.revision)return;current.current=s;setState(s)}
 useEffect(()=>{
  if(controller&&pinStatus!=='unlocked')return;
  screenId.current=crypto.randomUUID();let done=false,timer:ReturnType<typeof setTimeout>,fetching=false,loopVersion=0,active=demo?Date.now()-demoStarted.current<20*60*1000:dismissalWindow();setDismissalActive(active);
  const poll=async()=>{if(fetching||done||(!controller&&document.visibilityState==='hidden'))return;fetching=true;const start=performance.now();
   try{
    // The live bus list is intentionally public; never make the controller's
    // connectivity depend on the optional authenticated screen-receipt query.
    const res=await fetch(demo?'/api/state?demo=1':'/api/state',{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!res.ok)throw Error('Bus feed: HTTP '+res.status);
    const s=await res.json() as State;
    if(controller){
      void fetch('/api/state?controller=1'+(demo?'&demo=1':''),{headers:{Authorization:'Bearer '+tokenRef.current},cache:'no-store',signal:AbortSignal.timeout(8000)})
        .then(async r=>{
          if(done)return;
          if(r.status===401){setConnectionError('Controller authorization expired. Please enter your PIN again.');setPinStatus('locked');return}
          if(!r.ok){setScreenStatusError('Screen confirmations unavailable (HTTP '+r.status+').');return}
          const extra=await r.json() as State;
          setScreenStatusError('');
          if(extra.revision===current.current?.revision)apply(extra);
        })
        .catch(e=>{if(!done)setScreenStatusError('Screen confirmations unavailable: '+(e instanceof Error?e.message:'network error'))});
    }
    if(done)return;
    const prev=current.current?.calls.at(-1)?.id;apply(s);lastGood.current=Date.now();setConnected(true);setConnectionError('');setRtt(Math.round(performance.now()-start));
    if(!first.current&&s.calls.at(-1)?.id&&s.calls.at(-1)?.id!==prev&&soundRef.current&&!controller){try{const a=audio.current!;const o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.frequency.value=660;g.gain.setValueAtTime(0,a.currentTime);g.gain.linearRampToValueAtTime(.055,a.currentTime+.03);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+1);o.start();o.stop(a.currentTime+1)}catch{}}
    first.current=false;
    if(!controller&&active&&document.visibilityState==='visible'&&(Date.now()-lastSeen.current>15000||s.revision!==lastSeenRevision)){
     lastSeen.current=Date.now();lastSeenRevision=s.revision;
     void fetch('/api/seen',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:screenId.current,day:s.day,revision:s.revision}),signal:AbortSignal.timeout(3500)}).catch(()=>{});
    }
   }catch(e){if(!done){setConnectionError(e instanceof Error?e.message:'Network error');if(Date.now()-lastGood.current>12000)setConnected(false)}}finally{fetching=false}
  };
  let lastSeenRevision=-1;pollRef.current=poll;
  const loop=async(version:number)=>{await poll();if(!done&&version===loopVersion)timer=setTimeout(()=>void loop(version),active?3000:300000)};void loop(loopVersion);
  const tick=setInterval(()=>{
   const next=demo?Date.now()-demoStarted.current<20*60*1000:dismissalWindow();
   if(next!==active){active=next;setDismissalActive(next);lastSeen.current=0;loopVersion++;clearTimeout(timer);void loop(loopVersion)}
   setNow(Date.now());
   if(Date.now()-lastGood.current>(active?12000:420000))setConnected(false);
  },1000);
  const visible=()=>{if(document.visibilityState==='visible'){lastSeen.current=0;loopVersion++;clearTimeout(timer);void loop(loopVersion)}};document.addEventListener('visibilitychange',visible);
  return()=>{done=true;clearTimeout(timer);clearInterval(tick);document.removeEventListener('visibilitychange',visible)};
 },[controller,pinStatus,demo]);
 async function send(action:string,bus?:number|string){if(!current.current||busy||!connected||(action==='call'&&!dismissalActive))return;setBusy(true);setNotice('Sending…');setReset(false);const s=current.current;
  try{const r=await fetch(demo?'/api/state?demo=1':'/api/state',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokenRef.current},body:JSON.stringify({action,bus,day:s.day,revision:s.revision,id:crypto.randomUUID()}),signal:AbortSignal.timeout(5000)});const data=await r.json() as State&{error?:string};if(!r.ok)throw Error(data.error||'Could not send.');apply({...data,screens:current.current?.screens});setNotice(action==='call'?label(bus!)+' sent and locked.':'Board cleared for the next dismissal.');void pollRef.current()}
  catch(e){setNotice(e instanceof Error&&e.name==='TimeoutError'?'Confirmation timed out. Check the board before trying again.':e instanceof Error?e.message:'Could not send. Check your connection.');void pollRef.current()}
  finally{setBusy(false)}
 }
 const storedCalls=(state?.calls||[]).filter(c=>buses.includes(c.bus));
 // A classroom display must never keep showing stale dismissals. Controllers retain
 // their last known state for recovery, while a disconnected display fails blank.
 const calls=controller||(dismissalActive&&connected)?storedCalls:[],latest=calls.at(-1),called=new Set(calls.map(c=>c.bus)),previous=[...calls].reverse().filter((c,i,arr)=>c.bus!==latest?.bus&&arr.findIndex(a=>a.bus===c.bus)===i),screens=state?.screens||[],received=screens.filter(s=>s.revision>=(state?.revision??0)).length;
 return <main className={controller?'controller':'display'}>
  <div className="page">
   {controller&&<CharacterHeader connected={connected} hasState={!!state} showConnection={pinStatus==='unlocked'}/>}
   {!connected&&(controller?pinStatus==='unlocked':dismissalActive)&&(!!connectionError||!!state)&&<div className="warning" role="alert">Connection unavailable{connectionError?": "+connectionError:" — waiting for bus updates."} Please check with school staff.</div>}
   {controller?<>
    {pinStatus!=='unlocked'?<section className="control-panel" style={{maxWidth:420,margin:'40px auto',padding:24}}><h1>Dismissal controller</h1>{pinStatus==='checking'?<p>Checking this device…</p>:<form onSubmit={unlock}><p>Enter your 4-digit PIN. Enter your PIN each time you open the controller.</p><input autoFocus aria-label="Four-digit controller PIN" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))} style={{fontSize:24,width:'100%',padding:12}}/><p role="alert">{pinError}</p><button type="submit" disabled={pinBusy||pin.length!==4}>{pinBusy?'Checking…':'Unlock controller'}</button></form>}</section>:<>
    <section className="control-title"><p className="eyebrow">DISMISSAL CONTROL</p><h1>Bus dismissal</h1><p>{demo?'Demo mode: test calls stay separate from school dismissal. This session pauses after 20 minutes.':'Tap a bus as it arrives. Every connected display follows from 2:45 to 3:20 p.m. on weekdays.'}</p></section>
    <section className="control-panel">
     <div className="control-top"><span className="eyebrow">{demo?'DEMO CALLS':'CALL A BUS'}</span><a href={demo?'/?demo=1':'/'} target="_blank" rel="noreferrer">Open {demo?'demo ':''}display ↗</a></div>
     <p><a href={demo?'/controller':'/controller?demo=1'}>{demo?'Return to school controller':'Open separate demo controller'} ↗</a></p>
     <div className="controller-current" aria-live="polite">{called.size===buses.length?<>All groups <strong>COMPLETE</strong></>:latest?<>Now dismissing <strong>{label(latest.bus)}</strong></>:"Ready for the first bus"}</div><div className="bus-buttons">{buses.map(bus=>{const isCalled=called.has(bus);return <button key={bus} disabled={!connected||!dismissalActive||busy||isCalled} aria-pressed={isCalled} className={'bus-button '+(isCalled?'called':'')} onClick={()=>void send('call',bus)}><span className="bus-label">{typeof bus==='number'?'BUS':'GROUP'}</span><strong className={typeof bus==='string'?'group-button-label':undefined}>{bus}</strong><span className="bus-status">{isCalled?'Called ✓':'Call →'}</span></button>})}</div>
     {screenStatusError&&<p role="status" style={{fontSize:13,color:'#8e4a06'}}>{screenStatusError}</p>}
     <div className="receipt" aria-live="polite"><span className="receipt-symbol">{busy?'…':received?'✓':'○'}</span><div><strong>{busy?'Sending bus call…':screens.length?(received===screens.length?'Received by '+received+' display'+(received===1?'':'s'):'Waiting for display confirmation…'):'No active classroom display'}</strong><small>{notice||'Open the display on a second device to test.'}</small></div></div>
     <div className={'control-actions '+(called.size?'clearable':'')}><span>{!dismissalActive?(demo?'Demo paused. Reload to start a new 20-minute demo.':'Live calls open at 2:45 p.m. Use demo mode for testing.'):called.size===buses.length?'Dismissal complete.':called.size?'Clear resets every called group.':'Call a group to begin dismissal.'}</span><button disabled={!connected||busy||called.size===0} onClick={()=>setReset(true)}>Clear board</button></div>
     {reset&&<div className="reset-confirm" role="alert"><p>Clear the board and unlock every bus button?</p><button onClick={()=>void send('reset')}>Clear and reset</button><button onClick={()=>setReset(false)}>Cancel</button></div>}
    </section>
    <section className="activity"><div><p className="eyebrow">TODAY’S CALLS</p><span>{called.size} of {buses.length} groups called</span></div>{calls.length?<ol>{[...calls].reverse().slice(0,12).map(c=><li key={c.id}><strong>{label(c.bus)}</strong><span>{time(c.at)}</span></li>)}</ol>:<p className="muted">A fresh start. No buses called yet.</p>}</section>
    <button type="button" onClick={lock} style={{marginTop:16}}>Lock controller</button>
    <p className="technical">{connected?'Server round trip: '+rtt+' ms · Checks every '+(dismissalActive?'3 seconds':'5 minutes'):'Waiting for a connection'}<br/>Authorized for this open controller tab.</p>
   </> }</>:<>
    {demo&&<p className="display-notice" role="status">DEMO MODE · Test calls stay separate from school dismissal. This demo pauses after 20 minutes.</p>}
    <div className="art-board">
     <img className="board-art" src="/art/dismissal-board.jpg" alt="Derby Middle School. Character Counts: Trustworthiness, Respect, Responsibility, Fairness, Caring, Citizenship. Already called. Still waiting. Have a great afternoon." fetchPriority="high"/>
     <section className={'board-live '+(!connected&&state?'stale':'')} aria-live="polite" aria-atomic="true">
      <h1 className="live-heading">{!dismissalActive?(demo?'DEMO ENDED':'DISMISSAL CLOSED'):latest?(connected?'NOW DISMISSING':'LAST RECEIVED CALL'):connected?'DISMISSAL READY':'CONNECTING'}</h1>
      <div className="live-current" key={latest?.id||'waiting'}>
       {latest?<>{typeof latest.bus==='number'&&<span className="live-bus-label">BUS</span>}<strong className={typeof latest.bus==='number'?'live-number':'live-group-name'}>{latest.bus}</strong><p className="live-instruction">{connected?'Please proceed to your dismissal location.':'Check with school staff.'}</p></>:<div className="live-empty"><strong>{dismissalActive?<>Waiting for<br/>the first bus.</>:<>{demo?'Demo':'Dismissal'}<br/>{demo?'ended.':'is closed.'}</>}</strong><p>{dismissalActive?'Your bus will appear here.':demo?'Reload to start another demo.':'Weekdays, 2:45–3:20 p.m.'}</p></div>}
      </div>
      <div className="live-history" aria-label="Already called">{Array.from({length:8},(_,i)=>{const entries=previous.slice(i*2,i*2+2);return <div className={'history-slot '+(entries.length>1?'history-pair':'')} key={i}>{entries.map(call=><strong className={typeof call.bus==='string'?'history-group':undefined} key={call.bus}>{call.bus}</strong>)}</div>})}</div>
      <div className="live-waiting" aria-label="Still waiting">{buses.filter(bus=>!called.has(bus)).map(bus=><span className={typeof bus==='string'?'waiting-group':undefined} key={bus}>{bus}</span>)}{called.size===buses.length&&<span className="all-called">All groups called</span>}</div>
     </section>
    </div>
    <nav className="display-tools"><span className={'connection '+(connected?'online':'offline')}><i/>{connected?'Connected':state?'Connection lost':'Connecting…'}</span><span className="tool-spacer"/><button onClick={()=>{if(!sound){audio.current??=new AudioContext();void audio.current.resume()}soundRef.current=!sound;setSound(!sound)}}>{sound?'Chime on':'Chime off'}</button><button onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else if(document.documentElement.requestFullscreen)void document.documentElement.requestFullscreen().catch(()=>setNotice('Fullscreen is unavailable on this device.'));else setNotice('Use your browser’s full-screen mode.')}}>Full screen</button><a href={demo?'/controller?demo=1':'/controller'}>Controller ↗</a></nav>
    {notice&&<p role="status" className="display-notice">{notice}</p>}
   </>}
  </div>
 </main>
}
