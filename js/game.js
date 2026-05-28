const cv=document.getElementById('c'),cx=cv.getContext('2d');
cv.width=CONFIG.WIDTH;cv.height=CONFIG.HEIGHT;
const W=CONFIG.WIDTH,H=CONFIG.HEIGHT;
const{HORIZON_Y:HY,FOCAL,TRACK_COLS:COLS,TRACK_HW:THW,VIEW_DIST:VIEW,PLAYER_Z:PZ,BALL_RADIUS:BR,TILE_COLORS:EC}=CONFIG;
function pr(d){d=Math.max(d,0.05);const s=FOCAL/d;return{y:HY+(H-HY)*s,hw:W*0.46*s,s};}

// Levels er definert i levels.js
function currentLevelData(){if(gameMode==='test'&&typeof TEST_LEVEL!=='undefined')return TEST_LEVEL;return LEVELS[currentLevel%LEVELS.length];}

let track=[],tBase=0;
function mkRow(z){
  const i=Math.floor(z);
  if(i>=currentLevelData().length){const lvl=currentLevelData();return{c:lvl[i%lvl.length].slice(),e:'n'};}
  const lvl=currentLevelData();return{c:lvl[Math.min(i,lvl.length-1)].slice(),e:'n'};
}
function getRow(wz){const i=Math.floor(wz)-tBase;return(i>=0&&i<track.length)?track[i]:null;}
function growTrack(cZ){const need=Math.floor(cZ)+VIEW+6;while(tBase+track.length<=need)track.push(mkRow(tBase+track.length));while(tBase<Math.floor(cZ)-4&&track.length>0){track.shift();tBase++;}}

function loadProgress(){try{return JSON.parse(localStorage.getItem('sr_progress'))||{unlocked:1,completed:[]};}catch(e){return{unlocked:1,completed:[]};}}
function saveProgress(p){try{localStorage.setItem('sr_progress',JSON.stringify(p));}catch(e){}}
function completeLevel(n){const p=loadProgress();if(!p.completed.includes(n))p.completed.push(n);p.unlocked=Math.max(p.unlocked,n+1);saveProgress(p);}
function loadHS(){try{return JSON.parse(localStorage.getItem('ballzy_hs'))||[];}catch(e){return[];}}
function saveHS(hs){try{localStorage.setItem('ballzy_hs',JSON.stringify(hs));}catch(e){}}
function isHighscore(s){const hs=loadHS();return hs.length<5||s>hs[hs.length-1].score;}
function addHS(name,s){const hs=loadHS();hs.push({name:name.slice(0,12),score:s});hs.sort((a,b)=>b.score-a.score);hs.splice(10);saveHS(hs);}

let camZ,px,pvx,jy,jvy,spd,score,state,hi=0,pts=[],rot=0,currentLevel=0,gameMode='main',menuState='main',scoreOffset=0;
let nameInput='',enteringName=false,gpLetterIdx=0,gpLastPress=0,gpLastDir=0;
let namePickerIdx=0,typingCustomName=false;
let skinMenuIdx=0,mainMenuIdx=0;

const OFFICE_NAMES=['Vegar','Lars','Kristian E','Kristian B','Simeon','Ida','Felix','Daniel','Eyerusalem','Tora','Ragnar K','Einar','Kjetil','Annet'];

const SKINS=[
  {name:'Standard', type:'radial', c1:'#aaf5f0',c2:'#00c8c0',c3:'#006f6a'},
  {name:'Rød',      type:'radial', c1:'#ffaaaa',c2:'#ff2020',c3:'#8b0000'},
  {name:'Gull',     type:'radial', c1:'#fff3aa',c2:'#ffd700',c3:'#b8860b'},
  {name:'Grønn',    type:'radial', c1:'#aaffdd',c2:'#00dd44',c3:'#006622'},
  {name:'Lilla',    type:'radial', c1:'#ddaaff',c2:'#aa00ff',c3:'#550088'},
  {name:'Oransje',  type:'radial', c1:'#ffddaa',c2:'#ff8800',c3:'#884400'},
  {name:'Rosa',     type:'radial', c1:'#ffaadd',c2:'#ff00aa',c3:'#880055'},
  {name:'Is',       type:'radial', c1:'#ffffff', c2:'#aaddff',c3:'#4488cc'},
  {name:'Fotball',  type:'football'},
  {name:'Stripete', type:'stripes',c1:'#ff00ff',c2:'#00ffff'},
  {name:'Prikker',  type:'dots',   c1:'#ff6600',c2:'#ffff00'},
  {name:'Galakse',  type:'galaxy'},
];
function loadSkin(){return parseInt(localStorage.getItem('sr_skin')||'0');}
function saveSkin(i){localStorage.setItem('sr_skin',i);}
let selectedSkin=loadSkin();

const SKIN_SIZE=64;
function buildSkinCanvas(skin){
  const sc=document.createElement('canvas');sc.width=SKIN_SIZE;sc.height=SKIN_SIZE;
  const sx=sc.getContext('2d');
  const cx0=SKIN_SIZE/2,cy0=SKIN_SIZE/2,r=SKIN_SIZE/2-2;
  if(skin.type==='radial'){
    const g=sx.createRadialGradient(cx0-r*.3,cy0-r*.35,r*.05,cx0,cy0,r);
    g.addColorStop(0,skin.c1);g.addColorStop(.4,skin.c2);g.addColorStop(1,skin.c3);
    sx.beginPath();sx.arc(cx0,cy0,r,0,Math.PI*2);sx.fillStyle=g;sx.fill();
    sx.beginPath();sx.arc(cx0-r*.28,cy0-r*.32,r*.2,0,Math.PI*2);sx.fillStyle='rgba(255,255,255,.45)';sx.fill();
  } else if(skin.type==='football'){
    sx.beginPath();sx.arc(cx0,cy0,r,0,Math.PI*2);sx.fillStyle='#f0f0f0';sx.fill();
    sx.strokeStyle='#111';sx.lineWidth=2;
    const pts=[[0,-1],[0.95,-0.31],[0.59,0.81],[-0.59,0.81],[-0.95,-0.31]];
    for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];sx.beginPath();sx.moveTo(cx0+a[0]*r*.6,cy0+a[1]*r*.6);sx.lineTo(cx0,cy0);sx.stroke();}
    sx.beginPath();const sp=pts.map(p=>[cx0+p[0]*r*.6,cy0+p[1]*r*.6]);sx.moveTo(sp[0][0],sp[0][1]);for(const p of sp)sx.lineTo(p[0],p[1]);sx.closePath();sx.stroke();
    sx.beginPath();sx.arc(cx0,cy0,r,0,Math.PI*2);sx.strokeStyle='#333';sx.lineWidth=1.5;sx.stroke();
  } else if(skin.type==='stripes'){
    sx.beginPath();sx.arc(cx0,cy0,r,0,Math.PI*2);sx.clip();
    for(let i=0;i<SKIN_SIZE;i+=8){sx.fillStyle=(Math.floor(i/8)%2===0)?skin.c1:skin.c2;sx.fillRect(i,0,8,SKIN_SIZE);}
    sx.beginPath();sx.arc(cx0,cy0,r*.2,0,Math.PI*2);sx.fillStyle='rgba(255,255,255,.3)';sx.fill();
  } else if(skin.type==='dots'){
    sx.beginPath();sx.arc(cx0,cy0,r,0,Math.PI*2);sx.fillStyle=skin.c1;sx.fill();sx.clip();
    for(let dx=-r;dx<r;dx+=14){for(let dy=-r;dy<r;dy+=14){
      sx.beginPath();sx.arc(cx0+dx+7,cy0+dy+7,4,0,Math.PI*2);sx.fillStyle=skin.c2;sx.fill();
    }}
  } else if(skin.type==='galaxy'){
    const g=sx.createRadialGradient(cx0,cy0,2,cx0,cy0,r);
    g.addColorStop(0,'#8800ff');g.addColorStop(.5,'#000033');g.addColorStop(1,'#000010');
    sx.beginPath();sx.arc(cx0,cy0,r,0,Math.PI*2);sx.fillStyle=g;sx.fill();sx.clip();
    for(let i=0;i<30;i++){const a=Math.random()*Math.PI*2,d=Math.random()*r;sx.beginPath();sx.arc(cx0+Math.cos(a)*d,cy0+Math.sin(a)*d,Math.random()*2+.5,0,Math.PI*2);sx.fillStyle='rgba(255,255,255,'+(.4+Math.random()*.6)+')';sx.fill();}
  }
  return sc;
}
const SKIN_CANVASES=SKINS.map(buildSkinCanvas);

