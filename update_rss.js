const fs = require('fs').promises;
const { existsSync } = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const RSS_PATH = path.join(__dirname, 'docs', 'jefbinomed.rss');
const PLAYLIST_PATH = path.join(__dirname, 'docs', 'playlist.js');
const MIXS_XML_DIR = path.join(__dirname, 'docs', 'mixsXML');
const STORAGE_URL_BASE = 'https://storage.googleapis.com/binomed-mix/';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Rekordbox logs one TRACK block per deck load. A segment shorter than this is
// dropped only when the same track is played longer elsewhere in the mix: it was
// cued up before being played for real. A short segment nobody replays is kept.
const MAX_PREVIEW_SECONDS = 60;

const DRY_RUN = process.argv.includes('--dry-run');

// --refresh [mix] rebuilds an already published tracklist: every CUE mix by
// default, or the single mix named right after the flag.
const REFRESH = process.argv.includes('--refresh');
const REFRESH_TARGET = REFRESH
  ? (process.argv[process.argv.indexOf('--refresh') + 1] || '').replace(/^--.*/, '').replace(/\.(cue|xml|mp3)$/, '')
  : '';

const NO_TRACK_LIST = '<p>No track list</p>';
const PLAYLIST_MARKER = '<h4>Playlist:</h4>';

function secondsToHms(d) {
  d = Number(d);
  const h = Math.floor(d / 3600);
  const m = Math.floor(d % 3600 / 60);
  const s = Math.floor(d % 3600 % 60);

  const hDisplay = h > 0 ? (h < 10 ? "0" + h : h) + ":" : "00:";
  const mDisplay = m < 10 ? "0" + m : m;
  const sDisplay = s < 10 ? "0" + s : s;
  return hDisplay + mDisplay + ":" + sDisplay;
}

function formatDate(dateStr) {
  // 2026-01-25
  const parts = dateStr.split('-');
  const year = parts[0];
  const month = MONTHS[parseInt(parts[1], 10) - 1];
  const day = parts[2];
  return `${parseInt(day, 10)} ${month} ${year} 21:10:00 +0100`;
}

function buildPlaylistHtml(tracks) {
  return `<h4>Playlist:</h4><ul>\n` +
    tracks.map(track => `  <li>${track.artist} - ${track.song}</li>`).join('\n') +
    `\n</ul>`;
}

// --- MP3 ---------------------------------------------------------------

const MPEG1_LAYER3_BITRATES = [null, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, null];

// A CUE sheet carries no total duration, so it has to be derived from the MP3
// itself. Our exports are CBR, so the first frame header is enough.
async function readMp3DurationSeconds(filePath) {
  let handle;
  try {
    handle = await fs.open(filePath, 'r');
    const { size } = await handle.stat();
    const buffer = Buffer.alloc(Math.min(65536, size));
    await handle.read(buffer, 0, buffer.length, 0);

    let offset = 0;
    // Skip an ID3v2 tag if present: "ID3" + version(2) + flags(1) + synchsafe size(4)
    if (buffer.length > 10 && buffer.toString('latin1', 0, 3) === 'ID3') {
      const tagSize = (buffer[6] << 21) | (buffer[7] << 14) | (buffer[8] << 7) | buffer[9];
      offset = 10 + tagSize;
    }

    for (let i = offset; i < buffer.length - 1; i++) {
      // Frame sync: 11 bits set, then MPEG-1 (11) Layer III (01)
      if (buffer[i] !== 0xff || (buffer[i + 1] & 0xe0) !== 0xe0) continue;
      if ((buffer[i + 1] & 0x18) !== 0x18 || (buffer[i + 1] & 0x06) !== 0x02) continue;

      const bitrateKbps = MPEG1_LAYER3_BITRATES[(buffer[i + 2] & 0xf0) >> 4];
      if (!bitrateKbps) continue;

      return size / (bitrateKbps * 1000 / 8);
    }

    console.warn(`Could not read MPEG header of ${path.basename(filePath)}, duration unknown.`);
    return null;
  } catch (error) {
    console.warn(`Could not read duration of ${path.basename(filePath)}: ${error.message}`);
    return null;
  } finally {
    if (handle) await handle.close();
  }
}

// --- CUE ---------------------------------------------------------------

