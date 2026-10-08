const interactiveImage=(id,n)=>{const stem=`showroom/interactive/${id}-view-${String(n).padStart(2,'0')}`;return {desktop:`${stem}-desktop.webp`,mobile:`${stem}-mobile.webp`,fallbackDesktop:`${stem}-desktop.jpg`,fallbackMobile:`${stem}-mobile.jpg`}};
const oldImage=name=>({desktop:name,mobile:name,fallbackDesktop:name,fallbackMobile:name});
const point=(x,y,mx=x,my=y)=>({desktop:{x,y},mobile:{x:mx,y:my}});
const link=(id,direction,x=50,y=78,mx=x,my=y)=>({viewpointId:id,direction,position:point(x,y,mx,my)});
const feature=(id,viewpointId,title,category,description,image,position,specs=[])=>({id,viewpointId,title,category,description,image,position,specs});
function makePrepared(id,title,scenes,features){return {id,title,viewpoints:scenes.map((s,i)=>({id:`view-${i+1}`,title:s.title,image:interactiveImage(id,i+1),connections:s.connections})),hotspots:features}}
const configs={
 lightminimal:makePrepared('lightminimal','Светлый минимализм',[
  {title:'Общий вид',connections:[link('view-2','forward',55,78,51,74)]},
  {title:'Перед островом',connections:[link('view-1','back',19,82,18,82),link('view-3','right',73,74,65,75)]},
  {title:'Остров и рабочая зона',connections:[link('view-2','back',26,81,23,84),link('view-4','forward',62,68,58,74)]},
  {title:'Материалы вблизи',connections:[link('view-3','back',23,84,24,85)]}
 ],[
  feature('gold-sink','view-1','Золотая мойка','Фурнитура','Тёплый металлический акцент на светлом острове.','showroom/light-minimal-sink.jpg',point(57,62,54,60)),
  feature('stone-worktop','view-2','Светлая столешница','Материалы','Спокойная светлая поверхность объединяет рабочие зоны.','showroom/light-minimal-worktop.jpg',point(50,65,52,61)),
  feature('lit-niche','view-3','Подсвеченная ниша','Технологии','Мягкая подсветка выделяет фактуру камня и предметы в нише.','showroom/light-minimal-niche.jpg',point(55,35,50,30))
 ]),
 lightframe:makePrepared('lightframe','Светлая рамка',[
  {title:'Общий вид',connections:[link('view-2','left',35,76,42,75)]},
  {title:'Вдоль острова',connections:[link('view-1','back',82,78,81,80),link('view-3','forward',60,70,52,75)]},
  {title:'Рабочая зона',connections:[link('view-2','back',22,80,25,82)]}
 ],[
  feature('frame-front','view-1','Рамочные фасады','Материалы','Светлый фасад с тонким профилем и тёплой фурнитурой.','showroom/light-frame-storage.jpg',point(56,47,60,43)),
  feature('frame-handle','view-2','Металлическая ручка','Фурнитура','Небольшая ручка аккуратно подчёркивает геометрию фасада.','showroom/light-frame-storage.jpg',point(57,66,56,65)),
  feature('frame-worktop','view-3','Рабочая поверхность','Материалы','Каменная фактура и продуманное рабочее освещение.','showroom/light-frame-worktop.jpg',point(55,62,52,58))
 ]),
 senso498:makePrepared('senso498','Senso 498',[
  {title:'Общий вид',connections:[link('view-2','forward',54,75,53,78)]},
  {title:'Перед рабочей зоной',connections:[link('view-1','back',18,81,20,82),link('view-3','right',72,72,68,74)]},
  {title:'Мойка и столешница',connections:[link('view-2','back',22,81,23,82)]}
 ],[
  feature('senso-front','view-1','Матовый фасад','Материалы','Глубокий шоколадный оттенок с мягкой матовой поверхностью.','showroom/senso-498-2.jpg',point(48,42,49,37)),
  feature('senso-light','view-2','Контурная подсветка','Технологии','Световая линия подчёркивает край рабочей поверхности.','showroom/senso-498-3.jpg',point(56,61,51,58)),
  feature('senso-sink','view-3','Золотая мойка','Фурнитура','Тёплый металл становится выразительной деталью интерьера.','showroom/senso-498-4.jpg',point(66,62,60,59))
 ]),
 structura:makePrepared('structura','Structura 419',[
  {title:'Общий вид',connections:[link('view-2','forward',49,76,50,77)]},
  {title:'Рабочая зона',connections:[link('view-1','back',18,80,18,82),link('view-3','right',70,71,64,74)]},
  {title:'Фактура вблизи',connections:[link('view-2','back',25,83,23,84)]}
 ],[
  feature('dark-oak','view-1','Тёмный дуб','Материалы','Выразительная древесная фактура тёмных фасадов.','showroom/structura-419-3.jpg',point(69,43,69,41)),
  feature('dark-handle','view-2','Минималистичная ручка','Фурнитура','Лаконичная ручка сохраняет цельность плоскости фасада.','showroom/structura-419-2.jpg',point(56,69,54,66)),
  feature('dark-stone','view-3','Каменная столешница','Материалы','Светлый камень создаёт баланс с тёмным дубом.','showroom/structura-419-4.jpg',point(55,55,53,51))
 ])
};
for(const [id,title] of [['senso','Senso 488'],['natura','Natura 744'],['riva','Riva 842'],['slate','Senso 491'],['easy','Easytouch 969']]){
 const images=[`${id}.webp`,`${id}-1.webp`,`${id}-2.webp`];
 configs[id]={id,title,viewpoints:images.map((image,i)=>({id:`view-${i+1}`,title:['Общий вид','Другой ракурс','Детали'][i],image:oldImage(image),connections:[...(i>0?[link(`view-${i}`,'back',22,81)]:[]),...(i<2?[link(`view-${i+2}`,'forward',56,77)]:[])]})),hotspots:[feature(`${id}-detail`,'view-2','Детали кухни','Материалы','Рассмотрите выбранную кухню с другого ракурса.',`${id}-3.webp`,point(55,48,55,47))]};
}
export function getShowroomConfig(id){return configs[id]||configs.lightminimal}