function reset(){camZ=0;px=0;pvx=0;jy=0;jvy=0;spd=CONFIG.BASE_SPEED;score=0;pts=[];rot=0;track=[];tBase=0;growTrack(0);state='play';}
function die(){
  stopMusic();playDie();
  if(gameMode==='select'){state='dead';return;}
  if(score>hi)hi=score;
  if(isHighscore(score)){state='enter_name';nameInput='';enteringName=true;}
  else{state='dead';}
  fetchGlobalScores();
}
function go(){if(gameMode==='select'){scoreOffset=999;playMusic();reset();}else{currentLevel=0;scoreOffset=0;levelDisplay=1;playMusic();reset();}}
function startTestMode(){AC.resume();playMusic();gameMode='test';currentLevel=0;scoreOffset=0;levelDisplay=1;loopCount=0;speedNotif=0;lastSpeedLevel=0;menuState='play';reset();}
function startMainMode(){AC.resume();playMusic();gameMode='main';currentLevel=0;scoreOffset=0;levelDisplay=1;loopCount=0;speedNotif=0;lastSpeedLevel=0;menuState='play';reset();}
function startLevel(n){AC.resume();playMusic(n);gameMode='select';currentLevel=n;scoreOffset=999;menuState='play';reset();}
function nextLevel(){
  completeLevel(currentLevel);
  if(gameMode==='main'){
    scoreOffset+=camZ;levelDisplay++;
    currentLevel=(currentLevel+1)%LEVELS.length;
    camZ=0;px=0;pvx=0;jy=0;jvy=0;pts=[];rot=0;track=[];tBase=0;state='play';playMusic();growTrack(0);
  } else {
    completeLevel(currentLevel);
    if(score>hi)hi=score;
    if(isHighscore(score)){state='enter_name';nameInput='';enteringName=true;}
    else{state='levelcomplete';}
  }
}

const K={};
let tL=0,tR=0,tJ=0;

cv.addEventListener('touchstart',e=>{
  e.preventDefault();
  if(state!=='play'){
    if(state==='dead'||state==='levelcomplete'){state='start';menuState='main';return;}
    if(state==='start'){handleClick(e.changedTouches[0]);return;}
    return;
  }
  const r=cv.getBoundingClientRect();
  for(const t of e.changedTouches){
    const tx=(t.clientX-r.left)*(W/r.width);
    const ty=(t.clientY-r.top)*(H/r.height);
    if(ty>H*0.72){
      if(tx<W/3)tL=1;
      else if(tx<W*2/3)tJ=1;
      else tR=1;
    }
  }
},{passive:false});

cv.addEventListener('touchend',e=>{
  const r=cv.getBoundingClientRect();
  for(const t of e.changedTouches){
    const tx=(t.clientX-r.left)*(W/r.width);
    const ty=(t.clientY-r.top)*(H/r.height);
    if(ty>H*0.72){
      if(tx<W/3)tL=0;
      else if(tx<W*2/3)tJ=0;
      else tR=0;
    }
  }
});
document.addEventListener('keydown',e=>{
  if(enteringName){
    e.preventDefault();
    if(typingCustomName){
      if(e.key==='Enter'&&nameInput.length>0){addHS(nameInput,score);enteringName=false;typingCustomName=false;stopMusic();state='start';menuState='main';}
      else if(e.key==='Backspace'){nameInput=nameInput.slice(0,-1);}
      else if(e.key==='Escape'){typingCustomName=false;nameInput='';}
      else if(e.key.length===1&&nameInput.length<12){nameInput+=e.key.toUpperCase();}
    } else {
      if(e.key==='ArrowUp'||e.key==='ArrowLeft'){namePickerIdx=(namePickerIdx-1+OFFICE_NAMES.length)%OFFICE_NAMES.length;}
      else if(e.key==='ArrowDown'||e.key==='ArrowRight'){namePickerIdx=(namePickerIdx+1)%OFFICE_NAMES.length;}
      else if(e.key==='Enter'){
        if(OFFICE_NAMES[namePickerIdx]==='Annet'){typingCustomName=true;nameInput='';}
        else{addHS(OFFICE_NAMES[namePickerIdx],score);enteringName=false;stopMusic();state='start';menuState='main';}
      }
    }
    return;
  }
  K[e.key]=1;
  if([' ','ArrowLeft','ArrowRight','ArrowUp'].includes(e.key))e.preventDefault();
  if(state==='dead'&&e.key==='Enter')go();if(state==='levelcomplete'&&e.key==='Enter'){state='start';menuState='main';currentLevel=0;}
});
document.addEventListener('keyup',e=>K[e.key]=0);
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(state==='play'){stopMusic();state='start';menuState='main';currentLevel=0;scoreOffset=0;}
    else if(state==='dead'||state==='levelcomplete'){stopMusic();state='start';menuState='main';currentLevel=0;}
  }
});
cv.addEventListener('click',(e)=>{handleClick(e);});


// Scrollbar drag
cv.addEventListener('mousedown',(e)=>{
  if(state!=='start'&&state!=='dead'&&state!=='levelcomplete')return;
  const gs=getGlobalScores();if(!gs.length)return;
  const rect=cv.getBoundingClientRect();
  const scale=Math.min(rect.width/W,rect.height/H);
  const offsetX=(rect.width-W*scale)/2;
  const offsetY=(rect.height-H*scale)/2;
  const mx=(e.clientX-rect.left-offsetX)/scale;
  const my=(e.clientY-rect.top-offsetY)/scale;
  const pw=260,ph=360,gap=16,rx=W/2+gap/2;
  const y=drawHighscoreY;
  const sbX=rx+pw-7;
  if(mx>=sbX-4&&mx<=sbX+9&&my>=y+20&&my<=y+ph-4){
    scrollDragging=true;
    scrollDragStartY=e.clientY;
    scrollDragStartScroll=worldScrollY;
    e.preventDefault();
  }
});
document.addEventListener('mousemove',(e)=>{
  if(!scrollDragging)return;
  const gs=getGlobalScores();if(!gs.length)return;
  const rowH=28,ph=360;
  const trackH=ph-24;
  const maxScroll=Math.max(0,(gs.length*rowH)-(ph-28));
  const dy=(e.clientY-scrollDragStartY);
  const rect=cv.getBoundingClientRect();
  const scale=Math.min(rect.width/W,rect.height/H);
  worldScrollY=Math.max(0,Math.min(scrollDragStartScroll+(dy/scale/trackH)*maxScroll,maxScroll));
});
document.addEventListener('mouseup',()=>{scrollDragging=false;});
cv.addEventListener('wheel',(e)=>{
  if(state==='start'||state==='dead'||state==='levelcomplete'){
    const gs=getGlobalScores();
    if(gs.length>6){
      const maxSc=Math.max(0,(gs.length*28)-(360-28));worldScrollY=Math.max(0,Math.min(worldScrollY+e.deltaY*0.5,maxSc));
      e.preventDefault();
    }
  }
},{passive:false});



