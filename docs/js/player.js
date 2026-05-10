/*!
 *  Howler.js Audio Player Demo
 *  howlerjs.com
 *
 *  (c) 2013-2020, James Simpson of GoldFire Studios
 *  goldfirestudios.com
 *
 *  MIT License
 */

// Cache references to DOM elements.
var elms = [
    'player-track-title',
    'player-timer',
    'player-duration',
    'player-play-pause',
    'player-play-icon',
    'player-prev',
    'player-next',
    'player-progress-bar',
    'player-progress-container',
    'player-album-art',
    'player-volume-bar',
    'player-volume-container',
    // Mocks and remaining elements
    'loading',
    'playlist',
    'list',
    'waveform',
];
elms.forEach(function (elm) {
    window[elm.replace(/-/g, '_')] = document.getElementById(elm);
});

// Alias for compatibility with the rest of the script (to avoid massive refactoring)
var track = player_track_title;
var timer = player_timer;
var duration = player_duration;
var playBtn = player_play_pause;
var pauseBtn = player_play_pause; // Same button in new design
var prevBtn = player_prev;
var nextBtn = player_next;
var progress = player_progress_bar;
var image = player_album_art;
var barFull = player_volume_bar;
var barEmpty = player_volume_container;

/**
 * Player class containing the state of our playlist and where we are in it.
 * Includes all methods for playing, skipping, updating the display, etc.
 * @param {Array} playlist Array of objects with playlist song details ({title, file, howl}).
 */
var Player = function (playlist) {
    this.playlist = playlist;
    this.index = 0;
    this.howl = null;

    // Display the title of the first track.
    track.innerHTML = playlist[0].title;
    if (playlist[0].image != null) {
        image.src = playlist[0].image;
    } else {
        image.src = 'djdadoo-new.jpg';
    }

    // Setup the playlist display.
    playlist.forEach(function (song) {
        var div = document.createElement('div');
        div.className = 'list-song';
        div.innerHTML = song.title;
        div.onclick = function () {
            player.skipTo(playlist.indexOf(song));
        };
        if (list) list.appendChild(div);
    });
};
Player.prototype = {
    /**
     * Play a song in the playlist.
     * @param  {Number} index Index of the song in the playlist (leave empty to play the first or current).
     */
    play: function (index) {
        var self = this;
        var sound;

        index = typeof index === 'number' ? index : self.index;
        var data = self.playlist[index];

        // If we already loaded this track, use the current one.
        // Otherwise, setup and load a new Howl.
        if (this.howl) {
            sound = this.howl;
        } else {
            sound = this.howl = new Howl({
                src: data.file,
                html5: true, // Force to HTML5 so that the audio can stream in (best for large files).
                onplay: function () {
                    // Display the duration.
                    duration.innerHTML = self.formatTime(
                        Math.round(sound.duration())
                    );

                    // Start updating the progress of the track.
                    requestAnimationFrame(self.step.bind(self));

                    // Update UI
                    player_play_icon.innerHTML = 'pause_circle';
                    if (loading) loading.style.display = 'none';
                },
                onload: function () {
                    if (loading) loading.style.display = 'none';
                    if (data.image != null) {
                        image.src = data.image;
                    } else {
                        image.src = 'djdadoo-new.jpg';
                    }
                },
                onend: function () {
                    self.skip('next');
                },
                onpause: function () {
                    player_play_icon.innerHTML = 'play_circle';
                },
                onstop: function () {
                    player_play_icon.innerHTML = 'play_circle';
                },
                onseek: function () {
                    // Start updating the progress of the track.
                    requestAnimationFrame(self.step.bind(self));
                },
            });
        }

        // Begin playing the sound.
        sound.play();

        // Update the track display.
        track.innerHTML = data.title;

        // Show the pause icon.
        if (sound.state() === 'loaded') {
            player_play_icon.innerHTML = 'pause_circle';
        } else {
            if (loading) loading.style.display = 'block';
            player_play_icon.innerHTML = 'play_circle';
        }

        // Keep track of the index we are currently playing.
        self.index = index;
    },

    /**
     * Pause the currently playing track.
     */
    pause: function () {
        var self = this;

        // Get the Howl we want to manipulate.
        var sound = self.howl;

        // Pause the sound.
        if (sound) sound.pause();

        // Show the play icon.
        player_play_icon.innerHTML = 'play_circle';
    },

    /**
     * Skip to the next or previous track.
     * @param  {String} direction 'next' or 'prev'.
     */
    skip: function (direction) {
        var self = this;

        // Get the next track based on the direction of the track.
        var index = 0;
        if (direction === 'prev') {
            index = self.index - 1;
            if (index < 0) {
                index = self.playlist.length - 1;
            }
        } else {
            index = self.index + 1;
            if (index >= self.playlist.length) {
                index = 0;
            }
        }

        self.skipTo(index);
    },

    /**
     * Skip to a specific track based on its playlist index.
     * @param  {Number} index Index in the playlist.
     */
    skipTo: function (index) {
        var self = this;

        // Stop the current track.
        if (self.howl) {
            self.howl.stop();
            self.howl.unload();
            self.howl = null;
        }

        // Reset progress.
        progress.style.width = '0%';

        // Play the new track.
        self.play(index);
    },

    /**
     * Set the volume and update the volume slider display.
     * @param  {Number} val Volume between 0 and 1.
     */
    volume: function (val) {
        var self = this;

        // Update the global volume (affecting all Howls).
        Howler.volume(val);

        // Update the display on the slider.
        barFull.style.width = (val * 100) + '%';
        
        // Update volume icon based on level
        var icon = 'volume_up';
        if (val === 0) icon = 'volume_off';
        else if (val < 0.5) icon = 'volume_down';
        document.getElementById('player-volume-icon').innerHTML = icon;
    },

    /**
     * Seek to a new position in the currently playing track.
     * @param  {Number} per Percentage through the song to skip.
     */
    seek: function (per) {
        var self = this;

        // Get the Howl we want to manipulate.
        var sound = self.howl;

        // Convert the percent into a seek position.
        if (sound && sound.playing()) {
            sound.seek(sound.duration() * per);
        }
    },

    /**
     * The step called within requestAnimationFrame to update the playback position.
     */
    step: function () {
        var self = this;

        // Get the Howl we want to manipulate.
        var sound = self.howl;

        // Determine our current seek position.
        var seek = sound.seek() || 0;
        timer.innerHTML = self.formatTime(Math.round(seek));
        progress.style.width = ((seek / sound.duration()) * 100 || 0) + '%';

        // If the sound is still playing, continue stepping.
        if (sound.playing()) {
            requestAnimationFrame(self.step.bind(self));
        }
    },

    /**
     * Toggle the playlist display on/off.
     */
    togglePlaylist: function () {
        if (!playlist) return;
        var self = this;
        var display = playlist.style.display === 'block' ? 'none' : 'block';

        setTimeout(
            function () {
                playlist.style.display = display;
            },
            display === 'block' ? 0 : 500
        );
        playlist.className = display === 'block' ? 'fadein' : 'fadeout';
    },

    /**
     * Toggle the volume display on/off.
     */
    toggleVolume: function () {
        // Not used anymore in the new design as volume is always visible or handled differently
    },

    /**
     * Format the time from seconds to M:SS.
     * @param  {Number} secs Seconds to format.
     * @return {String}      Formatted time.
     */
    formatTime: function (secs) {
        var minutes = Math.floor(secs / 60) || 0;
        var seconds = secs - minutes * 60 || 0;

        return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
    },
};

