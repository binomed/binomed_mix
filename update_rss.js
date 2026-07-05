const fs = require('fs').promises;
const { existsSync } = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const RSS_PATH = path.join(__dirname, 'docs', 'jefbinomed.rss');
const PLAYLIST_PATH = path.join(__dirname, 'docs', 'playlist.js');
const MIXS_XML_DIR = path.join(__dirname, 'docs', 'mixsXML');
const STORAGE_URL_BASE = 'https://storage.googleapis.com/binomed-mix/';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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

async function updateRss() {
  try {
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
    let playlistUpdated = false;
    let newPlaylistEntries = [];

    // Pass 1: detect new items from MP3 files (XML is optional)
    for (const mixFile of mixFiles) {
      if (path.extname(mixFile) !== '.mp3') continue;

      const mp3Basename = path.basename(mixFile, '.mp3');

      const alreadyInRss = rssJs.rss.channel[0].item.some(item => {
        if (!item.enclosure || !item.enclosure[0] || !item.enclosure[0].$.url) return false;
        const urlBasename = path.basename(item.enclosure[0].$.url, '.mp3');
        return mp3Basename.toLowerCase() === urlBasename.toLowerCase();
      });

      if (alreadyInRss) continue;

      console.log(`New mix found: ${mp3Basename}`);

      // Try to load XML tracklist if available
      const xmlPath = path.join(MIXS_XML_DIR, mp3Basename + '.xml');
      let playlistHtml = '<p>No track list</p>';
      let durationHms = '00:00:00';

      if (existsSync(xmlPath)) {
        const mixFileContent = await fs.readFile(xmlPath, 'utf-8');
        const mixJs = await parser.parseStringPromise(mixFileContent);

        if (mixJs.recordEvents && mixJs.recordEvents.track) {
          const tracks = mixJs.recordEvents.track;
          tracks.sort((a, b) => parseFloat(a.interval[0].$.start) - parseFloat(b.interval[0].$.start));
          playlistHtml = `<h4>Playlist:</h4><ul>\n` +
            tracks.map(track => `  <li>${track.$.artist} - ${track.$.song}</li>`).join('\n') +
            `\n</ul>`;
        }

        if (mixJs.recordEvents && mixJs.recordEvents.$) {
          durationHms = secondsToHms(mixJs.recordEvents.$.length);
        }
      } else {
        console.log(`No XML found for ${mp3Basename}, registering with no track list.`);
      }

      const mp3Path = path.join(MIXS_XML_DIR, mixFile);
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

      await fs.unlink(mp3Path);
      console.log(`Added new mix to RSS and deleted ${mp3Basename}.mp3`);
    }

    // Pass 2: enrich existing items with XML tracklist if not already present
    for (const mixFile of mixFiles) {
      if (path.extname(mixFile) !== '.xml') continue;

      const xmlBasename = path.basename(mixFile, '.xml');
      const mixFilePath = path.join(MIXS_XML_DIR, mixFile);
      const mixFileContent = await fs.readFile(mixFilePath, 'utf-8');
      const mixJs = await parser.parseStringPromise(mixFileContent);

      if (!mixJs.recordEvents || !mixJs.recordEvents.track) {
        console.warn(`Skipping ${mixFile}: No tracks found.`);
        continue;
      }

      const tracks = mixJs.recordEvents.track;
      tracks.sort((a, b) => parseFloat(a.interval[0].$.start) - parseFloat(b.interval[0].$.start));

      const playlistHtml = `<h4>Playlist:</h4><ul>\n` +
        tracks.map(track => `  <li>${track.$.artist} - ${track.$.song}</li>`).join('\n') +
        `\n</ul>`;

      const rssItem = rssJs.rss.channel[0].item.find(item => {
        if (!item.enclosure || !item.enclosure[0] || !item.enclosure[0].$.url) return false;
        const urlBasename = path.basename(item.enclosure[0].$.url, '.mp3');
        return xmlBasename.toLowerCase() === urlBasename.toLowerCase();
      });

      if (rssItem) {
        let originalDescription = rssItem.description[0];
        if (typeof originalDescription === 'object' && originalDescription._) {
          originalDescription = originalDescription._;
        }

        if (!originalDescription.includes('<h4>Playlist:</h4>')) {
          const stripped = originalDescription.replace('<p>No track list</p>', '').trim();
          rssItem.description[0] = `<p>${stripped || originalDescription}</p>${playlistHtml}`;
          console.log(`Updated playlist for existing item: ${xmlBasename}`);
        }
      }
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
