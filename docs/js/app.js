/**
 * App logic for DJ JefBinomed Mixes
 * Handles view switching (SPA) and dynamic content generation
 */

const App = {
    durations: {},

    async init() {
        this.pageContainer = document.getElementById('page-container');
        await this.loadRSSDurations();
        this.renderHome();
    },

    /**
     * Loads the RSS file and extracts durations mapped by MP3 URL
     */
    async loadRSSDurations() {
        try {
            const response = await fetch('./jefbinomed.rss');
            const text = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            const items = xmlDoc.getElementsByTagName('item');
            
            for (let item of items) {
                const url = item.getElementsByTagName('enclosure')[0]?.getAttribute('url');
                const duration = item.getElementsByTagName('itunes:duration')[0]?.textContent;
                if (url && duration) {
                    this.durations[url] = duration;
                }
            }
        } catch (e) {
            console.error("Erreur lors du chargement du RSS :", e);
        }
    },

    /**
     * Renders the Home view with Featured Mix and Past Mixes
     */
    renderHome() {
        if (!binomedPlayList || binomedPlayList.length === 0) return;

        const featured = binomedPlayList[0];
        const pastMixes = binomedPlayList.slice(1);

        let html = `
            <!-- Featured Section -->
            <section class="mb-lg relative rounded-3xl overflow-hidden aspect-[16/9] md:aspect-[21/9] group shadow-xl cursor-pointer" onclick="player.play(0)">
                <img src="${featured.image}" alt="${featured.title}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105">
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <div class="absolute bottom-0 left-0 p-8 md:p-12 w-full flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-3 mb-4">
                            <span class="px-3 py-1 bg-primary-container text-on-primary-container text-[10px] font-extrabold uppercase tracking-widest rounded-full">Dernière Sortie</span>
                            <span class="text-white/80 font-label-bold text-label-bold uppercase">${this.formatDateFromTitle(featured.title)}</span>
                        </div>
                        <h1 class="font-headline-lg text-headline-lg text-white leading-tight mb-2 truncate">${this.cleanTitle(featured.title)}</h1>
                        <p class="text-white/80 font-body-lg text-body-lg max-w-xl">Plongez dans le dernier mix exclusif de DJ JefBinomed.</p>
                    </div>
                    <div class="flex flex-col items-center gap-2">
                        <button class="flex items-center justify-center gap-3 bg-primary-container text-on-primary-container px-10 py-5 rounded-full font-bold text-lg active-glow transition-all hover:scale-105 active:scale-95 group">
                            <span class="material-symbols-outlined scale-150" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
                            <span>ÉCOUTER</span>
                        </button>
                        ${this.durations[featured.file] ? `<span class="text-white/60 text-xs font-bold">${this.durations[featured.file]}</span>` : ''}
                    </div>
                </div>
            </section>

            <!-- Past Mixes Section -->
            <section>
                <div class="flex items-center justify-between mb-sm">
                    <h2 class="font-headline-lg text-headline-lg text-on-surface">Anciens Mixs</h2>
                    <span class="text-secondary font-label-bold text-label-bold">${pastMixes.length} MIXS DISPONIBLES</span>
                </div>
                <div class="flex flex-col border border-outline-variant/30 rounded-xl overflow-hidden bg-surface-container-lowest">
                    ${pastMixes.map((mix, index) => `
                        <div class="flex items-center gap-md p-4 hover:bg-surface-container transition-colors border-b border-outline-variant/10 group cursor-pointer" onclick="player.play(${index + 1})">
                            <div class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-primary-fixed">
                                <img src="${mix.image}" alt="${mix.title}" class="w-full h-full object-cover">
                            </div>
                            <div class="flex-1 min-w-0">
                                <h3 class="font-bold text-on-surface truncate group-hover:text-primary transition-colors">${this.cleanTitle(mix.title)}</h3>
                                <p class="text-sm text-on-surface-variant truncate">${this.formatDateFromTitle(mix.title)}</p>
                            </div>
                            <div class="flex items-center gap-4">
                                ${this.durations[mix.file] ? `<span class="text-xs font-bold text-on-surface-variant bg-surface-container-high px-2 py-1 rounded">${this.durations[mix.file]}</span>` : ''}
                                <span class="material-symbols-outlined text-primary opacity-0 group-hover:opacity-100 transition-opacity">play_circle</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </section>
        `;

        this.pageContainer.innerHTML = html;
        window.scrollTo(0, 0);
    },

    /**
     * Extracts and formats date from title (YYYY-MM-DD - Title)
     */
    formatDateFromTitle(title) {
        const match = title.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return "Date inconnue";
        
        const [_, year, month, day] = match;
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    },

    /**
     * Removes the date prefix from the title
     */
    cleanTitle(title) {
        return title.replace(/^\d{4}-\d{2}-\d{2}\s*-\s*/, '');
    }
};

// Initialize App when everything is loaded
window.addEventListener('DOMContentLoaded', () => {
    App.init();
});
