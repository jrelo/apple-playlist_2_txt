(() => {
  // try multiple selector patterns (Apple Music changes classnames often)
  const rowCandidates = [
    '[data-testid="track-lockup"]',
    '[data-testid="track-list"] [role="row"]',
    'div.songs-list-row',
    '[aria-label="Songs"] [role="row"]'
  ];
  let rows = [];
  for (const sel of rowCandidates) {
    rows = Array.from(document.querySelectorAll(sel));
    if (rows.length) break;
  }
  if (!rows.length) {
    alert('Could not detect song rows. Scroll through the playlist to load more, then try again.');
    return;
  }

  const getText = (el, selectors) =>
    selectors.reduce((t, s) => t || el.querySelector(s)?.textContent?.trim() || '', '');

  const lines = rows.map(r => {
    const title = getText(r, [
      '[data-testid="track-title"]',
      '.songs-list-row__song-name',
      '[aria-label][role="gridcell"] span'
    ]);
    const artist = getText(r, [
      '[data-testid="track-artist"]',
      '.songs-list-row__by-line a',
      '[data-testid="lockup-subtitles"] a'
    ]);
    return (artist && title) ? `${artist} - ${title}` : null;
  }).filter(Boolean);

  if (!lines.length) {
    alert('No tracks found. Scroll the page so all songs load, then run again.');
    return;
  }

  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'FLATLINER_FM_100.txt' });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  console.log(`Exported ${lines.length} tracks to FLATLINER_FM_100.txt`);
})();
