import AsyncStorage from '@react-native-async-storage/async-storage';
import { DownloadItem } from './downloadService';

export interface PlaylistItem {
  id: string;
  downloadItemId: string;
  order: number;
  addedAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  items: PlaylistItem[];
  isShuffled: boolean;
  currentTrackIndex: number;
}

export interface PlaybackState {
  currentPlaylistId: string | null;
  currentTrackIndex: number;
  isShuffled: boolean;
  isPlaying: boolean;
  position: number;
}

class PlaylistService {
  private playlists: Map<string, Playlist> = new Map();
  private playbackState: PlaybackState = {
    currentPlaylistId: null,
    currentTrackIndex: 0,
    isShuffled: false,
    isPlaying: false,
    position: 0,
  };

  constructor() {
    this.loadPlaylistsFromStorage();
    this.loadPlaybackState();
  }

  private async savePlaylistsToStorage() {
    try {
      const playlistsArray = Array.from(this.playlists.values());
      await AsyncStorage.setItem('@playlists', JSON.stringify(playlistsArray));
    } catch (error) {
      console.error('Error saving playlists to storage:', error);
    }
  }

  private async loadPlaylistsFromStorage() {
    try {
      const storedPlaylists = await AsyncStorage.getItem('@playlists');
      if (storedPlaylists) {
        const playlistsArray: Playlist[] = JSON.parse(storedPlaylists);
        playlistsArray.forEach(playlist => {
          this.playlists.set(playlist.id, playlist);
        });
      }
    } catch (error) {
      console.error('Error loading playlists from storage:', error);
    }
  }

  private async savePlaybackState() {
    try {
      await AsyncStorage.setItem('@playback_state', JSON.stringify(this.playbackState));
    } catch (error) {
      console.error('Error saving playback state:', error);
    }
  }

  private async loadPlaybackState() {
    try {
      const storedState = await AsyncStorage.getItem('@playback_state');
      if (storedState) {
        this.playbackState = { ...this.playbackState, ...JSON.parse(storedState) };
      }
    } catch (error) {
      console.error('Error loading playback state:', error);
    }
  }

