  const selector='textarea[data-script-code],textarea[data-fw-field="code"],textarea[data-k="code"][data-s]';
  const editors=new Map();
  const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const keywords=new Set('if elif else for while in is not and or return break continue try except finally raise with as from import pass yield assert del lambda'.split(' '));
  const declarations=new Set(['def','class','global','nonlocal']);
  const types=new Set(['int','float','str','bool','list','dict','set','tuple']);
  function highlight(source){
    const tokens=/(#[^\n]*|(?:[rRuUbBfF]{1,2})?(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*(?:"|$)|'(?:\\.|[^'\\\n])*(?:'|$))|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b|[()[\]{}])/g;
    let html='',last=0;
    for(const m of source.matchAll(tokens)){
      html+=escape(source.slice(last,m.index));const word=m[0];let kind='';
      if(word[0]==='#')kind='comment';
      else if(/^(?:[rRuUbBfF]{1,2})?["']/.test(word))kind='string';
      else if(/^\d/.test(word))kind='number';
      else if(keywords.has(word))kind='keyword';
      else if(declarations.has(word))kind='declaration';
      else if(['True','False','None'].includes(word))kind='constant';
      else if(types.has(word))kind='type';
      else if(/^[()[\]{}]$/.test(word))kind='bracket';
      else if(/^\s*\(/.test(source.slice(m.index+word.length)))kind='function';
      else kind='name';
      let text=escape(word);
      if(kind==='string'&&/^[fF]/.test(word))text=text.replace(/\{[^{}]*\}/g,s=>`<span class="vsc-interpolation">${s}</span>`);
      html+=`<span class="vsc-${kind}">${text}</span>`;last=m.index+word.length;
    }
    return html+escape(source.slice(last))+'\n';
  }
  const copyIcon='<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="6" width="9" height="11" rx="1"/><path d="M5 14H3V2h10v2"/></svg>';
  const expandIcon='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5"/></svg>';
  function filename(t){
    const name=t.id==='sc-code'?document.getElementById('sc-name')?.value:document.getElementById('a-name')?.value;
    return (name||'draconic').trim().replace(/[^\p{L}\p{N}_-]+/gu,'_').slice(0,40)+'.py';
  }
  function sync(t){
    const e=editors.get(t);if(!e||!t.isConnected)return;
    const prefix=t.value.slice(0,t.selectionStart),line=prefix.split('\n').length,col=prefix.length-prefix.lastIndexOf('\n');
    if(e.value!==t.value){
      e.value=t.value;e.line=null;const html=highlight(t.value);
      e.code.innerHTML=html;e.mini.innerHTML=html;
      e.lines.innerHTML=Array.from({length:t.value.split('\n').length},(_,i)=>`<span>${i+1}</span>`).join('');
    }
    if(e.line!==line){e.lines.querySelector('.current')?.classList.remove('current');e.lines.children[line-1]?.classList.add('current');e.line=line;}
    e.code.style.transform=`translate(${-t.scrollLeft}px,${-t.scrollTop}px)`;
    e.lines.style.transform=`translateY(${-t.scrollTop}px)`;
    e.active.style.transform=`translateY(${(line-1)*22-t.scrollTop}px)`;
    e.position.textContent=`Ln ${line}, Col ${col}`;
    e.file.textContent=filename(t);e.crumb.textContent=filename(t);
    const height=e.map.clientHeight,ratio=t.clientHeight/Math.max(t.scrollHeight,1),contentHeight=Math.min(height,t.value.split('\n').length*4+24);
    e.window.style.height=Math.min(contentHeight,Math.max(8,contentHeight*ratio))+'px';
    e.window.style.top=(contentHeight*(t.scrollTop/Math.max(t.scrollHeight,1)))+'px';
  }
  function mount(t){
    if(editors.has(t))return;
    const box=document.createElement('div');box.className='vsc-editor';
    box.innerHTML=`<div class="vsc-tabs"><div class="vsc-tab"><span class="vsc-python" aria-hidden="true">Py</span><span class="vsc-file"></span></div><div class="vsc-tools"><button type="button" class="vsc-tool vsc-copy" aria-label="Copy Draconic code" title="Copy code">${copyIcon}</button><button type="button" class="vsc-tool vsc-expand" aria-label="Expand Draconic editor" title="Expand editor">${expandIcon}</button></div></div><div class="vsc-breadcrumb" aria-hidden="true"><span>scripts</span><i>›</i><strong></strong><i>›</i><span>Draconic</span></div><div class="vsc-body"><div class="vsc-active" aria-hidden="true"></div><div class="vsc-highlight" aria-hidden="true"><pre class="vsc-code"></pre></div><div class="vsc-gutter" aria-hidden="true"><div class="vsc-lines"></div></div><div class="vsc-minimap" role="presentation" title="Click to scroll through code"><div class="vsc-mini-window"></div><pre class="vsc-mini-code" aria-hidden="true"></pre></div></div><div class="vsc-status"><span class="vsc-mode" aria-hidden="true">&gt;&lt;</span><span>Draconic</span><span class="vsc-position">Ln 1, Col 1</span><span>Spaces: 4</span><span class="vsc-encoding">UTF-8</span><span class="vsc-ending">LF</span></div>`;
    // Keep labels attached only to the textarea, not to the editor's tool buttons.
    const label=t.closest('label');if(label){if(!t.id)t.id='draconic-'+Math.random().toString(36).slice(2);label.htmlFor=t.id;}
    t.before(box);box.querySelector('.vsc-body').append(t);t.classList.add('vsc-input');t.wrap='off';t.autocapitalize='off';t.autocomplete='off';t.spellcheck=false;
    if(!t.getAttribute('aria-label'))t.setAttribute('aria-label','Draconic code');
    t.setAttribute('aria-description','Code editor. Tab indents, Shift+Tab unindents. Ctrl+M toggles Tab key focus navigation. Escape restores the expanded editor.');
    const e={box,code:box.querySelector('.vsc-code'),mini:box.querySelector('.vsc-mini-code'),map:box.querySelector('.vsc-minimap'),window:box.querySelector('.vsc-mini-window'),lines:box.querySelector('.vsc-lines'),active:box.querySelector('.vsc-active'),position:box.querySelector('.vsc-position'),file:box.querySelector('.vsc-file'),crumb:box.querySelector('.vsc-breadcrumb strong')};
    editors.set(t,e);sync(t);
    for(const event of ['input','click','keyup','select','scroll','focus'])t.addEventListener(event,()=>sync(t));
    e.observer=new ResizeObserver(()=>sync(t));e.observer.observe(t);
    box.querySelector('.vsc-copy').addEventListener('click',async event=>{event.preventDefault();event.stopPropagation();try{await navigator.clipboard.writeText(t.value);const b=box.querySelector('.vsc-copy');b.title='Copied';b.setAttribute('aria-label','Code copied');setTimeout(()=>{b.title='Copy code';b.setAttribute('aria-label','Copy Draconic code');},1500);}catch{t.focus();t.select();}});
    box.querySelector('.vsc-expand').addEventListener('click',event=>{event.preventDefault();event.stopPropagation();const expanded=box.classList.toggle('vsc-expanded');box.querySelector('.vsc-expand').setAttribute('aria-label',expanded?'Restore Draconic editor size':'Expand Draconic editor');t.focus();sync(t);});
    e.map.addEventListener('pointerdown',event=>{const r=e.map.getBoundingClientRect();t.scrollTop=(event.clientY-r.top)/Math.max(r.height,1)*t.scrollHeight-t.clientHeight/2;sync(t);});
  }
  function scan(root){if(root.nodeType!==1)return;if(root.matches(selector))mount(root);root.querySelectorAll(selector).forEach(mount);}
  function edit(t,text,start=t.selectionStart,end=t.selectionEnd){
    if(t.maxLength>=0&&t.value.length-(end-start)+text.length>t.maxLength)return;
    t.setRangeText(text,start,end,'end');t.dispatchEvent(new Event('input',{bubbles:true}));sync(t);
  }
  document.addEventListener('keydown',event=>{
    const t=event.target,e=editors.get(t);if(!e||event.defaultPrevented)return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='m'){event.preventDefault();e.tabMovesFocus=!e.tabMovesFocus;e.position.title=e.tabMovesFocus?'Tab moves focus':'Tab indents';e.box.querySelector('.vsc-mode').textContent=e.tabMovesFocus?'⇥':'><';return;}
    if(event.key==='Tab'&&!event.ctrlKey&&!event.metaKey){
      if(e.tabMovesFocus)return;
      // Leave an open completion menu's Tab handler in control.
      if(document.getElementById('ac')?.getAttribute('hidden')===null&&document.querySelector('#ac [aria-selected="true"]'))return;
      event.preventDefault();event.stopImmediatePropagation();
      const start=t.selectionStart,end=t.selectionEnd;
      if(start===end&&!event.shiftKey){edit(t,' '.repeat(4-((start-t.value.lastIndexOf('\n',start-1)-1)%4)));return;}
      if(start===end&&event.shiftKey){
        const a=t.value.lastIndexOf('\n',start-1)+1,remove=/^(?: {1,4}|\t)/.exec(t.value.slice(a))?.[0].length||0;
        if(remove){edit(t,'',a,a+remove);t.setSelectionRange(Math.max(a,start-remove),Math.max(a,start-remove));sync(t);}
        return;
      }
      const a=t.value.lastIndexOf('\n',start-1)+1,b=end>start&&t.value[end-1]==='\n'?end-1:end;
      const text=t.value.slice(a,b),rows=text.split('\n'),changed=rows.map(row=>event.shiftKey?row.replace(/^(?: {1,4}|\t)/,''):'    '+row).join('\n');
      edit(t,changed,a,b);t.setSelectionRange(a,a+changed.length);sync(t);return;
    }
    if(event.key==='Enter'&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.defaultPrevented){
      if(document.querySelector('#ac [aria-selected="true"]')&&!document.getElementById('ac')?.hidden)return;
      event.preventDefault();const prefix=t.value.slice(0,t.selectionStart).split('\n').at(-1),indent=/^\s*/.exec(prefix)[0];edit(t,'\n'+indent+(/:\s*(?:#.*)?$/.test(prefix)?'    ':''));
    }
    if(event.key==='Escape'&&!event.defaultPrevented&&e.box.classList.contains('vsc-expanded')){e.box.classList.remove('vsc-expanded');e.box.querySelector('.vsc-expand').setAttribute('aria-label','Expand Draconic editor');sync(t);}
  },true);
  document.addEventListener('selectionchange',()=>{if(editors.has(document.activeElement))sync(document.activeElement);});
  document.addEventListener('input',event=>{if(['sc-name','a-name'].includes(event.target.id))editors.forEach((e,t)=>sync(t));});
  new MutationObserver(changes=>{
    for(const change of changes)for(const node of change.addedNodes)scan(node);
    for(const [t,e] of editors)if(!t.isConnected){e.observer?.disconnect();editors.delete(t);}
  }).observe(document.body,{childList:true,subtree:true});
  function caret(t,offset=t.selectionStart){
    if(!editors.has(t))return null;
    const r=t.getBoundingClientRect(),cs=getComputedStyle(t),rows=t.value.slice(0,offset).split('\n');
    let col=0,text='';for(const c of rows.at(-1)){if(c==='\t'){const n=4-col%4;text+=' '.repeat(n);col+=n;}else{text+=c;col++;}}
    caret.ctx=caret.ctx||document.createElement('canvas').getContext('2d');caret.ctx.font=`${cs.fontSize} ${cs.fontFamily}`;
    const top=r.top+parseFloat(cs.paddingTop)+(rows.length-1)*22-t.scrollTop;
    return {left:r.left+parseFloat(cs.paddingLeft)+caret.ctx.measureText(text).width-t.scrollLeft,top,bottom:top+22};
  }
  window.DraconicEditor={refresh:sync,caret};
  scan(document.body);
})();
