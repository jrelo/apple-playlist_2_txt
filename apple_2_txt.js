(async () => {
  // helpers
  const qs = (s, root=document) => root.querySelector(s);
  const getMeta = (name, prop) =>
    qs(`meta[${name ? `name="${name}"` : `property="${prop}"`}]`)?.content?.trim() || '';

  const sanitize = (s) => s
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');

  const getPlaylistTitle = () => {
    // 1) visible H1
    const h1 =
      qs('[data-testid="non-editable-product-title"]') ||
      qs('.headings__title') ||
      qs('header h1');
    let t = h1?.innerText?.trim();
    if (t) return t;

    // 2) meta apple:title
    t = getMeta('apple:title');
    if (t) return t;

    // 3) og:title or document.title, then strip the suffix
    t = getMeta(null, 'og:title') || document.title || '';
    if (t) {
      t = t.replace(/\s+by\s+[^-]+-+\s*Apple Music.*$/i, '')
           .replace(/\s+-\s*Apple Music.*$/i, '')           
           .trim();
    }
    return t || 'APPLE_MUSIC_PLAYLIST';
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  let prevHeight = -1, stable = 0;
  for (let i = 0; i < 400 && stable < 6; i++) {
    window.scrollTo(0, document.scrollingElement.scrollHeight);
    await sleep(300);
    const h = document.scrollingElement.scrollHeight;
    stable = (h === prevHeight) ? (stable + 1) : 0;
    prevHeight = h;
  }
  // jump back up a bit so header stays rendered
  window.scrollTo(0, 0);

  const rowSelectors = [
    '[data-testid="track-lockup"]',
    '[data-testid="track-list"] [role="row"]',
    'div.songs-list-row',
    '[aria-label="Songs"] [role="row"]'
  ];
  let rows = [];
  for (const sel of rowSelectors) {
    const cand = Array.from(document.querySelectorAll(sel));
    if (cand.length) { rows = cand; break; }
  }
  if (!rows.length) {
    alert('Could not detect song rows. Try scrolling the list, then run again.');
    return;
  }

  const getText = (el, sels) => {
    for (const s of sels) {
      const node = el.querySelector(s);
      const txt = node?.textContent?.trim();
      if (txt) return txt;
    }
    return '';
  };

  const titleSels = [
    '[data-testid="track-title"]',
    '.songs-list-row__song-name',
    '[role="gridcell"] [dir][data-test-song-title]',
    '[role="gridcell"] span'
  ];
  const artistSels = [
    '[data-testid="track-artist"]',
    '.songs-list-row__by-line a',
    '[data-testid="lockup-subtitles"] a',
    '[role="gridcell"] a[href*="/artist/"]'
  ];

  const lines = rows.map(r => {
    const title = getText(r, titleSels);
    const artist = getText(r, artistSels);
    return (artist && title) ? `${artist} - ${title}` : null;
  }).filter(Boolean);

  if (!lines.length) {
    alert('No tracks found after scanning rows. Scroll a bit and try again.');
    return;
  }

  // playlist title grab
  const playlistTitle = getPlaylistTitle();
  const filename = `${sanitize(playlistTitle)}.txt`;

  // download
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);

  console.log(`Exported ${lines.length} tracks to ${filename}`);
})();