// Rekordbox writes HH:MM:SS here, not the historical MM:SS:FF of the CUE spec.
function cueTimeToSeconds(str) {
  const parts = str.split(':').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function unquote(line, keyword) {
  const value = line.slice(keyword.length).trim();
  const match = value.match(/^"(.*)"$/);
  return match ? match[1] : value;
}

// Rekordbox mangles accents in TITLE / PERFORMER (É -> U+FFFD) but leaves the
// FILE path of the same TRACK block correctly encoded: recover from there.
function repairMojibake(field, filePath, trackNumber) {
  if (!field || !field.includes('�')) return field;

  if (filePath) {
    const pattern = field
      .split('�')
      .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.');
    const matches = filePath.match(new RegExp(pattern, 'g'));
    if (matches && matches.length === 1) {
      console.log(`Repaired encoding of track ${trackNumber}: "${field}" -> "${matches[0]}"`);
      return matches[0];
    }
  }

  console.warn(`Track ${trackNumber} "${field}" has a broken character and no match in its FILE path; fix the .cue manually.`);
  return field;
}

function parseCueSheet(content, totalDurationSeconds) {
  const rawTracks = [];
  let current = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (/^TRACK\s+\d+\s+AUDIO$/i.test(line)) {
      current = { number: parseInt(line.split(/\s+/)[1], 10), song: '', artist: '', file: '', start: null };
      rawTracks.push(current);
      continue;
    }

    // TITLE / PERFORMER before the first TRACK describe the mix itself.
    if (!current) continue;

    if (/^TITLE\s/i.test(line)) current.song = unquote(line, 'TITLE');
    else if (/^PERFORMER\s/i.test(line)) current.artist = unquote(line, 'PERFORMER');
    else if (/^FILE\s/i.test(line)) current.file = line.replace(/^FILE\s+/i, '').replace(/\s+\w+$/, '').replace(/^"(.*)"$/, '$1');
    else if (/^INDEX\s+01\s/i.test(line)) current.start = cueTimeToSeconds(line.split(/\s+/)[2]);
  }

  for (const track of rawTracks) {
    track.song = repairMojibake(track.song, track.file, track.number);
    track.artist = repairMojibake(track.artist, track.file, track.number);
  }

  const lastStart = rawTracks.length ? rawTracks[rawTracks.length - 1].start : null;
  let canMeasure = rawTracks.every(track => track.start !== null);
  if (canMeasure && totalDurationSeconds && lastStart > totalDurationSeconds) {
    console.warn(`Last INDEX (${secondsToHms(lastStart)}) exceeds the mix duration (${secondsToHms(totalDurationSeconds)}); keeping every track.`);
    canMeasure = false;
  }

  for (let i = 0; i < rawTracks.length; i++) {
    const track = rawTracks[i];
    track.label = `${track.artist} - ${track.song}`;
    track.key = track.label.toLowerCase();
    // Without a duration for the mix, the last track cannot be measured.
    const next = i + 1 < rawTracks.length ? rawTracks[i + 1].start : totalDurationSeconds;
    track.length = canMeasure && next !== null && next !== undefined ? next - track.start : null;
  }

  const tracks = [];
  const seen = new Map();

  for (const track of rawTracks) {
    // A short segment is a cue-up only when the same track is played longer
    // somewhere else. A short segment nobody replays is just a short track.
    if (track.length !== null && track.length < MAX_PREVIEW_SECONDS) {
      const realPlay = rawTracks.find(other => other.key === track.key && other.length > track.length);
      if (realPlay) {
        console.log(`Skipped track ${track.number} "${track.label}" (${Math.round(track.length)}s cue-up of track ${realPlay.number})`);
        continue;
      }
    }

    if (seen.has(track.key)) {
      console.log(`Skipped track ${track.number} "${track.label}" (duplicate of track ${seen.get(track.key)})`);
      continue;
    }

    seen.set(track.key, track.number);
    tracks.push({ artist: track.artist, song: track.song, start: track.start });
  }

  return tracks;
}

// The player's detail view needs timecodes. VirtualDJ mixes already have their
// .xml on the site, so only CUE mixes get this normalized companion file.
async function writeTracksJson(basename, tracks, onlyIfMissing = false) {
  const jsonPath = path.join(MIXS_XML_DIR, basename + '.tracks.json');
  if (onlyIfMissing && existsSync(jsonPath)) return;

  const content = JSON.stringify(
    tracks.map(track => ({ song: track.song, artist: track.artist, start: track.start })),
    null,
    2
  ) + '\n';

  if (existsSync(jsonPath) && await fs.readFile(jsonPath, 'utf-8') === content) return;

  if (DRY_RUN) {
    console.log(`Would write ${basename}.tracks.json (${tracks.length} tracks).`);
    return;
  }

  await fs.writeFile(jsonPath, content);
  console.log(`Wrote ${basename}.tracks.json (${tracks.length} tracks).`);
}

// --- Tracklist loading --------------------------------------------------

