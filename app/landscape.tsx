export default function Landscape(){return <svg className="landscape" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" role="img" aria-label="An autumn mountain valley with amber trees and a winding river">
<defs><linearGradient id="sky" x2="0" y2="1"><stop stopColor="#efe6ce"/><stop offset="1" stopColor="#d4d8c2"/></linearGradient><linearGradient id="hill" x2="0" y2="1"><stop stopColor="#7d8766"/><stop offset="1" stopColor="#465d4b"/></linearGradient><linearGradient id="near" x2="0" y2="1"><stop stopColor="#455b46"/><stop offset="1" stopColor="#213e35"/></linearGradient></defs>
<path fill="url(#sky)" d="M0 0h1600v1000H0z"/><circle cx="1110" cy="245" r="70" fill="#f9edc8"/>
<path d="M0 430 160 375 250 396 435 225 570 367 710 313 855 440 1050 288 1190 330 1330 213 1600 397V1000H0Z" fill="#b5bda5"/>
<path d="m0 475 228-130 146 105 205-65 221 152 272-141 215 88 180-147 133 39v624H0Z" fill="#919e83"/>
<path d="M0 470Q180 410 390 565T820 664Q1040 526 1250 514T1600 407V1000H0Z" fill="url(#hill)"/>
<path d="M790 653q145 42 220 83t-121 100q-193 51-11 164h310q-310-132-164-165t24-106q-76-42-258-76" fill="#c7d2bb"/>
<path d="M0 627q256-121 482 70t233 303H0Z" fill="#8b854d"/>
<path d="M0 697q218-124 427 39t214 264H0Z" fill="#a48b49"/>
<path d="M1600 587q-223 16-348 185t-131 228h479Z" fill="#7b7950"/>
{Array.from({length:80},(_,i)=>{const right=i>45;const x=right?1220+(i*83%430):(i*97%600)-50;const y=right?720+(i*53%340):735+(i*61%340);const r=18+i*17%28;const colors=['#b08039','#c19543','#a46032','#7d713c','#b35732','#d2aa53'];return <g key={i}><path d={`M${x} ${y}v${r*1.6}`} stroke="#534a31" strokeWidth="4"/><ellipse cx={x} cy={y-r*.35} rx={r*.8} ry={r*1.15} fill={colors[i%6]}/></g>})}
<path d="M0 916q163-41 275 84H0ZM1600 905q-111-46-220 95h220Z" fill="url(#near)"/>
<g fill="none" stroke="#596752" strokeWidth="2" opacity=".6"><path d="m1050 340 8-4 8 4m24-15 8-4 8 4m-36-10 7-3 7 3"/></g>
</svg>}
