const AGENTS=[
{id:'orbit',name:'ORBIT',role:'Studio lead',emoji:'🪐',color:'#58d5ff',specialty:'Planning & workflow',desc:'Keeps the content crew organized from the first idea to the final publish.'},
{id:'pixel',name:'PIXEL',role:'Video editor',emoji:'🎬',color:'#ff83b7',specialty:'Editing & motion',desc:'Owns editing briefs, pacing, captions, audio, thumbnails, and visual polish.'},
{id:'echo',name:'ECHO',role:'Social manager',emoji:'📣',color:'#66e6ba',specialty:'Publishing & captions',desc:'Prepares platform-specific captions, publishing checklists, and content schedules.'},
{id:'byte',name:'BYTE',role:'Script & tools',emoji:'💻',color:'#b7a0ff',specialty:'Scripts & automation',desc:'Organizes scripts, production templates, naming systems, and creator tools.'},
{id:'scout',name:'SCOUT',role:'Trend researcher',emoji:'🔎',color:'#ffd178',specialty:'Trends & analytics',desc:'Collects content ideas, researches trends, and helps interpret performance data.'}
];
const CHANNELS=['TikTok','YouTube','Facebook','Instagram'];
const STATUSES=['Idea','Scripting','Editing','Blocked','Ready','Scheduled','Published'];
const SEED_TASKS=[
{id:1,title:'Draft 3 hooks for a TikTok Short',agent:'scout',channel:'TikTok',status:'Editing',priority:'High',due:dayOffset(0),notes:'Keep the hook under three seconds.',created:Date.now()-3500000},
{id:2,title:'Edit captions and pacing for a Short',agent:'pixel',channel:'YouTube',status:'Editing',priority:'Medium',due:dayOffset(1),notes:'Add readable captions and tighten pauses.',created:Date.now()-1800000},
{id:3,title:'Prepare Instagram Reels caption',agent:'echo',channel:'Instagram',status:'Scripting',priority:'Medium',due:dayOffset(2),notes:'Write a short caption and call to action.',created:Date.now()-900000},
{id:4,title:'Review weekly content ideas',agent:'orbit',channel:'Facebook',status:'Published',priority:'Low',due:dayOffset(-1),notes:'Demo item to show the completed state.',created:Date.now()-6500000}
];
function dayOffset(n){const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
const SEED_PROJECTS=[{id:101,name:'Daily Shorts Engine',channel:'YouTube',goal:'Build a repeatable Shorts workflow',status:'Active',due:dayOffset(7)},{id:102,name:'TikTok Experiments',channel:'TikTok',goal:'Test hooks and short formats',status:'Planning',due:dayOffset(12)},{id:103,name:'Cross-platform Repurpose',channel:'Instagram',goal:'Adapt one source video for each channel',status:'Active',due:dayOffset(18)}];
const SEED_LOGS=[{text:'Creator Office workspace initialized',time:Date.now()-7200000},{text:'SCOUT added a TikTok hook research task',time:Date.now()-3500000}];
const $=id=>document.getElementById(id);
const safeLoad=(key,fallback)=>{try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback}catch{return fallback}};
let tasks=safeLoad('bv.creator.tasks',safeLoad('botverse.tasks',SEED_TASKS));
let projects=safeLoad('bv.creator.projects',SEED_PROJECTS);
let logs=safeLoad('bv.creator.logs',safeLoad('botverse.activity',SEED_LOGS));
tasks=tasks.map(t=>({...t,status:({'pending':'Idea','running':'Editing','completed':'Published','failed':'Idea'}[t.status]||t.status),channel:CHANNELS.includes(t.channel)?t.channel:(t.channel==='General'?'General':'TikTok'),priority:t.priority||'Medium',due:t.due||dayOffset(1),created:t.created||Date.now()}));
let selectedAgent='orbit',taskFilter='all',calendarDate=new Date(),editingTaskId=null,editingProjectId=null;
const agent=id=>AGENTS.find(a=>a.id===id)||AGENTS[0];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const prettyDate=s=>{if(!s)return 'No date';const d=new Date(s+'T12:00:00');return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})};
const age=t=>{const m=Math.max(0,Math.floor((Date.now()-t)/60000));return m<1?'just now':m<60?m+'m ago':Math.floor(m/60)+'h ago'};
function save(){try{localStorage.setItem('bv.creator.tasks',JSON.stringify(tasks));localStorage.setItem('bv.creator.projects',JSON.stringify(projects));localStorage.setItem('bv.creator.logs',JSON.stringify(logs))}catch{toast('Browser storage is full. Export your data and remove old items.')}}
function log(text){logs.unshift({text,time:Date.now()});logs=logs.slice(0,120);save();renderLogs()}
function toast(text){const el=$('toast');el.textContent=text;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2400)}
function statusClass(s){return s==='Published'?'completed':s==='Blocked'?'failed':s==='Ready'||s==='Scheduled'?'scheduled':s==='Idea'?'pending':'running'}
function taskHtml(t){return '<article class="task"><button class="check '+(t.status==='Published'?'done':'')+'" data-task-action="advance" data-id="'+t.id+'" title="Advance workflow">'+(t.status==='Published'?'✓':'›')+'</button><div><b>'+esc(t.title)+'</b><small>'+agent(t.agent).emoji+' '+agent(t.agent).name+' · '+esc(t.channel)+' · Due '+prettyDate(t.due)+'</small></div><div style="display:flex;gap:5px;align-items:center"><span class="task-status '+statusClass(t.status)+'">'+esc(t.status)+'</span><span class="task-actions"><button data-task-action="edit" data-id="'+t.id+'" title="Edit task">✎</button><button data-task-action="delete" data-id="'+t.id+'" title="Delete task">×</button></span></div></article>'}
function kanbanHtml(t){return '<article class="kanban-item"><b>'+esc(t.title)+'</b><p>'+esc(t.channel)+' · '+agent(t.agent).emoji+' '+agent(t.agent).name+'</p><div class="toolbar"><span class="pill">'+esc(t.priority||'Medium')+'</span><button class="btn" style="padding:4px 6px;font-size:10px" data-task-action="edit" data-id="'+t.id+'">Edit</button></div></article>'}
function renderTasks(){const shown=taskFilter==='all'?tasks:tasks.filter(t=>t.status===taskFilter);$('runningCount').textContent=tasks.filter(t=>['Scripting','Editing'].includes(t.status)).length;$('doneCount').textContent=tasks.filter(t=>t.status==='Published').length;$('allTasks').innerHTML=shown.map(taskHtml).join('')||'<div class="empty">No content in this filter yet. Create a task to get started.</div>';$('overviewTasks').innerHTML=tasks.slice().sort((a,b)=>new Date(a.due||'9999-12-31')-new Date(b.due||'9999-12-31')).slice(0,4).map(taskHtml).join('')||'<div class="empty">No tasks yet.</div>';$('navTaskCount').textContent=tasks.filter(t=>t.status!=='Published').length;$('filterStatus').value=taskFilter;
$('kanban').innerHTML=STATUSES.map(s=>'<section class="kanban-col" data-column-status="'+s+'"><div class="kanban-head"><span>'+s.toUpperCase()+'</span><span class="pill">'+tasks.filter(t=>t.status===s).length+'</span></div>'+tasks.filter(t=>t.status===s).map(kanbanHtml).join('')+'</section>').join('')
function renderAgents(){const teamHtml=a=>{const state=agentWorkState(a.id);return '<div class="team-row" data-agent-pick="'+a.id+'" data-work-state="'+state.label.toLowerCase().replace(/\s+/g,'-')+'"><div class="mini-buddy" style="color:'+a.color+'">'+a.emoji+'</div><div class="team-info"><b>'+a.name+'</b><small>'+a.role+'</small></div><span class="status">● '+state.label+'</span></div>'};$('teamList').innerHTML=AGENTS.map(teamHtml).join('');$('agentCards').innerHTML=AGENTS.map(a=>'<article class="agent-card" data-agent-pick="'+a.id+'"><div style="font-size:34px">'+a.emoji+'</div><h3>'+a.name+'</h3><span class="muted small">'+a.role+'</span><p>'+a.desc+'</p><div class="detail"><span>Specialty</span><b>'+a.specialty+'</b></div><div class="detail"><span>Assigned tasks</span><b>'+tasks.filter(t=>t.agent===a.id).length+'</b></div><button class="btn" style="width:100%;margin-top:8px" data-agent-pick="'+a.id+'">Select teammate</button></article>').join('');$('taskAgent').innerHTML=AGENTS.map(a=>'<option value="'+a.id+'">'+a.name+' — '+a.role+'</option>').join('')}
function selectAgent(id){selectedAgent=id;const a=agent(id),state=agentWorkState(id);$('profileName').textContent=a.name;$('profileRole').textContent=a.role+' · '+state.label;$('profileEmoji').textContent=a.emoji;$('profileTitle').textContent=a.specialty;$('profileDesc').textContent=a.desc;$('profileTasks').textContent=tasks.filter(t=>t.agent===id).length;$('profileSpecLine').textContent=state.label;if($('profileStatus'))$('profileStatus').textContent='● '+state.label;$('taskAgent').value=id;if($('cubeBotEmoji'))$('cubeBotEmoji').textContent=a.emoji;if($('cubeBotName'))$('cubeBotName').textContent=a.name;if($('cubeBotRole'))$('cubeBotRole').textContent=a.role+' · '+state.label;if($('cubeBotDetail'))$('cubeBotDetail').textContent=state.detail;document.querySelectorAll('.bot-char').forEach(b=>b.classList.toggle('selected',b.dataset.agent===id))}
function renderOfficePreviews(){
 const projectTarget=$('officeProjects'),scheduleTarget=$('officeSchedule');
 if(projectTarget)projectTarget.innerHTML=projects.slice(0,4).map(p=>'<article class="office-project-row"><div class="project-mark">'+(p.channel==='YouTube'?'▶':p.channel==='TikTok'?'♪':p.channel==='Instagram'?'◎':'✦')+'</div><div class="office-preview-copy"><b>'+esc(p.name)+'</b><small>'+esc(p.channel)+' · '+esc(p.status||'Planning')+'</small></div><span class="office-preview-date">'+prettyDate(p.due)+'</span></article>').join('')||'<div class="empty">Create a project to see it here.</div>';
 const upcoming=tasks.filter(t=>t.status!=='Published').slice().sort((a,b)=>String(a.due||'9999').localeCompare(String(b.due||'9999'))).slice(0,4);
 if(scheduleTarget)scheduleTarget.innerHTML=upcoming.map(t=>'<article class="office-schedule-row"><span class="schedule-marker"></span><div class="schedule-date">'+prettyDate(t.due)+'</div><div class="office-preview-copy"><b>'+esc(t.title)+'</b><small>'+esc(t.channel)+' · '+agent(t.agent).name+'</small></div><span class="task-status '+statusClass(t.status)+'">'+esc(t.status)+'</span></article>').join('')||'<div class="empty">No upcoming deadlines. Add a task to plan the next step.</div>';
}
function renderProjects(){renderOfficePreviews();$('projectCards').innerHTML=projects.map(p=>'<article class="project-card"><div class="toolbar" style="justify-content:space-between"><span class="pill">'+esc(p.channel)+'</span><span class="pill">'+esc(p.status)+'</span></div><h3>'+esc(p.name)+'</h3><p>'+esc(p.goal||'No project description yet.')+'</p><div class="detail"><span>Target date</span><b>'+prettyDate(p.due)+'</b></div><div class="detail"><span>Related tasks</span><b>'+tasks.filter(t=>String(t.projectId)===String(p.id)).length+'</b></div><div class="toolbar" style="margin-top:10px"><button class="btn" data-project-action="edit" data-id="'+p.id+'">Edit</button><button class="btn danger" data-project-action="delete" data-id="'+p.id+'">Delete</button></div></article>').join('')||'<div class="empty">No projects yet. Create your first content campaign.</div>'}
function renderCalendar(){const y=calendarDate.getFullYear(),m=calendarDate.getMonth();$('calendarTitle').textContent=calendarDate.toLocaleDateString(undefined,{month:'long',year:'numeric'});const first=new Date(y,m,1),start=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate(),prevDays=new Date(y,m,0).getDate();let html=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>'<div class="calendar-dayname">'+d+'</div>').join('');for(let i=0;i<42;i++){let day=i-start+1,date,inside=true;if(day<1){date=new Date(y,m-1,prevDays+day);inside=false}else if(day>days){date=new Date(y,m+1,day-days);inside=false}else date=new Date(y,m,day);const iso=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');const today=iso===dayOffset(0);const dayTasks=tasks.filter(t=>t.due===iso);html+='<button class="calendar-cell '+(!inside?'outside ':'')+(today?'today':'')+'" data-calendar-date="'+iso+'"><span class="daynum">'+date.getDate()+'</span>'+dayTasks.slice(0,2).map(t=>'<span class="calendar-chip '+(t.status==='Published'?'published':t.status==='Scheduled'?'scheduled':'')+'">'+esc(t.channel)+': '+esc(t.title)+'</span>').join('')+(dayTasks.length>2?'<span class="muted" style="font-size:9px">+'+(dayTasks.length-2)+' more</span>':'')+'</button>'} $('calendarGrid').innerHTML=html}
function renderLogs(){$('activityList').innerHTML=logs.map(l=>'<article class="task"><span style="color:var(--blue)">✦</span><div><b>'+esc(l.text)+'</b><small>'+age(l.time)+'</small></div></article>').join('')||'<div class="empty">No activity recorded.</div>'}
function renderAnalytics(){const published=tasks.filter(t=>t.status==='Published').length,open=tasks.filter(t=>t.status!=='Published').length,ready=tasks.filter(t=>['Ready','Scheduled'].includes(t.status)).length;$('analyticsStats').innerHTML=[['Total content',tasks.length,'Across all channels'],['Published',published,'Marked as published'],['In production',open,'Still in workflow'],['Ready to post',ready,'Ready or scheduled']].map(x=>'<div class="stat"><div class="stat-label">'+x[0]+'</div><div class="stat-num">'+x[1]+'</div><div class="stat-note">'+x[2]+'</div></div>').join('');$('analyticsStats2').innerHTML=$('analyticsStats').innerHTML;$('channelBars').innerHTML=CHANNELS.map(ch=>{const n=tasks.filter(t=>t.channel===ch).length,p=tasks.length?Math.round(n/tasks.length*100):0;return '<div class="barrow"><span>'+ch+'</span><div class="bartrack"><div class="barfill" style="width:'+p+'%"></div></div><b>'+n+'</b></div>'}).join('');$('channelBars2').innerHTML=$('channelBars').innerHTML;const weekly=[6,8,5,10,7,12,Math.max(2,tasks.length)];$('weeklyChart').innerHTML=weekly.map((n,i)=>'<div class="chart-col"><div class="chart-bar" style="height:'+Math.min(100,n*7)+'%"></div><small>'+['M','T','W','T','F','S','S'][i]+'</small></div>').join('');$('weeklyChart2').innerHTML=$('weeklyChart').innerHTML;$('dashboardTasks').innerHTML=tasks.slice(0,5).map(taskHtml).join('')||'<div class="empty">No content yet.</div>'}
function agentWorkState(id){
 const assigned=tasks.filter(t=>t.agent===id);
 if(!assigned.length)return {label:'Idle',detail:'No tasks assigned'};
 const blocked=assigned.find(t=>t.status==='Blocked');
 if(blocked)return {label:'Blocked',detail:blocked.title};
 const active=assigned.find(t=>['Scripting','Editing'].includes(t.status));
 if(active)return {label:'Working',detail:active.title};
 const review=assigned.find(t=>t.status==='Ready');
 if(review)return {label:'Needs review',detail:review.title};
 const scheduled=assigned.find(t=>t.status==='Scheduled');
 if(scheduled)return {label:'Scheduled',detail:scheduled.title};
 const open=assigned.find(t=>t.status==='Idea');
 if(open)return {label:'Assigned',detail:open.title};
 if(assigned.every(t=>t.status==='Published'))return {label:'Completed',detail:'All assigned tasks are published'};
 return {label:'Idle',detail:'Waiting for next task'};
}
function refreshWorkflowStats(){
 const active=tasks.filter(t=>['Scripting','Editing'].includes(t.status)).length;
 const published=tasks.filter(t=>t.status==='Published').length;
 const el=$('runningCount');if(el)el.textContent=active;
 const done=$('doneCount');if(done)done.textContent=published;
}
function renderAgentStates(){
 document.querySelectorAll('#teamList .team-row[data-agent-pick]').forEach(row=>{
  const state=agentWorkState(row.dataset.agentPick),badge=row.querySelector('.status');
  row.dataset.workState=state.label.toLowerCase().replace(/\s+/g,'-');
  if(badge)badge.textContent='● '+state.label;
  row.title=state.detail;
 });
 document.querySelectorAll('.bot-char[data-agent]').forEach(bot=>{
  const state=agentWorkState(bot.dataset.agent);
  bot.dataset.workState=state.label.toLowerCase().replace(/\s+/g,'-');
  bot.title=agent(bot.dataset.agent).name+' — '+state.label+': '+state.detail;
 });
 const selected=agentWorkState(selectedAgent);
 const profile=document.querySelector('#page-agents .agent-card[data-agent-pick="'+selectedAgent+'"]');
 if(profile)profile.dataset.workState=selected.label.toLowerCase().replace(/\s+/g,'-');
}
function render(){renderTasks();renderAgents();renderAgentStates();renderProjects();renderCalendar();renderLogs();renderAnalytics();selectAgent(selectedAgent);renderAgentStates();refreshWorkflowStats()}
const PAGE_INFO={office:['Creator Office ✨','One little AI crew. All your content channels.'],dashboard:['Creator Dashboard','Your content operation at a glance.'],calendar:['Content Calendar','Plan publishing dates and see what is coming up.'],pipeline:['Production Pipeline','Move every idea from scripting to published.'],projects:['Projects & Campaigns','Group content work into campaigns and recurring series.'],agents:['AI Team','Five friendly specialist bots for your creator company.'],analytics:['Content Analytics','A local overview of your content plan, not live platform metrics.'],activity:['Activity Log','Recent changes saved in this browser.'],settings:['Workspace Settings','Manage your local workspace and export your data.']};
function goPage(page){document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id==='page-'+page));document.querySelectorAll('.nav [data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===page));$('pageTitle').textContent=PAGE_INFO[page][0];$('pageSubtitle').textContent=PAGE_INFO[page][1];$('sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'})}
function openTask(prefill='',assignee=selectedAgent){editingTaskId=null;$('taskFormTitle').textContent='Create content task';$('taskSubmit').textContent='Add to pipeline';$('taskTitle').value=prefill;$('taskAgent').value=assignee;$('taskChannel').value='TikTok';$('taskStatus').value='Idea';$('taskPriority').value='Medium';$('taskDue').value=dayOffset(1);$('taskNotes').value='';$('taskProject').innerHTML='<option value="">No project</option>'+projects.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('');$('taskModal').classList.add('open');setTimeout(()=>$('taskTitle').focus(),40)}
function editTask(id){const t=tasks.find(x=>String(x.id)===String(id));if(!t)return;openTask();editingTaskId=id;$('taskFormTitle').textContent='Edit content task';$('taskSubmit').textContent='Save changes';$('taskTitle').value=t.title;$('taskAgent').value=t.agent;$('taskChannel').value=t.channel;$('taskStatus').value=t.status;$('taskPriority').value=t.priority||'Medium';$('taskDue').value=t.due||dayOffset(1);$('taskNotes').value=t.notes||'';$('taskProject').value=t.projectId||''}
async function submitTask(e){e.preventDefault();const title=$('taskTitle').value.trim();if(!title)return;const rawProject=$('taskProject').value;const data={title,agent:$('taskAgent').value,channel:$('taskChannel').value,status:$('taskStatus').value,priority:$('taskPriority').value,due:$('taskDue').value,notes:$('taskNotes').value.trim(),projectId:rawProject?( /^[0-9]+$/.test(rawProject)?Number(rawProject):rawProject):null};if(apiWriteThrough){try{readApiForm();const response=await apiRequest(editingTaskId?'/api/tasks/'+encodeURIComponent(editingTaskId):'/api/tasks',{method:editingTaskId?'PATCH':'POST',body:JSON.stringify(data)});const saved=response.data;if(editingTaskId)tasks=tasks.map(t=>String(t.id)===String(editingTaskId)?{...saved,created:saved.created?new Date(saved.created).getTime():Date.now()}:t);else tasks.unshift({...saved,created:saved.created?new Date(saved.created).getTime():Date.now()});}catch(err){toast('API save failed: '+(err.message||'request error'));return}}else if(editingTaskId){const existing=tasks.find(t=>String(t.id)===String(editingTaskId));if(existing)Object.assign(existing,data);log('Updated content: '+title)}else{tasks.unshift({id:Date.now()+Math.floor(Math.random()*999),...data,created:Date.now()});log('Added content task: '+title+' → '+agent(data.agent).name)}save();$('taskModal').classList.remove('open');render();toast(editingTaskId?'Changes saved':'Added to production pipeline');editingTaskId=null}
async function advanceTask(id){const t=tasks.find(x=>String(x.id)===String(id));if(!t)return;const transitions={Idea:'Scripting',Scripting:'Editing',Editing:'Ready',Blocked:'Scripting',Ready:'Scheduled',Scheduled:'Published',Published:'Idea'};const next=transitions[t.status]||'Scripting';if(apiWriteThrough){try{readApiForm();const r=await apiRequest('/api/tasks/'+encodeURIComponent(t.id),{method:'PATCH',body:JSON.stringify({status:next})});Object.assign(t,r.data,{created:r.data.created?new Date(r.data.created).getTime():Date.now()})}catch(err){toast('API update failed: '+(err.message||'request error'));return}}else t.status=next;log('Moved \"'+t.title+'\" to '+t.status);save();render();toast('Moved to '+t.status)}
function openProject(id=null){editingProjectId=id;const p=projects.find(x=>String(x.id)===String(id));$('projectFormTitle').textContent=p?'Edit project':'Create project';$('projectName').value=p?.name||'';$('projectChannel').value=p?.channel||'YouTube';$('projectStatus').value=p?.status||'Planning';$('projectDue').value=p?.due||dayOffset(14);$('projectGoal').value=p?.goal||'';$('projectModal').classList.add('open')}
async function submitProject(e){e.preventDefault();const data={name:$('projectName').value.trim(),channel:$('projectChannel').value,status:$('projectStatus').value,due:$('projectDue').value,goal:$('projectGoal').value.trim()};if(!data.name)return;if(apiWriteThrough){try{readApiForm();const r=await apiRequest(editingProjectId?'/api/projects/'+encodeURIComponent(editingProjectId):'/api/projects',{method:editingProjectId?'PATCH':'POST',body:JSON.stringify(data)});const saved=r.data;if(editingProjectId)projects=projects.map(p=>String(p.id)===String(editingProjectId)?{...saved,created:saved.created?new Date(saved.created).getTime():Date.now()}:p);else projects.unshift({...saved,created:saved.created?new Date(saved.created).getTime():Date.now()})}catch(err){toast('API save failed: '+(err.message||'request error'));return}}else if(editingProjectId){const existing=projects.find(p=>String(p.id)===String(editingProjectId));if(existing)Object.assign(existing,data);log('Updated project: '+data.name)}else{projects.unshift({id:Date.now(),...data});log('Created project: '+data.name)}save();$('projectModal').classList.remove('open');render();toast('Project saved')}
function exportData(){const data={schemaVersion:1,exportedAt:new Date().toISOString(),tasks,projects,logs};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='botverse-creator-workspace.json';a.click();URL.revokeObjectURL(url);toast('Workspace exported as JSON')}
function importData(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const d=JSON.parse(reader.result);if(!Array.isArray(d.tasks)||!Array.isArray(d.projects))throw new Error('Invalid workspace file');tasks=d.tasks;projects=d.projects;logs=Array.isArray(d.logs)?d.logs:[];save();render();toast('Workspace imported')}catch{toast('Could not import: invalid BOTVERSE JSON')}$('importFile').value=''};reader.readAsText(file)}
document.addEventListener('click',async e=>{
 const nav=e.target.closest('[data-page]');if(nav){goPage(nav.dataset.page);return}
 const pick=e.target.closest('[data-agent-pick],.bot-char');if(pick){const id=pick.dataset.agentPick||pick.dataset.agent;selectAgent(id);toast(agent(id).name+' selected');return}
 const ta=e.target.closest('[data-task-action]');if(ta){const id=ta.dataset.id;if(ta.dataset.taskAction==='edit'){editTask(id);return}if(ta.dataset.taskAction==='advance'){advanceTask(id);return}const t=tasks.find(x=>String(x.id)===String(id));if(t&&confirm('Delete "'+t.title+'"?')){if(apiWriteThrough){try{readApiForm();await apiRequest('/api/tasks/'+encodeURIComponent(t.id),{method:'DELETE'})}catch(err){toast('API delete failed: '+(err.message||'request error'));return}}tasks=tasks.filter(x=>String(x.id)!==String(id));log('Deleted task: '+t.title);save();render()}return}
 const pa=e.target.closest('[data-project-action]');if(pa){const id=pa.dataset.id,p=projects.find(x=>String(x.id)===String(id));if(pa.dataset.projectAction==='edit')openProject(id);else if(p&&confirm('Delete project "'+p.name+'"? Tasks will remain in your pipeline.')){if(apiWriteThrough){try{readApiForm();await apiRequest('/api/projects/'+encodeURIComponent(p.id),{method:'DELETE'})}catch(err){toast('API delete failed: '+(err.message||'request error'));return}}projects=projects.filter(x=>String(x.id)!==String(id));tasks.forEach(t=>{if(String(t.projectId)===String(id))t.projectId=null});log('Deleted project: '+p.name);save();render()}return}
 const cal=e.target.closest('[data-calendar-date]');if(cal){openTask('',selectedAgent);$('taskDue').value=cal.dataset.calendarDate;return}
});
$('newTaskBtn').addEventListener('click',()=>openTask());$('boardNewTask').addEventListener('click',()=>openTask());$('assignBtn').addEventListener('click',()=>openTask('',selectedAgent));$('taskForm').addEventListener('submit',submitTask);$('cancelTask').addEventListener('click',()=>$('taskModal').classList.remove('open'));$('taskModal').addEventListener('click',e=>{if(e.target===$('taskModal'))$('taskModal').classList.remove('open')});
$('newProjectBtn').addEventListener('click',()=>openProject());$('projectForm').addEventListener('submit',submitProject);$('cancelProject').addEventListener('click',()=>$('projectModal').classList.remove('open'));$('projectModal').addEventListener('click',e=>{if(e.target===$('projectModal'))$('projectModal').classList.remove('open')});
$('filterStatus').addEventListener('change',e=>{taskFilter=e.target.value;renderTasks()});$('commandSend').addEventListener('click',()=>{const input=$('commandInput'),v=input.value.trim();if(!v){input.focus();return}tasks.unshift({id:Date.now(),title:v,agent:selectedAgent,channel:'TikTok',status:'Idea',priority:'Medium',due:dayOffset(1),notes:'',created:Date.now()});input.value='';log('Quick task created: '+v);save();render();toast('Added as a new content idea')});$('commandInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('commandSend').click()});
$('menuBtn').addEventListener('click',()=>$('sidebar').classList.toggle('open'));$('exportBtn').addEventListener('click',exportData);$('exportSettings').addEventListener('click',exportData);$('importBtn').addEventListener('click',()=>$('importFile').click());$('importFile').addEventListener('change',e=>importData(e.target.files[0]));
$('clearActivity').addEventListener('click',()=>{if(confirm('Clear all activity entries?')){logs=[];save();renderLogs();toast('Activity cleared')}});
$('saveSettings').addEventListener('click',()=>{const name=$('workspaceName').value.trim()||'BOTVERSE Creator Office';localStorage.setItem('bv.creator.name',name);toast('Workspace name saved in this browser')});
$('resetDemo').addEventListener('click',()=>{if(confirm('Reset local tasks, projects, and activity to demo data?')){tasks=SEED_TASKS.map(t=>({...t}));projects=SEED_PROJECTS.map(p=>({...p}));logs=SEED_LOGS.map(l=>({...l}));save();render();toast('Demo data reset')}});
$('prevMonth').addEventListener('click',()=>{calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()-1,1);renderCalendar()});$('nextMonth').addEventListener('click',()=>{calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()+1,1);renderCalendar()});$('todayMonth').addEventListener('click',()=>{calendarDate=new Date();renderCalendar()});
let apiSession={baseUrl:'',token:'',workspaceId:'default'};
let apiWriteThrough=false;
$('apiWriteThrough')?.addEventListener('change',e=>{apiWriteThrough=e.target.checked;if(apiWriteThrough){try{readApiForm();toast('API write-through enabled for this page session')}catch(err){apiWriteThrough=false;e.target.checked=false;toast(err.message)}}else toast('API write-through disabled')});
function apiHeaders(){return {'Authorization':'Bearer '+apiSession.token,'X-Workspace-Id':apiSession.workspaceId,'Accept':'application/json'}}
async function apiRequest(path,options={}){const base=apiSession.baseUrl.endsWith('/')?apiSession.baseUrl.slice(0,-1):apiSession.baseUrl;const response=await fetch(base+path,{...options,headers:{...apiHeaders(),...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});let payload=null;if(response.status!==204){try{payload=await response.json()}catch{payload=null}}if(!response.ok)throw new Error(payload?.error?.message||'API request failed ('+response.status+')');return payload}
function readApiForm(){const raw=$('apiBaseUrl').value.trim();const base=raw.endsWith('/')?raw.slice(0,-1):raw;const token=$('apiToken').value.trim();const workspaceId=$('apiWorkspace').value.trim()||'default';if(!(base.startsWith('https://')||base.startsWith('http://')))throw new Error('Masukkan URL API yang valid (https://...).');if(!token||token.length<32)throw new Error('Token API harus minimal 32 karakter.');if(!/^[a-zA-Z0-9_-]{1,64}$/.test(workspaceId))throw new Error('Workspace ID hanya boleh huruf, angka, _ dan -.');apiSession={baseUrl:base,token,workspaceId}}
async function testApiConnection(){const status=$('apiStatus');status.textContent='Testing…';try{readApiForm();const r=await fetch(apiSession.baseUrl+'/api/health',{headers:{'Accept':'application/json'}});const data=await r.json();if(!r.ok||!data.ok)throw new Error(data?.error?.message||'API health check failed');await apiRequest('/api/tasks?limit=1');status.textContent='Connected · '+data.service;toast('API connection successful')}catch(err){status.textContent='Connection failed';toast(err.message||'Could not connect to API')}}
async function loadApiWorkspace(){const status=$('apiStatus');status.textContent='Loading…';try{readApiForm();const [taskResult,projectResult,activityResult]=await Promise.all([apiRequest('/api/tasks?limit=250'),apiRequest('/api/projects'),apiRequest('/api/activity')]);if(!confirm('Replace local task and project lists with '+taskResult.data.length+' server tasks and '+projectResult.data.length+' server projects? Existing local data remains in this browser backup only.')){status.textContent='Cancelled';return}tasks=taskResult.data.map(t=>({...t,id:String(t.id),created:t.created?new Date(t.created).getTime():Date.now(),projectId:t.projectId?String(t.projectId):null}));projects=projectResult.data.map(p=>({...p,id:String(p.id),created:p.created?new Date(p.created).getTime():Date.now()}));logs=activityResult.data.map(l=>({...l,time:new Date(l.time).getTime()}));save();render();status.textContent='Loaded · '+tasks.length+' tasks / '+projects.length+' projects';toast('Loaded workspace data from API')}catch(err){status.textContent='Load failed';toast(err.message||'Could not load API data')}}
$('testApi').addEventListener('click',testApiConnection);$('loadApiData').addEventListener('click',loadApiWorkspace);
async function runAiAgent(){
 const button=$('runAiAgent'),status=$('aiAgentStatus'),result=$('aiAgentResult');
 const prompt=$('aiAgentPrompt').value.trim(),agentId=$('aiAgentSelect').value;
 if(!prompt){$('aiAgentPrompt').focus();toast('Write a task for the agent first');return}
 status.textContent='Running agent…';button.disabled=true;result.hidden=true;result.textContent='';
 try{
  readApiForm();
  const response=await apiRequest('/api/agents/run',{method:'POST',body:JSON.stringify({agent:agentId,prompt})});
  result.textContent=response.data.answer;result.hidden=false;
  status.textContent=response.data.model+' · generated '+new Date(response.data.generatedAt).toLocaleTimeString();
  toast('Agent response ready');
 }catch(err){
  status.textContent='Agent unavailable';
  result.textContent=err.message||'Could not run the agent.';
  result.hidden=false;
  toast('Agent request did not complete');
 }finally{button.disabled=false}
}

$('runAiAgent')?.addEventListener('click',runAiAgent);

async function refreshJobs(){
 const status=$('queueStatus'),list=$('jobList');status.textContent='Loading queue…';list.textContent='';
 try{
  readApiForm();
  const response=await apiRequest('/api/jobs?limit=100');
  const jobs=response.data||[];
  status.textContent=jobs.length+' jobs';
  list.innerHTML=jobs.map(job=>'<article class="task"><div><b>'+esc(job.kind)+' · '+esc(job.status)+'</b><small>'+esc(job.created?new Date(job.created).toLocaleString():'Recently created')+(job.lastError?' · '+esc(job.lastError):'')+'</small></div><div class="task-actions">'+(job.status==='queued'||job.status==='failed'?'<button class="btn" data-job-cancel="'+esc(job.id)+'">Cancel</button>':'')+'</div></article>').join('')||'<div class="empty">Queue is empty.</div>';
 }catch(err){status.textContent='Queue unavailable';list.textContent=err.message||'Could not load jobs.'}
}
async function enqueueDraft(){
 const status=$('queueStatus'),prompt=$('queuePrompt').value.trim(),agentId=$('aiAgentSelect').value;
 if(!prompt){toast('Enter a prompt for the queued draft');return}
 status.textContent='Queueing…';
 try{
  readApiForm();
  const response=await apiRequest('/api/jobs',{method:'POST',body:JSON.stringify({kind:'agent_draft',payload:{agent:agentId,prompt}})});
  $('queuePrompt').value='';
  status.textContent='Queued · '+response.data.id;
  toast('Agent draft added to queue');
  await refreshJobs();
 }catch(err){status.textContent='Could not queue';toast(err.message||'Queue request failed')}
}
async function checkIntegrations(){
 const status=$('integrationStatus'),list=$('integrationList');status.textContent='Checking…';list.textContent='';
 try{
  readApiForm();
  const response=await apiRequest('/api/integrations/status');
  const platforms=response.data.platforms||[];
  list.innerHTML=platforms.map(p=>'<article class="task"><div><b>'+esc(p.name)+' · '+(p.configured?'App metadata configured':'Not configured')+'</b><small>'+esc(p.note)+'</small></div><span class="task-status pending">Not connected</span></article>').join('');
  status.textContent='Live publishing disabled';
 }catch(err){status.textContent='Check failed';list.textContent=err.message||'Could not check integration status.'}
}
$('refreshJobs')?.addEventListener('click',refreshJobs);
$('enqueueDraft')?.addEventListener('click',enqueueDraft);
$('checkIntegrations')?.addEventListener('click',checkIntegrations);
$('jobList')?.addEventListener('click',async e=>{
 const button=e.target.closest('[data-job-cancel]');if(!button)return;
 try{readApiForm();await apiRequest('/api/jobs/'+encodeURIComponent(button.dataset.jobCancel),{method:'PATCH',body:JSON.stringify({status:'cancelled'})});toast('Job cancelled');await refreshJobs()}
 catch(err){toast(err.message||'Could not cancel job')}
});


$('workspaceName').value=safeLoad('bv.creator.name','BOTVERSE Creator Office');render();


// Interactive office scene controls — presentation-only, no external services required.
(function initOfficeScene(){
 const world=document.getElementById('world');
 const view=document.getElementById('sceneViewBtn');
 const lights=document.getElementById('sceneLightBtn');
 const motion=document.getElementById('sceneMotionBtn');
 const zoom=document.getElementById('sceneZoomBtn');
 if(!world||!view||!lights||!motion||!zoom)return;
 view.addEventListener('click',()=>{
   const top=world.classList.toggle('scene-top-view');
   view.classList.toggle('active',!top);
   view.textContent=top?'▦ Top view':'◈ Isometric';
   world.style.transform=top?'perspective(1100px) rotateX(0deg) scale(1.02)':'';
   toast(top?'Top view enabled':'Isometric view enabled');
 });
 lights.addEventListener('click',()=>{
   const off=world.classList.toggle('scene-lights-off');
   lights.classList.toggle('active',!off);
   lights.textContent=off?'☾ Ambient':'☼ Lights';
   toast(off?'Ambient lighting':'Neon lights enabled');
 });
 motion.addEventListener('click',()=>{
   const off=world.classList.toggle('scene-motion-off');
   motion.classList.toggle('active',!off);
   motion.textContent=off?'▷ Motion paused':'▶ Idle motion';
   toast(off?'Office animation paused':'Office animation running');
 });
 zoom.addEventListener('click',()=>{
   const enlarged=world.classList.toggle('scene-zoomed');
   zoom.classList.toggle('active',enlarged);
   zoom.textContent=enlarged?'− Zoom out':'＋ Zoom';
 });
 world.querySelectorAll('.bot-char').forEach((button,index)=>{
   button.addEventListener('click',()=>{
     world.querySelectorAll('.bot-char').forEach(b=>b.classList.remove('selected'));
     button.classList.add('selected');
     button.style.zIndex='8';
     world.querySelectorAll('.bot-char').forEach(b=>{if(b!==button)b.style.zIndex='7'});
     world.style.setProperty('--selected-bot',button.style.getPropertyValue('--bot'));
   });
 });
})();


// Cube-office interactions: select human teammates, inspect rooms, and jump to task management.
(function initCubeOffice(){
 const world=$('world'); if(!world)return;
 const info={orbit:{emoji:'🧑🏻‍💼',name:'ORBIT',role:'Studio lead',detail:'Planning & workflow'},pixel:{emoji:'👩🏻‍🎨',name:'PIXEL',role:'Video editor',detail:'Editing, motion, captions and visual polish'},echo:{emoji:'👩🏽‍💻',name:'ECHO',role:'Social manager',detail:'Captions, publishing checklists and content schedule'},byte:{emoji:'👨🏻‍💻',name:'BYTE',role:'Script & tools',detail:'Scripts, automation and creator tools'},scout:{emoji:'🧑🏽‍🔬',name:'SCOUT',role:'Trend researcher',detail:'Researches ideas and content trends'}};
 const card=$('cubeBotCard');
 function selectBot(button){
   const id=button.dataset.agent, bot=info[id]||info.orbit;
   world.querySelectorAll('.bot-char').forEach(b=>{b.classList.toggle('selected',b===button);b.style.zIndex=b===button?'8':'7'});
   const state=agentWorkState(id);
   $('cubeBotEmoji').textContent=bot.emoji;$('cubeBotName').textContent=bot.name;$('cubeBotRole').textContent=bot.role;
   $('cubeBotDetail').textContent=state.label+' · '+state.detail;
   card.hidden=false;
   selectedAgent=id;
   selectAgent(id);
   renderAgentStates();
 }
 world.querySelectorAll('.bot-char').forEach(button=>button.addEventListener('click',()=>selectBot(button)));
 world.querySelectorAll('.cube-room-tag').forEach(tag=>tag.addEventListener('click',()=>{
   world.querySelectorAll('.cube-room-tag').forEach(t=>t.classList.toggle('active',t===tag));
   const room=tag.dataset.room;
   world.querySelectorAll('.hybrid-room').forEach(r=>r.style.filter='');
   if(room==='creative'){world.querySelector('.creative-zone').style.filter='brightness(1.25)';selectAgent('pixel');goPage('agents');toast('Creative Room · PIXEL selected')}
   else if(room==='development'){world.querySelector('.dev-zone').style.filter='brightness(1.25)';selectAgent('byte');goPage('agents');toast('Development Room · BYTE selected')}
   else {selectAgent('orbit');goPage('agents');toast('Meeting Room · ORBIT selected')}
 }));
 $('cubeTasksBtn')?.addEventListener('click',()=>{const b=document.querySelector('[data-page="pipeline"]');if(b)b.click()});
 $('cubeAssignBtn')?.addEventListener('click',()=>{const b=$('newTaskBtn');if(b)b.click();setTimeout(()=>{if($('taskAgent'))$('taskAgent').value=selectedAgent},50)});
 $('cubeBotClose')?.addEventListener('click',()=>{card.hidden=true});
 function refreshCubeSummary(){
   const active=tasks.filter(t=>t.status!=='Published').length,done=tasks.filter(t=>t.status==='Published').length;
   if($('cubeActiveTasks'))$('cubeActiveTasks').textContent=active;
   if($('cubeCompletedTasks'))$('cubeCompletedTasks').textContent=done;
   if($('cubeOnlineCount'))$('cubeOnlineCount').textContent=AGENTS.length+' TEAMMATES';
 }
 refreshCubeSummary();
 document.addEventListener('click',e=>{
   if(e.target.closest('[data-task-action]')||e.target.closest('#taskSubmit')||e.target.closest('#boardNewTask'))setTimeout(()=>{refreshCubeSummary();renderAgentStates()},0);
 });
})();