  // Playlist Management
  async createPlaylist(name: string, description?: string): Promise<string> {
    const playlistId = `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const playlist: Playlist = {
      id: playlistId,
      name: name.trim(),
      description: description?.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
      isShuffled: false,
      currentTrackIndex: 0,
    };

    this.playlists.set(playlistId, playlist);
    await this.savePlaylistsToStorage();
    return playlistId;
  }

  async deletePlaylist(playlistId: string): Promise<boolean> {
    if (!this.playlists.has(playlistId)) return false;
    
    this.playlists.delete(playlistId);
    
    // Clear playback state if this playlist was playing
    if (this.playbackState.currentPlaylistId === playlistId) {
      this.playbackState = {
        currentPlaylistId: null,
        currentTrackIndex: 0,
        isShuffled: false,
        isPlaying: false,
        position: 0,
      };
      await this.savePlaybackState();
    }
    
    await this.savePlaylistsToStorage();
    return true;
  }

  async renamePlaylist(playlistId: string, newName: string): Promise<boolean> {
    const playlist = this.playlists.get(playlistId);
    if (!playlist) return false;

    playlist.name = newName.trim();
    playlist.updatedAt = new Date().toISOString();
    
    this.playlists.set(playlistId, playlist);
    await this.savePlaylistsToStorage();
    return true;
  }

  // Playlist Items Management
  async addToPlaylist(playlistId: string, downloadItemId: string): Promise<boolean> {
    const playlist = this.playlists.get(playlistId);
    if (!playlist) return false;

    // Check if item already exists
    const existingItem = playlist.items.find(item => item.downloadItemId === downloadItemId);
    if (existingItem) return false;

    const playlistItem: PlaylistItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      downloadItemId,
      order: playlist.items.length,
      addedAt: new Date().toISOString(),
    };

    playlist.items.push(playlistItem);
    playlist.updatedAt = new Date().toISOString();
    
    this.playlists.set(playlistId, playlist);
    await this.savePlaylistsToStorage();
    return true;
  }

  async removeFromPlaylist(playlistId: string, downloadItemId: string): Promise<boolean> {
    const playlist = this.playlists.get(playlistId);
    if (!playlist) return false;

    const initialLength = playlist.items.length;
    playlist.items = playlist.items.filter(item => item.downloadItemId !== downloadItemId);
    
    if (playlist.items.length === initialLength) return false;

    // Reorder remaining items
    playlist.items.forEach((item, index) => {
      item.order = index;
    });

    playlist.updatedAt = new Date().toISOString();
    this.playlists.set(playlistId, playlist);
    await this.savePlaylistsToStorage();
    return true;
  }

  async removeFromAllPlaylists(downloadItemId: string): Promise<boolean> {
    let removedFromAny = false;
    
    for (const playlist of this.playlists.values()) {
      const initialLength = playlist.items.length;
      playlist.items = playlist.items.filter(item => item.downloadItemId !== downloadItemId);
      
      if (playlist.items.length !== initialLength) {
        // Reorder remaining items
        playlist.items.forEach((item, index) => {
          item.order = index;
        });
        
        playlist.updatedAt = new Date().toISOString();
        this.playlists.set(playlist.id, playlist);
        removedFromAny = true;
      }
    }
    
    if (removedFromAny) {
      await this.savePlaylistsToStorage();
    }
    
    return removedFromAny;
  }

  async reorderPlaylistItems(playlistId: string, fromIndex: number, toIndex: number): Promise<boolean> {
    const playlist = this.playlists.get(playlistId);
    if (!playlist || fromIndex === toIndex) return false;

    const items = [...playlist.items];
    const [reorderedItem] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, reorderedItem);

    // Update order values
    items.forEach((item, index) => {
      item.order = index;
    });

    playlist.items = items;
    playlist.updatedAt = new Date().toISOString();
    
    this.playlists.set(playlistId, playlist);
    await this.savePlaylistsToStorage();
    return true;
  }

  // Playback Management
  async startPlaylist(playlistId: string, startIndex: number = 0, shuffle: boolean = false): Promise<boolean> {
    const playlist = this.playlists.get(playlistId);
    if (!playlist || playlist.items.length === 0) return false;

    this.playbackState = {
      currentPlaylistId: playlistId,
      currentTrackIndex: startIndex,
      isShuffled: shuffle,
      isPlaying: true,
      position: 0,
    };

    playlist.isShuffled = shuffle;
    playlist.currentTrackIndex = startIndex;
    
    this.playlists.set(playlistId, playlist);
    await this.savePlaylistsToStorage();
    await this.savePlaybackState();
    return true;
  }

  async toggleShuffle(playlistId: string): Promise<boolean> {
    const playlist = this.playlists.get(playlistId);
    if (!playlist) return false;

    playlist.isShuffled = !playlist.isShuffled;
    
    if (this.playbackState.currentPlaylistId === playlistId) {
      this.playbackState.isShuffled = playlist.isShuffled;
      await this.savePlaybackState();
    }

    this.playlists.set(playlistId, playlist);
    await this.savePlaylistsToStorage();
    return true;
  }

  async nextTrack(playlistId: string): Promise<number | null> {
    const playlist = this.playlists.get(playlistId);
    if (!playlist || playlist.items.length === 0) return null;

    let nextIndex: number;

    if (playlist.isShuffled) {
      // Random next track
      const availableIndices = playlist.items.map((_, index) => index);
      const currentIndex = availableIndices.indexOf(playlist.currentTrackIndex);
      if (currentIndex >= 0) {
        availableIndices.splice(currentIndex, 1);
      }
      nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)] || 0;
    } else {
      // Sequential next track
      nextIndex = (playlist.currentTrackIndex + 1) % playlist.items.length;
    }

    playlist.currentTrackIndex = nextIndex;
    
    if (this.playbackState.currentPlaylistId === playlistId) {
      this.playbackState.currentTrackIndex = nextIndex;
      this.playbackState.position = 0;
      await this.savePlaybackState();
    }

    this.playlists.set(playlistId, playlist);
    await this.savePlaylistsToStorage();
    return nextIndex;
  }

  async previousTrack(playlistId: string): Promise<number | null> {
    const playlist = this.playlists.get(playlistId);
    if (!playlist || playlist.items.length === 0) return null;

    let prevIndex: number;

    if (playlist.isShuffled) {
      // Random previous track (for shuffle, just pick random)
      prevIndex = Math.floor(Math.random() * playlist.items.length);
    } else {
      // Sequential previous track
      prevIndex = playlist.currentTrackIndex === 0 
        ? playlist.items.length - 1 
        : playlist.currentTrackIndex - 1;
    }

    playlist.currentTrackIndex = prevIndex;
    
    if (this.playbackState.currentPlaylistId === playlistId) {
      this.playbackState.currentTrackIndex = prevIndex;
      this.playbackState.position = 0;
      await this.savePlaybackState();
    }

    this.playlists.set(playlistId, playlist);
    await this.savePlaylistsToStorage();
    return prevIndex;
  }

  // Getters
  getPlaylists(): Playlist[] {
    return Array.from(this.playlists.values()).sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  getPlaylist(playlistId: string): Playlist | null {
    return this.playlists.get(playlistId) || null;
  }

  getPlaybackState(): PlaybackState {
    return { ...this.playbackState };
  }

  async updatePlaybackPosition(position: number) {
    this.playbackState.position = position;
    await this.savePlaybackState();
  }

  async setPlaybackState(isPlaying: boolean) {
    this.playbackState.isPlaying = isPlaying;
    await this.savePlaybackState();
  }

  // Utility Methods
  isItemInPlaylist(playlistId: string, downloadItemId: string): boolean {
    const playlist = this.playlists.get(playlistId);
    return playlist ? playlist.items.some(item => item.downloadItemId === downloadItemId) : false;
  }

  getPlaylistsContainingItem(downloadItemId: string): Playlist[] {
    return Array.from(this.playlists.values()).filter(playlist =>
      playlist.items.some(item => item.downloadItemId === downloadItemId)
    );
  }
}

export const playlistService = new PlaylistService();