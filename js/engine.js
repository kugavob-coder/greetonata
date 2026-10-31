/* Greetonata — shared engine: shapes from text, melody, piano, card drawing and sparkles.
   Used by index.html (sender) and card.html (recipient). */
/* ================= text → numbers ================= */
function hash(str){let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<str.length;i++){const c=str.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return (h2>>>0)*4294967296+(h1>>>0);}
function rng(seed){let a=seed%4294967296>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function features(text){
  const words=(text.match(/[A-Za-z']+/g)||[]).map(w=>w.toLowerCase());
  const letters=words.join('').replace(/'/g,'');
  const vowels=(letters.match(/[aeiouy]/g)||[]).length;
  const sentences=text.split(/[.!?]+/).filter(s=>/[a-z]/i.test(s)).length;
  const codes=[...letters].map(ch=>ch.charCodeAt(0)-97);
  return{words,wordLens:words.map(w=>w.length),codes,vowelRatio:vowels/Math.max(1,letters.length),
    sentences,letterSum:codes.reduce((a,b)=>a+b,0),avgLen:letters.length/Math.max(1,words.length),h:hash(text)};
}
const code=(f,i)=>f.codes[((i%f.codes.length)+f.codes.length)%f.codes.length];

/* ================= colour ================= */
const hsl=(c,a=1)=>`hsla(${c[0]},${c[1].toFixed(1)}%,${c[2].toFixed(1)}%,${a})`;
function tone(c){let[h,s,l]=c;
  if(mood==='warm'){s*=.72;l=l+(100-l)*.22;}
  else if(mood==='playful'){s=Math.min(100,s*1.25);l=l>85?l:l+(l<50?4:0);}
  else{s=Math.min(100,s*1.05);l=l>90?l:l*.84;}
  return[h,s,l];}
function lineOf(c){
  if(mood==='festive')return celestial?[44,85,74]:[38,70,36];
  return celestial?[c[0],Math.min(70,c[1]),78]:[c[0],Math.min(55,c[1]*.8+10),Math.max(24,Math.min(46,c[2]-34))];}
function colors(v){
  const o={};for(const k in v)o[k]=tone(v[k]);
  o.line=lineOf(o.petal||o.line);
  return o;}

/* ================= geometry ================= */
const P=(x,y)=>({x,y});
function bez(p0,p1,p2,p3,n){const o=[];for(let i=0;i<=n;i++){const t=i/n,u=1-t;o.push(P(u*u*u*p0.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t*t*t*p3.x,u*u*u*p0.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t*t*t*p3.y));}return o;}
/* one petal: origin o, angle a, start r0, length L, half-width W.
   opt: k tip roundness, notch, curl, fringe, asym */
function petal(o,a,r0,L,W,opt={}){
  const k=opt.k??.5,n=opt.n??20,asym=opt.asym||0;
  const Wl=W*(1+asym),Wr=W*(1-asym*.6);
  let left,right,mid=[];
  if(opt.notch){
    const e=r0+L*(1-opt.notch*.35);
    left=bez(P(r0,0),P(r0+L*.3,Wl),P(r0+L*.9,Wl*k),P(e,Wl*.3),n);
    right=bez(P(r0,0),P(r0+L*.3,-Wr),P(r0+L*.9,-Wr*k),P(e,-Wr*.3),n);
    mid=[P(r0+L*(1-opt.notch),0)];
  }else{
    left=bez(P(r0,0),P(r0+L*.3,Wl),P(r0+L*.85,Wl*k),P(r0+L,0),n);
    right=bez(P(r0,0),P(r0+L*.3,-Wr),P(r0+L*.85,-Wr*k),P(r0+L,0),n);
  }
  let pts=left.concat(mid,right.reverse().slice(opt.notch?0:1));
  if(opt.fringe){const c=P(r0+L*.5,0);
    pts=pts.map((p,i)=>{const u=(p.x-r0)/L;if(u<.45||i===0||i===pts.length-1)return p;
      const m=i%2?1+opt.fringe:1-opt.fringe*.4;return P(c.x+(p.x-c.x)*m,c.y+(p.y-c.y)*m);});}
  if(opt.curl)pts=pts.map(p=>{const u=Math.max(0,(p.x-r0)/L);return P(p.x,p.y+opt.curl*L*u*u);});
  const d=P(Math.cos(a),Math.sin(a)),q=P(-d.y,d.x);
  return pts.map(p=>P(o.x+d.x*p.x+q.x*p.y,o.y+d.y*p.x+q.y*p.y));
}
function circle(r,n=40,cx=0,cy=0){const o=[];for(let i=0;i<=n;i++){const a=i/n*2*Math.PI;o.push(P(cx+r*Math.cos(a),cy+r*Math.sin(a)));}return o;}
function hexagon(r,cx=0,cy=0,a0=0){const o=[];for(let i=0;i<=6;i++){const a=a0+i*Math.PI/3;o.push(P(cx+r*Math.cos(a),cy+r*Math.sin(a)));}return o;}
const O=P(0,0), TAU=Math.PI*2;
const L_=(pts,t0,t1,col,w,x={})=>Object.assign({k:'line',pts,t0,t1,col,w},x);
const F_=(pts,t0,t1,col,x={})=>Object.assign({k:'fill',pts,t0,t1,col},x);
const D_=(x,y,r,t0,t1,col)=>({k:'dot',x,y,r,t0,t1,col});
function addPetal(els,pts,t0,t1,c,stops,r0,r1,w=1.4){
  els.push(F_(pts,t0+.06,t1+.06,null,{stops,r0,r1}));
  els.push(L_(pts,t0,t1,c.line,w));
}
const dir=a=>P(Math.cos(a),Math.sin(a));
function rayLine(a,r0,r1){const d=dir(a);return[P(d.x*r0,d.y*r0),P(d.x*r1,d.y*r1)];}
function phyllo(els,N,R,size,col,t0,t1,f){
  for(let k=0;k<N;k++){const r=R*Math.sqrt((k+.5)/N),th=k*2.39996;
    els.push(D_(r*Math.cos(th),r*Math.sin(th),size*(.75+.5*(code(f,k)%5)/4),t0+(t1-t0)*k/N*.8,t0+(t1-t0)*(k/N*.8+.2),col));}}

/* ================= FLOWERS ================= */
const FLOWERS=[
{id:'daisy',name:'Daisy',variants:[
  {name:'white',inner:[48,70,90],petal:[40,25,97],center:[45,90,55],dark:[30,70,35]},
  {name:'cream',inner:[45,80,80],petal:[42,65,90],center:[38,90,50],dark:[25,70,30]},
  {name:'pink',inner:[340,50,92],petal:[338,65,80],center:[45,90,55],dark:[30,70,35]}],
 build(f,R,c){const els=[],n=14+f.letterSum%13,layers=f.sentences>2?2:1;
  for(let l=0;l<layers;l++){const off=l*Math.PI/n+R()*.2;
    for(let j=0;j<n;j++){const a=-Math.PI/2+off+j*TAU/n,L=.72*(1-l*.12)*(.94+.06*(code(f,j)%7)/6),W=L*(.08+.05*f.vowelRatio);
      const pts=petal(O,a,.2,L,W,{k:.6}),t0=l*.25+.4*j/n;
      addPetal(els,pts,t0,t0+.2,c,[[0,hsl(c.inner)],[1,hsl(c.petal)]],.2,.2+L,1.1);
      els.push(L_(rayLine(a,.24,.2+L*.8),t0+.15,t0+.25,hsl(c.line,.35),.7));}}
  els.push(F_(circle(.21),.7,.8,null,{stops:[[0,hsl(c.center)],[1,hsl(c.dark)]],r0:0,r1:.21}));
  els.push(L_(circle(.21),.7,.8,hsl(c.line),1.3));
  phyllo(els,90,.19,.012,hsl(c.dark),.78,1,f);
  return els;}},
{id:'cherry',name:'Cherry blossom',variants:[
  {name:'light pink',inner:[338,70,72],petal:[345,70,92],center:[340,55,45],stamen:[48,90,58]},
  {name:'deep pink',inner:[330,70,55],petal:[335,75,78],center:[330,55,35],stamen:[48,90,60]},
  {name:'white',inner:[345,55,85],petal:[350,30,97],center:[345,45,55],stamen:[45,85,55]}],
 build(f,R,c){const els=[],off=R()*TAU;
  for(let j=0;j<5;j++){const a=off+j*TAU/5,L=.84,W=L*(.44+.07*R());
    const pts=petal(O,a,.03,L,W,{k:.75,notch:.1+.05*(f.wordLens[j%f.wordLens.length]%3)/2,n:24}),t0=.45*j/5;
    addPetal(els,pts,t0,t0+.28,c,[[0,hsl(c.inner)],[.55,hsl(c.petal)],[1,hsl(c.petal)]],.03,.87,1.5);
    for(const s of[-.18,0,.18])els.push(L_(rayLine(a+s,.08,.45),t0+.25,t0+.35,hsl(c.inner,.5),.8));}
  const ns=16+f.words.length%10;
  for(let k=0;k<ns;k++){const a=k*TAU/ns+R()*.1,r1=.2+.1*(code(f,k)%6)/5,d=dir(a);
    els.push(L_(rayLine(a,.05,r1),.62+.25*k/ns,.72+.25*k/ns,hsl(c.center),1));
    els.push(D_(d.x*r1,d.y*r1,.016,.7+.25*k/ns,.78+.25*k/ns,hsl(c.stamen)));}
  els.push(F_(circle(.05),.6,.66,hsl(c.center)));
  return els;}},
{id:'rose',name:'Rose',variants:[
  {name:'red',inner:[350,75,30],petal:[355,75,50]},
  {name:'pink',inner:[340,60,55],petal:[345,65,78]},
  {name:'peach',inner:[18,75,62],petal:[25,80,80]}],
 build(f,R,c){const els=[];
    const rings=3+Math.floor(R()*3)+Math.min(2,f.sentences>>1);          // 3–7 rings
    const outer=4+Math.floor(R()*5);                                       // 4–8 petals in the outer ring
    const round=.6+R()*.4, wide=.42+R()*.36, step=.3+R()*.9;               // petal roundness, width, how tightly the rings turn
    const ruffle=R()<.35?.04+R()*.04:0;                                    // some roses get ruffled edges
    let rot=R()*TAU;
    for(let j=0;j<rings;j++){const u=j/rings,Rj=.95*(1-u*.8),m=Math.max(3,outer-Math.floor(j*outer/(rings+1)));
      rot+=step;
      const shade=1-j/(rings+1),pc=[c.petal[0],c.petal[1],c.inner[2]+(c.petal[2]-c.inner[2])*shade];
      for(let i=0;i<m;i++){const a=rot+i*TAU/m,L=Rj*(.72+.14*(code(f,i+j*7)%4)/3),W=L*wide;
        const pts=petal(O,a,Rj*.16,L,W,{k:round,fringe:ruffle,n:ruffle?28:22}),t0=u*.75+.1*i/m;
        addPetal(els,pts,t0,t0+.16,c,[[0,hsl(c.inner)],[1,hsl(pc)]],Rj*.16,Rj,1.3);}}
    const turns=2+Math.floor(R()*4),sp=[];for(let t=0;t<=turns*Math.PI;t+=.12){const r=.01+.034*t/turns;sp.push(P(r*Math.cos(t+rot),r*Math.sin(t+rot)));}
    els.push(F_(circle(.16),.8,.86,hsl(c.inner,.6)));
    els.push(L_(sp,.84,1,hsl(c.line),1.4));
    return els;}},
{id:'lily',name:'Water lily',variants:[
  {name:'white & pink',inner:[45,40,96],petal:[335,65,76],center:[46,92,55],stamen:[35,90,50]},
  {name:'violet',inner:[280,40,90],petal:[272,50,58],center:[46,92,58],stamen:[35,90,50]},
  {name:'blush',inner:[30,60,94],petal:[350,55,84],center:[46,92,55],stamen:[30,90,48]}],
 build(f,R,c){const els=[],m=8+f.letterSum%5,lens=[.92,.74,.54];
  for(let l=0;l<3;l++){const off=l*Math.PI/m+R()*.1;
    for(let j=0;j<m;j++){const a=-Math.PI/2+off+j*TAU/m,L=lens[l]*(.95+.05*(code(f,j+l*3)%5)/4),W=L*(.24+.05*f.vowelRatio);
      const pts=petal(O,a,.04,L,W,{k:.08,n:20}),t0=l*.24+.3*j/m;
      addPetal(els,pts,t0,t0+.2,c,[[0,hsl(c.inner)],[.45,hsl(c.inner)],[1,hsl(c.petal)]],.04,.04+L,1.2);
      els.push(L_(rayLine(a,.08,.04+L*.85),t0+.15,t0+.25,hsl(c.petal,.45),.7));}}
  els.push(F_(circle(.1),.76,.82,hsl(c.center)));
  for(let k=0;k<26;k++){const a=k*TAU/26,r1=.15+.04*(code(f,k)%4)/3,d=dir(a);
    els.push(L_(rayLine(a,.09,r1),.8+.15*k/26,.86+.15*k/26,hsl(c.stamen),1.1));
    els.push(D_(d.x*r1,d.y*r1,.012,.84+.15*k/26,.9+.15*k/26,hsl(c.center)));}
  return els;}},
{id:'pompon',name:'Pompon dahlia',variants:[
  {name:'magenta',inner:[320,60,30],petal:[322,72,58]},
  {name:'orange',inner:[15,85,42],petal:[28,92,62]},
  {name:'burgundy',inner:[345,60,20],petal:[348,62,40]}],
 build(f,R,c){const els=[];
    const rings=6+Math.floor(R()*5)+Math.min(2,f.words.length>>4);       // 6–12 rings
    const crowd=18+Math.floor(R()*16);                                     // petals in the outer ring
    const cup=.35+R()*.6, tip=.5+R()*.5, size=.1+R()*.1;                   // round or pointed, small or large petals
    const twist=(R()-.5)*.5;                                               // the rings swirl left or right
    for(let j=0;j<rings;j++){const u=j/(rings-1),Rj=.95-u*.84,Lj=size*(1-u*.45),m=Math.max(6,Math.round(crowd-j*(crowd-6)/rings));
      const pc=[c.petal[0],c.petal[1],c.petal[2]+(c.inner[2]-c.petal[2])*u*.85];
      const off=j*Math.PI/m+j*twist;
      for(let i=0;i<m;i++){const a=off+i*TAU/m,d=dir(a),o=P(d.x*(Rj-Lj),d.y*(Rj-Lj));
        const pts=petal(o,a,0,Lj,Lj*cup,{k:tip,n:12}),t0=u*.75+.12*i/m;
        els.push(F_(pts,t0+.04,t0+.12,hsl(pc)));els.push(L_(pts,t0,t0+.1,hsl(c.line,.85),1));}}
    els.push(F_(circle(.06),.9,.95,hsl(c.inner)));
    return els;}},
{id:'mum',name:'Chrysanthemum',variants:[
  {name:'yellow',inner:[40,85,50],petal:[48,92,66]},
  {name:'bronze',inner:[18,70,32],petal:[28,70,55]},
  {name:'lilac',inner:[290,40,55],petal:[285,48,78]}],
 build(f,R,c){const els=[],lens=[.93,.78,.62,.45],sign=f.letterSum%2?1:-1;
  for(let l=0;l<4;l++){const m=22+(f.letterSum+l*3)%10,off=l*Math.PI/m+R()*.3,curl=sign*(l%2?-.12:.14);
    for(let j=0;j<m;j++){const a=off+j*TAU/m,L=lens[l]*(.9+.1*(code(f,j*2+l)%5)/4),W=L*.075;
      const pts=petal(O,a,.06,L,W,{k:.05,curl,n:14}),t0=l*.2+.25*j/m;
      addPetal(els,pts,t0,t0+.14,c,[[0,hsl(c.inner)],[1,hsl(c.petal)]],.06,.06+L,.9);}}
  els.push(F_(circle(.08),.88,.94,hsl(c.inner)));
  phyllo(els,24,.07,.01,hsl(c.petal),.9,1,f);
  return els;}},
{id:'plumeria',name:'Plumeria',variants:[
  {name:'white',inner:[46,95,60],petal:[45,35,97]},
  {name:'coral',inner:[44,95,62],petal:[8,78,72]},
  {name:'pink',inner:[46,90,64],petal:[335,65,82]}],
 build(f,R,c){const els=[],off=R()*TAU;
    const L0=.72+R()*.24, wide=.32+R()*.3, k=.6+R()*.4;                    // petal length, width, how round the tip is
    const curl=(R()-.5)*.5, asym=R()*.45;                                  // straight or twisted like a propeller
    const glow=.2+R()*.35, edge=R()<.4;                                    // size of the golden heart; some get coloured edges
    for(let j=0;j<5;j++){const a=off+j*TAU/5,L=L0*(.93+.07*(code(f,j*3)%4)/3),W=L*wide;
      const pts=petal(O,a,0,L,W,{k,asym:asym*Math.sign(curl||1),curl,n:24}),t0=.5*j/5;
      const stops=[[0,hsl(c.inner)],[glow,hsl(c.inner,.9)],[Math.min(.95,glow+.3),hsl(c.petal)],[1,edge?hsl(c.inner,.75):hsl(c.petal)]];
      addPetal(els,pts,t0,t0+.3,c,stops,0,L,1.4);
      const sg=Math.sign(curl||1),crease=bez(P(0,0),P(.15,.02*sg),P(.4,.06*sg),P(L*.7,.1*sg),12).map(p=>{const d=dir(a),q=P(-d.y,d.x);return P(d.x*p.x+q.x*p.y,d.y*p.x+q.y*p.y);});
      els.push(L_(crease,t0+.25,t0+.38,hsl(c.inner,.6),.9));}
    els.push(F_(circle(.04),.8,.86,hsl(c.inner)));
    return els;}},
{id:'anemone',name:'Anemone',variants:[
  {name:'red',inner:[355,70,40],petal:[358,82,52],center:[240,25,14],stamen:[240,25,18]},
  {name:'purple',inner:[275,50,35],petal:[278,55,52],center:[240,25,14],stamen:[240,25,18]},
  {name:'blue',inner:[228,55,45],petal:[225,62,62],center:[240,30,14],stamen:[240,25,18]}],
 build(f,R,c){const els=[],n=5+f.letterSum%2,off=R()*TAU;
  for(let j=0;j<n;j++){const a=off+j*TAU/n,L=.84,W=L*.6;
    const pts=petal(O,a,.06,L,W,{k:.95,n:24}),t0=.45*j/n;
    addPetal(els,pts,t0,t0+.25,c,[[0,hsl(c.inner)],[.35,hsl(c.petal)],[1,hsl(c.petal)]],.06,.9,1.4);
    for(let v=-2;v<=2;v++)els.push(L_(rayLine(a+v*.09,.16,.62-Math.abs(v)*.05),t0+.22,t0+.32,hsl(c.inner,.45),.7));}
  els.push(F_(circle(.14),.62,.7,hsl(c.center)));
  const ns=40+f.words.length%15;
  for(let k=0;k<ns;k++){const a=k*TAU/ns+R()*.05,r1=.19+.08*(code(f,k*3)%6)/5,d=dir(a);
    els.push(L_(rayLine(a,.13,r1),.68+.25*k/ns,.76+.25*k/ns,hsl(c.stamen),.9));
    els.push(D_(d.x*r1,d.y*r1,.012,.72+.25*k/ns,.8+.25*k/ns,hsl(c.stamen)));}
  els.push(F_(circle(.06),.9,.96,hsl(c.inner,.8)));
  return els;}},
{id:'carnation',name:'Carnation',variants:[
  {name:'pink',inner:[340,55,62],petal:[340,70,78],tip:[338,75,70]},
  {name:'red',inner:[352,70,32],petal:[355,75,48],tip:[355,78,44]},
  {name:'white & red',inner:[0,0,90],petal:[0,0,97],tip:[355,78,50]}],
 build(f,R,c){const els=[],m=9+f.letterSum%4,lens=[.92,.72,.5];
  for(let l=0;l<3;l++){const off=l*Math.PI/m+R()*.2;
    for(let j=0;j<m;j++){const a=off+j*TAU/m,L=lens[l]*(.94+.06*(code(f,j+l)%5)/4),W=L*.55;
      const pts=petal(O,a,.03,L,W,{k:.95,fringe:.11,n:30}),t0=l*.27+.3*j/m;
      addPetal(els,pts,t0,t0+.2,c,[[0,hsl(c.inner)],[.6,hsl(c.petal)],[1,hsl(c.tip)]],.03,.03+L,1.1);}}
  els.push(F_(circle(.07),.92,.98,hsl(c.inner)));
  return els;}}
];

/* ================= SNOWFLAKES ================= */
const SNOW_COLORS=[
  {name:'ice blue',line:[205,60,40],fill:[200,65,90],accent:[210,12,62]},
  {name:'blue & lilac',line:[248,40,46],fill:[255,55,91],accent:[285,40,60]},
  {name:'gold',line:[38,72,36],fill:[46,80,88],accent:[45,90,52]},
  {name:'red & gold',line:[355,62,40],fill:[44,80,90],accent:[42,85,48]}];
function snowCol(v){const t=c=>tone(c);const o={line:t(v.line),fill:t(v.fill),accent:t(v.accent)};
  if(celestial){o.line=[o.line[0],Math.min(70,o.line[1]+10),80];o.fill=[o.fill[0],o.fill[1],38];o.accent=[o.accent[0],o.accent[1],72];}
  if(mood==='festive')o.accent=celestial?[44,85,72]:[40,80,45];
  return o;}
function sixfold(fn){for(let i=0;i<6;i++)fn(-Math.PI/2+i*Math.PI/3,i);}
const SNOWS=[
{id:'stellarPlate',name:'Stellar plate',build(f,R,c){const els=[],w=.055+.04*f.vowelRatio;
  els.push(F_(hexagon(.15,0,0,Math.PI/6),0,.1,hsl(c.fill)));els.push(L_(hexagon(.15,0,0,Math.PI/6),0,.12,hsl(c.line),1.6));
  sixfold(a=>{const loc=[[.12,w],[.6,w],[.72,w*1.7],[.88,w*1.1],[.94,0],[.88,-w*1.1],[.72,-w*1.7],[.6,-w],[.12,-w]];
    const d=dir(a),q=P(-d.y,d.x),pts=loc.map(([s,t])=>P(d.x*s+q.x*t,d.y*s+q.y*t));pts.push(pts[0]);
    els.push(F_(pts,.15,.5,hsl(c.fill)));els.push(L_(pts,.1,.55,hsl(c.line),1.5));
    els.push(L_(rayLine(a,.15,.9),.3,.6,hsl(c.line,.7),1));
    const K=2+f.sentences%3;for(let k=0;k<K;k++){const s=.25+.38*(k+.5)/K;
      els.push(L_([P(d.x*s+q.x*w*.75,d.y*s+q.y*w*.75),P(d.x*s-q.x*w*.75,d.y*s-q.y*w*.75)],.5+.06*k,.58+.06*k,hsl(c.line,.7),.9));}
    els.push(D_(d.x*.78,d.y*.78,.018,.8,.9,hsl(c.accent)));});
  els.push(L_(hexagon(.08,0,0,Math.PI/6),.6,.7,hsl(c.line),1.1));
  return els;}},
{id:'sectored',name:'Sectored plate',build(f,R,c){const els=[],Rm=.9,K=3+f.sentences%3;
  const V=[],M=[];for(let i=0;i<6;i++){const a=-Math.PI/2+Math.PI/6+i*Math.PI/3;V.push(P(Rm*Math.cos(a),Rm*Math.sin(a)));}
  for(let i=0;i<6;i++){const a=V[i],b=V[(i+1)%6],dent=.9-.05*(code(f,i)%3)/2;M.push(P((a.x+b.x)/2*dent,(a.y+b.y)/2*dent));}
  const alt=[c.fill[0],c.fill[1],celestial?c.fill[2]+9:c.fill[2]-9];
  // twelve facets, alternately shaded like a cut gem
  for(let i=0;i<6;i++){
    els.push(F_([O,V[i],M[i],O],.02+.04*i,.12+.04*i,hsl(c.fill)));
    els.push(F_([O,M[i],V[(i+1)%6],O],.04+.04*i,.14+.04*i,hsl(alt)));}
  const outline=[];for(let i=0;i<6;i++)outline.push(V[i],M[i]);outline.push(V[0]);
  els.push(L_(outline,0,.35,hsl(c.line),1.8));
  // ridges to the corners, with frost feathers along them
  for(let i=0;i<6;i++){const v=V[i],a=Math.atan2(v.y,v.x);
    els.push(L_([O,v],.3,.55,hsl(c.line),1.5));
    for(let k=1;k<=K;k++){const t=k/(K+1),o=P(v.x*t,v.y*t),len=.16*(1-t*.6)*(.8+.2*(code(f,k+i*3)%4)/3);
      for(const sg of[-1,1]){const d=dir(a+sg*Math.PI*5/6);
        els.push(L_([o,P(o.x+d.x*len,o.y+d.y*len)],.5+.06*k,.58+.06*k,hsl(c.line,.65),.9));}}
    // tiny spike + bead at each corner
    const d=dir(a);els.push(L_([v,P(v.x+d.x*.06,v.y+d.y*.06)],.85,.9,hsl(c.line),1.3));
    els.push(D_(v.x+d.x*.07,v.y+d.y*.07,.018,.88,.96,hsl(c.accent)));}
  els.push(F_(hexagon(.1,0,0,Math.PI/6),.75,.82,hsl(c.fill)));els.push(L_(hexagon(.1,0,0,Math.PI/6),.75,.85,hsl(c.line),1.3));
  els.push(D_(0,0,.025,.85,.95,hsl(c.accent)));
  return els;}},
{id:'dendrite',name:'Stellar dendrite',build(f,R,c){const els=[],Rm=.94,K=Math.min(6,Math.max(3,f.wordLens.length>>2)),maxL=Math.max(...f.wordLens);
  const br=[];for(let k=0;k<K;k++){const wl=f.wordLens[(k*3+1)%f.wordLens.length],t=.28+.58*(k+.3+R()*.4)/K;br.push({t,len:Rm*(.1+.26*wl/maxL)*(1-t*.55),sub:code(f,k*5)%3===0});}
  els.push(F_(hexagon(.13,0,0,Math.PI/6),0,.1,hsl(c.fill)));els.push(L_(hexagon(.13,0,0,Math.PI/6),0,.12,hsl(c.line),1.6));
  sixfold(a=>{const d=dir(a),at=s=>.12+.68*s/Rm;
    els.push(L_(rayLine(a,.07,Rm),.12,.8,hsl(c.line),1.9));
    for(const b of br){const s=b.t*Rm,o=P(d.x*s,d.y*s);
      for(const sg of[-1,1]){const bd=dir(a+sg*Math.PI/3),e=P(o.x+bd.x*b.len,o.y+bd.y*b.len);
        els.push(L_([o,e],at(s),at(s)+.12,hsl(c.line),1.4));
        if(b.sub){const m=P(o.x+bd.x*b.len*.55,o.y+bd.y*b.len*.55);for(const s2 of[-1,1]){const sd=dir(a+sg*Math.PI/3+s2*Math.PI/3);els.push(L_([m,P(m.x+sd.x*b.len*.3,m.y+sd.y*b.len*.3)],at(s)+.1,at(s)+.17,hsl(c.line),1));}}
        els.push(D_(e.x,e.y,.012,at(s)+.11,at(s)+.15,hsl(c.accent)));}}
    els.push(D_(d.x*Rm,d.y*Rm,.022,.8,.92,hsl(c.accent)));});
  return els;}},
{id:'fern',name:'Fernlike dendrite',build(f,R,c){const els=[],Rm=.95;
  els.push(F_(hexagon(.08,0,0,Math.PI/6),0,.08,hsl(c.fill)));els.push(L_(hexagon(.08,0,0,Math.PI/6),0,.1,hsl(c.line),1.3));
  sixfold((a,i)=>{const d=dir(a),at=s=>.08+.75*s/Rm;
    els.push(L_(rayLine(a,.05,Rm),.08,.83,hsl(c.line),1.6));
    let k=0;for(let s=.16;s<Rm-.03;s+=.034,k++){const o=P(d.x*s,d.y*s),len=(.15*(1-s/Rm)+.025)*(.7+.3*(code(f,k+i*7)%5)/4);
      for(const sg of[-1,1]){const bd=dir(a+sg*Math.PI/3),e=P(o.x+bd.x*len,o.y+bd.y*len);
        els.push(L_([o,e],at(s),at(s)+.08,hsl(c.line),.9));
        if(len>.09){const m=P(o.x+bd.x*len*.5,o.y+bd.y*len*.5),sd=dir(a+sg*Math.PI/3-sg*Math.PI/3);
          els.push(L_([m,P(m.x+sd.x*len*.28,m.y+sd.y*len*.28)],at(s)+.06,at(s)+.11,hsl(c.line),.7));}}}
    els.push(D_(d.x*Rm,d.y*Rm,.016,.85,.95,hsl(c.accent)));});
  return els;}},
{id:'twelve',name:'12-sided',build(f,R,c){const els=[];
  els.push(F_(circle(.12,12),0,.1,hsl(c.fill)));els.push(L_(circle(.12,12),0,.12,hsl(c.line),1.4));
  for(let i=0;i<12;i++){const a=-Math.PI/2+i*Math.PI/6,Rm=i%2?.68:.94,d=dir(a),t0=(i%2)*.15;
    els.push(L_(rayLine(a,.12,Rm),.1+t0,.65+t0,hsl(c.line),i%2?1.3:1.7));
    const K=i%2?2:3;for(let k=0;k<K;k++){const s=Rm*(.4+.45*(k+.5)/K),len=(.06+.06*(code(f,k+i)%4)/3)*(1-s*.4),o=P(d.x*s,d.y*s);
      for(const sg of[-1,1]){const bd=dir(a+sg*Math.PI/3);els.push(L_([o,P(o.x+bd.x*len,o.y+bd.y*len)],.3+t0+.3*s,.4+t0+.3*s,hsl(c.line),1));}}
    els.push(D_(d.x*Rm,d.y*Rm,i%2?.014:.02,.85,.95,hsl(c.accent)));}
  return els;}},
{id:'split',name:'Split star',build(f,R,c){const els=[],tipR=.06+.03*f.vowelRatio;
  els.push(F_(hexagon(.2,0,0,Math.PI/6),0,.15,hsl(c.fill)));els.push(L_(hexagon(.2,0,0,Math.PI/6),0,.18,hsl(c.line),1.6));
  els.push(L_(hexagon(.11,0,0,Math.PI/6),.1,.22,hsl(c.line),1.1));
  sixfold(a=>{const d=dir(a);els.push(L_(rayLine(a,.0,.2),.15,.25,hsl(c.line,.6),.9));
    els.push(L_(rayLine(a,.2,.86-tipR),.25,.65,hsl(c.line),1.7));
    const mid=.5;els.push(F_(hexagon(.035,d.x*mid,d.y*mid,a),.45,.55,hsl(c.fill)));els.push(L_(hexagon(.035,d.x*mid,d.y*mid,a),.45,.55,hsl(c.line),1));
    const tp=P(d.x*.88,d.y*.88);
    els.push(F_(hexagon(tipR,tp.x,tp.y,a),.65,.8,hsl(c.fill)));els.push(L_(hexagon(tipR,tp.x,tp.y,a),.65,.8,hsl(c.line),1.4));
    els.push(D_(tp.x,tp.y,.014,.85,.95,hsl(c.accent)));
    for(const sg of[-1,1]){const s=.72,o=P(d.x*s,d.y*s),bd=dir(a+sg*Math.PI/3);els.push(L_([o,P(o.x+bd.x*.07,o.y+bd.y*.07)],.6,.68,hsl(c.line),1.1));}});
  return els;}},
{id:'hexplate',name:'Hexagonal plate',build(f,R,c){const els=[],K=3+f.sentences%4;
  els.push(F_(hexagon(.9,0,0,Math.PI/6),0,.2,hsl(c.fill)));
  for(let k=K;k>=1;k--){const r=.9*k/K;els.push(L_(hexagon(r,0,0,Math.PI/6),.05+(K-k)*.1,.15+(K-k)*.1,hsl(c.line),k===K?1.8:1));}
  sixfold(a=>{const pts=petal(O,a,.03,.32,.08,{k:.4,n:12});els.push(F_(pts,.6,.7,hsl(c.accent,.35)));els.push(L_(pts,.55,.7,hsl(c.line),1));
    const v=dir(a);for(let k=1;k<=K;k++){const r=.9*k/K;els.push(D_(v.x*r,v.y*r,.013,.75+.04*k,.82+.04*k,hsl(c.accent)));}});
  els.push(F_(circle(.04),.8,.88,hsl(c.accent)));
  return els;}}
];

/* ================= HEART (Thank you) ================= */
const HEART_COLORS=[
  {name:'amber',outline:[25,70,48],vine:[95,32,38],leaf:[95,38,64],bloom:[28,85,66],bloomIn:[45,90,76]},
  {name:'rose',outline:[345,55,48],vine:[120,25,36],leaf:[110,30,62],bloom:[345,70,74],bloomIn:[45,85,76]},
  {name:'golden',outline:[38,70,40],vine:[85,32,36],leaf:[80,40,62],bloom:[45,90,62],bloomIn:[40,95,82]}];
function heartCol(v){const o={};for(const k in v)if(k!=='name')o[k]=tone(v[k]);
  if(celestial){o.outline=[o.outline[0],70,74];o.vine=[o.vine[0],40,70];o.leaf=[o.leaf[0],35,45];}
  if(mood==='festive')o.outline=celestial?[44,85,72]:[38,70,38];
  return o;}
function heartPoly(){
  const raw=[];for(let i=0;i<=240;i++){const t=i/240*TAU;raw.push(P(16*Math.sin(t)**3,-(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))));}
  let a=1e9,b=-1e9,c=1e9,d=-1e9;for(const p of raw){a=Math.min(a,p.x);b=Math.max(b,p.x);c=Math.min(c,p.y);d=Math.max(d,p.y);}
  const s=1.86/Math.max(b-a,d-c),cy=(c+d)/2;return raw.map(p=>P(p.x*s,(p.y-cy)*s));}
function inside(p,poly){let r=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))r=!r;}return r;}
function blossom(els,cx,cy,r,a0,t0,c){
  for(let i=0;i<5;i++){const pts=petal(P(cx,cy),a0+i*TAU/5,r*.15,r,r*.45,{k:.55,n:12});
    els.push(F_(pts,t0,t0+.08,hsl(c.bloom)));els.push(L_(pts,t0,t0+.08,hsl(c.outline),1.1));}
  els.push(D_(cx,cy,r*.28,t0+.05,t0+.1,hsl(c.bloomIn)));}
function buildHeart(f,R,c){
  const els=[],H=heartPoly(),inner=H.map(p=>P(p.x*.86,p.y*.86+.03));
  els.push(L_(H,0,.3,hsl(c.outline),2.4));
  els.push(L_(H.map(p=>P(p.x*.93,p.y*.93+.015)),.08,.36,hsl(c.outline,.6),1,{dash:true}));
  const S=P(0,.32),V=Math.min(4,1+f.sentences),half=[];
  for(let v=0;v<V;v++){const wl=f.wordLens[(v*5+2)%f.wordLens.length];
    let a=-Math.PI/2-.18-v*(1.25/Math.max(1,V-1)),cv=(wl%2?1:-1)*(.022+.03*R());
    const pts=[S];let p=S;
    for(let i=0;i<80;i++){a+=cv*(1+i*.025);const q=P(p.x+Math.cos(a)*.03,p.y+Math.sin(a)*.03);if(!inside(q,inner))break;pts.push(q);p=q;}
    if(pts.length<4)continue;
    const leaves=[];for(let i=3;i<pts.length-2;i+=3){const cd=code(f,v*11+i),side=(i/3)%2?1:-1;
      leaves.push({o:pts[i],a:Math.atan2(pts[i+1].y-pts[i].y,pts[i+1].x-pts[i].x)+side*.9,L:.05+.035*(cd%6)/5,u:i/pts.length});}
    half.push({pts,leaves,end:pts[pts.length-1],size:.04+.02*(wl%4)/3});}
  for(const m of[false,true])for(const vn of half){
    els.push(L_(m?vn.pts.map(q=>P(-q.x,q.y)):vn.pts,.32,.82,hsl(c.vine),1.8));
    for(const lf of vn.leaves){const o=m?P(-lf.o.x,lf.o.y):lf.o,a=m?Math.PI-lf.a:lf.a,lp=petal(o,a,0,lf.L,lf.L*.38,{k:.15,n:10}),t=.32+.5*lf.u;
      els.push(F_(lp,t+.03,t+.1,hsl(c.leaf)));els.push(L_(lp,t,t+.08,hsl(c.vine),1));}
    const e=m?P(-vn.end.x,vn.end.y):vn.end;blossom(els,e.x,e.y,vn.size,R()*Math.PI,.82,c);}
  blossom(els,S.x,S.y,.07,-Math.PI/2,.26,c);
  return els;}

/* ================= BIRTHDAY CAKE ================= */
const CAKE_COLORS=[
  {name:'strawberry',body:[345,62,80],cream:[345,55,93],accent:[350,72,52],candle:[345,70,60]},
  {name:'vanilla',   body:[40,62,84], cream:[42,60,95], accent:[12,72,58], candle:[200,60,60]},
  {name:'chocolate', body:[22,38,40], cream:[32,45,82], accent:[350,72,55],candle:[45,85,58]},
  {name:'mint',      body:[150,38,78],cream:[150,32,93],accent:[340,68,62],candle:[340,65,62]},
  {name:'lemon',     body:[50,82,76], cream:[52,70,93], accent:[200,62,55],candle:[200,60,58]},
  {name:'lavender',  body:[268,38,80],cream:[270,35,93],accent:[45,85,55], candle:[45,85,55]}];
function cakeCol(v){const o={};for(const k in v)if(k!=='name')o[k]=tone(v[k]);
  o.line=celestial?[o.body[0],45,80]:[o.body[0],Math.min(45,o.body[1]),Math.max(22,Math.min(38,o.body[2]-40))];
  if(mood==='festive')o.line=celestial?[44,85,74]:[38,70,36];
  return o;}
/* a number in the message: digits ("30", "21st") or words ("thirty", "twenty-one") */
const NUMW={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,hundred:100};
function cakeNumber(text){
  const body=text.split('\n').slice(1,-1).join(' ').toLowerCase();
  const d=body.match(/\b(\d{1,3})(?:st|nd|rd|th)?\b/);if(d){const n=+d[1];if(n>0&&n<=120)return n;}
  const w=body.match(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]+(one|two|three|four|five|six|seven|eight|nine)\b/);
  if(w)return NUMW[w[1]]+NUMW[w[2]];
  const s=body.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\b(?=[\s-]*(years?|today|th|birthday|candles|!|\.|,|$))/);
  if(s)return NUMW[s[1]];
  return 0;
}
function buildCake(f,R,c,text){
  const els=[],flames=[];
  const tiers=1+Math.min(2,Math.floor(f.sentences/2)+(R()<.3?1:0));
  const styles=['smooth','drip','scallop','stripes','dots','ruffle'];
  const plateY=.9;
  // plate
  const plate=[];for(let i=0;i<=40;i++){const a=i/40*TAU;plate.push(P(.94*Math.cos(a),plateY+.11*Math.sin(a)));}
  els.push(F_(plate,0,.06,hsl([c.cream[0],12,celestial?40:94])));els.push(L_(plate,0,.08,hsl(c.line,.7),1.2));
  let yB=plateY,w=tiers===1?1.36:tiers===2?1.46:1.5;
  const tierH=tiers===1?.66:tiers===2?.5:.4;
  let topInfo=null;
  for(let k=0;k<tiers;k++){
    const h=tierH*(1-k*.08),yT=yB-h,ry=w*.13,t0=.06+k*.2,t1=t0+.2;
    const style=styles[(code(f,k*11+3)+k)%styles.length];
    // body (front side) and the top surface
    const body=[P(-w/2,yT),P(-w/2,yB)];
    for(let i=0;i<=24;i++){const a=Math.PI-i/24*Math.PI;body.push(P(w/2*Math.cos(a),yB+ry*Math.sin(a)));}
    body.push(P(w/2,yT));
    for(let i=0;i<=24;i++){const a=i/24*Math.PI;body.push(P(w/2*Math.cos(a),yT+ry*Math.sin(a)));}
    els.push(F_(body,t0+.03,t1,null,{lin:[yT,yB],stops:[[0,hsl([c.body[0],c.body[1],Math.min(97,c.body[2]+6)])],[1,hsl([c.body[0],c.body[1],c.body[2]-8])]]}));
    els.push(L_(body,t0,t1,hsl(c.line),1.5));
    const top=[];for(let i=0;i<=40;i++){const a=i/40*TAU;top.push(P(w/2*Math.cos(a),yT+ry*Math.sin(a)));}
    els.push(F_(top,t1-.04,t1+.02,hsl(c.cream)));els.push(L_(top,t1-.06,t1+.02,hsl(c.line),1.2));
    const front=x=>yT+ry*Math.sqrt(Math.max(0,1-(2*x/w)**2));   // y of the top front edge
    const frontB=x=>yB+ry*Math.sqrt(Math.max(0,1-(2*x/w)**2));
    const d0=t1,d1=t1+.12;
    if(style==='drip'){
      const n=6+code(f,k*5)%5,band=[];
      for(let i=0;i<=60;i++){const x=-w/2+i/60*w;band.push(P(x,front(x)));}
      const low=[];for(let i=60;i>=0;i--){const x=-w/2+i/60*w;let dy=.035;
        for(let j=0;j<n;j++){const xj=-w/2+(j+.5)/n*w,L=(.06+.12*((code(f,j*7+k)%5)/4))*h/.4;dy+=L*Math.exp(-(((x-xj)/(w*.035))**2));}
        low.push(P(x,front(x)+dy));}
      const pts=band.concat(low);
      els.push(F_(pts,d0,d1,hsl(c.cream)));els.push(L_(low,d0,d1,hsl(c.line,.8),1.1));
    }else if(style==='scallop'){
      const n=9+code(f,k*3)%5;
      for(let j=0;j<n;j++){const xa=-w/2+j/n*w,xb=xa+w/n,arc=[];
        for(let i=0;i<=10;i++){const x=xa+(xb-xa)*i/10;arc.push(P(x,frontB(x)-.05*Math.sin(i/10*Math.PI)));}
        els.push(L_(arc,d0+j/n*.1,d0+j/n*.1+.05,hsl(c.cream),2.6));els.push(L_(arc,d0+j/n*.1,d0+j/n*.1+.05,hsl(c.line,.6),.8));
        const xm=(xa+xb)/2;els.push(D_(xm,front(xm)+.012,.018,d0+j/n*.1,d0+j/n*.1+.06,hsl(c.cream)));}
    }else if(style==='stripes'){
      const n=7+code(f,k*9)%5;
      for(let j=0;j<n;j++){const x=-w/2+(j+.5)/n*w,dw=w/n*.18,q=[];
        q.push(P(x-dw,front(x-dw)),P(x-dw,frontB(x-dw)),P(x+dw,frontB(x+dw)),P(x+dw,front(x+dw)));
        els.push(F_(q,d0+j/n*.08,d0+j/n*.08+.05,hsl(c.accent,.55)));}
    }else if(style==='dots'){
      const cols=5+code(f,k)%3,rows=2;
      for(let r=0;r<rows;r++)for(let j=0;j<cols;j++){const x=-w/2+(j+.5+(r%2)*.5)/cols*w;if(x>w/2-.04)continue;
        const y=front(x)+(r+1)*(h/(rows+1));els.push(D_(x,y,.022,d0+(r*cols+j)*.006,d0+(r*cols+j)*.006+.05,hsl(r%2?c.cream:c.accent)));}
    }else if(style==='ruffle'){
      for(let r=1;r<=2;r++){const pts=[];for(let i=0;i<=60;i++){const x=-w/2+i/60*w;pts.push(P(x,front(x)+r*h/3+.018*Math.sin(i*1.3)));}
        els.push(L_(pts,d0+r*.03,d1,hsl(c.cream),3.2));els.push(L_(pts,d0+r*.03,d1,hsl(c.line,.5),.8));}
    }
    topInfo={yT,w,ry,t:d1};
    yB=yT+ry*.2;w*=.72;
  }
  // decorations on the top tier
  const {yT,w:tw,ry}=topInfo,decoT=Math.min(.82,topInfo.t+.02);
  const deco=['berries','strawberries','flowers','stars','sprinkles'][code(f,17)%5];
  const spots=[];const nd=5+code(f,23)%4;
  for(let j=0;j<nd;j++){const a=Math.PI*(.12+.76*j/(nd-1));spots.push(P(-tw/2*.86*Math.cos(a),yT+ry*.86*Math.sin(a)));}
  spots.forEach((p,j)=>{const t0=decoT+j*.012;
    if(deco==='berries'){for(const[dx,dy]of[[0,0],[.025,-.015],[-.022,-.012]])els.push(D_(p.x+dx,p.y+dy-.02,.022,t0,t0+.05,hsl(j%2?[300,40,38]:[350,70,45])));}
    else if(deco==='strawberries'){const s=.05,b=[];for(let i=0;i<=16;i++){const a=i/16*TAU;b.push(P(p.x+s*.8*Math.sin(a),p.y-.03-s*(.55*Math.cos(a)-.3*Math.cos(2*a)*.4)));}
      els.push(F_(b,t0,t0+.05,hsl([355,75,52])));els.push(D_(p.x,p.y-.075,.012,t0+.03,t0+.06,hsl([110,45,40])));}
    else if(deco==='flowers'){for(let i=0;i<5;i++){const a=i*TAU/5;els.push(D_(p.x+.022*Math.cos(a),p.y-.025+.022*Math.sin(a),.016,t0,t0+.05,hsl(c.accent)));}
      els.push(D_(p.x,p.y-.025,.012,t0+.02,t0+.06,hsl([45,90,62])));}
    else if(deco==='stars'){const s=[];for(let i=0;i<=10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?.016:.04;s.push(P(p.x+r*Math.cos(a),p.y-.03+r*Math.sin(a)));}
      els.push(F_(s,t0,t0+.05,hsl([45,90,60])));}
    else{for(let i=0;i<4;i++){const a=R()*Math.PI,x=p.x+(R()-.5)*.08,y=p.y-.02+(R()-.5)*.03;
      els.push(L_([P(x-.014*Math.cos(a),y-.014*Math.sin(a)),P(x+.014*Math.cos(a),y+.014*Math.sin(a))],t0,t0+.04,hsl([[350,70,60],[200,60,55],[50,85,55],[140,45,50]][i]),2.2));}}
  });
  // candles: the number from the message, or a little group
  const num=cakeNumber(text||''),cT=.86;
  if(num){
    const digits=String(num).split(''),size=digits.length>2?.38:.54,gap=size*.62,x0=-(digits.length-1)*gap/2;
    digits.forEach((dg,i)=>{const x=x0+i*gap,y=yT-size*.12;
      els.push({k:'text',x,y,size,txt:dg,col:hsl(c.candle),stroke:hsl(c.line),t0:cT+i*.03,t1:cT+i*.03+.06});
      els.push(L_([P(x,y-size*.7),P(x,y-size*.8)],cT+.08,cT+.1,hsl([30,20,25]),1.4));
      flames.push({x,y:y-size*.8,s:.06});});
  }else{
    const n=3+code(f,31)%5;
    for(let i=0;i<n;i++){const a=Math.PI*(.15+.7*i/Math.max(1,n-1)),x=-tw/2*.62*Math.cos(a),yb=yT+ry*.5*Math.sin(a)-.01,hgt=.26+.05*(i%2),cw=.026;
      const body=[P(x-cw,yb),P(x-cw,yb-hgt),P(x+cw,yb-hgt),P(x+cw,yb)];
      els.push(F_(body,cT+i*.012,cT+i*.012+.04,hsl(celestial?[0,0,85]:[0,0,99])));
      for(let s=0;s<4;s++){const y1=yb-hgt*(s+.2)/4;els.push(L_([P(x-cw,y1),P(x+cw,y1-hgt*.12)],cT+i*.012+.02,cT+i*.012+.05,hsl(c.candle),1.8));}
      els.push(L_(body.concat([body[0]]),cT+i*.012,cT+i*.012+.04,hsl(c.line,.6),.9));
      els.push(L_([P(x,yb-hgt),P(x,yb-hgt-.03)],cT+.06,cT+.08,hsl([30,20,25]),1.2));
      flames.push({x,y:yb-hgt-.03,s:.045});}
  }
  return{els,flames};
}
/* flames that flicker; blown = how far they have gone out (0..1) */
function drawFlames(ctx,flames,time,alpha,blown){
  if(!flames||!flames.length||alpha<=0)return;
  const S=ctx.canvas.width,c=S/2,u=S*.47;
  flames.forEach((fl,i)=>{
    const x=c+fl.x*u,y=c+fl.y*u,s=fl.s*u*(1-blown),fl2=Math.sin(time*13+i*2.1)*.12+Math.sin(time*7.3+i)*.08;
    if(s<=.5)return;
    ctx.save();ctx.globalAlpha=alpha*(1-blown);
    const g=ctx.createRadialGradient(x,y-s*.4,0,x,y-s*.4,s*2.6);g.addColorStop(0,'rgba(255,214,120,.55)');g.addColorStop(1,'rgba(255,190,90,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y-s*.4,s*2.6,0,TAU);ctx.fill();
    ctx.translate(x,y);ctx.rotate(fl2*.25);ctx.scale(1,1+fl2);
    const gr=ctx.createLinearGradient(0,0,0,-s*1.6);gr.addColorStop(0,'#ff8a2a');gr.addColorStop(.5,'#ffc94a');gr.addColorStop(1,'#fff3c4');
    ctx.fillStyle=gr;ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(s*.7,-s*.2,s*.45,-s*1.1,0,-s*1.7);ctx.bezierCurveTo(-s*.45,-s*1.1,-s*.7,-s*.2,0,0);ctx.fill();
    ctx.restore();
  });
}
/* little curls of smoke after the candles are blown out */
function drawSmoke(ctx,flames,since){
  if(since<0||since>2.6)return;
  const S=ctx.canvas.width,c=S/2,u=S*.47;
  flames.forEach((fl,i)=>{for(let k=0;k<5;k++){const t=since-k*.14;if(t<0)continue;
    const x=c+fl.x*u+Math.sin(t*3+i+k)*u*.03,y=c+fl.y*u-t*u*.16,r=u*(.01+t*.018);
    ctx.globalAlpha=Math.max(0,.35*(1-t/2.4));ctx.fillStyle=celestial?'#c9c3d6':'#a99b8a';ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}});
  ctx.globalAlpha=1;
}

/* ================= HEARTS — six kinds, the message picks one ================= */
const HEART_KINDS=['garden','lace','petals','hearts','glass','ribbon'];
const HEART_NAMES={garden:'Garden heart',lace:'Lace heart',petals:'Heart of petals',hearts:'Heart of hearts',glass:'Stained-glass heart',ribbon:'Ribbon heart'};
/* point on the heart outline (t 0..2π), k = scale toward the middle */
const HC=P(0,.04);
function heartAt(t,k=1){
  const x=16*Math.sin(t)**3,y=-(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t));
  const s=.0575;return P(HC.x+(x*s)*k,HC.y+(y*s+.1)*k);
}
function heartPath(k=1,n=160){const o=[];for(let i=0;i<=n;i++)o.push(heartAt(i/n*TAU,k));return o;}
function miniHeart(cx,cy,r,rot=0){const o=[];for(let i=0;i<=24;i++){const t=i/24*TAU,x=16*Math.sin(t)**3/17,y=-(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))/17;
  const ca=Math.cos(rot),sa=Math.sin(rot);o.push(P(cx+r*(x*ca-y*sa),cy+r*(x*sa+y*ca)));}return o;}
