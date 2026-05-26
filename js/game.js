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
function addHS(name,s){const hs=loadHS();hs.push({name:name.slice(0,12),score:s});hs.sort((a,b)=>b.score-a.score);hs.splice(10);saveHS(hs);if(window.fbSubmitScore)window.fbSubmitScore(name.slice(0,12),s);}

let camZ,px,pvx,jy,jvy,spd,score,state,hi=0,pts=[],rot=0,currentLevel=0,gameMode='main',menuState='main',scoreOffset=0;
let nameInput='',enteringName=false,gpLetterIdx=0,gpLastPress=0,gpLastDir=0;

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
    if(e.key==='Enter'&&nameInput.length>0){addHS(nameInput,score);enteringName=false;state=camZ+PZ>=currentLevelData().length?'levelcomplete':'dead';}
    else if(e.key==='Backspace'){nameInput=nameInput.slice(0,-1);}
    else if(e.key.length===1&&nameInput.length<12){nameInput+=e.key;}
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
  if(state==='dead'){go();return;}
  if(state==='levelcomplete'){state='start';menuState='main';return;}
  if(state==='start'){
    const rect=cv.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(W/rect.width);
    const my=(e.clientY-rect.top)*(H/rect.height);
    if(menuState==='main'){
      const py2=H*0.28+20,btnH=56;
      if(mx>W/2-110&&mx<W/2+110&&my>py2&&my<py2+btnH){startMainMode();}
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

      // Navigate letters with stick or dpad
      const goRight=axis>0.3||dpad_right;
      const goLeft=axis<-0.3||dpad_left;
      if((goRight||goLeft)&&now-gpLastDir>150){
        gpLastDir=now;
        if(goRight)gpLetterIdx=(gpLetterIdx+1)%26;
        else gpLetterIdx=(gpLetterIdx+25)%26;
      }
      // Add letter
      if(btnX&&now-gpLastPress>300){gpLastPress=now;if(nameInput.length<12)nameInput+=String.fromCharCode(65+gpLetterIdx);}
      // Delete
      if(btnCircle&&now-gpLastPress>300){gpLastPress=now;nameInput=nameInput.slice(0,-1);}
      // Save
      if((btnTriangle||btnStart)&&nameInput.length>0&&now-gpLastPress>300){gpLastPress=now;addHS(nameInput,score);enteringName=false;state='dead';}
      break;
    }
    if(state!=='play'){if((state==='dead'||state==='start')&&(gp.start||gp.jump))go();return;}
  }
  if(state!=='play'){if((state==='dead'||state==='start')&&(gp.start||gp.jump))go();return;}const dt=Math.min((t-prevT)/1000,.05);prevT=t;camZ+=spd*dt;score=(scoreOffset+Math.floor(camZ))*12|0;const totalTiles=scoreOffset+Math.floor(camZ);if(gameMode==='test'){const tilesAfter=Math.max(0,totalTiles-100);const baseSpd=Math.min(CONFIG.MAX_SPEED,CONFIG.BASE_SPEED+totalTiles*CONFIG.SPEED_GROWTH);spd=Math.min(25,baseSpd+Math.floor(tilesAfter/5));}else{const tilesAfter=Math.max(0,totalTiles-1827);const baseSpd=Math.min(CONFIG.MAX_SPEED,CONFIG.BASE_SPEED+totalTiles*CONFIG.SPEED_GROWTH);spd=Math.min(25,baseSpd+Math.floor(tilesAfter/5));}const curSpeedLevel=Math.floor(spd);
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

