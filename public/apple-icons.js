(() => {
  const icons = {
    home: 'M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6',
    clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    calendar: 'M6 3v3M18 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01',
    chart: 'M4 19V5M4 19h17M8 16v-4M12 16V8M16 16v-7',
    notes: 'M6 3h10l3 3v15H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z M8 9h8M8 13h8M8 17h5',
    tag: 'm20 13-7 7-9-9V4h7l9 9ZM8 8h.01',
    star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z',
    settings: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a8 8 0 0 0-2-1.2L14.3 3h-4.6l-.3 2.7a8 8 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 2 1.2l.3 2.7h4.6l.3-2.7a8 8 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z',
    help: 'M9.6 9a2.5 2.5 0 1 1 4.3 1.8c-1.2 1-1.9 1.5-1.9 3M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    play: 'm8 5 11 7-11 7V5Z',
    stop: 'M7 7h10v10H7z',
    download: 'M12 3v11m0 0 4-4m-4 4-4-4M5 18v2h14v-2',
    file: 'M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6M9 16h6',
    plus: 'M12 5v14M5 12h14',
    bell: 'M6 16h12l-1.2-1.8V10a4.8 4.8 0 0 0-9.6 0v4.2L6 16ZM10 19h4',
    pencil: 'm4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5ZM14 6.5l3.5 3.5',
    more: 'M6 12h.01M12 12h.01M18 12h.01',
    close: 'm6 6 12 12M18 6 6 18',
    chevronLeft: 'm15 5-7 7 7 7',
    chevronRight: 'm9 5 7 7-7 7',
    coffee: 'M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8ZM16 10h2a2 2 0 0 1 0 4h-2M8 5v2M12 5v2'
  };
  const map = {'⌂':'home','◷':'clock','▦':'calendar','▥':'chart','▣':'calendar','☷':'notes','◇':'tag','☆':'star','★':'star','⚙':'settings','?':'help','▷':'play','■':'stop','⇩':'download','⇧':'download','⇥':'download','▤':'file','▥':'chart','＋':'plus','↪':'play','♧':'bell','☕':'coffee','✎':'pencil','⋮':'more','×':'close','‹':'chevronLeft','›':'chevronRight'};
  const svg = name => `<svg class="apple-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${icons[name]}"/></svg>`;
  const replace = root => {
    root.querySelectorAll('i').forEach(node => { const name=map[node.textContent.trim()]; if(name && !node.querySelector('.apple-icon')) node.innerHTML=svg(name); });
    const walker=document.createTreeWalker(root,window.NodeFilter ? window.NodeFilter.SHOW_TEXT : 4);
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node=>{ if(node.parentElement?.closest('.apple-icon')) return; const match=node.nodeValue.match(/^([⌂◷▦▥▣☷◇☆★⚙?▷■⇩⇧⇥▤＋↪♧☕✎⋮×‹›])(?=\s|$)/); if(!match)return; const name=map[match[1]], holder=document.createElement('span'); holder.innerHTML=svg(name); node.parentNode.insertBefore(holder.firstChild,node); node.nodeValue=node.nodeValue.slice(match[1].length); });
  };
  const style=document.createElement('style'); style.textContent='.apple-icon{display:inline-block;width:1.15em;height:1.15em;vertical-align:-.17em;flex:none;stroke:currentColor}.nav .apple-icon{width:1.25em;height:1.25em}.metric-icon .apple-icon,.entry-icon .apple-icon{width:1.1em;height:1.1em}.btn .apple-icon,.auth-menu .apple-icon{margin-right:.35em}.apple-icon+span{vertical-align:middle}'; document.head.append(style);
  const run=()=>replace(document);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
  new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1)replace(node);}))).observe(document.body,{childList:true,subtree:true});
})();
