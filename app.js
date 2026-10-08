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
 {id:'lightminimal',name:'СВЕТЛЫЙ МИНИМАЛИЗМ',image:'light-minimal.jpg',title:'Светлый камень и золотые акценты',preview:true},
 {id:'lightframe',name:'СВЕТЛАЯ РАМКА',image:'light-frame.jpg',title:'Светлая рамка и тёплый металл',preview:true},
 {id:'senso498',name:'SENSO 498',image:'senso-498.jpg',title:'Тёплый шоколадный матовый',preview:true},
 {id:'structura',name:'STRUCTURA 419',image:'structura.jpeg',title:'Тёмный дуб и камень',preview:true}
];
window.collections=models;
const modelImage=m=>m.image||m.id+'.webp';
function catalogCard(m,duplicate=false){return `<button class="catalog-card" type="button" data-showroom-model="${m.id}"${duplicate?' tabindex="-1" aria-hidden="true"':''}><span class="catalog-photo"><img src="${modelImage(m)}" alt="" width="1000" height="730" loading="lazy"></span><strong>${m.name}</strong></button>`}
function renderMarquee(target,list){const cards=list.map(m=>catalogCard(m)).join('');const copies=list.map(m=>catalogCard(m,true)).join('');target.innerHTML=`<div class="catalog-set">${cards}</div><div class="catalog-set" aria-hidden="true">${copies}</div>`}
renderMarquee($('#catalog-row-one'),models.slice(0,4));
renderMarquee($('#catalog-row-two'),[...models].reverse());

let showroomModel=models[0];
const showroomSelector=$('#showroom-selector');
showroomSelector.innerHTML=models.map((m,i)=>`<button type="button" data-showroom-select="${m.id}" aria-pressed="${i===0}">${m.name}</button>`).join('');
function showroomEvent(name,extra={}){const detail={event:name,showroom_id:'kuchen-technik-mini',kitchen_id:showroomModel.id,viewpoint_id:null,hotspot_id:null,category:null,device:matchMedia('(max-width:700px)').matches?'mobile':'desktop',...extra};document.dispatchEvent(new CustomEvent('showroom:analytics',{detail}));if(Array.isArray(window.dataLayer))window.dataLayer.push(detail);if(typeof window.gtag==='function')window.gtag('event',name,detail)}
function previewImage(model){const picture=$('#showroom-preview-picture');const sources=[...picture.querySelectorAll('source')];if(model.preview){const id=model.id;sources[0].srcset=`showroom/interactive/${id}-preview-mobile.avif`;sources[1].srcset=`showroom/interactive/${id}-preview-mobile.webp`;sources[2].srcset=`showroom/interactive/${id}-preview-mobile.jpg`;sources[3].srcset=`showroom/interactive/${id}-preview-desktop.avif`;sources[4].srcset=`showroom/interactive/${id}-preview-desktop.webp`;$('#showroom-preview-image').src=`showroom/interactive/${id}-preview-desktop.jpg`}else{sources.forEach(s=>s.removeAttribute('srcset'));$('#showroom-preview-image').src=modelImage(model)}$('#showroom-preview-image').alt=`${model.name} — превью интерактивного шоурума`}
function selectShowroom(id,scroll=false){const model=models.find(m=>m.id===id);if(!model)return;showroomModel=model;previewImage(model);$('#showroom-preview-code').textContent=model.name;$('#showroom-preview-title').textContent=model.title;showroomSelector.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.showroomSelect===id)));if(scroll)$('#mini-showroom').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}
document.addEventListener('click',e=>{const card=e.target.closest('[data-showroom-model]');if(card&&!card.hasAttribute('aria-hidden'))selectShowroom(card.dataset.showroomModel,true);const select=e.target.closest('[data-showroom-select]');if(select)selectShowroom(select.dataset.showroomSelect)});
let activeShowroom=null,showroomOpening=false;
async function openShowroom(){if(showroomOpening||activeShowroom)return;showroomOpening=true;showroomEvent('showroom_open_click');showroomEvent('showroom_loading');$('#showroom-error').hidden=true;$('#showroom-loader').hidden=false;$('#showroom-open').disabled=true;try{const {mountShowroom}=await import('./showroom/showroom.js');activeShowroom=await mountShowroom({host:$('#showroom-host'),preview:$('#showroom-preview'),modelId:showroomModel.id,analytics:showroomEvent,onClose:()=>{activeShowroom=null;$('#showroom-preview').hidden=false;$('#showroom-host').hidden=true;$('#showroom-loader').hidden=true;$('#showroom-open').disabled=false}});$('#showroom-preview').hidden=true;$('#showroom-host').hidden=false;showroomEvent('showroom_loaded')}catch(error){console.error('Showroom failed to open',error);showroomEvent('showroom_error');$('#showroom-error').hidden=false;$('#showroom-loader').hidden=true;$('#showroom-open').disabled=false}finally{showroomOpening=false}}
$('#showroom-open').addEventListener('click',openShowroom);$('#showroom-retry').addEventListener('click',openShowroom);
const previewObserver=new IntersectionObserver((entries)=>{if(entries.some(entry=>entry.isIntersecting)){showroomEvent('showroom_preview_view');previewObserver.disconnect()}},{threshold:.3});previewObserver.observe($('#showroom-preview'));
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