// Setup our new audio player class and pass it the playlist.
var player = new Player(binomedPlayList);

// Bind our player controls.
playBtn.addEventListener('click', function () {
    if (player.howl && player.howl.playing()) {
        player.pause();
    } else {
        player.play();
    }
});
prevBtn.addEventListener('click', function () {
    player.skip('prev');
});
nextBtn.addEventListener('click', function () {
    player.skip('next');
});

// New progress bar handling
player_progress_container.addEventListener('click', function (event) {
    var rect = player_progress_container.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var per = x / rect.width;
    player.seek(per);
});

// New volume handling
player_volume_container.addEventListener('click', function (event) {
    var rect = player_volume_container.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var per = Math.min(1, Math.max(0, x / rect.width));
    player.volume(per);
});

// Setup the event listeners to enable dragging of volume slider (Simplified for Phase 2)
var moveVolume = function (event) {
    if (window.sliderDown) {
        var x = event.clientX || (event.touches ? event.touches[0].clientX : 0);
        var rect = player_volume_container.getBoundingClientRect();
        var layerX = x - rect.left;
        var per = Math.min(1, Math.max(0, layerX / rect.width));
        player.volume(per);
    }
};

player_volume_container.addEventListener('mousedown', function () { window.sliderDown = true; });
window.addEventListener('mouseup', function () { window.sliderDown = false; });
window.addEventListener('mousemove', moveVolume);

/* Setup the "waveform" animation.
var wave = new SiriWave({
    container: waveform,
    style: 'ios9',
    ratio: 1,
    speed: 0.03,
    amplitude: 3,
    frequency: 2,
});
wave.stop(); */

// Mock wave object to avoid errors in Player.prototype.play
var wave = {
    start: function() {},
    stop: function() {}
};

// Update the height of the wave animation.
var resize = function () {
    // Update the position of the slider.
    if (player && player.playlist && player.playlist[player.index]) {
        var sound = player.playlist[player.index].howl;
        if (sound) {
            var vol = sound.volume();
            var barWidth = vol * 0.9;
            sliderBtn.style.left =
                window.innerWidth * barWidth + window.innerWidth * 0.05 - 25 + 'px';
        }
    }
};
window.addEventListener('resize', resize);
resize();