function handleClick(e){
  if(state==='dead'&&!enteringName){go();return;}
  if(state==='levelcomplete'){state='start';menuState='main';return;}
  if(state==='start'){
    const rect=cv.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(W/rect.width);
    const my=(e.clientY-rect.top)*(H/rect.height);
    if(menuState==='main'){
      const py2=H*0.28+20;
      if(mx>W/2-110&&mx<W/2+110&&my>py2&&my<py2+56){startMainMode();}
      if(mx>W/2-110&&mx<W/2+110&&my>py2+84&&my<py2+120){skinMenuIdx=selectedSkin;menuState='skinselect';}
    } else if(menuState==='skinselect'){
      const cols=4,cellW=240,cellH=110,gridW=cols*cellW,gx=W/2-gridW/2,gy=H*0.3;
      for(let i=0;i<SKINS.length;i++){
        const col=i%cols,row=Math.floor(i/cols);
        const bx=gx+col*cellW,by=gy+row*cellH;
        if(mx>bx&&mx<bx+cellW&&my>by&&my<by+cellH){selectedSkin=i;saveSkin(i);menuState='main';}
      }
      if(mx>W/2-50&&mx<W/2+50&&my>H*0.88&&my<H*0.88+32){menuState='main';}
    }
  }
}
function readGamepad(){const pads=navigator.getGamepads?navigator.getGamepads():[];for(const p of pads){if(p)return{left:p.axes[0]<-0.3||p.buttons[14]?.pressed,right:p.axes[0]>0.3||p.buttons[15]?.pressed,jump:p.buttons[0]?.pressed||p.buttons[1]?.pressed,start:p.buttons[9]?.pressed||p.buttons[8]?.pressed};}return{};}
let prevT=0;
function update(t){const gp=readGamepad();
  if(state==='enter_name'&&enteringName){
    const now=Date.now();
    const pads=navigator.getGamepads?navigator.getGamepads():[];
    for(const p of pads){
      if(!p)continue;
      const axis=p.axes[0];
      const dpad_left=p.buttons[14]?.pressed;
      const dpad_right=p.buttons[15]?.pressed;
      const btnX=p.buttons[0]?.pressed; // X = confirm letter
      const btnCircle=p.buttons[1]?.pressed; // Circle = delete
      const btnTriangle=p.buttons[3]?.pressed; // Triangle = save
      const btnStart=p.buttons[9]?.pressed; // Start = save

      const dpad_up=p.buttons[12]?.pressed;
      const dpad_down=p.buttons[13]?.pressed;
      const stickDown=p.axes[1]>0.3;const stickUp=p.axes[1]<-0.3;
      const goDown=stickDown||dpad_down||dpad_right;
      const goUp=stickUp||dpad_up||dpad_left;
      if(typingCustomName){
        if((goDown||goUp)&&now-gpLastDir>150){gpLastDir=now;if(goDown)gpLetterIdx=(gpLetterIdx+1)%26;else gpLetterIdx=(gpLetterIdx+25)%26;}
        if(btnX&&now-gpLastPress>300){gpLastPress=now;if(nameInput.length<12)nameInput+=String.fromCharCode(65+gpLetterIdx);}
        if(btnCircle&&now-gpLastPress>300){gpLastPress=now;nameInput=nameInput.slice(0,-1);}
        if((btnTriangle||btnStart)&&nameInput.length>0&&now-gpLastPress>300){gpLastPress=now;addHS(nameInput,score);enteringName=false;typingCustomName=false;stopMusic();state='start';menuState='main';}
      } else {
        if((goDown||goUp)&&now-gpLastDir>150){gpLastDir=now;if(goDown)namePickerIdx=(namePickerIdx+1)%OFFICE_NAMES.length;else namePickerIdx=(namePickerIdx-1+OFFICE_NAMES.length)%OFFICE_NAMES.length;}
        if(btnStart&&now-gpLastPress>300){gpLastPress=now;if(OFFICE_NAMES[namePickerIdx]==='Annet'){typingCustomName=true;nameInput='';gpLetterIdx=0;}else{addHS(OFFICE_NAMES[namePickerIdx],score);enteringName=false;stopMusic();state='start';menuState='main';}}
        if(btnCircle&&now-gpLastPress>300){gpLastPress=now;enteringName=false;stopMusic();state='start';menuState='main';}
      }
      break;
    }
    if(state!=='play'){if((state==='dead'||state==='start')&&gp.start)go();return;}
  }
  // Gamepad menu navigation
  if(state!=='play'&&state!=='enter_name'){
    const now3=Date.now();
    const pads3=navigator.getGamepads?navigator.getGamepads():[];
    for(const p of pads3){if(!p)continue;
      const du3=p.buttons[12]?.pressed||p.axes[1]<-0.3;
      const dd3=p.buttons[13]?.pressed||p.axes[1]>0.3;
      const btnX3=p.buttons[0]?.pressed;
      const circle3=p.buttons[1]?.pressed;
      const options3=p.buttons[9]?.pressed;
      if(menuState==='main'){
        if((du3||dd3)&&now3-gpLastDir>150){gpLastDir=now3;mainMenuIdx=(mainMenuIdx+(dd3?1:-1)+2)%2;}
        if(btnX3&&now3-gpLastPress>300){gpLastPress=now3;
          if(mainMenuIdx===0)startMainMode();
          else{skinMenuIdx=selectedSkin;menuState='skinselect';}
        }
        if(options3&&now3-gpLastPress>300){gpLastPress=now3;startMainMode();}
        const hsU=p.buttons[4]?.pressed,hsD=p.buttons[5]?.pressed;
        if((hsU||hsD)&&now3-gpLastDir>120){gpLastDir=now3;
          const hs=loadHS();hsScrollIdx=Math.max(0,Math.min(hsScrollIdx+(hsD?1:-1),Math.max(0,hs.length-HS_VISIBLE)));
        }
      }
      if(menuState==='skinselect'){
        const cols=4;
        if((du3||dd3||p.buttons[14]?.pressed||p.buttons[15]?.pressed)&&now3-gpLastDir>150){gpLastDir=now3;
          if(p.buttons[15]?.pressed||p.axes[0]>0.3)skinMenuIdx=(skinMenuIdx+1)%SKINS.length;
          else if(p.buttons[14]?.pressed||p.axes[0]<-0.3)skinMenuIdx=(skinMenuIdx-1+SKINS.length)%SKINS.length;
          else if(dd3)skinMenuIdx=Math.min(SKINS.length-1,skinMenuIdx+cols);
          else if(du3)skinMenuIdx=Math.max(0,skinMenuIdx-cols);
        }
        if((options3||btnX3)&&now3-gpLastPress>300){gpLastPress=now3;selectedSkin=skinMenuIdx;saveSkin(skinMenuIdx);menuState='main';}
        if(circle3&&now3-gpLastPress>300){gpLastPress=now3;menuState='main';}
      }
      if(circle3&&now3-gpLastPress>300&&menuState==='main'){gpLastPress=now3;
        if(state==='dead'||state==='levelcomplete'){stopMusic();state='start';menuState='main';}
      }
      break;
    }
  }
  if(state!=='play'){if((state==='dead'||state==='start')&&!enteringName&&gp.start)go();return;}const dt=Math.min((t-prevT)/1000,.05);prevT=t;camZ+=spd*dt;score=(scoreOffset+Math.floor(camZ))*12|0;const totalTiles=scoreOffset+Math.floor(camZ);if(gameMode==='test'){const tilesAfter=Math.max(0,totalTiles-100);const baseSpd=Math.min(CONFIG.MAX_SPEED,CONFIG.BASE_SPEED+totalTiles*CONFIG.SPEED_GROWTH);spd=Math.min(25,baseSpd+Math.floor(tilesAfter/5));}else{const tilesAfter=Math.max(0,totalTiles-1827);const baseSpd=Math.min(CONFIG.MAX_SPEED,CONFIG.BASE_SPEED+totalTiles*CONFIG.SPEED_GROWTH);spd=Math.min(25,baseSpd+Math.floor(tilesAfter/5));}const curSpeedLevel=Math.floor(spd);
if(curSpeedLevel>lastSpeedLevel){lastSpeedLevel=curSpeedLevel;speedNotif=3;}
if(speedNotif>0)speedNotif-=dt;const left=K['ArrowLeft']||tL||gp.left,right=K['ArrowRight']||tR||gp.right,jump=K[' ']||tJ||gp.jump;pvx+=((right?CONFIG.LATERAL_SPEED:left?-CONFIG.LATERAL_SPEED:0)-pvx)*CONFIG.LATERAL_DRAG*dt;px=Math.max(-THW+.12,Math.min(THW-.12,px+pvx*dt));rot+=spd*dt*(1/BR)*8+pvx*3*dt;if(jump&&jy>=0){jvy=CONFIG.JUMP_VY;playJump();jy=-1;}jvy+=CONFIG.GRAVITY*dt;jy+=jvy*dt;if(jy>0){jy=0;jvy=0;}const row=getRow(camZ+PZ);
const ballW=0.15;
const colL=Math.max(0,Math.min(COLS-1,Math.floor(px+THW-ballW)));
const colR=Math.max(0,Math.min(COLS-1,Math.floor(px+THW+ballW)));
const solidL=row&&row.c[colL];
const solidR=row&&row.c[colR];
const solid=solidL||solidR;
if(jy>=0&&!solid){die();return;}if(solid&&jy>=0&&Math.abs(pvx)>1.5&&Math.random()<.15)spawnSpark();for(const p of pts){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=300*dt;p.life-=dt;}pts=pts.filter(p=>p.life>0);growTrack(camZ);if(camZ+PZ>=currentLevelData().length){scoreOffset+=Math.floor(camZ);camZ=0;jy=0;jvy=0;pts=[];track=[];tBase=0;loopCount++;growTrack(0);}}
function spawnSpark(){const p=pr(PZ),bx=W/2+(px/THW)*p.hw;for(let i=0;i<3;i++)pts.push({x:bx,y:p.y,vx:(Math.random()-.5)*100,vy:-50-Math.random()*60,life:.35,col:['#ff00ff','#00ffff','#aa00ff'][Math.floor(Math.random()*3)]});}