function buildHeartKind(kind,f,R,c){
  const els=[],H=heartPath(1);
  if(kind==='garden')return buildHeart(f,R,c);
  if(kind==='lace'){
    els.push(L_(H,0,.25,hsl(c.outline),2.2));
    const loops=22+code(f,5)%14;
    for(let j=0;j<loops;j++){const t=(j+.5)/loops*TAU,p=heartAt(t,1),q=heartAt(t,.9),m=P((p.x+q.x)/2,(p.y+q.y)/2);
      const r=.045+.02*((code(f,j)%3)/2);els.push(L_(circle(r,18,m.x,m.y),.15+j/loops*.35,.2+j/loops*.35,hsl(c.outline,.95),1.6));els.push(D_(p.x,p.y,.012,.2+j/loops*.35,.25+j/loops*.35,hsl(c.bloom)));}
    for(const k of[.74,.54]){els.push(L_(heartPath(k),.45+(1-k)*.3,.65+(1-k)*.3,hsl(c.outline,.75),1.4,{dash:true}));}
    const rings=[.62,.38];rings.forEach((k,ri)=>{const n=14-ri*5;for(let j=0;j<n;j++){const p=heartAt((j+.5)/n*TAU,k);els.push(D_(p.x,p.y,.013,.6+ri*.1+j*.006,.66+ri*.1+j*.006,hsl(c.bloom)));}});
    blossom(els,HC.x,HC.y+.1,.09,-Math.PI/2,.82,c);
    return els;
  }
  if(kind==='petals'){
    const pts=[],step=.13-.025*((code(f,7)%3)/2);
    for(let y=.92;y>-.72;y-=step*.8)for(let x=-.95;x<=.95;x+=step){const q=P(x+(Math.round(y/step)%2)*step/2+(R()-.5)*.02,y);if(inside(q,heartPath(.94,80)))pts.push(q);}
    const cols=[c.bloom,c.bloomIn,c.leaf];
    pts.forEach((p,i)=>{const a=Math.atan2(p.y-HC.y,p.x-HC.x)+(R()-.5)*.6,L=step*1.15,t0=.08+.7*(1-(p.y+.72)/1.64);
      const pts2=petal(P(p.x-Math.cos(a)*L*.5,p.y-Math.sin(a)*L*.5),a,0,L,L*.42,{k:.8,n:10});
      els.push(F_(pts2,t0,t0+.06,hsl(cols[(code(f,i)+i)%3],.85)));els.push(L_(pts2,t0,t0+.06,hsl(c.outline,.6),.8));});
    els.push(L_(H,.85,1,hsl(c.outline),2));
    return els;
  }
  if(kind==='hearts'){
    els.push(L_(H,0,.2,hsl(c.outline,.6),1.2,{dash:true}));
    const step=.15-.03*((code(f,9)%3)/2),cols=[c.bloom,c.outline,c.bloomIn],cells=[],HP=heartPath(.92,80);
    for(let y=-.8;y<.95;y+=step*.86)for(let x=-.98;x<=.98;x+=step){const q=P(x+(Math.round((y+.8)/(step*.86))%2)*step/2+(R()-.5)*.03,y+(R()-.5)*.03);if(inside(q,HP))cells.push(q);}
    cells.sort((a,b)=>b.y-a.y);const N=cells.length;
    for(let k=0;k<N;k++){const p=cells[k],r=Math.hypot(p.x-HC.x,p.y-HC.y);
      const s=step*(.62+.25*((code(f,k)%3)/2)),t0=.1+.75*k/N;
      const mh=miniHeart(p.x,p.y,s,(R()-.5)*.6);els.push(F_(mh,t0,t0+.05,hsl(cols[k%3],.9)));els.push(L_(mh,t0,t0+.05,hsl(c.outline,.5),.7));}
    return els;
  }
  if(kind==='glass'){
    const rings=[1,.72,.44,.2],segs=8+code(f,13)%5,t0s=[];
    const hueBase=c.bloom[0],cells=[];
    for(let r=0;r<rings.length-1;r++)for(let j=0;j<segs;j++){
      const ta=j/segs*TAU,tb=(j+1)/segs*TAU,poly=[];
      for(let i=0;i<=8;i++)poly.push(heartAt(ta+(tb-ta)*i/8,rings[r]));
      for(let i=8;i>=0;i--)poly.push(heartAt(ta+(tb-ta)*i/8,rings[r+1]));
      const h=(hueBase+[-18,0,14,28,-30][(code(f,r*segs+j))%5]+360)%360;
      cells.push({poly,col:[h,Math.min(68,c.bloom[1]),celestial?52:[76,82,70][(r+j)%3]],t:.1+r*.22+j/segs*.15});}
    const core=heartPath(.2,40);cells.push({poly:core,col:c.bloomIn,t:.75});
    for(const cl of cells){els.push(F_(cl.poly,cl.t,cl.t+.08,hsl(cl.col,.85)));els.push(L_(cl.poly,cl.t,cl.t+.08,hsl([30,20,celestial?80:22],.9),1.6));}
    els.push(L_(H,.85,1,hsl([30,20,celestial?80:22]),3));
    return els;
  }
  // ribbon: a wide band traced around the heart, finished with a bow
  const wR=.08+.04*((code(f,19)%3)/2),outer=[],inner=[];
  for(let i=0;i<=120;i++){const t=.18+i/120*(TAU-.36);outer.push(heartAt(t,1));inner.push(heartAt(t,1-wR*1.6));}
  const band=outer.concat(inner.slice().reverse());
  els.push(F_(band,.05,.6,hsl(c.bloom,.9)));els.push(L_(outer,0,.6,hsl(c.outline),1.6));els.push(L_(inner,0,.6,hsl(c.outline),1.2));
  for(let k=0;k<12;k++){const t=.3+k/12*(TAU-.6),a=heartAt(t,1),b=heartAt(t+.12,1-wR*1.6);els.push(L_([a,b],.3+k*.02,.36+k*.02,hsl(c.bloomIn,.6),1));}
  const top=heartAt(0,1-wR*.8),bw=.16+.05*((code(f,21)%3)/2);
  for(const s of[-1,1]){const loop=[];for(let i=0;i<=24;i++){const a=i/24*TAU;loop.push(P(top.x+s*bw*(.55+.45*Math.cos(a)),top.y-.02+bw*.45*Math.sin(a)));}
    els.push(F_(loop,.65,.75,hsl(c.bloom)));els.push(L_(loop,.62,.75,hsl(c.outline),1.4));
    const tail=[P(top.x,top.y),P(top.x+s*.08,top.y+.2),P(top.x+s*.05,top.y+.26),P(top.x+s*.12,top.y+.24)];
    els.push(L_(tail,.75,.85,hsl(c.outline),2.4));}
  els.push(D_(top.x,top.y,.035,.78,.86,hsl(c.outline)));
  return els;
}

