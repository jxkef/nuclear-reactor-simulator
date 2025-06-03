class AudioManager {
    constructor() {
        // Track if user has interacted
        this.userInteracted = false;
        document.addEventListener('click', () => {
            this.userInteracted = true;
            document.getElementById('soundNotification').style.display = 'none';
        });

        // Sound file paths
        this.sounds = {
            overdrive_activate: 'assets/sounds/overdrive activate.mp3',
            overdrive_deactivate: 'assets/sounds/overdrive deactivate.mp3',
            high_temp_alarm: 'assets/sounds/high temp alarm.mp3',
            reactor_hum_low: 'assets/sounds/reactor hum low.mp3',
            reactor_hum_medium: 'assets/sounds/reactor hum medium.mp3',
            reactor_hum_high: 'assets/sounds/reactor hum high.mp3',
            turbine_whine_low: 'assets/sounds/turbine whine low.mp3',
            turbine_whine_high: 'assets/sounds/turbine whine high.mp3'
        };

        // Create audio elements for each sound
        this.audioElements = {};
        for (const [name, path] of Object.entries(this.sounds)) {
            const audio = new Audio();
            audio.src = path;
            this.audioElements[name] = audio;
        }

        // Ambient sound properties
        this.currentReactorHum = null;
        this.currentTurbineWhine = null;
        this.lastReactorHumLevel = null;
        this.lastTurbineWhineLevel = null;

        // Volume settings
        this.masterVolume = 0.5;
        this.updateAllVolumes();
    }

    playSound(name) {
        if (this.audioElements[name]) {
            // Allow UI sounds (button clicks) to play immediately, require interaction for others
            if (name === 'button_click' || this.userInteracted) {
                // Clone the audio to allow overlapping sounds
                const sound = this.audioElements[name].cloneNode();
                sound.volume = this.masterVolume;
                sound.play().catch(e => console.log('Audio playback failed:', e));
            }
        }
    }

    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        this.updateAllVolumes();
    }

    updateAllVolumes() {
        // Update all audio elements with the master volume
        for (const audio of Object.values(this.audioElements)) {
            audio.volume = this.masterVolume;
        }
        
        // Update current ambient sounds if playing
        if (this.currentReactorHum) {
            this.currentReactorHum.volume = this.masterVolume * 0.3;
        }
        if (this.currentTurbineWhine) {
            this.currentTurbineWhine.volume = this.masterVolume * 0.2;
        }
    }

    // Update ambient sounds based on reactor state
    updateAmbientSounds(reactor) {
        // Only play ambient sounds after user interaction
        if (!this.userInteracted) return;

        // Update reactor hum based on power output
        const powerRatio = reactor.powerOutput / reactor.maxPower;
        let reactorHumLevel;
        
        if (reactor.overdriveActive || powerRatio > 0.66) {
            reactorHumLevel = 'high';
        } else if (powerRatio > 0.33) {
            reactorHumLevel = 'medium';
        } else {
            reactorHumLevel = 'low';
        }

        // Only change sounds if the level has changed
        if (reactorHumLevel !== this.lastReactorHumLevel) {
            // Stop current hum if playing
            if (this.currentReactorHum) {
                this.currentReactorHum.pause();
                this.currentReactorHum.currentTime = 0;
            }

            // Start new hum
            const newHum = this.audioElements[`reactor_hum_${reactorHumLevel}`];
            newHum.loop = true;
            newHum.volume = this.masterVolume * 0.3;
            newHum.play().catch(e => console.log('Audio playback failed:', e));
            
            this.currentReactorHum = newHum;
            this.lastReactorHumLevel = reactorHumLevel;
        }

        // Update turbine whine based on RPM
        const rpmRatio = reactor.turbine.rpm / reactor.turbine.maxRpm;
        const turbineWhineLevel = rpmRatio >= 0.5 ? 'high' : 'low';

        if (turbineWhineLevel !== this.lastTurbineWhineLevel) {
            // Stop current whine if playing
            if (this.currentTurbineWhine) {
                this.currentTurbineWhine.pause();
                this.currentTurbineWhine.currentTime = 0;
            }

            // Start new whine
            const newWhine = this.audioElements[`turbine_whine_${turbineWhineLevel}`];
            newWhine.loop = true;
            newWhine.volume = this.masterVolume * 0.2;
            newWhine.play().catch(e => console.log('Audio playback failed:', e));
            
            this.currentTurbineWhine = newWhine;
            this.lastTurbineWhineLevel = turbineWhineLevel;
        }

        // Check for high temperature alarm (over 930°C)
        // if (reactor.temperature > 930 && !this.highTempAlarmPlaying) {
        //     this.playSound('high_temp_alarm');
        //     this.highTempAlarmPlaying = true;
        // } else if (reactor.temperature <= 930) {
        //     this.highTempAlarmPlaying = false;
        // }
    }
}