const STARS=[];
for(let i=0;i<180;i++){STARS.push({x:(Math.random()-.5)*2,y:(Math.random()-.5)*2,size:Math.random()*1.8+0.3,col:['#ffffff','#aaccff','#ccaaff','#ffeebb'][Math.floor(Math.random()*4)],speed:0.3+Math.random()*0.7});}

function drawBg(){
  const g=cx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#00000f');g.addColorStop(0.5,'#0a0020');g.addColorStop(1,'#050010');cx.fillStyle=g;cx.fillRect(0,0,W,H);
  const n=cx.createRadialGradient(W*.3,H*.25,10,W*.3,H*.25,W*.45);n.addColorStop(0,'rgba(60,0,120,.18)');n.addColorStop(1,'rgba(0,0,0,0)');cx.fillStyle=n;cx.fillRect(0,0,W,H);
  const n2=cx.createRadialGradient(W*.75,H*.15,10,W*.75,H*.15,W*.35);n2.addColorStop(0,'rgba(0,40,120,.15)');n2.addColorStop(1,'rgba(0,0,0,0)');cx.fillStyle=n2;cx.fillRect(0,0,W,H);
  const cx0=W/2,cy0=H/2,zoom=1+((camZ*0.2)%80)/80*1;
  for(const s of STARS){const sx=cx0+s.x*W/2*zoom*s.speed,sy=cy0+s.y*H/2*zoom*s.speed;if(sx<0||sx>W||sy<0||sy>H)continue;const size=s.size*(0.5+zoom*s.speed*0.3),alpha=Math.min(1,zoom*s.speed*0.4);cx.globalAlpha=alpha;cx.fillStyle=s.col;cx.beginPath();cx.arc(sx,sy,size,0,Math.PI*2);cx.fill();if(spd>7&&size>1){cx.globalAlpha=alpha*0.3;cx.fillRect(sx,sy-size*spd*0.4,size*0.5,size*spd*0.8);}}cx.globalAlpha=1;
}
function drawTrack(){
  const NEON=[['#ff00ff','#cc00cc','#ff66ff'],['#00ffff','#00aaaa','#66ffff'],['#aa00ff','#7700bb','#cc66ff'],['#ff0099','#bb006f','#ff66cc']];
  const pulse=0.85+Math.sin(Date.now()*0.004)*0.15;
  for(let i=VIEW;i>=0;i--){
    const wz=Math.floor(camZ)+i,df=wz-camZ,db=wz+1-camZ;
    if(df<.08)continue;
    const pF=pr(df),pB=pr(db);
    if(pB.y>H+12||pF.y<HY-4)continue;
    const row=getRow(wz);if(!row)continue;
    const twF=pF.hw*2/COLS,twB=pB.hw*2/COLS,fade=Math.min(1,pF.s*1.8);
    for(let c=0;c<COLS;c++){
      if(!row.c[c])continue;
      const x1f=W/2-pF.hw+c*twF,x2f=x1f+twF,x1b=W/2-pB.hw+c*twB,x2b=x1b+twB;
      const nc=NEON[(c+Math.floor(wz/6))%NEON.length];
      cx.globalAlpha=.3+fade*.5;
      cx.beginPath();cx.moveTo(x1f,pF.y);cx.lineTo(x2f,pF.y);cx.lineTo(x2b,pB.y);cx.lineTo(x1b,pB.y);cx.closePath();
      cx.fillStyle='rgba(10,0,30,.9)';cx.fill();
      const ng=cx.createLinearGradient(x1f,pF.y,x2f,pF.y);
      ng.addColorStop(0,nc[2]+'33');ng.addColorStop(0.5,nc[0]+'55');ng.addColorStop(1,nc[2]+'33');
      cx.fillStyle=ng;cx.fill();
      cx.globalAlpha=1;
      cx.shadowBlur=0;
      cx.strokeStyle=nc[0];cx.lineWidth=1.5;
      cx.beginPath();cx.moveTo(x1f,pF.y);cx.lineTo(x2f,pF.y);cx.stroke();
      cx.lineWidth=0.8;
      // Venstre kant
      cx.beginPath();cx.moveTo(x1f,pF.y);cx.lineTo(x1b,pB.y);cx.stroke();
      // Høyre kant
      cx.beginPath();cx.moveTo(x2f,pF.y);cx.lineTo(x2b,pB.y);cx.stroke();
      // Bakre kant
      cx.lineWidth=0.6;
      cx.beginPath();cx.moveTo(x1b,pB.y);cx.lineTo(x2b,pB.y);cx.stroke();
      }
  }
}