/* ================= the AI layer: key words, colours, energy ================= */
let AI=null;   // {keywords:[...], palette:['#hex','#hex'], energy:1..5} — comes with the chosen draft

function hexHsl(hex){
  const n=parseInt(hex.replace('#',''),16),r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;let h=0,s=0;
  if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;}
  return[h,s*100,l*100];
}
const hueDist=(a,b)=>{const d=Math.abs(a-b)%360;return d>180?360-d:d;};
/* the colour variant closest to the AI palette (otherwise the text decides, as before) */
function pickVariant(list,key,f){
  if(!AI||!AI.palette||!AI.palette.length)return list[f.letterSum%list.length];
  const want=hexHsl(AI.palette[0]);let best=list[0],bd=1e9;
  for(const v of list){const c=v[key];const d=hueDist(c[0],want[0])+(c[1]<15?40:0)+Math.abs(c[2]-want[2])*.3;if(d<bd){bd=d;best=v;}}
  return best;
}


/* ================= choose the shape from the text ================= */
function chooseShape(text){
  const f=features(text),R=rng(hash(text+'|'+occ));
  const aiAccent=AI&&AI.palette&&AI.palette[0]?AI.palette[0]:null;
  if(occ==='xmas'){
    const pool=mood==='festive'?SNOW_COLORS.filter(x=>/gold/.test(x.name)):SNOW_COLORS.filter(x=>!/gold/.test(x.name));
    const t=SNOWS[Math.floor(f.h/7)%SNOWS.length],v=pool[f.letterSum%pool.length],c=snowCol(v);
    return{els:t.build(f,R,c),accent:aiAccent||hsl(c.line),label:t.name+' · '+v.name};}
  if(occ==='thanks'){const kind=HEART_KINDS[Math.floor(f.h/8)%HEART_KINDS.length],v=pickVariant(HEART_COLORS,'bloom',f),c=heartCol(v);
    return{els:buildHeartKind(kind,f,R,c),accent:aiAccent||hsl(c.bloom[2]>70?[c.bloom[0],c.bloom[1],55]:c.bloom),label:HEART_NAMES[kind]+' · '+v.name};}
  if(occ==='birthday'){const v=pickVariant(CAKE_COLORS,'body',f),c=cakeCol(v),cake=buildCake(f,R,c,text);
    return{els:cake.els,flames:cake.flames,accent:aiAccent||hsl([c.accent[0],c.accent[1],Math.min(55,c.accent[2])]),label:'Cake · '+v.name};}
  const t=FLOWERS[f.h%FLOWERS.length],v=pickVariant(t.variants,'petal',f),c=colors(v);
  const acc=c.petal[2]>80?c.inner:c.petal;
  return{els:t.build(f,R,c),accent:aiAccent||hsl(celestial?[acc[0],acc[1],Math.max(62,acc[2])]:[acc[0],acc[1],Math.min(55,acc[2])]),label:t.name+' · '+v.name};
}

