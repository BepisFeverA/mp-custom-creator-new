(() => {
  const W = window.Workshop = {
    uid:null, view:'browse', query:'', scope:'account', list:[], subs:[], detail:null,
    tab:'overview', busy:false, request:0, modalRequest:0, draft:null, captureData:null, link:null,
    pending:new URLSearchParams(location.search).get('collection') || sessionStorage.getItem('forge-workshop-link'),
    library:[], source:'account'
  };
  if(W.pending)sessionStorage.setItem('forge-workshop-link',W.pending);
  const h=esc;
  const scopeBody=()=>W.scope==='account'?{scope:'account'}:{scope:'server',guild:W.scope};
  const queryScope=()=>new URLSearchParams(scopeBody()).toString();
  const endpoint=(id,tail='')=>`/api/workshop/${encodeURIComponent(id)}${tail}`;
  const canInstall=()=>W.scope==='account'||AUTH.guilds.find(g=>g.id===W.scope)?.can_edit;
  const options=(value,readOnly=false)=>`<option value="account" ${value==='account'?'selected':''}>My account (private)</option>`+AUTH.guilds.map(g=>`<option value="${h(g.id)}" ${value===g.id?'selected':''} ${!readOnly&&!g.can_edit?'disabled':''}>${h(g.name)}${g.can_edit?'':' · view only'}</option>`).join('');
  const clean=data=>{const d=JSON.parse(JSON.stringify(data));delete d.workshop;return d;};
  const entryTitle=e=>`${e.kind==='class'?'Class':e.kind==='item'?'Item':'Action'} · ${e.data.name}`;
  const form=()=>W.detail?.can_edit&&W.tab==='draft';
  const say=message=>{const el=!$('ws-new-modal').hidden?$('ws-new-error'):$('ws-error');if(el)el.textContent=message;else toast(message);};

  W.capture=(kind,json)=>{
    try{W.captureData={kind,data:clean(JSON.parse(json))};}catch{}
    if(W.link&&W.captureData&&W.link.cid===W.detail?.id){
      const e=W.draft.entries.find(e=>e.id===W.link.eid);
      if(e&&e.kind===kind)e.data=W.captureData.data;
      W.link=null;W.returnToDraft=true;
    }
  };
  W.auth=()=>{
    const uid=AUTH.user?.id||null;
    if(W.uid!==uid){W.uid=uid;W.list=[];W.subs=[];W.detail=null;W.draft=null;W.request++;W.modalRequest++;$('ws-modal').hidden=true;}
    if(uid&&W.pending){const id=W.pending;W.pending=null;sessionStorage.removeItem('forge-workshop-link');setMode('workshop');W.open(id);}
    else if(MODE==='workshop')W.enter();
  };
  W.enter=()=>{
    render();
    if(AUTH.user)load();
    if(W.returnToDraft&&W.detail){W.returnToDraft=false;W.tab='draft';renderModal();$('ws-modal').hidden=false;}
  };
  function render(){
    const root=$('workshop-area');
    if(!AUTH.user){root.innerHTML='<section class="card"><h2>Workshop</h2><p class="hint">Log in with Discord to discover collections, manage your work, and subscribe privately or for a server.</p></section>';return;}
    root.innerHTML=`<div class="chars-head"><div><h2>Workshop</h2><p class="hint">Shared collections of actions, items and classes. Release updates without replacing subscriptions.</p></div><button type="button" class="primary" data-w="new">New collection</button></div>
      <div class="tabs" role="tablist" aria-label="Workshop library">${[['browse','Browse'],['mine','My work'],['subscriptions','Subscriptions']].map(([v,n])=>`<button type="button" class="tab" data-w-view="${v}" role="tab" aria-selected="${W.view===v}" aria-pressed="${W.view===v}">${n}</button>`).join('')}</div>
      <div class="picker" style="margin:16px 0">${W.view==='subscriptions'?`<label for="ws-scope">Library</label><select id="ws-scope">${options(W.scope,true)}</select>`:`<label for="ws-search">Find collections</label><input id="ws-search" type="search" value="${h(W.query)}" placeholder="Name, description or tag"><button type="button" data-w="search">Search</button>`}<button type="button" class="ghost" data-w="refresh">Refresh</button></div>
      <p class="hint" id="ws-list-error" role="alert"></p><div class="chars-grid" id="ws-grid"><p class="hint">Loading…</p></div>`;
  }
  async function load(){
    const seq=++W.request,uid=AUTH.user?.id;if(!uid)return;
    try{
      const path=W.view==='subscriptions'?`/api/workshop?view=subscriptions&${queryScope()}`:`/api/workshop?view=${W.view}&q=${encodeURIComponent(W.query)}`;
      const data=await api(path);
      if(seq!==W.request||AUTH.user?.id!==uid)return;
      W.subs=data.subscriptions||[];W.list=data.collections||W.subs.map(s=>s.collection);
      $('ws-grid').innerHTML=W.list.map(c=>`<div class="char" role="button" tabindex="0" data-w-open="${h(c.id)}" aria-label="Open ${h(c.name)}" style="--h:${hueOf(c.name)}"><div class="char-art" ${c.image?`style="background-image:url('${h(c.image.replaceAll("'",'%27'))}')"`:''}>${c.image?'':`<span class="char-initial">${h(c.name[0]||'?')}</span>`}</div><div class="char-over"><div><span class="char-name">${h(c.name)}</span><span class="char-meta">${h(c.visibility)} · ${c.version?'v'+c.version:'Draft'} · ${c.entries} entries</span></div><div class="char-bottom"><span>${h((c.tags||[]).slice(0,2).join(' · '))}</span><button type="button" class="char-btn" data-w-open="${h(c.id)}" aria-label="View ${h(c.name)}">${BOOK_SVG}</button></div></div></div>`).join('')||'<p class="hint">No collections here yet.</p>';
    }catch(e){if(seq===W.request)$('ws-list-error').textContent=e.message;}
  }
  W.open=async(id,version)=>{
    const seq=++W.modalRequest,uid=AUTH.user?.id;
    $('ws-modal').hidden=false;$('ws-modal-body').innerHTML='<p class="hint">Loading collection…</p>';
    try{
      const c=await api(endpoint(id)+(version?`?version=${version}`:''));
      if(seq!==W.modalRequest||AUTH.user?.id!==uid||$('ws-modal').hidden)return;
      W.detail=c;W.tab='overview';W.draft=c.draft?JSON.parse(JSON.stringify({...c,entries:c.draft.entries})):null;
      renderModal();await loadSubs();
    }catch(e){if(seq===W.modalRequest)$('ws-modal-body').innerHTML=`<p class="hint" role="alert">${h(e.message)}</p>`;}
  };
  async function loadSubs(){
    const cid=W.detail?.id,uid=AUTH.user?.id,scope=W.scope;if(!cid||!uid)return;
    try{
      const d=await api(`/api/workshop?view=subscriptions&${queryScope()}`);
      if(W.detail?.id!==cid||AUTH.user?.id!==uid||scope!==W.scope)return;
      W.subs=d.subscriptions||[];if(W.tab==='subscription')renderModal();
    }catch(e){say(e.message);}
  }
  const currentSub=()=>W.subs.find(s=>s.collection.id===W.detail?.id);
  function renderModal(){
    const c=W.detail;if(!c)return;
    $('ws-modal-title').textContent=c.name;
    const tabs=[['overview','Overview'],...(c.can_edit?[['draft','Draft']]:[]),['versions','Versions'],['subscription','Subscription']];
    let content='';
    if(W.tab==='overview')content=`<p class="hint">${h(c.visibility)} · ${c.view_version?'Viewing v'+c.view_version:'No release yet'} · ${c.subscribers} subscriptions · Owner ${h(c.owner)}</p><p style="white-space:pre-wrap">${h(c.description||'No description yet.')}</p><p class="hint">${h((c.tags||[]).join(' · '))}</p><div class="head-tools"><button type="button" data-w="share">Copy collection link</button><button type="button" data-w="export">Export release</button></div><h3>In this collection</h3>${c.entries.map((e,i)=>`<div class="mini"><div class="mini-head"><b>${h(entryTitle(e))}</b><button type="button" class="tiny" data-w-copy="${i}">Edit a copy</button></div><p class="hint" style="white-space:pre-wrap">${h(e.docs||'No documentation yet.')}</p><details><summary>Definition</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${h(JSON.stringify(e.data,null,2))}</pre></details></div>`).join('')||'<p class="hint">Save entries to the draft, then release a version to make them available for subscriptions.</p>'}`;
    if(W.tab==='draft'){
      const d=W.draft;
      content=`<div class="row"><label class="f"><span>Name</span><input type="text" data-w-field="name" maxlength="80" value="${h(d.name)}"></label><label class="f"><span>Visibility</span><select data-w-field="visibility" ${!c.is_owner?'disabled':''}>${['private','unlisted','published'].map(v=>`<option ${d.visibility===v?'selected':''}>${v}</option>`).join('')}</select></label></div><p class="hint">Private: owner/editors only. Unlisted: accessible through its link. Published: discoverable after a release. Saving the draft does not change released definitions.</p>
        <label class="f"><span>Description</span><textarea data-w-field="description" maxlength="4000" rows="3">${h(d.description||'')}</textarea></label>
        <div class="row"><label class="f"><span>Cover image URL</span><input type="text" data-w-field="image" value="${h(d.image||'')}"></label><label class="f"><span>Tags · comma separated</span><input type="text" data-w-field="tags" value="${h((d.tags||[]).join(', '))}"></label></div>
        ${c.is_owner?`<label class="f"><span>Editors · Discord user IDs, comma separated</span><input type="text" data-w-field="editors" value="${h((d.editors||[]).join(', '))}"></label>`:''}
        <h3>Draft entries (${d.entries.length}/50)</h3><div class="head-tools"><button type="button" data-w="add-current" ${!W.captureData?'disabled':''}>Add current builder draft</button><button type="button" data-w="blank-action">New action</button><button type="button" data-w="blank-item">New item</button><button type="button" data-w="blank-class">New class</button></div>
        <div class="picker" style="margin:12px 0"><label for="ws-source">Add saved content from</label><select id="ws-source">${options(W.source,true)}</select><button type="button" data-w="library">Load library</button></div><div class="picker"><select id="ws-library-pick" aria-label="Saved definition">${W.library.length?W.library.map((e,i)=>`<option value="${i}">${h(entryTitle(e))}</option>`).join(''):'<option value="">Load a library…</option>'}</select><button type="button" data-w="add-library" ${!W.library.length?'disabled':''}>Add selected</button></div>
        ${d.entries.map((e,i)=>`<div class="mini"><div class="mini-head"><b>${h(entryTitle(e))}</b><span class="char-act-btns"><button type="button" class="tiny" data-w-edit="${i}">Edit in builder</button><button type="button" class="tiny danger" data-w-remove="${i}">Remove</button></span></div><label class="f"><span>Documentation</span><textarea data-w-doc="${i}" rows="2" maxlength="4000">${h(e.docs||'')}</textarea></label><details><summary>Advanced definition JSON</summary><label class="f"><span>Definition</span><textarea class="mono" data-w-json="${i}" rows="6">${h(JSON.stringify(e.data,null,2))}</textarea></label></details></div>`).join('')}
        <div class="head-tools"><button type="button" class="primary" data-w="save-draft">Save draft</button></div><hr><label class="f"><span>Release notes</span><textarea id="ws-release-notes" maxlength="1000" rows="2" placeholder="What changed in this version?"></textarea></label><button type="button" class="primary" data-w="release">Save and release new version</button>
        ${c.is_owner?`<details style="margin-top:20px"><summary>Archive collection</summary><p class="hint">Archiving removes this collection and its subscriptions. Existing items become inactive; characters lose subscribed class features.</p><label class="chk"><input type="checkbox" id="ws-archive-confirm"> I want to archive ${h(c.name)}.</label><button type="button" class="danger" id="ws-archive-button" data-w="archive" disabled>Archive collection</button></details>`:''}`;
    }
    if(W.tab==='versions')content=`<p class="hint">Released definitions are immutable. Restoring creates a new release, so pinned subscribers keep their chosen version.</p>${c.versions.map(v=>`<div class="mini"><div class="mini-head"><b>Version ${v.number} · ${new Date(v.created*1000).toLocaleDateString()}</b><span class="char-act-btns"><button type="button" class="tiny" data-w-version="${v.number}">View</button>${c.can_edit?`<button type="button" class="tiny" data-w-restore="${v.number}">Restore as new release</button>`:''}</span></div><p style="white-space:pre-wrap">${h(v.notes||'No release notes.')}</p></div>`).join('')||'<p class="hint">No releases yet.</p>'}`;
    if(W.tab==='subscription'){
      const sub=currentSub();
      content=`<div class="row"><label class="f"><span>Install for</span><select id="ws-install-scope">${options(W.scope,true)}</select></label><label class="f"><span>Updates</span><select id="ws-pin"><option value="" ${sub?.version==null?'selected':''}>Follow latest release</option>${c.versions.map(v=>`<option value="${v.number}" ${sub?.version===v.number?'selected':''}>Pin version ${v.number}</option>`).join('')}</select></label></div><p class="hint">Personal content belongs to your account. Server content is available to its members. Actions run through $a in homebrew mode. Local names can differ from the author's names.</p><button type="button" class="primary" data-w="subscribe" ${!canInstall()||!c.version?'disabled':''}>${sub?'Update subscription':'Subscribe'}</button>${!canInstall()?'<p class="hint">This server is view only. Ask an admin or subscribe to your account.</p>':''}
        ${sub?`<h3>Local names</h3>${Object.entries(sub.bindings).map(([eid,b])=>`<div class="row"><label class="f"><span>${h(b.kind)}</span><input type="text" id="ws-binding-${h(eid)}" maxlength="${b.kind==='action'?50:30}" value="${h(b.name)}" ${!canInstall()?'disabled':''}></label><button type="button" data-w-rename="${h(eid)}" ${!canInstall()?'disabled':''}>Rename</button></div>`).join('')}<details><summary>Remove subscription</summary><p class="hint">Linked actions disappear; items become inactive; subscribed classes lose their features. This does not delete the author's collection.</p><button type="button" class="danger" data-w="unsubscribe" ${!canInstall()?'disabled':''}>Unsubscribe from ${h(c.name)}</button></details>`:'<p class="hint">Not subscribed in this library.</p>'}`;
    }
    $('ws-modal-body').innerHTML=`<div class="tabs" role="tablist" aria-label="Collection">${tabs.map(([v,n])=>`<button type="button" class="tab" role="tab" aria-selected="${W.tab===v}" aria-pressed="${W.tab===v}" data-w-tab="${v}">${n}</button>`).join('')}</div><p class="hint" id="ws-error" role="alert"></p>${content}`;

  }
  async function saveDraft(){
    if(document.querySelector('#ws-modal-body [data-w-json]:invalid'))throw Error('Fix the invalid definition JSON before saving.');
    const d=W.draft,body={name:d.name,description:d.description,image:d.image,tags:d.tags,entries:d.entries};
    if(W.detail.is_owner){body.editors=d.editors;body.visibility=d.visibility;}
    const c=await api(endpoint(W.detail.id),{method:'PATCH',body:JSON.stringify(body)});
    W.detail=c;W.draft=JSON.parse(JSON.stringify({...c,entries:c.draft.entries}));
  }
  function addEntry(e){if(W.draft.entries.length>=50)throw Error('A collection supports up to 50 entries.');const d=clean(e.data);delete d.id;W.draft.entries.push({kind:e.kind,data:d,docs:e.docs||''});renderModal();}
  function editBuilder(e,linked){
    if(linked&&!e.id)throw Error('Save the draft before editing this entry in the builder.');
    if(linked)W.link={cid:W.detail.id,eid:e.id};
    if(!linked){e={...e,data:clean(e.data)};delete e.data.id;e.data.name=e.data.name.slice(0,e.kind==='action'?45:25)+' copy';}
    $('ws-modal').hidden=true;
    if(e.kind==='action'){const {st}=fromData(clean(e.data));CHAR=null;setMode('action');loadState(st,'Loaded from Workshop.');}
    else{if(e.kind==='class')CL=entityFrom(clean(e.data));else IT=entityFrom(clean(e.data));setMode(e.kind);}
    window.scrollTo({top:0});
  }
  async function run(button){
    if(W.busy)return;W.busy=true;button.disabled=true;
    try{
      const action=button.dataset.w,c=W.detail;
      if(action==='new'){const name=$('ws-new-name').value.trim();if(!name)throw Error('Enter a collection name.');const d=await api('/api/workshop',{method:'POST',body:JSON.stringify({name})});$('ws-new-modal').hidden=true;await W.open(d.id);W.tab='draft';renderModal();load();}
      if(action==='save-draft'){await saveDraft();toast('Draft saved. Released definitions are unchanged.');renderModal();load();}
      if(action==='release'){const notes=$('ws-release-notes').value;await saveDraft();W.detail=await api(endpoint(c.id,'/release'),{method:'POST',body:JSON.stringify({notes})});W.draft=JSON.parse(JSON.stringify({...W.detail,entries:W.detail.draft.entries}));W.tab='overview';toast('New version released.');renderModal();load();invalidate();}
      if(action==='subscribe'){const pin=$('ws-pin').value;const d=await api(endpoint(c.id,'/subscribe'),{method:'POST',body:JSON.stringify({...scopeBody(),version:pin?Number(pin):null})});W.subs=d.subscriptions;toast('Subscription saved.');renderModal();invalidate();load();}
      if(action==='unsubscribe'){await api(endpoint(c.id,'/subscribe')+'?'+queryScope(),{method:'DELETE'});W.subs=W.subs.filter(s=>s.collection.id!==c.id);renderModal();invalidate();load();}
      if(action==='archive'){await api(endpoint(c.id),{method:'DELETE'});$('ws-modal').hidden=true;W.detail=null;invalidate();load();}
      if(button.dataset.wRename){const id=button.dataset.wRename;const d=await api(endpoint(c.id,'/bindings'),{method:'PATCH',body:JSON.stringify({...scopeBody(),entry:id,name:$('ws-binding-'+id).value})});W.subs=d.subscriptions;renderModal();invalidate();}
      if(button.dataset.wRestore){W.detail=await api(endpoint(c.id,'/release'),{method:'POST',body:JSON.stringify({restore:Number(button.dataset.wRestore),notes:`Restored version ${button.dataset.wRestore}`})});W.draft=JSON.parse(JSON.stringify({...W.detail,entries:W.detail.draft.entries}));renderModal();load();invalidate();}
      if(action==='library'){const data=await api(W.source==='account'?'/api/library?scope=account':'/api/library?guild='+encodeURIComponent(W.source));W.library=['actions','items','classes'].flatMap(kind=>(data[kind]||[]).map(e=>({kind:{actions:'action',items:'item',classes:'class'}[kind],data:e.json})));renderModal();}
      if(action==='share'){const url=new URL(location.pathname,location.origin);url.searchParams.set('collection',c.id);await navigator.clipboard.writeText(url.href);toast('Collection link copied.');}
      if(action==='export'){await navigator.clipboard.writeText(JSON.stringify({name:c.name,description:c.description,tags:c.tags,entries:c.entries},null,2));toast('Released collection JSON copied.');}
    }catch(e){say(e.message);}
    finally{W.busy=false;if(button.isConnected)button.disabled=false;}
  }
  function invalidate(){EXIST.libs={};if(AUTH.user){loadExistingLib(AUTH.guild||'account',true);if(CHARS)CHARS.list=null;} }
  document.addEventListener('input',ev=>{
    const t=ev.target;
    if(t.dataset.wField&&form()){const k=t.dataset.wField;W.draft[k]=['tags','editors'].includes(k)?t.value.split(',').map(s=>s.trim()).filter(Boolean):t.value;}
    if(t.dataset.wDoc!=null&&form())W.draft.entries[Number(t.dataset.wDoc)].docs=t.value;
    if(t.dataset.wJson!=null&&form()){try{W.draft.entries[Number(t.dataset.wJson)].data=JSON.parse(t.value);t.setCustomValidity('');}catch{t.setCustomValidity('Invalid JSON.');}}
    if(t.id==='ws-archive-confirm')$('ws-archive-button').disabled=!t.checked;
  });
  document.addEventListener('change',ev=>{
    const t=ev.target;if(W.busy)return;if(t.id==='ws-scope'){W.scope=t.value;load();}
    if(t.id==='ws-install-scope'){W.scope=t.value;W.subs=[];renderModal();loadSubs();}
    if(t.id==='ws-source'){W.source=t.value;W.library=[];renderModal();}
  });
  document.addEventListener('click',ev=>{
    const b=ev.target.closest('button,[data-w-open]');
    if(!b){if(ev.target===$('ws-modal')){$('ws-modal').hidden=true;W.modalRequest++;}if(ev.target===$('ws-new-modal'))$('ws-new-modal').hidden=true;return;}
    if(W.busy&&b.id!=='ws-close')return;
    if(b.id==='ws-close'){$('ws-modal').hidden=true;W.modalRequest++;return;}
    if(b.id==='ws-new-cancel'){$('ws-new-modal').hidden=true;return;}
    if(b.dataset.wView){W.view=b.dataset.wView;render();load();return;}
    if(b.dataset.wTab){if(W.busy)return;W.tab=b.dataset.wTab;renderModal();if(W.tab==='subscription')loadSubs();return;}
    if(b.dataset.wOpen){if(b.closest('#server-modal'))W.scope=SERVER.gid;$('server-modal').hidden=true;W.open(b.dataset.wOpen);return;}
    if(b.dataset.wVersion){W.open(W.detail.id,Number(b.dataset.wVersion));return;}
    if(b.dataset.wCopy!=null){editBuilder(W.detail.entries[Number(b.dataset.wCopy)],false);return;}
    if(b.dataset.wEdit!=null){try{editBuilder(W.draft.entries[Number(b.dataset.wEdit)],true);}catch(e){say(e.message);}return;}
    if(b.dataset.wRemove!=null){W.draft.entries.splice(Number(b.dataset.wRemove),1);renderModal();return;}
    const action=b.dataset.w;
    if(action==='new'&&!b.closest('#ws-new-modal')){$('ws-new-modal').hidden=false;$('ws-new-name').focus();return;}
    if(action==='refresh'||action==='search'){W.query=$('ws-search')?.value||'';load();return;}
    try{
      if(action==='add-current'){addEntry(W.captureData);return;}
      if(action==='add-library'){const e=W.library[Number($('ws-library-pick').value)];if(e)addEntry(e);return;}
      if(action?.startsWith('blank-')){const kind=action.slice(6),data=kind==='action'?{name:'New action',steps:[{type:'text',text:'Describe the effect.'}]}:kind==='item'?{name:'New item',slot:'accessory',rarity:'common',description:'',bonus:{}}:{name:'New class',hit_die:8,features:[],counters:[],actions:[]};addEntry({kind,data});return;}
      if(action||b.dataset.wRename||b.dataset.wRestore)run(b);
    }catch(e){say(e.message);}
  });
  document.addEventListener('keydown',ev=>{
    if(ev.key==='Enter'&&ev.target.id==='ws-search'){W.query=ev.target.value;load();}
    if(ev.key==='Escape'&&!W.busy){if(!$('ws-new-modal').hidden)$('ws-new-modal').hidden=true;else if(!$('ws-modal').hidden){$('ws-modal').hidden=true;W.modalRequest++;}}
    if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('[data-w-open]')){ev.preventDefault();W.open(ev.target.dataset.wOpen);}
  });
  W.auth();
})();
