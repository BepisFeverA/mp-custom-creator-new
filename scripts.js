(() => {
  const P=window.Scripts={scope:'account',list:[],schema:{functions:{roll:'roll("1d6")',vroll:'vroll("1d20")',damage:'damage(dice, damage_type)',heal:'heal(dice, to="self")',effect:'effect(name, stacks=1, duration=1)',remove_effect:'remove_effect(name)',emit:'emit(text)',counter:'counter(name)',use_counter:'use_counter(name, amount=1)',gain_counter:'gain_counter(name, amount=1)',get_var:'get_var(name, default=0, scope="character")',set_var:'set_var(name, value, scope="character")',delete_var:'delete_var(name)',get_stat:'get_stat(name, who="self")',stacks:'stacks(name)',set_local:'set_local(name,value)',randint:'randint(low,high)',choice:'choice(sequence)'}},busy:false,uid:null,loaded:false};
  const example='power = roll("1d6")\nif target["hp"] > 0:\n    damage(f"{power}+DEX", "slashing")\nset_var("uses", get_var("uses", 0) + 1)\nemit(f"Power: {power}")';
  const scopeBody=()=>P.scope==='account'?{scope:'account'}:{scope:'server',guild:P.scope};
  const endpoint=()=>'/api/scripts?'+new URLSearchParams(scopeBody());
  const canEdit=()=>!!AUTH.user&&(P.scope==='account'||AUTH.guilds.find(g=>g.id===P.scope)?.can_edit);
  function options(){return '<option value="account">My account (private)</option>'+AUTH.guilds.map(g=>`<option value="${esc(g.id)}">${esc(g.name)}${g.can_edit?'':' · view only'}</option>`).join('');}
  function draft(){return {name:$('sc-name').value.trim(),description:$('sc-description').value.trim(),code:$('sc-code').value,cost:$('sc-cost').value,targets:$('sc-targets').value};}
  function fill(d){$('sc-delete-confirm').checked=false;$('sc-delete').disabled=true;$('sc-name').value=d.name||'';$('sc-description').value=d.description||'';$('sc-code').value=d.code||'';$('sc-cost').value=d.cost||'action';$('sc-targets').value=typeof d.targets==='object'?(d.targets?.mode||'single'):(d.targets||'single');$('sc-result').textContent='';window.DraconicEditor?.refresh($('sc-code'));}
  function library(){
    $('sc-list').innerHTML=P.list.map((d,i)=>`<div class="lib-item"><span><b>${esc(d.name)}</b><div class="hint">${esc(d.description||(d.cost==='bonus'?'Bonus action':d.cost==='free'?'Free':'Action'))}</div></span><button type="button" data-sc-load="${i}">Edit</button></div>`).join('')||'<p class="hint">No saved scripted commands in this library.</p>';
    $('sc-save').disabled=!canEdit()||P.busy;$('sc-delete').disabled=!canEdit()||P.busy||!$('sc-delete-confirm').checked;
  }
  function reference(){
    if(!P.schema)return;
    $('sc-reference').innerHTML=Object.entries(P.schema.functions).map(([name,help])=>`<p><code class="inl">${esc(help)}</code></p>`).join('');
  }
  function render(){
    const root=$('scripts-area');
    if(!AUTH.user){root.innerHTML='<h2>Scripts</h2><p class="hint">Sign in to create account or server scripted commands. Script steps can also be added directly in the action builder.</p>';return;}
    root.innerHTML=`<div class="chars-head"><div><h2>Scripts</h2><p class="hint">Draconic commands and reusable action steps. Runs in homebrew mode.</p></div><button type="button" data-sc="new">New script</button></div>
      <div class="row"><label class="f"><span>Library</span><select id="sc-scope">${options()}</select></label></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:24px;align-items:start">
      <div><section class="card"><h2>The script</h2><div class="row"><label class="f"><span>Command name</span><input type="text" id="sc-name" maxlength="30" placeholder="froststrike"></label><label class="f"><span>Cost</span><select id="sc-cost"><option value="action">Action</option><option value="bonus">Bonus action</option><option value="free">Free</option></select></label></div>
      <label class="f"><span>Description</span><input type="text" id="sc-description" maxlength="1024"></label>
      <label class="f"><span>Targets</span><select id="sc-targets"><option value="single">Single target</option><option value="self">Self</option><option value="all_enemies">All enemies</option><option value="all_allies">All allies</option><option value="everyone">Everyone</option></select></label>
      <label class="f"><span>Draconic code</span><textarea id="sc-code" data-script-code rows="17" maxlength="12000" spellcheck="false" style="font-family:Consolas,monospace;tab-size:4;line-height:1.5"></textarea></label><p class="hint">Ctrl+Space: autocomplete. Tab: indent. self and target are read-only snapshots; args contains command arguments. Local numbers/text can be reused as {name} in later steps.</p>
      <div class="head-tools"><button type="button" data-sc="validate">Validate</button><button type="button" class="primary" id="sc-save" data-sc="save">Save command</button><button type="button" data-sc="builder">Open in action builder</button><button type="button" data-sc="export">Export JSON</button></div>
      <details><summary>Delete saved command</summary><p class="hint">Deletes the local command with the name above, in the selected library.</p><label class="chk"><input type="checkbox" id="sc-delete-confirm"> Delete this saved command</label><button type="button" class="danger" id="sc-delete" data-sc="delete" disabled>Delete command</button></details></section>
      <section class="card" style="margin-top:20px"><h2>Saved commands</h2><div id="sc-list"></div><p class="hint">Use $commandname [arguments] -- -t enemy. Built-in commands take priority. Use $a commandname if a built-in command uses the same name.</p></section></div>
      <div><section class="card"><h2>Execution preview</h2><p class="hint">Uses a sample character and target. Persistent variables are isolated; nothing is saved by a preview.</p><label class="f"><span>Arguments (JSON array of text)</span><input type="text" id="sc-args" value="[]"></label><button type="button" data-sc="preview">Run preview</button><pre id="sc-result" role="status" style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:520px;overflow:auto"></pre></section>
      <section class="card" style="margin-top:20px"><h2>Script reference</h2><p class="hint">Python-like conditions, loops, functions and lists. Character/account variables are private. Server variables can be read by server scripts; only server editors may write them.</p><div id="sc-reference"></div><p class="hint">Scripts have bounded loops, statements, API calls and generated steps. Importing modules, files, network requests and bot internals are unavailable.</p><p class="hint">To share: open in the action builder, then Workshop → Draft → Add current builder draft. Existing Workshop permissions and releases apply.</p></section></div></div>`;
    $('sc-scope').value=P.scope;fill({name:'froststrike',code:example});library();reference();
  }
  async function load(){
    if(!AUTH.user)return;
    const scope=P.scope,uid=AUTH.user.id;
    try{const data=await api(endpoint());if(scope!==P.scope||uid!==AUTH.user?.id)return;P.list=data.aliases;P.schema=data.schema;P.loaded=true;library();reference();}
    catch(e){if($('sc-result'))$('sc-result').textContent=e.message;}
  }
  P.enter=()=>{if(P.uid!==(AUTH.user?.id||null))P.auth();if(!$('sc-code'))render();if(AUTH.user)load();};
  P.auth=()=>{const uid=AUTH.user?.id||null;if(uid!==P.uid){P.uid=uid;P.scope='account';P.list=[];P.loaded=false;$('scripts-area').replaceChildren();if(MODE==='scripts'){render();load();}}};
  document.addEventListener('change',e=>{if(e.target.id==='sc-scope'){if(P.busy){e.target.value=P.scope;return;}$('sc-delete-confirm').checked=false;P.scope=e.target.value;P.list=[];library();load();}if(e.target.id==='sc-delete-confirm')$('sc-delete').disabled=!e.target.checked||!canEdit()||P.busy;});
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-sc],[data-sc-load]');if(!b||P.busy)return;
    if(b.dataset.scLoad!=null){fill(P.list[Number(b.dataset.scLoad)]);return;}
    const op=b.dataset.sc;
    if(op==='new'){fill({name:'newscript',code:example});return;}
    const d=draft();
    if(op==='builder'){const data={name:d.name||'Script action',description:d.description,cost:d.cost,targets:d.targets,steps:[{type:'script',code:d.code}]};const {st}=fromData(data);CHAR=null;setMode('action');loadState(st,'Loaded script in action builder.');return;}
    if(op==='export'){navigator.clipboard.writeText(JSON.stringify(d,null,2)).then(()=>toast('Script JSON copied.')).catch(()=>{$('sc-result').textContent=JSON.stringify(d,null,2);});return;}
    if(op==='delete'&&!$('sc-delete-confirm').checked)return;
    P.busy=true;b.disabled=true;$('sc-result').textContent='Working…';
    try{
      if(op==='save'){if(!canEdit())throw Error('This library is view only.');await api('/api/scripts',{method:'POST',body:JSON.stringify({...scopeBody(),alias:d})});$('sc-result').textContent='Saved. Use $'+d.name+' in homebrew mode.';await load();}
      if(op==='delete'){await api(endpoint()+'&name='+encodeURIComponent(d.name),{method:'DELETE'});$('sc-result').textContent='Command deleted.';$('sc-delete-confirm').checked=false;await load();}
      if(op==='validate'){await api('/api/scripts/validate',{method:'POST',body:JSON.stringify({alias:d})});$('sc-result').textContent='Syntax and action definition are valid. Run preview to check execution.';}
      if(op==='preview'){const args=JSON.parse($('sc-args').value||'[]');const r=await api('/api/scripts/preview',{method:'POST',body:JSON.stringify({alias:d,args})});$('sc-result').textContent=[...(r.pages||[]),...(r.errors||[]).map(e=>e.message||String(e)),'','Trace:',JSON.stringify(r.trace||[],null,2)].join('\n');}
    }catch(error){$('sc-result').textContent=error.message;const line=/Line (\d+)/i.exec(error.message);if(line){const t=$('sc-code'),rows=t.value.split('\n'),start=rows.slice(0,Number(line[1])-1).join('\n').length+(Number(line[1])>1?1:0);t.focus();t.setSelectionRange(start,start+(rows[Number(line[1])-1]||'').length);}}
    finally{P.busy=false;b.disabled=false;library();$('sc-delete').disabled=!canEdit()||!$('sc-delete-confirm').checked;}
  });
  if(MODE==='scripts')P.enter();
})();