/* ================= the melody: a real little tune, composed from the message =================
   8 bars in question–answer form (4 + 4), steady meter, hand-written two-bar phrases.
   Notes are scale steps (0 = do, 7 = do above, negative = below) with lengths in beats. */
const MAJ=[0,2,4,5,7,9,11];
const norm=w=>w.toLowerCase().replace(/[^a-z0-9']/g,'');
function isKeyword(w){return!!(AI&&AI.keywords&&AI.keywords.some(k=>String(k).split(/\s+/).map(norm).includes(norm(w))));}
const PHRASES={
  /* 4/4 — bars: I V | IV V | I V | IV·V I */
  common:{
    beats:4,
    open:[   // over I then V
      [[0,1],[2,1],[4,1],[7,1],[6,1.5],[4,.5],[1,2]],
      [[4,1.5],[2,.5],[0,1],[2,1],[1,1],[4,1],[6,1],[4,1]],
      [[2,.5],[3,.5],[4,1],[4,1],[4,1],[3,.5],[2,.5],[1,1],[1,2]],
      [[0,1],[4,1],[4,1],[5,.5],[4,.5],[3,1],[1,1],[-1,2]],
      [[2,1],[2,.5],[3,.5],[4,2],[1,1],[1,.5],[2,.5],[3,2]],
      [[4,1],[7,1],[6,.5],[5,.5],[4,1],[3,1],[1,1],[4,2]],
      [[0,1.5],[1,.5],[2,1.5],[0,.5],[-1,1],[1,1],[4,2]]],
    cont:[   // over IV then V, ends open (a question)
      [[5,1],[5,1],[3,1],[5,1],[4,1],[3,.5],[2,.5],[1,2]],
      [[3,1.5],[5,.5],[7,1],[5,1],[4,1],[6,1],[4,2]],
      [[5,.5],[4,.5],[3,1],[0,1],[3,1],[4,1],[6,1],[1,2]],
      [[7,1],[5,.5],[3,.5],[5,1],[3,1],[4,1],[1,1],[4,2]],
      [[3,1],[2,1],[3,1],[5,1],[4,2],[1,1],[6,1]]],
    close:[  // over IV·V then I, ends home (the answer)
      [[5,1],[3,1],[4,1],[1,1],[0,4]],
      [[3,.5],[5,.5],[7,1],[6,1],[4,1],[7,4]],
      [[5,1],[7,1],[6,.5],[4,.5],[1,1],[2,1],[1,1],[0,2]],
      [[2,.5],[3,.5],[5,1],[4,.5],[3,.5],[1,1],[0,4]],
      [[5,1.5],[5,.5],[4,1],[1,1],[2,1],[0,3]]],
    chords:['I','V','IV','V','I','V','IV|V','I']
  },
  /* 3/4 waltz, like a music box — bars: I V | IV V | I V | V I */
  waltz:{
    beats:3,
    open:[
      [[0,1],[2,1],[4,1],[4,2],[1,1]],
      [[4,2],[2,1],[1,2],[-1,1]],
      [[2,1],[4,1],[7,1],[6,2],[4,1]],
      [[0,2],[4,1],[6,1.5],[4,.5],[1,1]],
      [[4,1],[5,1],[4,1],[1,2],[-1,1]],
      [[7,2],[4,1],[6,1],[8,1],[4,1]]],
    cont:[
      [[5,2],[3,1],[4,2],[1,1]],
      [[3,1],[5,1],[7,1],[6,2],[4,1]],
      [[5,1],[3,1],[0,1],[1,2],[4,1]],
      [[7,1.5],[5,.5],[3,1],[4,3]],
      [[3,2],[5,1],[4,1],[3,1],[1,1]]],
    close:[
      [[4,1],[6,1],[8,1],[7,3]],
      [[1,2],[-1,1],[0,3]],
      [[4,2],[1,1],[2,1],[0,2]],
      [[6,1.5],[5,.5],[4,1],[7,3]],
      [[8,1],[6,1],[4,1],[7,3]]],
    chords:['I','V','IV','V','I','V','V','I']
  }
};
/* chords as semitones above (or below) the key note: root, third, fifth */
const CHORD3={I:[0,4,7],IV:[-7,-3,0],V:[-5,-1,2]};
const V3={
  warm:   {meter:'waltz', bpm:100,legato:1.0, swing:0,  keys:[60,62,65,67]},
  playful:{meter:'common',bpm:138,legato:.62, swing:.34,keys:[62,64,65,67]},
  festive:{meter:'common',bpm:118,legato:.9,  swing:0,  keys:[60,62,63,65]}};

/* the tune begins with their name and ends with yours:
   Each letter of a name becomes a note (a, h, o, v → do; b, i, p, w → re; …), like Bach spelling
   B-A-C-H in notes. The rhythm stays from a hand-written phrase, and notes on strong beats are
   moved to the nearest chord tone, so the name always sounds like part of a song. */
const CHORD_DEG={I:[0,2,4],IV:[3,5,0],V:[4,6,1]};
const TITLES=/^(mr|mrs|ms|miss|dr|mx|sir|madam)$/i;
function nameLetters(s){
  return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').split(/\s+/).filter(w=>!TITLES.test(w.replace(/\./g,'')))
    .join('').toLowerCase().replace(/[^a-z]/g,'').split('');
}
function partsOf(text){
  const lines=text.trim().split('\n').map(l=>l.trim());
  const to=((lines[0]||'').match(/^dear\s+(.+?),?$/i)||[])[1]||'';
  const last=lines[lines.length-1]||'';
  const from=last.length&&last.length<=30&&!/[,.!?]$/.test(last)?last:'';
  return{to,from};
}
const mod7=x=>((x%7)+7)%7;
/* letter → scale step; the common letters are spread over all seven notes */
const LETTER={a:0,b:1,c:2,d:3,e:2,f:3,g:4,h:5,i:4,j:6,k:1,l:2,m:5,n:1,o:5,p:3,q:6,r:3,s:6,t:4,u:1,v:4,w:5,x:6,y:6,z:0};
function nearestOf(d,degs,maxStep=3){
  for(let k=0;k<=maxStep;k++)for(const s of[d-k,d+k])if(degs.includes(mod7(s)))return s;
  return d;
}
/* put name letters on a phrase template */
function nameOnPhrase(tpl,letters,chords,B,role){
  if(!letters.length)return tpl.map(n=>n.slice());
  const out=[];let pos=0,prev=tpl[0][0];
  const lastIdx=tpl.length-1;
  tpl.forEach(([s0,d],i)=>{
    const bar=Math.floor(pos/B),chord=chords[Math.min(bar,chords.length-1)];
    const parts=chord.split('|'),ch=parts[Math.min(parts.length-1,Math.floor((pos%B)/(B/parts.length)))];
    let s=s0;
    const useName=role==='open'?i<letters.length:(i<lastIdx&&i>=Math.max(0,lastIdx-letters.length));
    if(useName){
      const L=role==='open'?letters[i]:letters[i-(lastIdx-Math.min(letters.length,lastIdx))];
      const base=LETTER[L]??0;
      const cands=[base-7,base,base+7].filter(x=>x>=-3&&x<=8);
      s=cands.reduce((a,b)=>Math.abs(b-prev)<Math.abs(a-prev)?b:a,cands[0]);
      const strong=(pos%(B===3?3:2))===0||d>=2;
      if(strong||Math.abs(s-prev)>2)s=nearestOf(s,CHORD_DEG[ch]);
      if(i>=2&&s===out[i-1][0]&&s===out[i-2][0])s=nearestOf(s+(i%2?1:-1),CHORD_DEG[ch].concat(strong?[]:[mod7(s+1),mod7(s-1)]),2); // no three same notes in a row
    }
    if(role==='close'&&i===lastIdx)s=Math.abs(prev-7)<Math.abs(prev)?7:0;           // always end at home
    if(role==='open'&&i===lastIdx)s=nearestOf(s,CHORD_DEG[ch]);
    out.push([s,d]);prev=s;pos+=d;
  });
  return out;
}
function compose(text){
  const M=V3[mood],L=PHRASES[M.meter],B=L.beats;
  const energy=AI&&AI.energy?Math.max(1,Math.min(5,AI.energy)):3;
  const beat=60/(M.bpm*(1+(energy-3)*.06));
  const{to,from}=partsOf(text);
  const toL=nameLetters(to),fromL=nameLetters(from);
  const body=text.split('\n').slice(1,-1).join(' ');
  const h=hash(text),hb=hash(body);
  const root=M.keys[hash(to.toLowerCase()||text)%M.keys.length];
  const base=root<63?root+12:root;
  let low=base-24;if(low<45)low+=12;
  const mel=s=>base+MAJ[((s%7)+7)%7]+12*Math.floor(s/7);
  // the opening whose rhythm fits the name best (number of notes ≈ number of letters)
  const fit=L.open.map((p,i)=>({p,i,score:Math.abs(p.length-Math.max(3,toL.length))*10+((i+h)%L.open.length)}));
  fit.sort((a,b)=>a.score-b.score);
  const openChords=M.meter==='waltz'?['I','V']:['I','V'],contChords=['IV','V'],closeChords=M.meter==='waltz'?['V','I']:['IV|V','I'];
  const A=nameOnPhrase(fit[0].p,toL,openChords,B,'open');
  const A2=nameOnPhrase(fit[0].p.map(([s,d])=>[s+2,d]),toL.map(c=>Object.keys(LETTER).find(k=>LETTER[k]===mod7((LETTER[c]??0)+2))),openChords,B,'open'); // the name a third higher
  const cont1=L.cont[hb%L.cont.length],cont2=L.cont[(hb>>>5)%L.cont.length===hb%L.cont.length?(hb+1)%L.cont.length:(hb>>>5)%L.cont.length];
  const closeTpl=L.close.slice().sort((a,b)=>Math.abs(a.length-1-Math.max(2,fromL.length))-Math.abs(b.length-1-Math.max(2,fromL.length)))[0];
  const C=nameOnPhrase(closeTpl,fromL,closeChords,B,'close');
  const long=(body.match(/\S+/g)||[]).length>34;
  const form=long?[[A,'open'],[cont1,'cont'],[A2,'open'],[cont2,'cont'],[A,'open'],[C,'close']]
                 :[[A,'open'],[cont1,'cont'],[A,'open'],[C,'close']];
  const warp=x=>{if(!M.swing)return x;const b=Math.floor(x),f=x-b,s0=.5+M.swing*.5;return b+(f<.5?f/.5*s0:s0+(f-.5)/.5*(1-s0));};
  const notes=[],bass=[],fin=[],words=[],phraseStart=[];
  let pos=B;                                             // one bar of accompaniment first
  form.forEach(([ph])=>{phraseStart.push(notes.length);
    for(const[s,d]of ph){const t0=warp(pos),t1=warp(pos+d);
      notes.push({t:t0*beat,dur:Math.max(.12,(t1-t0)*beat*M.legato),midi:mel(s),vol:(pos%B===0)?.27:.22,beats:d});pos+=d;}});
  const melodyEnd=pos;
  const plan=['I'];form.forEach(([,role])=>plan.push(...(role==='open'?openChords:role==='cont'?contChords:closeChords)));
  plan.forEach((c,bar)=>{
    const parts=c.split('|'),len=B/parts.length;
    parts.forEach((name,pi)=>{
      let[r,t,f]=CHORD3[name];const start=bar*B+pi*len;
      if(low+r<43){r+=12;t+=12;f+=12;}
      if(M.meter==='waltz'){
        bass.push({t:start*beat,dur:beat*.95,midi:low+r,vol:.14});
        for(let k=1;k<len;k++)for(const x of[t,f])bass.push({t:(start+k)*beat,dur:beat*.7,midi:low+12+x,vol:.065});
      }else for(let k=0;k<len*2;k++){const x=warp(start+k*.5);
        bass.push({t:x*beat,dur:beat*(mood==='playful'?.4:.85),midi:low+[r,f,t+12,f][k%4],vol:k===0?.13:.08});}
    });
  });
  const endT=melodyEnd*beat;
  if(mood==='festive')[0,2,4,7].forEach((s,k)=>fin.push({t:endT+k*beat*.25,dur:beat*.5,midi:mel(s)+12,vol:.12}));
  [low,low+12,low+16,low+19].forEach(m=>fin.push({t:(melodyEnd-B)*beat,dur:B*beat*1.6,midi:m,vol:.08}));
  // words: the greeting sings on the name notes, the signature on the closing notes, the rest in between
  const tokens=text.match(/\S+/g)||[];
  const firstLineWords=(text.trim().split('\n')[0].match(/\S+/g)||[]).length;
  const lastLineWords=from?(from.match(/\S+/g)||[]).length:0;
  const closeStart=phraseStart[phraseStart.length-1],closeN=notes.length-closeStart;
  const bodyFirst=Math.min(notes.length-1,firstLineWords),bodyLast=Math.max(bodyFirst,closeStart-1);
  const starts=notes.map(n=>n.t);
  tokens.forEach((tok,i)=>{
    let j;
    if(i<firstLineWords)j=Math.min(i,notes.length-1);
    else if(lastLineWords&&i>=tokens.length-lastLineWords)j=closeStart+Math.min(closeN-1,Math.max(0,closeN-1-lastLineWords)+(i-(tokens.length-lastLineWords)));
    else{const k=i-firstLineWords,n=tokens.length-firstLineWords-lastLineWords;j=Math.round(bodyFirst+(n>1?k/(n-1):0)*(bodyLast-bodyFirst));}
    const key=isKeyword(tok.replace(/[^A-Za-z0-9']/g,''));
    if(key){for(let k=Math.max(bodyFirst,j-2);k<=Math.min(bodyLast,j+2);k++)if(notes[k].beats>=1){j=k;break;}
      notes[j].vol=.32;notes.push({t:notes[j].t,dur:notes[j].dur,midi:notes[j].midi-12,vol:.12});}
    words.push({t:starts[j],word:i,key});
  });
  return{notes,bass,fin,words,total:endT+B*beat*.9,info:{to,from,toNotes:A.slice(0,toL.length).map(n=>n[0]),fromNotes:C.map(n=>n[0]),long}};
}

/* ================= piano (Salamander Grand Piano, CC BY 3.0) ================= */
const PIANO_SAMPLES={48:'C3',51:'Ds3',54:'Fs3',57:'A3',60:'C4',63:'Ds4',66:'Fs4',69:'A4',72:'C5',75:'Ds5',78:'Fs5',81:'A5'};
let actx=null,buffers=null,master=null;
function b64(s){const bin=atob(s),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u.buffer;}
function decode(buf){return new Promise((res,rej)=>{const p=actx.decodeAudioData(buf,res,rej);if(p&&p.then)p.then(res,rej);});}
async function loadPiano(){
  if(!actx){actx=new(window.AudioContext||window.webkitAudioContext)();master=actx.createGain();master.gain.value=.9;master.connect(actx.destination);}
  if(actx.state==='suspended')await actx.resume();
  if(buffers)return;
  const list=await Promise.all(Object.entries(PIANO_SAMPLES).map(async([m,n])=>{
    let buf;
    if(window.PIANO_EMBED)buf=b64(window.PIANO_EMBED[n]);
    else{const r=await fetch('/piano/'+n+'.mp3');if(!r.ok)throw new Error(n);buf=await r.arrayBuffer();}
    return[Number(m),await decode(buf)];}));
  buffers=new Map(list);
}
function key(midi,t,dur,vol){
  let best=null;for(const m of buffers.keys())if(best===null||Math.abs(m-midi)<Math.abs(best-midi))best=m;
  const src=actx.createBufferSource();src.buffer=buffers.get(best);src.playbackRate.value=Math.pow(2,(midi-best)/12);
  const g=actx.createGain();g.gain.setValueAtTime(vol*2.6,t);g.gain.setTargetAtTime(0,t+dur,.08);
  src.connect(g);g.connect(master);src.start(t);src.stop(t+dur+.7);
  return src;
}


/* ================= drawing a card shape ================= */
const clamp=v=>v<0?0:v>1?1:v;
function normT(els){const m=Math.max(...els.map(e=>e.t1));if(m>1)for(const e of els){e.t0/=m;e.t1/=m;}return els;}
function sizeCanvas(c,css){const dpr=Math.min(2,window.devicePixelRatio||1);c.width=c.height=Math.round(css*dpr);}
function tracePath(ctx,pts,X,Y){ctx.beginPath();pts.forEach((pt,i)=>i?ctx.lineTo(X(pt),Y(pt)):ctx.moveTo(X(pt),Y(pt)));}
/* p = how much is drawn (0..1); mono = draw everything in one colour (wax seal) */
function paint(ctx,els,p,mono){
  const S=ctx.canvas.width,c=S/2,u=S*.47,px=S/360*(mono?2.2:1);
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,S,S);
  const X=pt=>c+pt.x*u,Y=pt=>c+pt.y*u;
  for(const e of els){
    if(p<=e.t0)continue;
    const q=clamp((p-e.t0)/Math.max(.001,e.t1-e.t0));
    if(e.k==='fill'){
      if(mono){ctx.globalAlpha=.18*q;ctx.fillStyle=mono;}
      else{ctx.globalAlpha=q*(celestial?.62:.95);
        if(e.lin){const g=ctx.createLinearGradient(0,Y(P(0,e.lin[0])),0,Y(P(0,e.lin[1])));for(const[o,col]of e.stops)g.addColorStop(o,col);ctx.fillStyle=g;}
        else if(e.stops){const g=ctx.createRadialGradient(c,c,e.r0*u,c,c,Math.max(e.r0+.01,e.r1)*u);for(const[o,col]of e.stops)g.addColorStop(o,col);ctx.fillStyle=g;}else ctx.fillStyle=e.col;}
      tracePath(ctx,e.pts,X,Y);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
    }else if(e.k==='line'){
      const n=e.pts.length-1,upto=q*n,full=Math.floor(upto);
      ctx.beginPath();ctx.moveTo(X(e.pts[0]),Y(e.pts[0]));
      for(let i=1;i<=full;i++)ctx.lineTo(X(e.pts[i]),Y(e.pts[i]));
      if(full<n){const a=e.pts[full],b=e.pts[full+1],t=upto-full,m=P(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);ctx.lineTo(X(m),Y(m));}
      ctx.lineCap='round';ctx.lineJoin='round';
      if(e.dash)ctx.setLineDash([2*px,6*px]);
      const col=mono||(typeof e.col==='string'?e.col:hsl(e.col));
      if(celestial&&!mono){ctx.globalAlpha=.22;ctx.strokeStyle=col;ctx.lineWidth=e.w*px*3.2;ctx.stroke();ctx.globalAlpha=1;}
      ctx.globalAlpha=mono?.85:1;ctx.strokeStyle=col;ctx.lineWidth=e.w*px*(mono?.7:1);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
    }else if(e.k==='text'){
      /* a number candle: a big numeral, filled and outlined */
      ctx.save();ctx.globalAlpha=q;ctx.translate(X(e),Y(e));const sc=.7+.3*q;ctx.scale(sc,sc);
      ctx.font=`700 ${e.size*u}px 'DM Sans',Arial,sans-serif`;ctx.textAlign='center';ctx.textBaseline='alphabetic';   // lining figures, so every digit has the same height
      if(mono){ctx.fillStyle=mono;ctx.globalAlpha=.85*q;ctx.fillText(e.txt,0,0);}
      else{ctx.fillStyle=e.col;ctx.fillText(e.txt,0,0);ctx.lineWidth=1.4*px;ctx.strokeStyle=e.stroke;ctx.strokeText(e.txt,0,0);}
      ctx.restore();
    }else{
      const k=q<1?1+.35*Math.sin(q*Math.PI):1;
      if(celestial&&!mono){ctx.globalAlpha=.25;ctx.fillStyle=e.col;ctx.beginPath();ctx.arc(X(e),Y(e),e.r*u*k*q*2,0,TAU);ctx.fill();ctx.globalAlpha=1;}
      ctx.fillStyle=mono||e.col;ctx.beginPath();ctx.arc(X(e),Y(e),e.r*u*k*q,0,TAU);ctx.fill();
    }
  }
}
/* splits the message into word spans (each word lights up with its note) */
function fillMessage(el,text,waiting){
  el.innerHTML='';const spans=[];
  for(const part of text.split(/(\s+)/)){
    if(part===''||/^\s+$/.test(part)){el.appendChild(document.createTextNode(part));continue;}
    const s=document.createElement('span');s.textContent=part;if(waiting)s.className='wait';el.appendChild(s);spans.push(s);}
  return spans;
}

/* keeps the word that is playing in view: the page glides down by itself */
function followWord(span){
  const r=span.getBoundingClientRect(),h=window.innerHeight;
  if(r.bottom>h*.82)window.scrollBy({top:r.top-h*.55,behavior:'smooth'});
}
/* brings the top of the card to the top of the screen */
function cardToTop(el){const y=el.getBoundingClientRect().top+window.scrollY-12;window.scrollTo({top:Math.max(0,y),behavior:'smooth'});}

/* ================= sparkles along the edges ================= */
const GOLD=['#d4a94e','#e9c46a','#f0d99b'];
function makeFx(canvas){return{cv:canvas,parts:[],on:false,w:0,h:0,dpr:1};}
function fxKinds(){return{birthday:['star','flower','dot'],celebration:['petal','star','dot'],xmas:['twinkle','flake','twinkle'],thanks:['heart','flower','heart']}[occ];}
function fxColors(){
  const a=scene?scene.accent:'#d97861';
  let c={birthday:[a,'#f1b86b','#e88b70'],celebration:[a,'#e9b2a1','#d7a3c7'],
    xmas:celestial?['#cfe6ff','#b9dcbf','#f0d99b']:['#6f9ec9','#8fb9d8','#c9a64e'],
    thanks:[a,'#e8a05d','#d9776f']}[occ];
  if(mood==='festive')c=[...GOLD,...GOLD,c[0]];
  return AI&&AI.palette?[...c,...AI.palette]:c;
}
function sizeFx(o){const w=o.cv.offsetWidth,h=o.cv.offsetHeight,dpr=Math.min(2,window.devicePixelRatio||1);o.cv.width=Math.max(1,w*dpr);o.cv.height=Math.max(1,h*dpr);o.dpr=dpr;o.w=w;o.h=h;}
function spawn(o,kind,x,y){
  const R=Math.random,cols=fxColors();
  const p={kind,x,y,r:3+R()*4,rot:R()*6.28,vr:(R()-.5)*2,vx:0,vy:0,age:0,life:1+R()*1.2,col:cols[Math.floor(R()*cols.length)],sw:R()*6.28};
  if(kind==='flake'){p.vy=14+R()*14;p.life=3+R()*2;p.r=4+R()*3;}
  if(kind==='heart'||kind==='flower'){p.vy=-(10+R()*14);p.life=2.4+R()*1.6;p.vr=(R()-.5)*1.6;p.r=4+R()*3;}
  if(kind==='petal'){p.vx=(R()-.5)*16;p.vy=8+R()*10;p.life=2.5+R()*1.5;}
  if(kind==='confetti'){p.vx=(R()-.5)*12;p.vy=18+R()*16;p.life=2.4+R()*1.4;p.r=3+R()*2.5;p.vr=(R()-.5)*6;}
  if(kind==='dot'){p.r=1.4+R()*1.6;p.life=.8+R()*.8;}
  if(kind==='twinkle'||kind==='star'){p.r=4+R()*5;p.life=.8+R()*.9;p.vr=(R()-.5)*.6;}
  if(mood==='playful'){p.vr*=1.6;p.vy*=1.25;}
  if(mood==='warm'){p.vy*=.75;p.life*=1.2;}
  o.parts.push(p);if(o.parts.length>46)o.parts.shift();
}
function edgePoint(o,kind){
  const R=Math.random,band=8+R()*18,W=o.w,H=o.h;
  if(kind==='flake'||kind==='petal'||kind==='confetti'){const side=R();
    if(side<.4)return[R()*W,band];return[side<.7?band:W-band,R()*H*.6];}
  if(kind==='heart'||kind==='flower'){const side=R()<.5;return[side?band:W-band,H*.35+R()*H*.6];}
  const t=R()*(2*W+2*H);
  if(t<W)return[t,band];if(t<W+H)return[W-band,t-W];if(t<2*W+H)return[t-W-H,H-band];return[band,t-2*W-H];
}
function emitEdge(o,n=1){
  if(!o.on)return;
  const kinds=fxKinds();
  for(let i=0;i<n;i++){const k=mood==='playful'&&Math.random()<.35?'confetti':kinds[Math.floor(Math.random()*kinds.length)];
    const[x,y]=edgePoint(o,k);spawn(o,k,x,y);}
}
function drawPart(ctx,p){
  const life=p.age/p.life,fade=life<.2?life/.2:life>.7?(1-life)/.3:1;
  let sc=1;if(p.kind==='twinkle'||p.kind==='star'||p.kind==='dot')sc=Math.sin(Math.min(1,life)*Math.PI);
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=Math.max(0,fade)*(p.kind==='dot'?.9:.95);
  ctx.fillStyle=p.col;ctx.strokeStyle=p.col;
  if(celestial){ctx.shadowBlur=8;ctx.shadowColor=p.col;}
  const r=p.r*sc;
  if(p.kind==='twinkle'||p.kind==='star'){
    ctx.beginPath();const k=r*.18;
    ctx.moveTo(0,-r);ctx.quadraticCurveTo(k,-k,r,0);ctx.quadraticCurveTo(k,k,0,r);ctx.quadraticCurveTo(-k,k,-r,0);ctx.quadraticCurveTo(-k,-k,0,-r);ctx.fill();
    if(p.kind==='twinkle'){ctx.globalAlpha*=.6;ctx.beginPath();ctx.arc(0,0,r*.28,0,6.28);ctx.fillStyle='#fff8e0';ctx.fill();}
  }else if(p.kind==='dot'){ctx.beginPath();ctx.arc(0,0,Math.max(.4,r),0,6.28);ctx.fill();}
  else if(p.kind==='flower'){for(let i=0;i<5;i++){const a=i*1.2566;ctx.beginPath();ctx.ellipse(Math.cos(a)*r*.55,Math.sin(a)*r*.55,r*.48,r*.34,a,0,6.28);ctx.fill();}
    ctx.beginPath();ctx.arc(0,0,r*.3,0,6.28);ctx.fillStyle='#f4d27a';ctx.fill();}
  else if(p.kind==='heart'){const h=r*1.1;ctx.beginPath();ctx.moveTo(0,h*.35);ctx.bezierCurveTo(-h*1.1,-h*.3,-h*.45,-h*1.05,0,-h*.45);ctx.bezierCurveTo(h*.45,-h*1.05,h*1.1,-h*.3,0,h*.35);ctx.fill();}
  else if(p.kind==='petal'){ctx.beginPath();ctx.ellipse(0,0,r*1.1,r*.5,0,0,6.28);ctx.fill();}
  else if(p.kind==='flake'){ctx.lineWidth=1.1;ctx.lineCap='round';for(let i=0;i<3;i++){ctx.rotate(1.0472);ctx.beginPath();ctx.moveTo(-r,0);ctx.lineTo(r,0);
    ctx.moveTo(r*.55,0);ctx.lineTo(r*.8,-r*.25);ctx.moveTo(r*.55,0);ctx.lineTo(r*.8,r*.25);ctx.moveTo(-r*.55,0);ctx.lineTo(-r*.8,-r*.25);ctx.moveTo(-r*.55,0);ctx.lineTo(-r*.8,r*.25);ctx.stroke();}}
  else if(p.kind==='confetti'){ctx.scale(1,Math.cos(p.sw));ctx.fillRect(-r,-r*.45,r*2,r*.9);}
  ctx.restore();
}
/* move and draw every sparkle of one layer */
function fxStep(o,dt){
  const ctx=o.cv.getContext('2d');ctx.setTransform(o.dpr,0,0,o.dpr,0,0);ctx.clearRect(0,0,o.w,o.h);
  for(const p of o.parts){p.age+=dt;p.x+=p.vx*dt+Math.sin(p.age*2+p.sw)*(p.kind==='flake'||p.kind==='petal'?.35:0);p.y+=p.vy*dt;p.rot+=p.vr*dt;p.sw+=dt*5;}
  o.parts=o.parts.filter(p=>p.age<p.life);
  for(const p of o.parts)drawPart(ctx,p);
}
const IDLE_RATE={warm:1.2,playful:3,festive:2.4};

/* ================= candles: make a wish ================= */
function makeWish(){return{lit:0,blown:0,blownAt:-1};}
/* draws the card and, for a cake, its flames and smoke; t = seconds (for the flicker) */
function paintCard(sc,p,wish,t){
  paint(sc.ctx,sc.els,p,null);
  if(!sc.flames)return;
  if(wish.lit>0)drawFlames(sc.ctx,sc.flames,t,wish.lit,wish.blown);
  if(wish.blownAt>=0)drawSmoke(sc.ctx,sc.flames,t-wish.blownAt);
}
function blowCandles(wish,t,done){
  if(!wish.lit||wish.blownAt>=0)return false;
  wish.blownAt=t;const t0=performance.now();
  const step=()=>{wish.blown=Math.min(1,(performance.now()-t0)/450);if(wish.blown<1)requestAnimationFrame(step);else{wish.lit=0;if(done)done();}};
  requestAnimationFrame(step);return true;
}
