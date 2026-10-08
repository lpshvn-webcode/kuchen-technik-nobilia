'use strict';
window.collections = [];
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const header=$('#header');
addEventListener('scroll',()=>{header.classList.toggle('scrolled',scrollY>80);$('.mobile-bottom').classList.toggle('shown',scrollY>600)},{passive:true});
function showDialog(dialog){dialog.showModal();document.body.classList.add('modal-open')}
$$('dialog').forEach(d=>{d.addEventListener('close',()=>{document.body.classList.remove('modal-open');if(d.id==='mobile-menu')$('.menu-toggle').setAttribute('aria-expanded','false')});d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}})});
document.addEventListener('click',e=>{const b=e.target.closest('[data-close]');if(b)b.closest('dialog').close()});
$('.menu-toggle').onclick=()=>{showDialog($('#mobile-menu'));$('.menu-toggle').setAttribute('aria-expanded','true')};
$$('#mobile-menu a').forEach(a=>a.onclick=()=>$('#mobile-menu').close());
const models=[
{id:'senso',name:'SENSO 488',tag:'СВЕТ И ПРОСТОТА',finish:'Матовый белый',description:'Светлые матовые фасады и выразительные древесные детали. Спокойная кухня, открытая для жизни.',code:'488 · Premium honed white',path:'natural-scandi/senso-488'},
{id:'natura',name:'NATURA 744',tag:'ТЕПЛО ПРИРОДЫ',finish:'Фактура дуба Montreal',description:'Тёплый характер древесной фактуры и чистая геометрия. Фасад с декором дуба Montreal — не массив дерева.',code:'744 · Oak Montreal reproduction',path:'natural-scandi/natura-744'},
{id:'riva',name:'RIVA 842',tag:'МЯГКАЯ ГЕОМЕТРИЯ',finish:'Песочная фактура бетона',description:'Сдержанный песочный оттенок с декором бетона. Архитектурное решение для современного пространства.',code:'842 · Concrete sand reproduction',path:'modern-kitchens/riva-842'},
{id:'slate',name:'SENSO 491',tag:'ВЫРАЗИТЕЛЬНЫЙ КОНТРАСТ',finish:'Матовый сланцевый серый',description:'Глубокий серый оттенок и ясные линии. Выразительная основа для кухни с собственным характером.',code:'491 · Premium honed slate grey',path:'designer-kitchens/senso-491'},
{id:'easy',name:'EASYTOUCH 969',tag:'ЕСТЕСТВЕННОЕ РАВНОВЕСИЕ',finish:'Ультраматовый песочный',description:'Мягкий песочный цвет объединяет кухню с жилым пространством. Тёплая нейтральная палитра для цельного интерьера.',code:'969 · Sand ultra matt',path:'designer-kitchens/easytouch-969'}
];
window.collections=models;
const track=$('#collection-track');
track.innerHTML=models.map(m=>`<article class="collection-card"><div class="photo"><img src="${m.id}.webp" alt="Кухня Nobilia ${m.name}" width="1000" height="730" loading="lazy"></div><div class="card-info"><h3>${m.name}</h3></div></article>`).join('');
let activeIndex=0;
function updateCarousel(){const cards=$$('.collection-card');const left=track.getBoundingClientRect().left+parseFloat(getComputedStyle(track).paddingLeft);activeIndex=cards.reduce((best,c,i)=>Math.abs(c.getBoundingClientRect().left-left)<Math.abs(cards[best].getBoundingClientRect().left-left)?i:best,0);$('#collection-counter').textContent=`${String(activeIndex+1).padStart(2,'0')} / 05`;$('#prev').disabled=track.scrollLeft<5;$('#next').disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-5}
track.addEventListener('scroll',updateCarousel,{passive:true});addEventListener('resize',updateCarousel);updateCarousel();
function moveCarousel(dir){track.scrollBy({left:dir*($('.collection-card').getBoundingClientRect().width+parseFloat(getComputedStyle(track).gap)),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}
$('#prev').onclick=()=>moveCarousel(-1);$('#next').onclick=()=>moveCarousel(1);
const state={model:null,configuration:null,source:'contact',type:'estimate',interest:null};
// All assets share one camera; each image is clipped to its own material zone.
const finishes=[
 {id:'milk',src:'config-milk.png',cabinet:'Молочный матовый',stone:'Камень · Светлый',short:'Молочный',stoneShort:'Светлый камень'},
 {id:'oak',src:'config-oak.png',cabinet:'Натуральный дуб',stone:'Камень · Графит',short:'Натуральный дуб',stoneShort:'Графит'},
 {id:'olive',src:'config-olive.png',cabinet:'Олива матовая',stone:'Камень · Травертин',short:'Олива',stoneShort:'Травертин'}
];
const configuration={upper:0,middle:1,lower:2};
const zoneNames={upper:'Верхние фасады',middle:'Столешница и фартук',lower:'Нижние фасады'};
const zoneRequests={upper:0,middle:0,lower:0};
function configText(){return `${finishes[configuration.upper].short} / ${finishes[configuration.middle].stoneShort} / ${finishes[configuration.lower].short}`}
function configDetails(){return Object.fromEntries(Object.keys(configuration).map(zone=>[zone,finishes[configuration[zone]].id]))}
function refreshConfiguration(){
 for(const zone of Object.keys(configuration)) $('#finish-'+zone).textContent=finishes[configuration[zone]][zone==='middle'?'stone':'cabinet'];
 $('#config-combination').textContent=configText();
 state.configuration=configDetails();syncContext();
}
async function selectFinish(zone,index){
 if(!Object.hasOwn(configuration,zone)||!Number.isInteger(index)||index<0||index>=finishes.length)throw Error('Unknown material');
 const token=++zoneRequests[zone];
 const buttons=$$(`[data-zone="${zone}"]`);buttons.forEach(b=>b.disabled=true);
 $('#config-status').textContent='Загружаем материал…';
 try {
  await new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=reject;image.src=finishes[index].src});
  if(token!==zoneRequests[zone])return;
  $('#config-'+zone).src=finishes[index].src;configuration[zone]=index;refreshConfiguration();
  $('#config-status').textContent=`${zoneNames[zone]}: ${finishes[index][zone==='middle'?'stone':'cabinet']}`;
 } catch {$('#config-status').textContent='Не удалось загрузить материал. Нажмите стрелку, чтобы повторить.'}
 finally {if(token===zoneRequests[zone])buttons.forEach(b=>b.disabled=false)}
 return configDetails();
}
$$('[data-zone]').forEach(button=>button.addEventListener('click',()=>{const zone=button.dataset.zone;selectFinish(zone,(configuration[zone]+Number(button.dataset.direction)+finishes.length)%finishes.length)}));
function syncContext(){const model=models.find(x=>x.id===state.model);$$('.selection-context').forEach(el=>{el.classList.toggle('active',!!model||!!state.configuration||!!state.interest);el.innerHTML=`<div><strong>Ваш выбор</strong><button type="button" data-clear>Очистить</button></div>${model?`<p>Коллекция: ${model.name} · <button type="button" data-return-model="${model.id}">Посмотреть</button></p>`:''}${state.configuration?`<p>Сочетание: ${configText()}</p>`:''}${state.interest?'<p>Кухня с техникой</p>':''}`})}
// The Tilda popup markup/runtime will be supplied separately. Keep the exact
// user-provided anchor; do not replace it with a simulated lead form.
function stageInquiry(type,source,interest){
  state.type=type;state.source=source||'contact';state.interest=interest||null;
  if(source==='materials')state.configuration=configDetails();
  $$('dialog[open]').forEach(d=>d.close());syncContext();
  window.kuchenInquiryContext={...state};
  document.dispatchEvent(new CustomEvent('kuchen:inquiry',{detail:{...state}}));
}
function openPrivacy(){const p=$('#privacy');showDialog(p)}
$('#privacy').addEventListener('close',()=>{if($('dialog[open]'))document.body.classList.add('modal-open')});
document.addEventListener('click',e=>{const inquiry=e.target.closest('[data-popup]');if(inquiry)stageInquiry(inquiry.dataset.popup,inquiry.dataset.source,inquiry.dataset.interest);if(e.target.closest('[data-clear]')){state.model=null;state.configuration=null;state.interest=null;syncContext()};if(e.target.closest('#privacy-open'))openPrivacy()});
const contactObserver=new IntersectionObserver(entries=>{$('.mobile-bottom').classList.toggle('hidden',entries[0].isIntersecting)},{threshold:.1});contactObserver.observe($('#contact'));
if(document.modelContext?.registerTool){const lifecycle=new AbortController();addEventListener('pagehide',()=>lifecycle.abort(),{once:true});try{Promise.resolve(document.modelContext.registerTool({name:'select_kitchen_material',title:'Подобрать материал кухни',description:'Изменить верхние фасады, столешницу с фартуком или нижние фасады в демонстрационном конструкторе. Не отправляет заявку.',inputSchema:{type:'object',properties:{zone:{type:'string',enum:['upper','middle','lower']},finish:{type:'string',enum:['milk','oak','olive']}},required:['zone','finish'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async input=>{if(!input||Object.keys(input).some(k=>!['zone','finish'].includes(k)))throw Error('Invalid configuration');return selectFinish(input.zone,finishes.findIndex(f=>f.id===input.finish))}},{signal:lifecycle.signal})).catch(()=>{})}catch{}}