function drawFinishLine(){
  const finishZ = currentLevelData().length - 5;
  const dist = finishZ - camZ;
  if(dist < 0 || dist > VIEW) return;
  const p = pr(dist);
  if(p.y > H+12 || p.y < HY-4) return;
  const pulse = 0.7 + Math.sin(Date.now()*0.006)*0.3;
  const x1 = W/2 - p.hw, x2 = W/2 + p.hw;
  // Glow
  
  cx.shadowBlur=0;
  cx.strokeStyle = '#ffd700';
  cx.lineWidth = 3;
  cx.beginPath();
  cx.moveTo(x1, p.y);
  cx.lineTo(x2, p.y);
  cx.stroke();
  // Checkerboard pattern
  const sq = (x2-x1)/8;
  for(let i=0;i<8;i++){
    cx.fillStyle = i%2===0 ? 'rgba(255,215,0,0.8)' : 'rgba(255,255,255,0.8)';
    cx.fillRect(x1+i*sq, p.y-4, sq, 4);
  }
  cx.shadowBlur=0;
  // Label når du er nærme
  if(dist < 12){
    cx.textAlign='center';
    cx.fillStyle='rgba(255,215,0,'+(1-dist/12)+')';
    cx.font='bold 16px Share Tech Mono, monospace';
    cx.fillText('🏁 END OF LEVEL '+levelDisplay, W/2, p.y - 12);
    cx.textAlign='left';
  }
}
function drawBall(){
  const p=pr(PZ),bx=W/2+(px/THW)*p.hw,gY=p.y-BR,by=gY+jy;
  cx.beginPath();cx.ellipse(bx,gY+3,BR*.75,BR*.2,0,0,Math.PI*2);
  cx.fillStyle='rgba(0,0,0,'+Math.max(0,.4+jy*.003)+')';cx.fill();
  cx.save();cx.translate(bx,by);cx.rotate(rot);
  cx.drawImage(SKIN_CANVASES[selectedSkin],-BR,-BR,BR*2,BR*2);
  cx.restore();
}
function drawParticles(){for(const p of pts){cx.beginPath();cx.arc(p.x,p.y,Math.max(1,3*p.life),0,Math.PI*2);cx.fillStyle=p.col+(Math.min(255,(p.life*2*255)|0).toString(16).padStart(2,'0'));cx.fill();}}
function drawHUD(){
  if(gameMode==='select')return;
  cx.textAlign='left';
  cx.fillStyle='#fff';cx.font='bold 34px Share Tech Mono, monospace';
  cx.fillText('SCORE '+score,10,38);

  // Speed bar - top left, same size as score
  const barW=280,barH=14,barX=10,barY=72;
  const speedPct=Math.min(1,(spd-CONFIG.BASE_SPEED)/(CONFIG.MAX_SPEED*2-CONFIG.BASE_SPEED));
  cx.fillStyle='rgba(255,255,255,.12)';cx.fillRect(barX,barY,barW,barH);
  const sc=cx.createLinearGradient(barX,0,barX+barW,0);
  sc.addColorStop(0,'#00ffff');sc.addColorStop(0.6,'#aa00ff');sc.addColorStop(1,'#ff0066');
  cx.fillStyle=sc;cx.fillRect(barX,barY,barW*speedPct,barH);
  cx.fillStyle='rgba(255,255,255,.6)';cx.font='bold 22px Share Tech Mono, monospace';
  cx.fillText('SPD '+spd.toFixed(1),barX,barY-5);
  cx.textAlign='left';
}

