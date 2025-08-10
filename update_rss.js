const fs = require('fs').promises;
const path = require('path');
const xml2js = require('xml2js');

const RSS_PATH = path.join(__dirname, 'docs', 'jefbinomed.rss');
const MIXS_XML_DIR = path.join(__dirname, 'docs', 'mixsXML');

async function updateRss() {
  try {
    const parser = new xml2js.Parser();
    const builder = new xml2js.Builder({
      cdata: true,
      headless: true, // We'll add the XML declaration manually
      renderOpts: { 'pretty': true, 'indent': '  ', 'newline': '\n' }
    });

    const rssFileContent = await fs.readFile(RSS_PATH, 'utf-8');
    const rssJs = await parser.parseStringPromise(rssFileContent);

    const mixFiles = await fs.readdir(MIXS_XML_DIR);

    for (const mixFile of mixFiles) {
      if (path.extname(mixFile) !== '.xml') continue;

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

      const xmlBasename = path.basename(mixFile, '.xml');
      const rssItem = rssJs.rss.channel[0].item.find(item => {
        if (!item.enclosure || !item.enclosure[0] || !item.enclosure[0].$.url) return false;
        const enclosureUrl = item.enclosure[0].$.url;
        const urlBasename = path.basename(enclosureUrl, '.mp3');
        return xmlBasename.toLowerCase() === urlBasename.toLowerCase();
      });

      if (rssItem) {
        let originalDescription = rssItem.description[0];
        // If parser returns an object (from CDATA), get the actual content
        if (typeof originalDescription === 'object' && originalDescription._) {
          originalDescription = originalDescription._;
        }

        // Check if a playlist is already there. If so, do nothing.
        if (originalDescription.includes('<h4>Playlist:</h4>')) continue;
        
        // Set the new description content. The builder will wrap it in CDATA.
        rssItem.description[0] = `<p>${originalDescription}</p>${playlistHtml}`;

      } else {
        console.warn(`Could not find matching RSS item for ${mixFile}`);
      }
    }

    const finalXml = builder.buildObject(rssJs);
    const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>\n';
    await fs.writeFile(RSS_PATH, xmlDeclaration + finalXml);

    console.log('RSS file updated successfully with clean CDATA!');

  } catch (error) {
    console.error('An error occurred:', error);
  }
}

updateRss();
