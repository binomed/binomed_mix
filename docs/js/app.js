/**
 * App logic for DJ JefBinomed Mixes
 * Handles view switching (SPA) and dynamic content generation
 */

const App = {
    durations: {},
    tracklists: {},
    currentView: 'home',
    currentMixIndex: 0,
    currentDetailedTracks: [],

    async init() {
        this.pageContainer = document.getElementById('page-container');
        await this.loadRSSData();
        this.renderHome();

        // Listen for track changes to update detail view if active
        window.addEventListener('player-timeupdate', (e) => {
            this.updateWaveform(e.detail.per);
        });
    },

    async loadRSSData() {
        try {
            const response = await fetch('./jefbinomed.rss');
            const text = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            const items = xmlDoc.getElementsByTagName('item');
            
            for (let item of items) {
                const url = item.getElementsByTagName('enclosure')[0]?.getAttribute('url');
                const duration = item.getElementsByTagName('itunes:duration')[0]?.textContent;
                const description = item.getElementsByTagName('description')[0]?.textContent;
                
                if (url) {
                    if (duration) this.durations[url] = duration;
                    if (description) this.tracklists[url] = description;
                }
            }
        } catch (e) {
            console.error("Erreur lors du chargement du RSS :", e);
        }
    },

    renderHome() {
        this.currentView = 'home';
        if (!binomedPlayList || binomedPlayList.length === 0) return;

        const featured = binomedPlayList[0];
        const pastMixes = binomedPlayList.slice(1);

        let html = `
            <section class="mb-lg relative rounded-3xl overflow-hidden aspect-[16/9] md:aspect-[21/9] group shadow-xl cursor-pointer" onclick="App.renderDetail(0)">
                <img src="${featured.image}" alt="${featured.title}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105">
                <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                <div class="absolute bottom-0 left-0 p-8 md:p-12 w-full flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-3 mb-4">
                            <span class="px-3 py-1 bg-primary-container text-on-primary-container text-[10px] font-extrabold uppercase tracking-widest rounded-full">Dernière Sortie</span>
                            <span class="text-white/80 font-label-bold text-label-bold uppercase">${this.formatDateFromTitle(featured.title)}</span>
                        </div>
                        <h1 class="font-headline-lg text-headline-lg text-white leading-tight mb-2 truncate" style="text-shadow: 0 2px 10px rgba(0,0,0,0.5)">${this.cleanTitle(featured.title)}</h1>
                        <p class="text-white/80 font-body-lg text-body-lg max-w-xl">Cliquez pour voir les détails et la tracklist.</p>
                    </div>
                    <div class="flex flex-col items-center gap-2">
                        <button class="flex items-center justify-center gap-3 bg-primary-container text-on-primary-container px-10 py-5 rounded-full font-bold text-lg active-glow transition-all hover:scale-105 active:scale-95 group" onclick="event.stopPropagation(); player.play(0)" aria-label="Écouter le dernier mix">
                            <span class="material-symbols-outlined scale-150" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
                            <span>ÉCOUTER</span>
                        </button>
                        ${this.durations[featured.file] ? `<span class="text-white/60 text-xs font-bold">${this.durations[featured.file]}</span>` : ''}
                    </div>
                </div>
            </section>

            <section>
                <div class="flex items-center justify-between mb-sm">
                    <h2 class="font-headline-lg text-headline-lg text-on-surface">Anciens Mixs</h2>
                    <span class="text-secondary font-label-bold text-label-bold">${pastMixes.length} MIXS DISPONIBLES</span>
                </div>
                <div class="flex flex-col border border-outline-variant/30 rounded-xl overflow-hidden bg-surface-container-lowest shadow-sm">
                    ${pastMixes.map((mix, index) => `
                        <div class="flex items-center gap-md p-4 hover:bg-surface-container transition-colors border-b border-outline-variant/10 group cursor-pointer" onclick="App.renderDetail(${index + 1})" role="link" aria-label="Détail du mix ${this.cleanTitle(mix.title)}">
                            <div class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-primary-fixed">
                                <img src="${mix.image}" alt="" class="w-full h-full object-cover">
                            </div>
                            <div class="flex-1 min-w-0">
                                <h3 class="font-bold text-on-surface truncate group-hover:text-primary transition-colors">${this.cleanTitle(mix.title)}</h3>
                                <p class="text-sm text-on-surface-variant truncate">${this.formatDateFromTitle(mix.title)}</p>
                            </div>
                            <div class="flex items-center gap-4">
                                ${this.durations[mix.file] ? `<span class="text-xs font-bold text-on-surface-variant bg-surface-container-high px-2 py-1 rounded">${this.durations[mix.file]}</span>` : ''}
                                <button onclick="event.stopPropagation(); player.play(${index + 1})" class="material-symbols-outlined text-primary opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Jouer ce mix">play_circle</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </section>
        `;

        this.pageContainer.innerHTML = html;
        this.pageContainer.focus();
        window.scrollTo(0, 0);
    },

    async renderDetail(index) {
        this.currentView = 'detail';
        this.currentMixIndex = index;
        const mix = binomedPlayList[index];
        const duration = this.durations[mix.file] || "Durée inconnue";
        
        let html = `
            <div class="flex flex-col gap-lg animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
                <button onclick="App.renderHome()" class="flex items-center gap-2 text-primary font-bold hover:underline self-start focus:outline-none focus:ring-2 focus:ring-primary rounded-lg px-2 py-1">
                    <span class="material-symbols-outlined">arrow_back</span>
                    RETOUR À L'ACCUEIL
                </button>

                <div class="grid grid-cols-1 md:grid-cols-12 gap-lg lg:gap-xl">
                    <section class="md:col-span-5 flex flex-col gap-md">
                        <div class="aspect-square w-full rounded-2xl overflow-hidden border border-outline-variant bg-surface-container-low shadow-lg">
                            <img src="${mix.image}" alt="Pochette du mix" class="w-full h-full object-cover">
                        </div>
                        <div class="flex flex-col gap-xs mt-2">
                            <div class="flex items-center gap-2">
                                <span class="px-2 py-0.5 bg-primary-container/20 text-primary text-[10px] font-bold uppercase rounded-md tracking-tighter">Mix Series</span>
                                <span class="text-secondary text-sm font-bold uppercase">${this.formatDateFromTitle(mix.title)}</span>
                            </div>
                            <h1 class="font-headline-lg text-headline-lg text-on-surface leading-tight">${this.cleanTitle(mix.title)}</h1>
                            <p class="text-secondary font-body-lg">${duration} • Curated by JefBinomed</p>
                        </div>

                        <div class="bg-surface-container-low border border-outline-variant rounded-xl p-6 mt-2 relative overflow-hidden group shadow-sm">
                            <div id="detail-waveform" class="flex items-end justify-between h-24 gap-[3px] cursor-pointer" role="slider" aria-label="Navigation dans le mix" aria-valuemin="0" aria-valuemax="100">
                                ${this.generateWaveformHtml()}
                            </div>
                            <div class="flex justify-between mt-4">
                                <span id="detail-timer" class="text-label-sm font-bold text-primary" aria-live="polite">0:00</span>
                                <span class="text-label-sm font-bold text-secondary">${duration}</span>
                            </div>
                        </div>

                        <button onclick="player.play(${index})" class="flex items-center justify-center gap-3 bg-primary text-on-primary px-8 py-4 rounded-full font-bold text-lg hover:scale-105 transition-transform active:scale-95 shadow-md focus:outline-none focus:ring-2 focus:ring-primary">
                            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">play_circle</span>
                            LANCER LE MIX
                        </button>
                    </section>

                    <section class="md:col-span-7">
                        <div class="flex flex-col bg-surface border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
                            <div class="px-md py-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
                                <h3 class="font-headline-md text-headline-md text-on-surface">Tracklist détaillée</h3>
                                <span class="material-symbols-outlined text-secondary">queue_music</span>
                            </div>
                            <div id="tracklist-container" class="p-md text-on-surface-variant overflow-y-auto max-h-[600px] scrollbar-thin">
                                <div class="animate-pulse flex flex-col gap-4">
                                    <div class="h-4 bg-surface-container-high rounded w-3/4"></div>
                                    <div class="h-4 bg-surface-container-high rounded w-1/2"></div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        `;

        this.pageContainer.innerHTML = html;
        this.pageContainer.focus();
        window.scrollTo(0, 0);
        this.initDetailWaveform();
        this.loadDetailedTracklist(mix);

        if (player.index === index && player.howl && player.howl.playing()) {
            this.updateWaveform(player.howl.seek() / player.howl.duration());
        }
    },

    async loadDetailedTracklist(mix) {
        const container = document.getElementById('tracklist-container');
        try {
            const mp3Name = mix.file.split('/').pop().replace('.mp3', '');
            const xmlPath = `./mixsXML/${mp3Name}.xml`;
            
            const response = await fetch(xmlPath);
            if (!response.ok) throw new Error('XML not found');
            
            const text = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            const trackNodes = xmlDoc.getElementsByTagName('track');
            
            this.currentDetailedTracks = [];
            for (let node of trackNodes) {
                const song = node.getAttribute('song');
                const artist = node.getAttribute('artist');
                const start = parseFloat(node.getElementsByTagName('interval')[0]?.getAttribute('start') || 0);
                this.currentDetailedTracks.push({ song, artist, start });
            }

            this.currentDetailedTracks.sort((a, b) => a.start - b.start);

            if (this.currentDetailedTracks.length === 0) {
                container.innerHTML = this.tracklists[mix.file] || "Aucune tracklist disponible.";
                return;
            }

            let html = '<ul class="flex flex-col gap-0">';
            this.currentDetailedTracks.forEach((t, i) => {
                html += `
                    <li id="track-item-${i}" class="track-item flex items-center gap-4 py-3 border-b border-outline-variant/10 hover:bg-surface-container-low transition-colors group cursor-pointer" onclick="App.seekToTime(${t.start})">
                        <span class="text-xs font-bold text-secondary w-8 index-col">${(i+1).toString().padStart(2, '0')}</span>
                        <span class="text-xs font-medium text-primary w-12 time-col">${player.formatTime(Math.round(t.start))}</span>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-bold text-on-surface truncate group-hover:text-primary title-col">${t.song}</p>
                            <p class="text-xs text-secondary truncate artist-col">${t.artist}</p>
                        </div>
                        <span class="material-symbols-outlined text-primary opacity-0 group-hover:opacity-100 text-sm play-icon">play_circle</span>
                    </li>
                `;
            });
            html += '</ul>';
            container.innerHTML = html;

        } catch (e) {
            container.innerHTML = this.tracklists[mix.file] || "Aucune tracklist disponible.";
        }
    },

    seekToTime(seconds) {
        if (this.currentMixIndex !== player.index) {
            player.play(this.currentMixIndex);
            const checkLoad = setInterval(() => {
                if (player.howl && player.howl.state() === 'loaded') {
                    player.howl.seek(seconds);
                    clearInterval(checkLoad);
                }
            }, 200);
        } else {
            if (player.howl) player.howl.seek(seconds);
        }
    },

    generateWaveformHtml() {
        let bars = '';
        for (let i = 0; i < 60; i++) {
            const h = 20 + Math.random() * 60;
            bars += `<div class="waveform-bar w-1 bg-outline-variant rounded-full transition-all duration-300" style="height: ${h}%" data-index="${i}"></div>`;
        }
        return bars;
    },

    initDetailWaveform() {
        const wf = document.getElementById('detail-waveform');
        if (!wf) return;

        wf.addEventListener('click', (e) => {
            const rect = wf.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const per = x / rect.width;
            if (this.currentMixIndex === player.index) {
                player.seek(per);
            } else {
                player.play(this.currentMixIndex);
                const checkLoad = setInterval(() => {
                    if (player.howl && player.howl.state() === 'loaded') {
                        player.seek(per);
                        clearInterval(checkLoad);
                    }
                }, 200);
            }
        });

        if (!document.getElementById('waveform-styles')) {
            const style = document.createElement('style');
            style.id = 'waveform-styles';
            style.innerHTML = `
                .waveform-bar.played { background-color: #845400 !important; opacity: 1 !important; }
                .waveform-bar.active { background-color: #f2a01d !important; transform: scaleY(1.2); opacity: 1 !important; }
            `;
            document.head.appendChild(style);
        }
    },

    updateWaveform(per) {
        if (this.currentView !== 'detail' || this.currentMixIndex !== player.index) return;
        const bars = document.querySelectorAll('.waveform-bar');
        if (bars.length === 0) return;

        const activeIdx = Math.floor(per * bars.length);
        bars.forEach((bar, i) => {
            if (i < activeIdx) {
                bar.classList.add('played');
                bar.classList.remove('active');
            } else if (i === activeIdx) {
                bar.classList.add('active');
                bar.classList.remove('played');
            } else {
                bar.classList.remove('played', 'active');
            }
        });

        // Update active track in list
        if (this.currentDetailedTracks && this.currentDetailedTracks.length > 0 && player.howl) {
            const currentTime = player.howl.seek();
            let activeTrackIdx = -1;
            for (let i = 0; i < this.currentDetailedTracks.length; i++) {
                if (currentTime >= this.currentDetailedTracks[i].start) {
                    activeTrackIdx = i;
                } else {
                    break;
                }
            }
            
            document.querySelectorAll('.track-item').forEach((el, idx) => {
                if (idx === activeTrackIdx) {
                    el.classList.add('bg-primary-container/10', 'border-primary/20');
                    const titleCol = el.querySelector('.title-col');
                    if (titleCol) titleCol.classList.add('text-primary');
                    const playIcon = el.querySelector('.play-icon');
                    if (playIcon) {
                        playIcon.classList.remove('opacity-0');
                        playIcon.innerHTML = 'equalizer';
                    }
                } else {
                    el.classList.remove('bg-primary-container/10', 'border-primary/20');
                    const titleCol = el.querySelector('.title-col');
                    if (titleCol) titleCol.classList.remove('text-primary');
                    const playIcon = el.querySelector('.play-icon');
                    if (playIcon) {
                        playIcon.classList.add('opacity-0');
                        playIcon.innerHTML = 'play_circle';
                    }
                }
            });
        }

        const dt = document.getElementById('detail-timer');
        if (dt && player.howl) {
            const currentSeek = player.howl.seek();
            if (typeof currentSeek === 'number') {
                dt.innerHTML = player.formatTime(Math.round(currentSeek));
            }
        }
    },

    formatDateFromTitle(title) {
        const match = title.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return "Date inconnue";
        const [_, year, month, day] = match;
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    },

    cleanTitle(title) {
        return title.replace(/^\d{4}-\d{2}-\d{2}\s*-\s*/, '');
    }
};

window.addEventListener('DOMContentLoaded', () => App.init());