function getGlobalScores(){
  return window.globalScoresCache||globalScores||[];
}
let drawHighscoreY=0;
const HS_VISIBLE=10,HS_ROW=30,HS_PH=HS_VISIBLE*HS_ROW+28;
let hsScrollIdx=0;
function drawHighscoreList(x,y){drawHighscoreY=y;
  const hs=loadHS();
  const pw=320;
  const px2=x-pw/2;
  hsScrollIdx=Math.max(0,Math.min(hsScrollIdx,Math.max(0,hs.length-HS_VISIBLE)));
  drawPanel(px2,y,pw,HS_PH,'#ff00ff');
  cx.textAlign='center';
  cx.fillStyle='#ff00ff';cx.font='bold 15px Share Tech Mono, monospace';
  cx.fillText('TRØNDER-IT',x,y+14);
  cx.save();cx.beginPath();cx.rect(px2+2,y+20,pw-4,HS_PH-22);cx.clip();
  if(!hs.length){
    cx.fillStyle='rgba(255,255,255,.3)';cx.font='12px Share Tech Mono, monospace';
    cx.fillText('Ingen scores ennå',x,y+50);
  } else {
    hs.slice(hsScrollIdx,hsScrollIdx+HS_VISIBLE).forEach((e,i)=>{
      const idx=hsScrollIdx+i;
      const ey=y+36+i*HS_ROW;
      cx.fillStyle=idx===0?'#ffd700':idx===1?'#c0c0c0':idx===2?'#cd7f32':'rgba(255,255,255,.65)';
      cx.font=(idx<3?'bold ':'')+'13px Share Tech Mono, monospace';
      cx.textAlign='left';
      cx.fillText(String(idx+1).padStart(2,' ')+'.',px2+10,ey);
      cx.fillText(e.name.slice(0,14),px2+34,ey);
      cx.textAlign='right';
      cx.fillText(e.score,px2+pw-18,ey);
    });
    if(hs.length>HS_VISIBLE){
      const trackH=HS_PH-26,thumbH=Math.max(20,(HS_VISIBLE/hs.length)*trackH);
      const thumbY=y+22+(hsScrollIdx/Math.max(1,hs.length-HS_VISIBLE))*(trackH-thumbH);
      cx.fillStyle='rgba(255,0,255,.2)';cx.fillRect(px2+pw-8,y+22,5,trackH);
      cx.fillStyle='#ff00ff';cx.fillRect(px2+pw-8,thumbY,5,thumbH);
    }
  }
  cx.restore();
  if(hsScrollIdx>0){cx.fillStyle='rgba(255,0,255,.8)';cx.font='14px monospace';cx.textAlign='center';cx.fillText('▲',x,y+28);}
  if(hs.length>hsScrollIdx+HS_VISIBLE){cx.fillStyle='rgba(255,0,255,.8)';cx.font='14px monospace';cx.textAlign='center';cx.fillText('▼',x,y+HS_PH-4);}
  cx.textAlign='left';
}
function drawPanel(x,y,w,h,color){
  color=color||'#00ffff';
  cx.fillStyle='rgba(4,0,15,0.92)';cx.fillRect(x,y,w,h);
  cx.strokeStyle=color;cx.lineWidth=1.5;cx.strokeRect(x,y,w,h);
  const s=8;cx.strokeStyle='rgba(255,255,255,.4)';cx.lineWidth=1;
  cx.beginPath();cx.moveTo(x,y+s);cx.lineTo(x,y);cx.lineTo(x+s,y);cx.stroke();
  cx.beginPath();cx.moveTo(x+w-s,y);cx.lineTo(x+w,y);cx.lineTo(x+w,y+s);cx.stroke();
  cx.beginPath();cx.moveTo(x,y+h-s);cx.lineTo(x,y+h);cx.lineTo(x+s,y+h);cx.stroke();
  cx.beginPath();cx.moveTo(x+w-s,y+h);cx.lineTo(x+w,y+h);cx.lineTo(x+w,y+h-s);cx.stroke();
}
function drawNeonBtn(x,y,w,h,label,color){
  color=color||'#00ffff';
  cx.fillStyle='rgba(0,0,0,0.4)';cx.fillRect(x,y,w,h);
  cx.strokeStyle=color;cx.lineWidth=2;cx.strokeRect(x,y,w,h);
  cx.fillStyle=color;cx.font='bold 16px Share Tech Mono, monospace';cx.textAlign='center';
  cx.fillText(label,x+w/2,y+h/2+6);cx.textAlign='left';
}
function drawSpaceRollrLogo(cx0,y){
  const letters=[{l:'S',c:'#ff00ff'},{l:'P',c:'#cc00ff'},{l:'A',c:'#00ffff'},{l:'C',c:'#ff00ff'},{l:'E',c:'#aa00ff'},{l:' ',c:'#fff'},{l:'R',c:'#00ffff'},{l:'O',c:'#ff0099'},{l:'L',c:'#ff00ff'},{l:'L',c:'#cc00ff'},{l:'R',c:'#00ffff'}];
  const fontSize=72,letterW=52,totalW=letters.length*letterW;
  const startX=cx0-totalW/2;
  cx.font='bold '+fontSize+'px Orbitron, monospace';cx.textAlign='left';
  letters.forEach(function(lt,i){
    if(lt.l===' ')return;
    const x=startX+i*letterW,ly=y;
    cx.fillStyle=lt.c;cx.fillText(lt.l,x,ly);
  });
  cx.textAlign='left';
}
function drawSpaceBg(){
  const bg=cx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#000008');bg.addColorStop(0.5,'#050018');bg.addColorStop(1,'#000008');
  cx.fillStyle=bg;cx.fillRect(0,0,W,H);
  for(const s of STARS){
    const sx=W/2+s.x*W/2*s.speed,sy=H/2+s.y*H/2*s.speed;
    if(sx<0||sx>W||sy<0||sy>H)continue;
    cx.globalAlpha=Math.min(1,s.speed*0.5);cx.fillStyle=s.col;
    cx.beginPath();cx.arc(sx,sy,s.size*.7,0,Math.PI*2);cx.fill();
  }
  cx.globalAlpha=1;
}
function drawOverlay(title,sub1,sub2){
  const cx0=W/2;
  cx.fillStyle='rgba(0,0,8,.75)';cx.fillRect(0,0,W,H);
  cx.textAlign='center';
  cx.fillStyle='#e0b4ff';cx.font='bold 36px Share Tech Mono, monospace';cx.fillText(title,cx0,H*0.25);
  if(gameMode!=='select'){
    if(sub1){cx.fillStyle='#fff';cx.font='17px Share Tech Mono, monospace';cx.fillText(sub1,cx0,H*0.25+40);}
    drawHighscoreList(cx0,H*0.25+70);
  }
  cx.fillStyle='#4cc9f0';cx.font='13px Share Tech Mono, monospace';
  cx.fillText('ENTER / CLICK TO TRY AGAIN',cx0,H-20);
  cx.textAlign='left';
}

function drawLevelComplete(){
  const cx0=W/2;
  drawSpaceBg();
  drawSpaceRollrLogo(cx0,H*0.22);
  const pw=260,ph=gameMode==='select'?90:120,px2=cx0-pw/2,py2=H*0.34;
  drawPanel(px2,py2,pw,ph,'#00ff88');
  cx.textAlign='center';
  cx.fillStyle='#00ff88';cx.font='bold 14px Share Tech Mono, monospace';
  cx.fillText(gameMode==='select'?'LEVEL COMPLETE!':'LEVEL COMPLETE!',cx0,py2+24);
  if(gameMode!=='select'){
    cx.fillStyle='#fff';cx.font='15px Share Tech Mono, monospace';cx.fillText('Score: '+score,cx0,py2+50);
    if(hi){cx.fillStyle='rgba(255,255,255,.5)';cx.font='11px Share Tech Mono, monospace';cx.fillText('Best: '+hi,cx0,py2+70);}
  }
  const btnLabel=gameMode==='select'?'ENTER / CLICK TO TRY AGAIN':'ENTER / CLICK TO CONTINUE';
  drawNeonBtn(px2+10,py2+ph-44,pw-20,32,btnLabel,'#00ff88');
  cx.textAlign='left';
}