function parseVirtualDjTracks(mixJs) {
  if (!mixJs.recordEvents || !mixJs.recordEvents.track) return null;
  const tracks = mixJs.recordEvents.track;
  tracks.sort((a, b) => parseFloat(a.interval[0].$.start) - parseFloat(b.interval[0].$.start));
  return tracks.map(track => ({ artist: track.$.artist, song: track.$.song }));
}

// VirtualDJ .xml wins over Rekordbox .cue when both are present.
async function loadTracklist(parser, basename, mp3Path) {
  const xmlPath = path.join(MIXS_XML_DIR, basename + '.xml');
  const cuePath = path.join(MIXS_XML_DIR, basename + '.cue');

  if (existsSync(xmlPath)) {
    const mixJs = await parser.parseStringPromise(await fs.readFile(xmlPath, 'utf-8'));
    const tracks = parseVirtualDjTracks(mixJs);
    return {
      source: 'xml',
      tracks: tracks || [],
      playlistHtml: tracks ? buildPlaylistHtml(tracks) : NO_TRACK_LIST,
      durationHms: mixJs.recordEvents && mixJs.recordEvents.$ ? secondsToHms(mixJs.recordEvents.$.length) : '00:00:00'
    };
  }

  if (existsSync(cuePath)) {
    const durationSeconds = mp3Path ? await readMp3DurationSeconds(mp3Path) : null;
    const tracks = parseCueSheet(await fs.readFile(cuePath, 'utf-8'), durationSeconds);
    return {
      source: 'cue',
      tracks,
      playlistHtml: tracks.length ? buildPlaylistHtml(tracks) : NO_TRACK_LIST,
      durationHms: durationSeconds ? secondsToHms(durationSeconds) : '00:00:00'
    };
  }

  console.log(`No XML nor CUE found for ${basename}, registering with no track list.`);
  return { source: null, tracks: [], playlistHtml: NO_TRACK_LIST, durationHms: '00:00:00' };
}

function findRssItem(rssJs, basename) {
  return rssJs.rss.channel[0].item.find(item => {
    if (!item.enclosure || !item.enclosure[0] || !item.enclosure[0].$.url) return false;
    const urlBasename = path.basename(item.enclosure[0].$.url, '.mp3');
    return basename.toLowerCase() === urlBasename.toLowerCase();
  });
}