// Cached static background
const bgCanvas=document.createElement('canvas');bgCanvas.width=W;bgCanvas.height=H;
const bgCtx=bgCanvas.getContext('2d');
(function(){
  const g=bgCtx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#00000f');g.addColorStop(0.5,'#0a0020');g.addColorStop(1,'#050010');bgCtx.fillStyle=g;bgCtx.fillRect(0,0,W,H);
  const n=bgCtx.createRadialGradient(W*.3,H*.25,10,W*.3,H*.25,W*.45);n.addColorStop(0,'rgba(60,0,120,.18)');n.addColorStop(1,'rgba(0,0,0,0)');bgCtx.fillStyle=n;bgCtx.fillRect(0,0,W,H);
  const n2=bgCtx.createRadialGradient(W*.75,H*.15,10,W*.75,H*.15,W*.35);n2.addColorStop(0,'rgba(0,40,120,.15)');n2.addColorStop(1,'rgba(0,0,0,0)');bgCtx.fillStyle=n2;bgCtx.fillRect(0,0,W,H);
})();
function drawBg(){
  cx.drawImage(bgCanvas,0,0);
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
      cx.fillStyle=nc[0]+'44';cx.fill();
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
function drawBall(){const p=pr(PZ),bx=W/2+(px/THW)*p.hw,gY=p.y-BR,by=gY+jy;cx.beginPath();cx.ellipse(bx,gY+3,BR*.75,BR*.2,0,0,Math.PI*2);cx.fillStyle='rgba(0,0,0,'+Math.max(0,.4+jy*.003)+')';cx.fill();cx.save();cx.translate(bx,by);cx.rotate(rot);const g=cx.createRadialGradient(-BR*.3,-BR*.35,BR*.05,0,0,BR);g.addColorStop(0,'#aaf5f0');g.addColorStop(.4,'#00c8c0');g.addColorStop(1,'#006f6a');cx.beginPath();cx.arc(0,0,BR,0,Math.PI*2);cx.fillStyle=g;cx.fill();cx.beginPath();cx.arc(-BR*.28,-BR*.32,BR*.2,0,Math.PI*2);cx.fillStyle='rgba(255,255,255,.45)';cx.fill();cx.restore();}
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

function getGlobalScores(){return[];}
let drawHighscoreY=0;
function drawHighscoreList(x,y){drawHighscoreY=y;
  const hs=loadHS();
  const gs=getGlobalScores();
  const pw=260,ph=360,gap=16;
  const lx=x-pw-gap/2,rx=x+gap/2;
  const rowH=28;

  // YOU panel
  drawPanel(lx,y,pw,ph,'#00ffff');
  cx.textAlign='center';
  cx.fillStyle='#00ffff';cx.font='bold 15px Share Tech Mono, monospace';
  cx.fillText('YOU',lx+pw/2,y+14);
  cx.save();cx.beginPath();cx.rect(lx+2,y+20,pw-4,ph-22);cx.clip();
  if(!hs.length){
    cx.fillStyle='rgba(255,255,255,.3)';cx.font='10px Share Tech Mono, monospace';
    cx.fillText('No scores yet',lx+pw/2,y+36);
  } else {
    hs.slice(0,10).forEach((e,i)=>{
      cx.fillStyle=i===0?'#ffd700':i===1?'#c0c0c0':i===2?'#cd7f32':'rgba(255,255,255,.6)';
      cx.font=(i<3?'bold ':'')+'13px Share Tech Mono, monospace';
      cx.textAlign='left';
      const rank=String(i+1).padStart(2,' ')+'.';
      cx.fillText(rank,lx+8,y+30+i*rowH);
      cx.fillText(e.name.slice(0,8),lx+28,y+30+i*rowH);
      cx.textAlign='right';
      cx.fillText(e.score,lx+pw-6,y+30+i*rowH);
    });
  }
  cx.restore();

  // WORLD panel - scrollable
  drawPanel(rx,y,pw,ph,'#aa00ff');
  cx.textAlign='center';
  cx.fillStyle='#aa00ff';cx.font='bold 15px Share Tech Mono, monospace';
  return; // no world leaderboard in office version
  cx.save();cx.beginPath();cx.rect(rx+2,y+20,pw-4,ph-22);cx.clip();
  if(!gs.length){
    cx.fillStyle='rgba(255,255,255,.3)';cx.font='10px Share Tech Mono, monospace';
    cx.fillText('Loading...',rx+pw/2,y+36);
  } else {
    const maxScroll=Math.max(0,(gs.length*rowH)-(ph-28));
    worldScrollY=Math.min(worldScrollY,maxScroll);
    const startIdx=Math.floor(worldScrollY/rowH);
    const visCount=Math.ceil((ph-22)/rowH)+1;
    for(let i=0;i<visCount;i++){
      const idx=startIdx+i;
      if(idx>=gs.length)break;
      const ey=y+30+i*rowH-(worldScrollY%rowH);
      if(ey>y+ph)break;
      const e=gs[idx];
      cx.fillStyle=idx===0?'#ffd700':idx===1?'#c0c0c0':idx===2?'#cd7f32':'rgba(255,255,255,.6)';
      cx.font=(idx<3?'bold ':'')+'13px Share Tech Mono, monospace';
      cx.textAlign='left';
      const rank=String(idx+1).padStart(2,' ')+'.';
      cx.fillText(rank,rx+8,ey);
      cx.fillText(e.name.slice(0,8),rx+28,ey);
      cx.textAlign='right';
      cx.fillText(e.score,rx+pw-14,ey);
    }
    if(gs.length*rowH>ph-24){
      const trackH=ph-24,thumbH=Math.max(16,((ph-24)/(gs.length*rowH))*trackH);
      const maxSc=Math.max(1,maxScroll);
      const thumbY=y+20+(worldScrollY/maxSc)*(trackH-thumbH);
      cx.fillStyle='rgba(170,0,255,.3)';cx.fillRect(rx+pw-7,y+20,5,trackH);
      cx.fillStyle='#aa00ff';cx.fillRect(rx+pw-7,thumbY,5,thumbH);
    }
  }
  cx.restore();
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
  drawSpaceRollrLogo(cx0,H*0.22);
  const hs=loadHS();const place=hs.filter(function(e){return e.score>score;}).length+1;
  const placeStr=place===1?'🥇 1. PLASS!':place===2?'🥈 2. PLASS!':place===3?'🥉 3. PLASS!':place+'. PLASS!';
  const pw=280,ph=150,px2=cx0-pw/2,py2=H*0.34;
  drawPanel(px2,py2,pw,ph,'#ffd700');
  cx.textAlign='center';
  cx.fillStyle='#ffd700';cx.font='bold 15px Share Tech Mono, monospace';cx.fillText(placeStr,cx0,py2+22);
  cx.fillStyle='#fff';cx.font='13px Share Tech Mono, monospace';cx.fillText('Score: '+score,cx0,py2+44);
  cx.fillStyle='rgba(255,255,255,.5)';cx.font='10px Share Tech Mono, monospace';cx.fillText('ENTER YOUR NAME:',cx0,py2+64);
  drawPanel(px2+20,py2+72,pw-40,34,'#00ffff');
  cx.fillStyle='#fff';cx.font='bold 15px Share Tech Mono, monospace';cx.fillText(nameInput+'|',cx0,py2+95);
  // Gamepad letter picker
  const pads=navigator.getGamepads?navigator.getGamepads():[];
  let hasGamepad=false;for(const p of pads){if(p){hasGamepad=true;break;}}
  if(hasGamepad){
    const letter=String.fromCharCode(65+gpLetterIdx);
    cx.fillStyle='rgba(255,255,255,.3)';cx.font='11px Share Tech Mono, monospace';cx.textAlign='center';
    cx.fillText('← '+letter+' →   X=legg til   ○=slett   △=lagre',cx0,py2+115);
    cx.fillStyle='#00ffff';cx.font='bold 22px Share Tech Mono, monospace';
    cx.fillText(letter,cx0,py2+140);
    cx.textAlign='left';
  }
  cx.fillStyle='rgba(255,255,255,.35)';cx.font='10px Share Tech Mono, monospace';cx.fillText('PRESS ENTER TO SAVE',cx0,py2+ph-12);
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
  drawNeonBtn(cx0-110,py2+20,220,56,'▶  PLAY GAME','#00ffff');
  drawHighscoreList(cx0,py2+90+6);
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
  if(window.fbSubmitScore){
    await window.fbSubmitScore(name,score);
    await setTimeout(fetchGlobalScores,500);setInterval(fetchGlobalScores,15000);
  }
}
setTimeout(fetchGlobalScores,500);setInterval(fetchGlobalScores,15000);

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
    } else {
      drawBg();drawTrack();drawParticles();drawBall();drawHUD();
      if(state==='dead')drawOverlay('GAME OVER',gameMode==='select'?'':'Score: '+score,'');

      if(state==='levelcomplete')drawLevelComplete();
      if(state==='enter_name')drawEnterName();
    }
  }catch(err){console.error(err);}
}
requestAnimationFrame(t=>{prevT=t;requestAnimationFrame(loop);});