function drawEnterName(){
  const cx0=W/2;
  drawSpaceBg();
  drawSpaceRollrLogo(cx0,H*0.18);
  const hs=loadHS();const place=hs.filter(function(e){return e.score>score;}).length+1;
  const placeStr=place===1?'🥇 1. PLASS!':place===2?'🥈 2. PLASS!':place===3?'🥉 3. PLASS!':place+'. PLASS!';
  cx.textAlign='center';
  cx.fillStyle='#ffd700';cx.font='bold 18px Share Tech Mono, monospace';cx.fillText(placeStr,cx0,H*0.3);
  cx.fillStyle='rgba(255,255,255,.7)';cx.font='13px Share Tech Mono, monospace';cx.fillText('Score: '+score,cx0,H*0.3+22);
  if(typingCustomName){
    const pw=300,ph=120,px2=cx0-pw/2,py2=H*0.38;
    drawPanel(px2,py2,pw,ph,'#00ffff');
    cx.fillStyle='#00ffff';cx.font='bold 13px Share Tech Mono, monospace';cx.textAlign='center';
    cx.fillText('SKRIV INN NAVN:',cx0,py2+18);
    drawPanel(px2+20,py2+30,pw-40,36,'#ffffff');
    cx.fillStyle='#111';cx.font='bold 16px Share Tech Mono, monospace';
    cx.fillText(nameInput+'|',cx0,py2+54);
    const pads=navigator.getGamepads?navigator.getGamepads():[];
    let hasGamepad=false;for(const p of pads){if(p){hasGamepad=true;break;}}
    if(hasGamepad){
      const letter=String.fromCharCode(65+gpLetterIdx);
      cx.fillStyle='rgba(255,255,255,.4)';cx.font='10px Share Tech Mono, monospace';
      cx.fillText('← '+letter+' →  X=legg til  ○=slett  △=lagre',cx0,py2+82);
      cx.fillStyle='#00ffff';cx.font='bold 20px Share Tech Mono, monospace';cx.fillText(letter,cx0,py2+102);
    }
    cx.fillStyle='rgba(255,255,255,.4)';cx.font='10px Share Tech Mono, monospace';
    cx.fillText('ENTER = lagre  |  ESC = tilbake',cx0,py2+ph-10);
  } else {
    const visCount=7,itemH=36,listW=300,listH=visCount*itemH+16;
    const lx=cx0-listW/2,ly=H*0.37;
    drawPanel(lx,ly,listW,listH,'#ff00ff');
    cx.fillStyle='#ff00ff';cx.font='bold 12px Share Tech Mono, monospace';cx.textAlign='center';
    cx.fillText('VELG NAVN',cx0,ly+12);
    const start=Math.max(0,Math.min(namePickerIdx-Math.floor(visCount/2),OFFICE_NAMES.length-visCount));
    cx.save();cx.beginPath();cx.rect(lx+2,ly+16,listW-4,listH-18);cx.clip();
    for(let i=0;i<visCount;i++){
      const idx=start+i;if(idx>=OFFICE_NAMES.length)break;
      const iy=ly+18+i*itemH;
      const selected=idx===namePickerIdx;
      if(selected){cx.fillStyle='rgba(255,0,255,.25)';cx.fillRect(lx+4,iy-2,listW-8,itemH-4);cx.strokeStyle='#ff00ff';cx.lineWidth=1.5;cx.strokeRect(lx+4,iy-2,listW-8,itemH-4);}
      cx.fillStyle=selected?'#ffffff':OFFICE_NAMES[idx]==='Annet'?'rgba(255,200,0,.7)':'rgba(255,255,255,.65)';
      cx.font=(selected?'bold ':'')+'14px Share Tech Mono, monospace';cx.textAlign='center';
      if(selected)cx.fillText('▶ '+OFFICE_NAMES[idx]+' ◀',cx0,iy+itemH/2+5);
      else cx.fillText(OFFICE_NAMES[idx],cx0,iy+itemH/2+5);
    }
    cx.restore();
    cx.fillStyle='rgba(255,255,255,.35)';cx.font='10px Share Tech Mono, monospace';cx.textAlign='center';
    cx.fillText('↑↓ = bla  |  OPTIONS = velg  |  ○ = avbryt',cx0,ly+listH+16);
  }
  cx.textAlign='left';
}

function drawTouchBtns(){
  const bw=W/4-8,bh=52,by=H-bh-8;
  const btns=[[8,'←',tL],[W/2-bw/2,'●',tJ],[W-bw-8,'→',tR]];
  btns.forEach(([x,lbl,on])=>{
    cx.fillStyle=on?'rgba(0,255,255,.25)':'rgba(255,255,255,.07)';
    cx.fillRect(x,by,bw,bh);
    cx.strokeStyle=on?'#00ffff':'rgba(255,255,255,.15)';
    cx.lineWidth=1.5;cx.strokeRect(x,by,bw,bh);
    cx.fillStyle=on?'#00ffff':'rgba(255,255,255,.5)';
    cx.font='bold 22px Share Tech Mono, monospace';cx.textAlign='center';
    cx.fillText(lbl,x+bw/2,by+34);
  });
  // Mobile warning
  const isMobile=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if(isMobile){
    const ww=320,wh=44,wx=cx0-ww/2,wy=H-60;
    cx.fillStyle='rgba(255,160,0,.15)';cx.fillRect(wx,wy,ww,wh);
    cx.strokeStyle='#ffaa00';cx.lineWidth=1;cx.strokeRect(wx,wy,ww,wh);
    cx.fillStyle='#ffaa00';cx.font='11px Share Tech Mono, monospace';cx.textAlign='center';
    cx.fillText('⚠️ Dette spillet er best på PC',cx0,wy+18);
    cx.fillText('med tastatur',cx0,wy+33);
  }
  cx.textAlign='left';
}

function drawSkinSelect(){
  const cx0=W/2;
  drawSpaceBg();
  drawSpaceRollrLogo(cx0,H*0.12);
  cx.textAlign='center';
  cx.fillStyle='#aa00ff';cx.font='bold 16px Share Tech Mono, monospace';
  cx.fillText('VELG SKIN',cx0,H*0.27);
  const cols=4,cellW=240,cellH=110,gridW=cols*cellW,gx=cx0-gridW/2,gy=H*0.3;
  for(let i=0;i<SKINS.length;i++){
    const col=i%cols,row=Math.floor(i/cols);
    const bx=gx+col*cellW+10,by=gy+row*cellH+6;
    const selected=i===skinMenuIdx,active=i===selectedSkin;
    cx.fillStyle=selected?'rgba(170,0,255,.25)':active?'rgba(0,255,255,.1)':'rgba(255,255,255,.04)';
    cx.fillRect(bx,by,cellW-20,cellH-12);
    cx.strokeStyle=selected?'#ff00ff':active?'#00ffff':'rgba(255,255,255,.15)';
    cx.lineWidth=selected?2:1;cx.strokeRect(bx,by,cellW-20,cellH-12);
    const ballX=bx+30,ballY=by+(cellH-12)/2;
    cx.save();cx.beginPath();cx.arc(ballX,ballY,22,0,Math.PI*2);cx.clip();
    cx.drawImage(SKIN_CANVASES[i],ballX-22,ballY-22,44,44);
    cx.restore();
    if(active){cx.fillStyle='#00ffff';cx.font='bold 10px Share Tech Mono, monospace';cx.textAlign='left';cx.fillText('✓',bx+6,by+14);}
    cx.fillStyle=selected?'#ffffff':'rgba(255,255,255,.7)';
    cx.font=(selected?'bold ':'')+'13px Share Tech Mono, monospace';cx.textAlign='left';
    cx.fillText(SKINS[i].name,bx+58,ballY+5);
  }
  cx.textAlign='center';
  cx.fillStyle='rgba(255,255,255,.35)';cx.font='11px Share Tech Mono, monospace';
  cx.fillText('↑↓←→ / D-PAD = bla   |   OPTIONS = velg   |   ○ = tilbake',cx0,H*0.86);
  drawNeonBtn(cx0-50,H*0.88,100,32,'← BACK','rgba(255,255,255,0.3)');
}

function drawLevelSelect(){
  const cx0=W/2;
  drawSpaceBg();
  drawSpaceRollrLogo(cx0,H*0.22);
  const n=LEVELS.length;
  const bw=60,bh=54,gap=8;
  const totalW=n*bw+(n-1)*gap;
  const pw=totalW+40,ph=130,px2=cx0-pw/2,py2=H*0.33;
  drawPanel(px2,py2,pw,ph,'#aa00ff');
  cx.textAlign='center';cx.fillStyle='#aa00ff';cx.font='bold 11px Share Tech Mono, monospace';
  cx.fillText('SELECT LEVEL',cx0,py2+16);
  const p=loadProgress();
  const startX=cx0-totalW/2;
  LEVELS.forEach(function(_,i){
    const bx=startX+i*(bw+gap),by=py2+26;
    const completed=p.completed.includes(i);
    const col=completed?'#00ff88':'#00ffff';
    drawPanel(bx,by,bw,bh,col);
    cx.fillStyle=col;cx.font='bold 14px Share Tech Mono, monospace';cx.textAlign='center';
    cx.fillText('L'+(i+1),bx+bw/2,by+24);
    if(completed){cx.fillStyle='#00ff88';cx.font='11px Share Tech Mono, monospace';cx.fillText('✓',bx+bw/2,by+40);}
  });
  drawNeonBtn(cx0-50,py2+ph-38,100,28,'← BACK','rgba(255,255,255,0.3)');
  cx.textAlign='left';
}

