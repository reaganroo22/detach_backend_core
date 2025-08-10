import { Audio } from 'expo-av';

class BackgroundAudioService {
  private static instance: BackgroundAudioService;
  private sound: Audio.Sound | null = null;
  private isInitialized = false;

  static getInstance(): BackgroundAudioService {
    if (!BackgroundAudioService.instance) {
      BackgroundAudioService.instance = new BackgroundAudioService();
    }
    return BackgroundAudioService.instance;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Configure audio mode for background playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      this.isInitialized = true;
      console.log('Background Audio Service initialized');
    } catch (error) {
      console.error('Failed to initialize background audio:', error);
      throw error;
    }
  }

  async loadAndPlay(uri: string): Promise<Audio.Sound> {
    try {
      await this.initialize();

      // Unload previous sound if exists
      if (this.sound) {
        await this.unloadSound();
      }

      // Create and load new sound
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        {
          shouldPlay: true,
          isLooping: false,
          volume: 1.0,
        }
      );

      this.sound = sound;
      console.log('Audio loaded and playing with background support');
      return sound;
    } catch (error) {
      console.error('Error loading audio:', error);
      throw error;
    }
  }

  async unloadSound() {
    if (this.sound) {
      try {
        await this.sound.unloadAsync();
        this.sound = null;
        console.log('Audio unloaded');
      } catch (error) {
        console.error('Error unloading audio:', error);
      }
    }
  }

  async play() {
    if (this.sound) {
      try {
        await this.sound.playAsync();
      } catch (error) {
        console.error('Error playing audio:', error);
      }
    }
  }

  async pause() {
    if (this.sound) {
      try {
        await this.sound.pauseAsync();
      } catch (error) {
        console.error('Error pausing audio:', error);
      }
    }
  }

  async stop() {
    if (this.sound) {
      try {
        await this.sound.stopAsync();
      } catch (error) {
        console.error('Error stopping audio:', error);
      }
    }
  }

  async setPosition(positionMillis: number) {
    if (this.sound) {
      try {
        await this.sound.setPositionAsync(positionMillis);
      } catch (error) {
        console.error('Error setting position:', error);
      }
    }
  }

  async setVolume(volume: number) {
    if (this.sound) {
      try {
        await this.sound.setVolumeAsync(volume);
      } catch (error) {
        console.error('Error setting volume:', error);
      }
    }
  }

  async setRate(rate: number) {
    if (this.sound) {
      try {
        await this.sound.setRateAsync(rate, true); // second param enables pitch correction
      } catch (error) {
        console.error('Error setting playback rate:', error);
      }
    }
  }

  async getStatus() {
    if (this.sound) {
      try {
        return await this.sound.getStatusAsync();
      } catch (error) {
        console.error('Error getting status:', error);
        return null;
      }
    }
    return null;
  }

  getCurrentSound(): Audio.Sound | null {
    return this.sound;
  }
}

export default BackgroundAudioService.getInstance();