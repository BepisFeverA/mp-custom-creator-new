(() => {
  const FIELD_MAX = 10;
  const P = window.Scripts = {scope: 'account', list: [], fields: [], run: null, view: 'design', schema: {functions: {roll: 'roll("1d6")', vroll: 'vroll("1d20")', damage: 'damage(dice, damage_type)', heal: 'heal(dice, to="self")', effect: 'effect(name, stacks=1, duration=1)', remove_effect: 'remove_effect(name)', emit: 'emit(text, title="Effect")', embed_title: 'embed_title(text)', embed_description: 'embed_description(text)', embed_color: 'embed_color("#FF6A00")', embed_footer: 'embed_footer(text)', embed_image: 'embed_image(url)', embed_thumbnail: 'embed_thumbnail(url)', embed_field: 'embed_field(name, value)', counter: 'counter(name)', use_counter: 'use_counter(name, amount=1)', gain_counter: 'gain_counter(name, amount=1)', get_var: 'get_var(name, default=0, scope="character")', set_var: 'set_var(name, value, scope="character")', delete_var: 'delete_var(name)', get_stat: 'get_stat(name, who="self")', stacks: 'stacks(name)', set_local: 'set_local(name,value)', randint: 'randint(low,high)', choice: 'choice(sequence)'}}, busy: false, uid: null, loaded: false};
  const example = 'power = roll("1d6")\nembed_title(f"{self[\'name\']} strikes with frost!")\nembed_color("#3BA7FF")\nif target["hp"] > 0:\n    damage(f"{power}+DEX", "cold")\nset_var("uses", get_var("uses", 0) + 1)\nembed_field("Power", f"You rolled **{power}**")\nemit("The air chills.", "Aftermath")';
  const scopeBody = () => P.scope === 'account' ? {scope: 'account'} : {scope: 'server', guild: P.scope};
  const endpoint = () => '/api/scripts?' + new URLSearchParams(scopeBody());
  const canEdit = () => !!AUTH.user && (P.scope === 'account' || AUTH.guilds.find(g => g.id === P.scope)?.can_edit);
  const val = id => $(id)?.value ?? '';
  function options() { return '<option value="account">My account (private)</option>' + AUTH.guilds.map(g => `<option value="${esc(g.id)}">${esc(g.name)}${g.can_edit ? '' : ' · view only'}</option>`).join(''); }
  function embedFields() { return P.fields.map(f => ({name: String(f.name || '').trim(), value: String(f.value || '').trim()})).filter(f => f.name || f.value); }
  function draft() {
    const d = {name: val('sc-name').trim(), description: val('sc-description').trim(), code: val('sc-code'), cost: val('sc-cost'), targets: val('sc-targets')};
    const title = val('sc-title').trim(), color = val('sc-color').trim(), footer = val('sc-footer').trim(), image = val('sc-image').trim(), thumb = val('sc-thumbnail').trim(), fields = embedFields();
    if (title) d.title = title;
    if (color) d.color = color;
    if (footer) d.footer = footer;
    if (image) d.image = image;
    if (thumb) d.thumbnail = thumb;
    if (fields.length) d.fields = fields;
    return d;
  }
  function fill(d) {
    $('sc-delete-confirm').checked = false; $('sc-delete').disabled = true;
    $('sc-name').value = d.name || ''; $('sc-description').value = d.description || ''; $('sc-code').value = d.code || '';
    $('sc-cost').value = d.cost || 'action'; $('sc-targets').value = typeof d.targets === 'object' ? (d.targets?.mode || 'single') : (d.targets || 'single');
    $('sc-title').value = d.title || ''; $('sc-color').value = d.color || ''; syncSwatch(); $('sc-footer').value = d.footer || ''; $('sc-image').value = d.image || ''; $('sc-thumbnail').value = d.thumbnail || '';
    P.fields = (d.fields || []).map(f => ({name: f.name || '', value: f.value || ''}));
    P.run = null; P.view = 'design'; status('');
    renderFields(); renderPreview();
    window.DraconicEditor?.refresh($('sc-code'));
  }
  function status(text, bad) { const s = $('sc-result'); if (!s) return; s.textContent = text || ''; s.style.color = bad ? 'var(--bad)' : ''; s.hidden = !text; }
  function syncSwatch() { const c = val('sc-color').trim(); const sw = $('sc-swatch'); if (sw) sw.value = /^#[0-9a-f]{6}$/i.test(c) ? c : '#ffffff'; }
  function library() {
    $('sc-list').innerHTML = P.list.map((d, i) => `<div class="lib-item"><span><b>${esc(d.name)}</b><div class="hint">${esc(d.title || d.description || (d.cost === 'bonus' ? 'Bonus action' : d.cost === 'free' ? 'Free' : 'Action'))}</div></span><button type="button" data-sc-load="${i}">Edit</button></div>`).join('') || '<p class="hint">No saved scripted commands in this library.</p>';
    $('sc-save').disabled = !canEdit() || P.busy; $('sc-delete').disabled = !canEdit() || P.busy || !$('sc-delete-confirm').checked;
  }
  function reference() {
    if (!P.schema) return;
    $('sc-reference').innerHTML = Object.entries(P.schema.functions).map(([name, help]) => `<p><code class="inl">${esc(help)}</code></p>`).join('');
  }
  function renderFields() {
    const host = $('sc-fields'); if (!host) return;
    host.innerHTML = P.fields.map((f, i) => `<div class="fieldrow"><label class="f"><span>Field name <em>max 100</em></span><input type="text" data-scf="name" data-i="${i}" maxlength="100" value="${esc(f.name)}"></label><label class="f"><span>Field text <em>max 1024</em></span><textarea data-scf="value" data-i="${i}" maxlength="1024" rows="2">${esc(f.value)}</textarea></label><button type="button" class="tiny danger" data-sc-field-del="${i}">Remove</button></div>`).join('') || '<p class="hint" style="margin:0">No extra fields. Results, Meta and any emit()/embed_field() text are added automatically.</p>';
    const add = $('sc-field-add'); if (add) add.disabled = P.fields.length >= FIELD_MAX;
  }
  const fillText = (t, me, action) => String(t ?? '').replace(/\{name\}/g, me).replace(/\{target\}|\{targets\}/g, 'Goblin').replace(/\{action\}/g, action || 'script');
  const mdText = t => decorate(md(esc(t)), 'link');
  function embedHTML(e) {
    const who = previewWho(), color = /^#[0-9a-f]{6}$/i.test(e.color || '') ? e.color : '#ffffff';
    const thumb = e.thumbnail && e.thumbnail !== 'none' && /^https?:/.test(e.thumbnail) ? `<img class="thumb pv-img" data-kind="thumb" src="${esc(e.thumbnail)}" alt="Thumbnail">` : (e.thumbnail === 'none' ? '' : '<div class="thumb" aria-hidden="true"></div>');
    const image = e.image && /^https?:/.test(e.image) ? `<img class="big pv-img" data-kind="image" src="${esc(e.image)}" alt="Embed image">` : '';
    const fields = (e.fields || []).map(f => `<div class="ftitle">${decorate(esc(f.name), 'title')}</div><div class="ftext">${mdText(f.value)}</div>`).join('');
    return `<div class="embed" style="--embed-strip:${color}"><div style="min-width:0"><div class="author"><i${e.avatar ?? who.pic ? ` style="background-image:url('${esc(e.avatar ?? who.pic)}')"` : ''}></i>${esc(e.author || who.name)}</div><div class="title">${decorate(esc(e.title || ''), 'title')}</div>${fields}</div>${thumb}${image}<div class="foot">${esc(e.footer || 'Script')} • Midnight\\Protocol</div></div>`;
  }
  function wireImages(root) {
    root.querySelectorAll('img.pv-img').forEach(img => {
      const fallback = () => { const box = document.createElement('div'); box.className = img.dataset.kind === 'thumb' ? 'thumb img-missing' : 'big img-missing'; box.textContent = img.dataset.kind === 'thumb' ? 'thumb set' : "Image link set. This page can't load outside images, but Discord will show it."; img.replaceWith(box); };
      if (img.complete && img.naturalWidth === 0) fallback(); else img.addEventListener('error', fallback, {once: true});
    });
  }
  function designEmbed() {
    const d = draft(), me = previewWho().name;
    const fields = [{name: 'Meta', value: '*The script\'s rolls, damage and notes appear here when it runs.*'}];
    if (d.description) fields.push({name: 'Effect', value: fillText(d.description, me, d.name)});
    for (const f of d.fields || []) fields.push({name: fillText(f.name, me, d.name), value: fillText(f.value, me, d.name)});
    return {title: d.title ? fillText(d.title, me, d.name) : `${me} uses ${d.name || 'your script'}!`, color: d.color, fields, footer: d.footer ? d.footer + ' • Script' : 'Script', image: d.image, thumbnail: d.thumbnail};
  }
  function renderPreview() {
    const host = $('sc-embed'); if (!host) return;
    const run = P.run, showRun = P.view === 'run' && run;
    $('sc-view-design').setAttribute('aria-pressed', String(!showRun)); $('sc-view-run').setAttribute('aria-pressed', String(!!showRun)); $('sc-view-run').disabled = !run;
    const body = showRun ? (run.embed ? embedHTML(run.embed) : `<div class="embed"><div><div class="title">No embed was produced</div><div class="ftext">${esc((run.pages || []).join('\n') || 'The script did not produce a message.')}</div></div></div>`) : embedHTML(designEmbed());
    $('sc-embed-note').textContent = showRun ? 'The message the bot would send for this run (sample character and target).' : 'Your design with placeholders. Run the preview to see the script\'s real output.';
    host.innerHTML = body; wireImages(host);
    const errs = showRun ? (run.errors || []) : [];
    $('sc-errors').innerHTML = errs.map(e => `<div class="notice" role="alert"><span style="color:var(--bad)">⚠️ ${esc(e.message || String(e))}</span></div>`).join('');
    const trace = $('sc-trace'); trace.hidden = !showRun; if (showRun) $('sc-trace-body').textContent = JSON.stringify(run.trace || [], null, 2);
  }
  function render() {
    const root = $('scripts-area');
    if (!AUTH.user) { root.innerHTML = '<h2>Scripts</h2><p class="hint">Sign in to create account or server scripted commands. Script steps can also be added directly in the action builder.</p>'; return; }
    root.innerHTML = `<div class="chars-head"><div><h2>Scripts</h2><p class="hint">Draconic commands and reusable action steps. Runs in homebrew mode.</p></div><button type="button" data-sc="new">New script</button></div>
      <div class="row"><label class="f"><span>Library</span><select id="sc-scope">${options()}</select></label></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:24px;align-items:start">
      <div><section class="card"><h2>The script</h2><div class="row"><label class="f"><span>Command name</span><input type="text" id="sc-name" maxlength="30" placeholder="froststrike"></label><label class="f"><span>Cost</span><select id="sc-cost"><option value="action">Action</option><option value="bonus">Bonus action</option><option value="free">Free</option></select></label></div>
      <label class="f"><span>Description <em>shown as the Effect text</em></span><input type="text" id="sc-description" maxlength="1024"></label>
      <label class="f"><span>Targets</span><select id="sc-targets"><option value="single">Single target</option><option value="self">Self</option><option value="all_enemies">All enemies</option><option value="all_allies">All allies</option><option value="everyone">Everyone</option></select></label>
      <label class="f"><span>Draconic code</span><textarea id="sc-code" data-script-code rows="17" maxlength="12000" spellcheck="false" style="font-family:Consolas,monospace;tab-size:4;line-height:1.5"></textarea></label><p class="hint">Ctrl+Space: autocomplete. Tab: indent. self and target are read-only snapshots; args contains command arguments. Local numbers/text can be reused as {name} in later steps.</p>
      <div class="head-tools"><button type="button" data-sc="validate">Validate</button><button type="button" class="primary" id="sc-save" data-sc="save">Save command</button><button type="button" data-sc="builder">Open in action builder</button><button type="button" data-sc="export">Export JSON</button></div>
      <details><summary>Delete saved command</summary><p class="hint">Deletes the local command with the name above, in the selected library.</p><label class="chk"><input type="checkbox" id="sc-delete-confirm"> Delete this saved command</label><button type="button" class="danger" id="sc-delete" data-sc="delete" disabled>Delete command</button></details></section>
      <section class="card" style="margin-top:20px"><h2>The message</h2><p class="hint">How the result looks in Discord. {name}, {target} and {action} work in text. The script can change any of this too: embed_title(), embed_color(), embed_footer(), embed_image(), embed_thumbnail(), embed_field() and embed_description().</p>
      <label class="f"><span>Title <em>max 200 · blank = “{name} uses …!”</em></span><input type="text" id="sc-title" maxlength="200" placeholder="{name} strikes with frost!"></label>
      <div class="row"><label class="f"><span>Color</span><span style="display:flex;gap:8px"><input type="color" id="sc-swatch" value="#ffffff" style="width:44px;padding:0;flex:none" aria-label="Pick a color"><input type="text" id="sc-color" maxlength="7" placeholder="#3BA7FF" style="flex:1"></span></label><label class="f"><span>Footer <em>max 100</em></span><input type="text" id="sc-footer" maxlength="100"></label></div>
      <div class="row"><label class="f"><span>Big image link</span><input type="url" id="sc-image" placeholder="https://…"></label><label class="f"><span>Thumbnail link <em>or “none”</em></span><input type="text" id="sc-thumbnail" placeholder="https://…"></label></div>
      <div class="sub-h">Extra fields <em class="hint">up to ${FIELD_MAX}</em></div><div id="sc-fields"></div><div><button type="button" class="tiny" id="sc-field-add" data-sc="field-add">Add a field</button></div></section>
      <section class="card" style="margin-top:20px"><h2>Saved commands</h2><div id="sc-list"></div><p class="hint">Use $commandname [arguments] -- -t enemy. Built-in commands take priority. Use $a commandname if a built-in command uses the same name.</p></section></div>
      <div><section class="card"><h2>Preview</h2><div class="tabs" role="group" aria-label="Preview view"><button type="button" class="tab" id="sc-view-design" data-sc-view="design" aria-pressed="true">Message design</button><button type="button" class="tab" id="sc-view-run" data-sc-view="run" aria-pressed="false" disabled>Last run</button></div>
      <p class="hint" id="sc-embed-note"></p><div id="sc-embed"></div><div id="sc-errors"></div>
      <p id="sc-result" class="hint" role="status" hidden style="white-space:pre-wrap;overflow-wrap:anywhere"></p>
      <label class="f"><span>Arguments (JSON array of text)</span><input type="text" id="sc-args" value="[]"></label><button type="button" class="primary" data-sc="preview">Run preview</button><p class="hint">Uses a sample character and target. Persistent variables are isolated; nothing is saved by a preview.</p>
      <details id="sc-trace" hidden><summary>Execution trace</summary><pre id="sc-trace-body" style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:320px;overflow:auto"></pre></details></section>
      <section class="card" style="margin-top:20px"><h2>Script reference</h2><p class="hint">Python-like conditions, loops, functions and lists. Character/account variables are private. Server variables can be read by server scripts; only server editors may write them.</p><div id="sc-reference"></div><p class="hint">Scripts have bounded loops, statements, API calls and generated steps. Importing modules, files, network requests and bot internals are unavailable.</p><p class="hint">To share: open in the action builder, then Workshop → Draft → Add current builder draft. Existing Workshop permissions and releases apply.</p></section></div></div>`;
    $('sc-scope').value = P.scope; fill({name: 'froststrike', code: example}); library(); reference();
  }
  async function load() {
    if (!AUTH.user) return;
    const scope = P.scope, uid = AUTH.user.id;
    try { const data = await api(endpoint()); if (scope !== P.scope || uid !== AUTH.user?.id) return; P.list = data.aliases; P.schema = data.schema; P.loaded = true; library(); reference(); }
    catch (e) { status(e.message, true); }
  }
  P.enter = () => { if (P.uid !== (AUTH.user?.id || null)) P.auth(); if (!$('sc-code')) render(); if (AUTH.user) load(); };
  P.auth = () => { const uid = AUTH.user?.id || null; if (uid !== P.uid) { P.uid = uid; P.scope = 'account'; P.list = []; P.loaded = false; $('scripts-area').replaceChildren(); if (MODE === 'scripts') { render(); load(); } } };
  const redraw = () => { if (!$('sc-embed')) return; if (P.view !== 'run') renderPreview(); };
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset?.scf) { const f = P.fields[Number(t.dataset.i)]; if (f) f[t.dataset.scf] = t.value; redraw(); return; }
    if (t.id === 'sc-swatch') { $('sc-color').value = t.value.toUpperCase(); redraw(); return; }
    if (t.id === 'sc-color') syncSwatch();
    if (['sc-name', 'sc-description', 'sc-title', 'sc-color', 'sc-footer', 'sc-image', 'sc-thumbnail'].includes(t.id)) redraw();
  });
  document.addEventListener('change', e => { if (e.target.id === 'sc-scope') { if (P.busy) { e.target.value = P.scope; return; } $('sc-delete-confirm').checked = false; P.scope = e.target.value; P.list = []; library(); load(); } if (e.target.id === 'sc-delete-confirm') $('sc-delete').disabled = !e.target.checked || !canEdit() || P.busy; });
  document.addEventListener('click', async e => {
    const view = e.target.closest('[data-sc-view]');
    if (view && !view.disabled) { P.view = view.dataset.scView; renderPreview(); return; }
    const del = e.target.closest('[data-sc-field-del]');
    if (del) { P.fields.splice(Number(del.dataset.scFieldDel), 1); renderFields(); redraw(); return; }
    const b = e.target.closest('[data-sc],[data-sc-load]'); if (!b || P.busy) return;
    if (b.dataset.scLoad != null) { fill(P.list[Number(b.dataset.scLoad)]); return; }
    const op = b.dataset.sc;
    if (op === 'new') { fill({name: 'newscript', code: example}); return; }
    if (op === 'field-add') { if (P.fields.length < FIELD_MAX) { P.fields.push({name: '', value: ''}); renderFields(); redraw(); $('sc-fields').querySelector('.fieldrow:last-child input')?.focus(); } return; }
    const d = draft();
    if (op === 'builder') { const data = {...d, name: d.name || 'Script action', steps: [{type: 'script', code: d.code}]}; delete data.code; const {st} = fromData(data); CHAR = null; setMode('action'); loadState(st, 'Loaded script in action builder.'); return; }
    if (op === 'export') { navigator.clipboard.writeText(JSON.stringify(d, null, 2)).then(() => toast('Script JSON copied.')).catch(() => { status(JSON.stringify(d, null, 2)); }); return; }
    if (op === 'delete' && !$('sc-delete-confirm').checked) return;
    P.busy = true; b.disabled = true; status('Working…');
    try {
      if (op === 'save') { if (!canEdit()) throw Error('This library is view only.'); await api('/api/scripts', {method: 'POST', body: JSON.stringify({...scopeBody(), alias: d})}); status(''); toast('Saved. Use $' + d.name + ' in homebrew mode.'); await load(); }
      if (op === 'delete') { await api(endpoint() + '&name=' + encodeURIComponent(d.name), {method: 'DELETE'}); status(''); toast('Command deleted.'); $('sc-delete-confirm').checked = false; await load(); }
      if (op === 'validate') { await api('/api/scripts/validate', {method: 'POST', body: JSON.stringify({alias: d})}); status(''); toast('Valid: syntax, message and action definition.'); }
      if (op === 'preview') {
        const args = JSON.parse($('sc-args').value || '[]');
        const r = await api('/api/scripts/preview', {method: 'POST', body: JSON.stringify({alias: d, args})});
        P.run = r; P.view = 'run'; status(''); renderPreview();
      }
    } catch (error) {
      status(error.message, true);
      const line = /Line (\d+)/i.exec(error.message);
      if (line) { const t = $('sc-code'), rows = t.value.split('\n'), start = rows.slice(0, Number(line[1]) - 1).join('\n').length + (Number(line[1]) > 1 ? 1 : 0); t.focus(); t.setSelectionRange(start, start + (rows[Number(line[1]) - 1] || '').length); }
    }
    finally { P.busy = false; b.disabled = false; library(); $('sc-delete').disabled = !canEdit() || !$('sc-delete-confirm').checked; }
  });
  if (MODE === 'scripts') P.enter();
})();