async function updateRss() {
  try {
    if (DRY_RUN) console.log('Dry run: no file will be written or deleted.\n');

    const parser = new xml2js.Parser();
    const builder = new xml2js.Builder({
      cdata: true,
      headless: true,
      renderOpts: { 'pretty': true, 'indent': '  ', 'newline': '\n' }
    });

    const rssFileContent = await fs.readFile(RSS_PATH, 'utf-8');
    const rssJs = await parser.parseStringPromise(rssFileContent);

    const playlistContent = await fs.readFile(PLAYLIST_PATH, 'utf-8');

    const mixFiles = await fs.readdir(MIXS_XML_DIR);
    let newPlaylistEntries = [];

    // Pass 1: detect new items from MP3 files (tracklist is optional)
    for (const mixFile of mixFiles) {
      if (path.extname(mixFile) !== '.mp3') continue;

      const mp3Basename = path.basename(mixFile, '.mp3');

      if (findRssItem(rssJs, mp3Basename)) continue;

      // Rekordbox playlist exports sometimes leave a leftover "01 " track-number
      // prefix on the filename. That breaks the YYYY-MM-DD parsing below and
      // puts a raw space in the enclosure URL, so catch it here instead of
      // publishing a corrupt item.
      if (!/^\d{4}-\d{2}-\d{2}-/.test(mp3Basename)) {
        console.warn(`Skipping "${mixFile}": filename doesn't start with YYYY-MM-DD-, rename it and rerun.`);
        continue;
      }

      console.log(`New mix found: ${mp3Basename}`);

      const mp3Path = path.join(MIXS_XML_DIR, mixFile);
      const { playlistHtml, durationHms, tracks, source } = await loadTracklist(parser, mp3Basename, mp3Path);
      if (source === 'cue' && tracks.length) await writeTracksJson(mp3Basename, tracks);

      const stats = await fs.stat(mp3Path);
      const lengthBytes = stats.size;

      // Extract title components from filename: 2026-01-25-House-Mix
      const parts = mp3Basename.split('-');
      const dateStr = parts.slice(0, 3).join('-');
      const mixTitle = parts.slice(3).join(' ');
      const formattedDate = formatDate(dateStr);

      const newItem = {
        title: [`JefBinomed - ${dateStr} - ${mixTitle}`],
        'itunes:author': ['JefBinomed'],
        'itunes:subtitle': [`${mixTitle}`],
        description: [`<p>${mixTitle} of ${parseInt(parts[2], 10)} ${MONTHS[parseInt(parts[1], 10) - 1]} ${parts[0]}</p>${playlistHtml}`],
        'itunes:image': [{ $: { href: 'https://jef.binomed.fr/binomed_mix/img/binomed_sun_flower.png' } }],
        enclosure: [{ $: { url: `${STORAGE_URL_BASE}${mp3Basename}.mp3`, length: lengthBytes.toString(), type: 'audio/mpeg' } }],
        guid: [`${STORAGE_URL_BASE}${mp3Basename}.mp3`],
        pubDate: [formattedDate],
        'itunes:duration': [durationHms],
        'itunes:keywords': ['DJ JefBinomed, House, Mix'],
        'itunes:explicit': ['false']
      };

      rssJs.rss.channel[0].item.unshift(newItem);

      newPlaylistEntries.push({
        title: `${dateStr} - ${mixTitle}`,
        file: `${STORAGE_URL_BASE}${mp3Basename}.mp3`,
        image: 'img/binomed_sun_flower.png'
      });

      if (DRY_RUN) {
        console.log(`Would add ${mp3Basename} (duration ${durationHms}) and delete its mp3.`);
      } else {
        await fs.unlink(mp3Path);
        console.log(`Added new mix to RSS and deleted ${mp3Basename}.mp3`);
      }
    }

    // Pass 2: enrich existing items with their tracklist if not already present
    for (const mixFile of mixFiles) {
      const extension = path.extname(mixFile);
      if (extension !== '.xml' && extension !== '.cue') continue;

      const basename = path.basename(mixFile, extension);
      // The .xml has priority and already covered this mix.
      if (extension === '.cue' && existsSync(path.join(MIXS_XML_DIR, basename + '.xml'))) continue;

      const rssItem = findRssItem(rssJs, basename);
      if (!rssItem) continue;

      let originalDescription = rssItem.description[0];
      if (typeof originalDescription === 'object' && originalDescription._) {
        originalDescription = originalDescription._;
      }

      const refreshing = REFRESH && (REFRESH_TARGET ? REFRESH_TARGET === basename : extension === '.cue');

      // Nothing left to do for this mix: skip before parsing it again.
      const hasTracklist = originalDescription.includes(PLAYLIST_MARKER);
      const needsJson = extension === '.cue' && !existsSync(path.join(MIXS_XML_DIR, basename + '.tracks.json'));
      if (hasTracklist && !needsJson && !refreshing) continue;

      // The mp3 is gone by now, so no duration: the last track stays unmeasured.
      // Pass 1 ran with the mp3 at hand, so its .tracks.json stays authoritative
      // unless we are explicitly refreshing this mix.
      const { playlistHtml, tracks, source } = await loadTracklist(parser, basename, null);
      if (source === 'cue' && tracks.length) await writeTracksJson(basename, tracks, !refreshing);

      if (playlistHtml === NO_TRACK_LIST) {
        if (!hasTracklist) console.warn(`Skipping ${mixFile}: No tracks found.`);
        continue;
      }

      if (hasTracklist) {
        if (!refreshing) continue;
        const previousCount = (originalDescription.match(/<li>/g) || []).length;
        // Keep the "<p>Mix of …</p>" header, swap the tracklist that follows it.
        rssItem.description[0] = originalDescription.split(PLAYLIST_MARKER)[0] + playlistHtml;
        console.log(`Refreshed ${basename} (${previousCount} -> ${tracks.length} tracks)`);
        continue;
      }

      const stripped = originalDescription.replace(NO_TRACK_LIST, '').trim();
      rssItem.description[0] = `<p>${stripped || originalDescription}</p>${playlistHtml}`;
      console.log(`Updated playlist for existing item: ${basename}`);
    }

    if (DRY_RUN) {
      console.log('\nDry run finished: jefbinomed.rss and playlist.js left untouched.');
      return;
    }

    // Update RSS file
    const finalXml = builder.buildObject(rssJs);
    const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>\n';
    await fs.writeFile(RSS_PATH, xmlDeclaration + finalXml);
    console.log('RSS file updated successfully!');

    // Update Playlist file
    if (newPlaylistEntries.length > 0) {
      let updatedPlaylistContent = playlistContent;
      for (const entry of newPlaylistEntries) {
        const entryStr = `    {
        title: '${entry.title}',
        file: '${entry.file}',
        image: '${entry.image}',
    },`;
        updatedPlaylistContent = updatedPlaylistContent.replace('var binomedPlayList = [', `var binomedPlayList = [\n${entryStr}`);
      }
      await fs.writeFile(PLAYLIST_PATH, updatedPlaylistContent);
      console.log('Playlist file updated successfully!');
    }

  } catch (error) {
    console.error('An error occurred:', error);
  }
}

updateRss();