function drawStartScreen(){
  const cx0=W/2;
  drawSpaceBg();
  drawSpaceRollrLogo(cx0,H*0.22);
  cx.textAlign='left';
  cx.font='bold 15px Share Tech Mono, monospace';
  const ctrlY1=H*0.22+30,ctrlY2=H*0.22+54;
  const divX=cx0-10;
  // Line 1
  cx.fillStyle='rgba(255,255,255,.5)';cx.fillText('⌨',divX-180,ctrlY1);
  cx.fillStyle='#00ffff';cx.fillText('← →',divX-148,ctrlY1);
  cx.fillStyle='rgba(255,255,255,.6)';cx.fillText('MOVE',divX-100,ctrlY1);
  cx.fillStyle='rgba(255,255,255,.3)';cx.fillText('|',divX,ctrlY1);
  cx.fillStyle='#ff00ff';cx.fillText('SPACE',divX+18,ctrlY1);
  cx.fillStyle='rgba(255,255,255,.6)';cx.fillText('= JUMP',divX+88,ctrlY1);
  // Line 2
  cx.fillStyle='rgba(255,255,255,.5)';cx.fillText('🎮',divX-180,ctrlY2);
  cx.fillStyle='#00ffff';cx.fillText('L-STICK',divX-148,ctrlY2);
  cx.fillStyle='rgba(255,255,255,.6)';cx.fillText('MOVE',divX-70,ctrlY2);
  cx.fillStyle='rgba(255,255,255,.3)';cx.fillText('|',divX,ctrlY2);
  cx.fillStyle='#ff00ff';cx.fillText('X',divX+18,ctrlY2);
  cx.fillStyle='rgba(255,255,255,.6)';cx.fillText('= JUMP',divX+38,ctrlY2);
  cx.textAlign='center';
  const pw=260,ph=90,px2=cx0-pw/2,py2=H*0.28;
  const playCol=mainMenuIdx===0?'#ffffff':'#00ffff';
  const skinCol=mainMenuIdx===1?'#ffffff':'#aa00ff';
  if(mainMenuIdx===0){cx.fillStyle='rgba(0,255,255,0.15)';cx.fillRect(cx0-110,py2+20,220,56);}
  if(mainMenuIdx===1){cx.fillStyle='rgba(170,0,255,0.15)';cx.fillRect(cx0-110,py2+84,220,36);}
  drawNeonBtn(cx0-110,py2+20,220,56,'▶  PLAY GAME',playCol);
  drawNeonBtn(cx0-110,py2+84,220,36,'🎨  VELG SKIN',skinCol);
  drawHighscoreList(cx0,py2+134);
  cx.textAlign='left';
}

// ===== GLOBAL LEADERBOARD =====
let globalScores=[],worldScrollY=0,scrollDragging=false,scrollDragStartY=0,scrollDragStartScroll=0,speedNotif=0,lastSpeedLevel=0;
async function fetchGlobalScores(){
  if(window.fbGetScores){
    try{
      const result=await window.fbGetScores();
      globalScores=result||[];
    }catch(e){globalScores=[];}
  }
}
async function submitGlobalScore(name,score){
  if(false){
  }
}


// ===== AUDIO =====
const AC = new (window.AudioContext||window.webkitAudioContext)();

function playJump(){
  const o=AC.createOscillator(),g=AC.createGain();
  o.connect(g);g.connect(AC.destination);
  o.type='sine';o.frequency.setValueAtTime(220,AC.currentTime);
  o.frequency.exponentialRampToValueAtTime(340,AC.currentTime+0.1);
  g.gain.setValueAtTime(0.12,AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+0.15);
  o.start();o.stop(AC.currentTime+0.15);
}

function playDie(){
  const o=AC.createOscillator(),g=AC.createGain();
  o.connect(g);g.connect(AC.destination);
  o.type='sawtooth';o.frequency.setValueAtTime(280,AC.currentTime);
  o.frequency.exponentialRampToValueAtTime(40,AC.currentTime+0.4);
  g.gain.setValueAtTime(0.3,AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+0.4);
  o.start();o.stop(AC.currentTime+0.4);
  // Extra crunch
  const o2=AC.createOscillator(),g2=AC.createGain();
  o2.connect(g2);g2.connect(AC.destination);
  o2.type='square';o2.frequency.setValueAtTime(120,AC.currentTime);
  o2.frequency.exponentialRampToValueAtTime(30,AC.currentTime+0.3);
  g2.gain.setValueAtTime(0.15,AC.currentTime);
  g2.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+0.3);
  o2.start();o2.stop(AC.currentTime+0.3);
}

function playFinish(){
  const notes=[440,554,659,880];
  notes.forEach((freq,i)=>{
    const o=AC.createOscillator(),g=AC.createGain();
    o.connect(g);g.connect(AC.destination);
    o.type='sine';o.frequency.setValueAtTime(freq,AC.currentTime+i*0.12);
    g.gain.setValueAtTime(0,AC.currentTime+i*0.12);
    g.gain.linearRampToValueAtTime(0.2,AC.currentTime+i*0.12+0.05);
    g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+i*0.12+0.3);
    o.start(AC.currentTime+i*0.12);
    o.stop(AC.currentTime+i*0.12+0.3);
  });
}

// Music system
const TRACKS=['audio/level1.mp3','audio/level2.mp3','audio/level3.mp3','audio/level4.mp3'];
let musicEl=null,currentTrack=-1;
function playNextTrack(){
  currentTrack=(currentTrack+1)%TRACKS.length;
  musicEl=new Audio(TRACKS[currentTrack]);
  musicEl.volume=0.05;
  musicEl.addEventListener('ended',playNextTrack);
  musicEl.play().catch(()=>{});
}
function playMusic(){
  if(musicEl)return;
  currentTrack=-1;
  playNextTrack();
}
function stopMusic(){
  if(musicEl){musicEl.pause();musicEl.removeEventListener('ended',playNextTrack);musicEl=null;currentTrack=-1;}
}

function resizeCanvas(){
  const scaleX=window.innerWidth/W;
  const scaleY=window.innerHeight/H;
  const scale=Math.min(scaleX,scaleY);
  cv.style.width=Math.round(W*scale)+'px';
  cv.style.height=Math.round(H*scale)+'px';
}
window.addEventListener('resize',resizeCanvas);
resizeCanvas();
state='start';reset();state='start';
let lastFrame=0;
function loop(t){
  requestAnimationFrame(loop);
  if(t-lastFrame<16.67)return;
  lastFrame=t;
  try{
    update(t);
    if(state==='start'){
      if(menuState==='main')drawStartScreen();
      else if(menuState==='levelselect')drawLevelSelect();
      else if(menuState==='skinselect')drawSkinSelect();
    } else {
      drawBg();drawTrack();drawParticles();drawBall();drawHUD();
      if(state==='dead')drawOverlay('GAME OVER',gameMode==='select'?'':'Score: '+score,'');

      if(state==='levelcomplete')drawLevelComplete();
      if(state==='enter_name')drawEnterName();
    }
  }catch(err){console.error(err);}
}
requestAnimationFrame(t=>{prevT=t;requestAnimationFrame(loop);});
