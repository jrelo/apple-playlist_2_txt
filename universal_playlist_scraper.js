// Universal Playlist Scraper
// Auto-scrolls, auto-downloads, works on Apple Music & Spotify
// Run this in DevTools Console on playlist page

(async () => {
  const qs = (s, root=document) => root.querySelector(s);
  const qsa = (s, root=document) => Array.from(root.querySelectorAll(s));
  
  const getMeta = (name, prop) => {
    const selector = name ? `meta[name="${name}"]` : `meta[property="${prop}"]`;
    const el = qs(selector);
    return el ? (el.getAttribute('content') || '').trim() : '';
  };

  const sanitize = (s) => s
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');

  // === PLATFORM DETECTION ===
  const detectPlatform = () => {
    const host = window.location.hostname;
    if (host.includes('music.apple.com')) return 'apple';
    if (host.includes('open.spotify.com')) return 'spotify';
    if (host.includes('music.youtube.com')) return 'youtube';
    if (host.includes('tidal.com')) return 'tidal';
    if (host.includes('soundcloud.com')) return 'soundcloud';
    return 'unknown';
  };

  const platform = detectPlatform();
  console.log(`[PLATFORM] ${platform.toUpperCase()}`);

  // === AUTO-SCROLL TO LOAD ALL TRACKS ===
  const autoScroll = async () => {
    console.log('[SCROLL] Auto-scrolling to load all tracks...');
    let prevHeight = -1, stable = 0;
    
    for (let i = 0; i < 500 && stable < 6; i++) {
      window.scrollTo(0, document.scrollingElement.scrollHeight);
      await new Promise(r => setTimeout(r, 300));
      
      const h = document.scrollingElement.scrollHeight;
      stable = (h === prevHeight) ? (stable + 1) : 0;
      prevHeight = h;
      
      // Progress indicator
      if (i % 10 === 0) {
        const trackCount = document.querySelectorAll('[data-testid="track-lockup"], [data-testid="tracklist-row"]').length;
        console.log(`  [PROGRESS] ${trackCount} tracks loaded`);
      }
    }
    
    // Scroll back up so header stays rendered
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 500));
    console.log('[SUCCESS] Finished loading tracks\n');
  };

  await autoScroll();

  // === TITLE EXTRACTION ===
  const getPlaylistTitle = () => {
    let title = '';

    if (platform === 'apple') {
      const h1 = qs('[data-testid="non-editable-product-title"]') || 
                 qs('.headings__title') || 
                 qs('header h1');
      title = h1 ? (h1.innerText || h1.textContent || '').trim() : '';
      
      if (!title) title = getMeta('apple:title', null);
      if (!title) title = getMeta(null, 'og:title');
      if (!title) title = document.title;
      
      // Clean up Apple Music suffixes
      title = title.replace(/\s+by\s+[^-]+-+\s*Apple Music.*$/i, '')
                   .replace(/\s+-\s*Apple Music.*$/i, '')
                   .trim();
    } 
    else if (platform === 'spotify') {
      const h1 = qs('[data-testid="playlist-name"]') || 
                 qs('h1[data-encore-id="type"]') || 
                 qs('h1');
      title = h1 ? (h1.innerText || h1.textContent || '').trim() : '';
      
      if (!title) title = getMeta(null, 'og:title');
      if (!title) title = document.title;
      
      // Clean up Spotify suffixes
      title = title.replace(/\s+-\s*playlist by.*$/i, '')
                   .replace(/\s+-\s*Spotify.*$/i, '')
                   .trim();
    }
    else {
      title = document.title || getMeta(null, 'og:title') || 'PLAYLIST';
    }

    return title || 'MUSIC_PLAYLIST';
  };

  // === TRACK EXTRACTION ===
  const getText = (el, selectors) => {
    for (const sel of selectors) {
      const node = el.querySelector(sel);
      if (node) {
        const txt = (node.textContent || '').trim();
        if (txt) return txt;
      }
    }
    return '';
  };

  let tracks = [];

  if (platform === 'apple') {
    const rowSelectors = [
      '[data-testid="track-lockup"]',
      '[data-testid="track-list"] [role="row"]',
      'div.songs-list-row',
      '[aria-label="Songs"] [role="row"]',
      '.track-row'
    ];

    let rows = [];
    for (const sel of rowSelectors) {
      rows = qsa(sel);
      if (rows.length) break;
    }

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

    tracks = rows.map(row => {
      const track = getText(row, titleSels);
      const artist = getText(row, artistSels);
      return (artist && track) ? { artist, track } : null;
    }).filter(t => t !== null);
  }

  else if (platform === 'spotify') {
    const rowSelectors = [
      '[data-testid="tracklist-row"]',
      '[data-testid="playlist-tracklist"] > div[role="row"]',
      'div[data-testid="track-row"]',
      '.tracklist-row'
    ];

    let rows = [];
    for (const sel of rowSelectors) {
      rows = qsa(sel);
      if (rows.length) break;
    }

    tracks = rows.map(row => {
      const track = getText(row, [
        '[data-testid="tracklist-row-track-name"]', 
        'a[data-testid="internal-track-link"]', 
        '.track-name'
      ]);
      const artist = getText(row, [
        '[data-testid="tracklist-row-artist-name"]', 
        'a[href*="/artist/"]', 
        '.artist-name'
      ]);
      
      return (artist && track) ? { artist, track } : null;
    }).filter(t => t !== null);
  }

  else if (platform === 'youtube') {
    const rows = qsa('ytmusic-responsive-list-item-renderer');
    tracks = rows.map(row => {
      const flexCols = qsa('.flex-column', row);
      if (flexCols.length >= 2) {
        const trackEl = flexCols[0].querySelector('a');
        const artistEl = flexCols[1].querySelector('a');
        const track = trackEl ? (trackEl.textContent || '').trim() : '';
        const artist = artistEl ? (artistEl.textContent || '').trim() : '';
        return (artist && track) ? { artist, track } : null;
      }
      return null;
    }).filter(t => t !== null);
  }

  // === VALIDATION ===
  if (!tracks.length) {
    console.error('[ERROR] No tracks found!');
    console.log('\n[TROUBLESHOOTING]');
    console.log('1. Make sure the playlist is visible on screen');
    console.log('2. Try running the script again');
    console.log('3. Page structure may have changed - check console for errors');
    return;
  }

  // === FORMAT OUTPUT ===
  const lines = tracks.map(t => `${t.artist} - ${t.track}`);
  const playlistTitle = getPlaylistTitle();
  const filename = `${sanitize(playlistTitle)}.txt`;

  // === STATISTICS ===
  const uniqueArtists = new Set(tracks.map(t => t.artist)).size;
  const artistCounts = {};
  tracks.forEach(t => {
    artistCounts[t.artist] = (artistCounts[t.artist] || 0) + 1;
  });
  const topArtists = Object.entries(artistCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log('\n' + '='.repeat(60));
  console.log(`[SUCCESS] Scraped: "${playlistTitle}"`);
  console.log('='.repeat(60));
  console.log(`\n[STATISTICS]`);
  console.log(`  Total tracks: ${tracks.length}`);
  console.log(`  Unique artists: ${uniqueArtists}`);
  console.log(`  Platform: ${platform.toUpperCase()}`);
  
  console.log(`\n[TOP 10 ARTISTS]`);
  topArtists.forEach(([artist, count], i) => {
    console.log(`  ${i + 1}. ${artist}: ${count} track${count > 1 ? 's' : ''}`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('[TRACK LIST PREVIEW] (first 10):');
  console.log('='.repeat(60));
  lines.slice(0, 10).forEach((line, i) => {
    console.log(`${i + 1}. ${line}`);
  });
  if (lines.length > 10) {
    console.log(`... and ${lines.length - 10} more tracks`);
  }

  // === DOWNLOAD FILE ===
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('\n' + '='.repeat(60));
  console.log(`[DOWNLOAD] Saved as: ${filename}`);
  console.log('='.repeat(60));
  console.log('\n[NEXT STEP] Use this file with the Spotify Playlist Creator!');
  console.log('   Just paste the contents into the trackList variable.\n');

  // Store in window for further use
  window.scrapedPlaylist = {
    title: playlistTitle,
    tracks,
    formatted: lines.join('\n'),
    stats: {
      total: tracks.length,
      uniqueArtists,
      topArtists
    }
  };

  console.log('[TIP] Access the data programmatically via window.scrapedPlaylist\n');

  return window.scrapedPlaylist;
})();
