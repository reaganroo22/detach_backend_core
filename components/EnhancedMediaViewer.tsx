import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
  Image,
  StatusBar,
  TouchableWithoutFeedback,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Video, ResizeMode } from 'expo-av';
import { Audio } from 'expo-av';
import { 
  X, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  FastForward, 
  Rewind,
  SkipBack,
  SkipForward, 
  Maximize,
  Minimize,
  Gauge
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import { DownloadItem } from '../services/downloadService';
import { useTheme } from '../contexts/ThemeContext';
import BackgroundAudioService from '../services/backgroundAudioService';

interface EnhancedMediaViewerProps {
  item: DownloadItem;
  visible: boolean;
  onClose: () => void;
  playlist?: DownloadItem[]; // Optional playlist context for continuous playback
  isPlaylistMode?: boolean; // Explicitly indicate if this is playlist playback
  onTrackChange?: (newItem: DownloadItem) => void; // Callback for track changes
}

const getScreenDimensions = () => Dimensions.get('window');
const { width: screenWidth, height: screenHeight } = getScreenDimensions();

type PlaybackStatus = {
  isLoaded: boolean;
  isPlaying?: boolean;
  positionMillis?: number;
  durationMillis?: number;
  shouldPlay?: boolean;
  rate?: number;
};

export default function EnhancedMediaViewer({ 
  item, 
  visible, 
  onClose, 
  playlist, 
  isPlaylistMode = false, 
  onTrackChange 
}: EnhancedMediaViewerProps) {
  const { theme } = useTheme();
  const [textContent, setTextContent] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [dimensions, setDimensions] = useState(getScreenDimensions());
  
  // Playlist states
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);
  const [showPlaylist, setShowPlaylist] = useState(false);
  
  // Audio player states
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(() => {
    return Boolean(isPlaylistMode);
  });
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  // Background audio states
  const [useBackgroundAudio, setUseBackgroundAudio] = useState(false);
  const [backgroundSound, setBackgroundSound] = useState<Audio.Sound | null>(null);
  
  // Playlist management
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const playlistTracks = playlist?.filter(i => (i.contentType === 'audio' || i.contentType === 'video') && i.status === 'completed') || [];
  const hasPlaylist = isPlaylistMode && playlistTracks.length > 1;
  
  // Video player states
  const videoRef = useRef<Video>(null);
  const [videoStatus, setVideoStatus] = useState<PlaybackStatus>({ isLoaded: false });
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);
  const [forceVideoRemount, setForceVideoRemount] = useState(0);
  
  // Auto-landscape detection for fullscreen mode  
  const isLandscape = isFullscreen && dimensions.width > dimensions.height;
  
  if (isFullscreen) {
    console.log('Fullscreen mode - isLandscape:', isLandscape, 'dimensions:', dimensions.width + 'x' + dimensions.height);
  }
  
  // Double-tap detection
  const [lastTap, setLastTap] = useState<number | null>(null);
  const [tapTimer, setTapTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible && item && item.filePath) {
      
      // Reset video states for new item
      if (item.contentType === 'video') {
        console.log('Resetting video states for new video item');
        console.log('Previous video ref exists:', !!videoRef.current);
        
        // Cleanup of previous video component
        if (videoRef.current) {
          try {
            videoRef.current.pauseAsync().catch(console.error);
            videoRef.current.unloadAsync().catch(console.error);
          } catch (error) {
            console.error('Error cleaning up previous video:', error);
          }
        }
        
        setVideoStatus({ isLoaded: false });
        setVideoLoadError(null);
        setPosition(0);
        setDuration(0);
        setForceVideoRemount(prev => prev + 1); // Force video component remount
        
        console.log('Video states reset complete, forcing remount:', forceVideoRemount + 1);
      }
      
      // Reset playing state to auto-play in playlist mode
      setIsPlaying(isPlaylistMode || false);
      
      // Show controls initially, let auto-hide handle them later
      setShowControls(true);
      
      loadContent();
      
      // Find current track index in playlist
      if (hasPlaylist) {
        const index = playlistTracks.findIndex(track => track.id === item.id);
        setCurrentTrackIndex(index >= 0 ? index : 0);
      }
    }
    
    return () => {
      cleanup();
    };
  }, [visible, item?.id, item?.filePath, isPlaylistMode]);

  // Auto-play when playlist mode changes
  useEffect(() => {
    if (isPlaylistMode && visible && item?.contentType === 'video' && videoStatus.isLoaded) {
      setIsPlaying(true);
    }
  }, [isPlaylistMode]);

  // Handle screen rotation and dimensions
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      console.log('Screen dimensions changed:', window.width, 'x', window.height);
      setDimensions(window);
      
      // Show controls when rotating to help user with orientation change
      if (item?.contentType === 'video') {
        setShowControls(true);
        console.log('Screen rotated - new dimensions:', window.width + 'x' + window.height, 'isFullscreen:', isFullscreen);
      }
    });
    
    return () => subscription?.remove();
  }, [item?.contentType]);

  // Listen for orientation changes directly
  useEffect(() => {
    let orientationSubscription: any;
    
    if (isFullscreen) {
      const checkOrientation = async () => {
        try {
          const orientation = await ScreenOrientation.getOrientationAsync();
          console.log('Current orientation:', orientation);
        } catch (error) {
          console.log('Could not get orientation:', error);
        }
      };
      
      checkOrientation();
      
      // Set up orientation change listener
      orientationSubscription = ScreenOrientation.addOrientationChangeListener((event) => {
        console.log('Orientation changed to:', event.orientationInfo.orientation);
        console.log('Screen lock type:', event.orientationLock);
        
        // Force a re-render when orientation changes
        const newDimensions = Dimensions.get('window');
        console.log('Force updating dimensions after orientation change:', newDimensions.width + 'x' + newDimensions.height);
        setDimensions({ ...newDimensions });
      });
      
      console.log('Orientation listener set up for fullscreen mode');
    }
    
    return () => {
      if (orientationSubscription) {
        ScreenOrientation.removeOrientationChangeListener(orientationSubscription);
      }
    };
  }, [isFullscreen]);

  // Monitor background audio state (removed auto-advance)
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    
    if (useBackgroundAudio && backgroundSound && visible && hasPlaylist) {
      intervalId = setInterval(async () => {
        try {
          const status = await backgroundSound.getStatusAsync();
          if (status.isLoaded && !status.isPlaying && status.didJustFinish) {
            console.log('Background audio finished');
            // Auto-advance removed - user must manually skip
          }
        } catch (error) {
          console.error('Error checking track end:', error);
        }
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [useBackgroundAudio, backgroundSound, visible, hasPlaylist, currentTrackIndex]);

  // Monitor background audio state
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    
    if (useBackgroundAudio && backgroundSound && visible) {
      intervalId = setInterval(async () => {
        try {
          const status = await backgroundSound.getStatusAsync();
          if (status.isLoaded) {
            setIsPlaying(status.isPlaying || false);
            setPosition(status.positionMillis || 0);
            setDuration(status.durationMillis || 0);
          }
        } catch (error) {
          console.error('Error updating background audio state:', error);
        }
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [useBackgroundAudio, backgroundSound, visible]);

  // Auto-hide controls for video (but only if video is loaded and playing)
  useEffect(() => {
    if (item?.contentType === 'video' && showControls && videoStatus.isLoaded && isPlaying) {
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
      
      const timeout = setTimeout(() => {
        setShowControls(false);
      }, 4000); // Increased timeout to 4 seconds
      
      setControlsTimeout(timeout);
      
      return () => {
        if (timeout) clearTimeout(timeout);
      };
    }
  }, [showControls, item?.contentType, videoStatus.isLoaded, isPlaying]);

  const cleanup = async () => {
    // Cleanup background audio
    if (useBackgroundAudio) {
      BackgroundAudioService.stop().catch(console.error);
    }
    
    // Cleanup regular audio
    if (sound) {
      try {
        await sound.unloadAsync();
        setSound(null);
      } catch (error) {
        console.error('Error cleaning up sound:', error);
      }
    }
    
    // Cleanup video
    if (videoRef.current) {
      try {
        // First pause, then unload
        await videoRef.current.pauseAsync();
        await videoRef.current.unloadAsync();
      } catch (error) {
        console.error('Error cleaning up video:', error);
      }
    }
    
    // Clear video ref
    if (videoRef.current) {
      videoRef.current = null;
    }
    
    // Clear timeouts
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
      setControlsTimeout(null);
    }
    if (tapTimer) {
      clearTimeout(tapTimer);
      setTapTimer(null);
    }
    
    // Reset states
    setTextContent('');
    setImageUri('');
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
    setVideoStatus({ isLoaded: false });
    setVideoLoadError(null);
    setIsFullscreen(false);
    setPlaybackRate(1.0);
    setShowControls(false); // Start with controls hidden to prevent quivering
    setUseBackgroundAudio(false);
    setBackgroundSound(null);
    setLastTap(null);
  };

  const loadContent = async () => {
    if (!item) return;

    // Handle playlist differently
    if (item.isPlaylist) {
      setIsLoading(false);
      setShowPlaylist(true);
      return;
    }

    if (!item.filePath) return;

    setIsLoading(true);
    try {
      switch (item.contentType) {
        case 'audio':
          await loadAudio();
          break;
        case 'video':
          console.log('Loading video from path:', item.filePath);
          console.log('Video loading - isPlaylistMode:', isPlaylistMode, 'currentTrackIndex:', currentTrackIndex);
          setIsLoading(false);
          break;
        case 'image':
          setImageUri(item.filePath);
          setIsLoading(false);
          break;
        case 'text':
          await loadText();
          break;
      }
    } catch (error) {
      console.error('Error loading content:', error);
      Alert.alert('Error', 'Failed to load content');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAudio = async () => {
    try {
      // Try to use background audio service first
      const backgroundAudioSound = await BackgroundAudioService.loadAndPlay(item.filePath!);
      setBackgroundSound(backgroundAudioSound);
      setUseBackgroundAudio(true);
      console.log('Using background audio service');
    } catch (error) {
      console.warn('Background audio failed, falling back to regular audio:', error);
      setUseBackgroundAudio(false);
      
      // If background audio fails due to corruption and we're in playlist mode, try to advance
      if (hasPlaylist && error.message && error.message.includes('This media may be damaged')) {
        console.log('Background audio corrupted, will try regular audio first, then advance if that fails too');
      }
      
      // Fallback to regular audio
      try {
        if (sound) {
          await sound.unloadAsync();
        }

        console.log('Loading audio from path:', item.filePath);
        
        const isServerUrl = item.filePath?.startsWith('http://') || item.filePath?.startsWith('https://');
        
        if (!isServerUrl) {
          const fileInfo = await FileSystem.getInfoAsync(item.filePath!);
          console.log('Audio file info:', fileInfo);
          
          if (!fileInfo.exists) {
            throw new Error('Audio file does not exist');
          }
        }

        if (isServerUrl) {
          console.log('Setting audio mode for podcast playback...');
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            staysActiveInBackground: true,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
        }
        
        const timeoutDuration = isServerUrl ? 15000 : 3000;
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Audio creation timeout')), timeoutDuration);
        });
        
        const audioPromise = Audio.Sound.createAsync(
          { uri: item.filePath! },
          { shouldPlay: isPlaylistMode || false, isLooping: false }
        );

        const result = await Promise.race([audioPromise, timeoutPromise]) as { sound: Audio.Sound };
        const { sound: newSound } = result;

        console.log('Audio created successfully');
        setSound(newSound);

        newSound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.isLoaded) {
            setDuration(status.durationMillis || 0);
            setPosition(status.positionMillis || 0);
            setIsPlaying(status.isPlaying || false);
            
            // Track when audio finishes (auto-advance removed)
            if (hasPlaylist && status.didJustFinish && !status.isPlaying) {
              console.log('Audio finished - user must manually skip to next track');
            }
          }
        });

        try {
          const initialStatus = await newSound.getStatusAsync();
          if (initialStatus.isLoaded) {
            setDuration(initialStatus.durationMillis || 0);
          }
        } catch (statusError) {
          console.warn('Could not get initial status, but continuing anyway');
        }

      } catch (audioError) {
        console.warn('Audio creation failed:', audioError);
        setSound(null);
        setDuration(0);
        
        // If in playlist mode and audio fails to load, show error (auto-advance removed)
        if (hasPlaylist && audioError.message.includes('This media may be damaged')) {
          console.log('Corrupted audio file detected - user must manually skip to next track');
        }
      }
    }
  };

  const playNextTrack = () => {
    console.log('playNextTrack called - hasPlaylist:', hasPlaylist, 'currentIndex:', currentTrackIndex, 'totalTracks:', playlistTracks.length);
    if (!hasPlaylist) return;
    
    const nextIndex = currentTrackIndex + 1;
    if (nextIndex < playlistTracks.length) {
      console.log('Playing next track at index:', nextIndex);
      playTrackAtIndex(nextIndex);
    } else {
      console.log('Reached end of playlist, stopping playback');
      setIsPlaying(false);
      // Optionally loop back to beginning: playTrackAtIndex(0);
    }
  };

  const playPreviousTrack = () => {
    console.log('playPreviousTrack called - hasPlaylist:', hasPlaylist, 'currentIndex:', currentTrackIndex, 'totalTracks:', playlistTracks.length);
    if (!hasPlaylist) return;
    
    const prevIndex = currentTrackIndex === 0 ? playlistTracks.length - 1 : currentTrackIndex - 1;
    console.log('Playing previous track at index:', prevIndex);
    playTrackAtIndex(prevIndex);
  };

  const playTrackAtIndex = async (index: number) => {
    if (index < 0 || index >= playlistTracks.length) return;
    
    const newTrack = playlistTracks[index];
    setCurrentTrackIndex(index);
    
    try {
      // Stop current track (audio or video)
      if (item?.contentType === 'video' && videoRef.current) {
        await videoRef.current.pauseAsync();
      }
      if (useBackgroundAudio) {
        await BackgroundAudioService.stop();
      } else if (sound) {
        await sound.pauseAsync();
      }
      
      // Always notify parent to change the track for proper state management
      if (onTrackChange) {
        onTrackChange(newTrack);
        return;
      }
      
      // Fallback: if no parent callback, try to handle internally
      if (newTrack.filePath && newTrack.contentType === 'audio') {
        if (useBackgroundAudio) {
          const newSound = await BackgroundAudioService.loadAndPlay(newTrack.filePath);
          setBackgroundSound(newSound);
          // Restore playback speed
          await BackgroundAudioService.setRate(playbackRate);
        } else {
          console.warn('Track switching not fully supported with fallback player');
        }
      }
    } catch (error) {
      console.error('Error switching tracks:', error);
      Alert.alert('Track Error', 'Failed to switch to the next track');
    }
  };

  const loadText = async () => {
    try {
      const content = await FileSystem.readAsStringAsync(item.filePath!);
      setTextContent(content || 'No content available');
    } catch (error) {
      console.error('Error loading text:', error);
      setTextContent('Error loading text content');
    } finally {
      setIsLoading(false);
    }
  };

  // Audio controls
  const toggleAudioPlayback = async () => {
    try {
      if (useBackgroundAudio) {
        if (isPlaying) {
          await BackgroundAudioService.pause();
        } else {
          await BackgroundAudioService.play();
        }
      } else if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
        } else {
          await sound.playAsync();
        }
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      Alert.alert('Playback Error', 'Failed to control audio playback');
    }
  };

  const changeAudioPlaybackRate = async (rate: number) => {
    try {
      setPlaybackRate(rate);
      if (useBackgroundAudio) {
        await BackgroundAudioService.setRate(rate);
      } else if (sound) {
        await sound.setRateAsync(rate, true);
      }
    } catch (error) {
      console.error('Error changing playback speed:', error);
      Alert.alert('Speed Change Error', 'Failed to change playback speed');
    }
  };

  const toggleAudioMute = async () => {
    try {
      if (useBackgroundAudio) {
        const newVolume = isMuted ? 1.0 : 0.0;
        await BackgroundAudioService.setVolume(newVolume);
        setIsMuted(!isMuted);
      } else if (sound) {
        await sound.setIsMutedAsync(!isMuted);
        setIsMuted(!isMuted);
      }
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const seekAudio = async (milliseconds: number) => {
    try {
      // Immediate UI feedback
      const clampedPosition = Math.max(0, Math.min(milliseconds, duration));
      setPosition(clampedPosition);
      
      if (useBackgroundAudio) {
        await BackgroundAudioService.setPosition(clampedPosition);
      } else if (sound) {
        await sound.setPositionAsync(clampedPosition);
      }
    } catch (error) {
      console.error('Error seeking:', error);
    }
  };

  // Video controls
  const toggleVideoPlayback = async () => {
    if (!videoRef.current) return;
    
    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    } catch (error) {
      console.error('Error toggling video playback:', error);
    }
  };

  const changeVideoPlaybackRate = async (rate: number) => {
    if (!videoRef.current) return;
    
    try {
      await videoRef.current.setRateAsync(rate, true);
      setPlaybackRate(rate);
    } catch (error) {
      console.error('Error changing video playback rate:', error);
    }
  };

  const toggleVideoMute = async () => {
    if (!videoRef.current) return;
    
    try {
      await videoRef.current.setIsMutedAsync(!isMuted);
      setIsMuted(!isMuted);
    } catch (error) {
      console.error('Error toggling video mute:', error);
    }
  };

  const toggleFullscreen = async () => {
    const newFullscreenState = !isFullscreen;
    console.log('Toggling fullscreen to:', newFullscreenState);
    setIsFullscreen(newFullscreenState);
    
    if (newFullscreenState) {
      // Entering fullscreen - automatically go to landscape
      StatusBar.setHidden(true);
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT);
        console.log('Automatically locked to landscape for fullscreen');
      } catch (error) {
        console.log('Could not lock to landscape:', error);
        // Fallback: try to unlock for free orientation
        try {
          await ScreenOrientation.unlockAsync();
          console.log('Fallback: unlocked orientation');
        } catch (fallbackError) {
          console.log('No orientation control available');
        }
      }
    } else {
      // Exiting fullscreen
      StatusBar.setHidden(false);
      try {
        // Allow portrait orientations when exiting fullscreen (try portrait up first, then fallback)
        try {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          console.log('Screen orientation locked to portrait up');
        } catch (portraitError) {
          // If portrait up doesn't work, try allowing default orientation
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT);
          console.log('Screen orientation set to default');
        }
      } catch (error) {
        console.log('Screen orientation lock not supported:', error);
      }
    }
  };

  const showVideoControls = () => {
    console.log('Showing video controls');
    setShowControls(true);
  };

  const handleDoubleTap = (action: 'rewind' | 'forward') => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if (lastTap && (now - lastTap) < DOUBLE_PRESS_DELAY) {
      // Double tap detected
      if (tapTimer) {
        clearTimeout(tapTimer);
        setTapTimer(null);
      }
      
      if (videoRef.current) {
        if (action === 'rewind') {
          const newPosition = Math.max(0, position - 10000);
          console.log('Double-tap rewind to:', Math.floor(newPosition / 1000), 'seconds');
          videoRef.current.setPositionAsync(newPosition);
        } else {
          const newPosition = Math.min(duration, position + 10000);
          console.log('Double-tap fast forward to:', Math.floor(newPosition / 1000), 'seconds');
          videoRef.current.setPositionAsync(newPosition);
        }
      }
      
      setLastTap(null);
    } else {
      // Single tap - show controls after delay
      setLastTap(now);
      const timeout = setTimeout(() => {
        showVideoControls();
        setLastTap(null);
      }, DOUBLE_PRESS_DELAY);
      
      if (tapTimer) {
        clearTimeout(tapTimer);
      }
      setTapTimer(timeout);
    }
  };

  const handlePlaybackRatePress = () => {
    const rates = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5, 3.75, 4.0];
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    const newRate = rates[nextIndex];
    
    if (item?.contentType === 'video') {
      changeVideoPlaybackRate(newRate);
    } else if (item?.contentType === 'audio') {
      changeAudioPlaybackRate(newRate);
    }
  };

  const formatTime = (milliseconds: number): string => {
    if (!milliseconds || isNaN(milliseconds) || milliseconds < 0) return '0:00';
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleClose = async () => {
    StatusBar.setHidden(false);
    // Reset orientation to portrait when closing the media viewer entirely
    try {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        console.log('Screen orientation locked to portrait up on close');
      } catch (portraitError) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT);
        console.log('Screen orientation set to default on close');
      }
    } catch (error) {
      console.log('Screen orientation lock not supported on close:', error);
    }
    await cleanup();
    onClose();
  };

  const getSafePlatformName = (): string => {
    if (!item || !item.platform) return 'Unknown';
    
    const platformMap: Record<string, string> = {
      'youtube': 'YouTube',
      'instagram': 'Instagram', 
      'tiktok': 'TikTok',
      'facebook': 'Facebook',
      'twitter': 'X/Twitter',
      'linkedin': 'LinkedIn',
      'pinterest': 'Pinterest'
    };
    
    return platformMap[item.platform] || 'Unknown';
  };

  const getSafeTitle = (): string => {
    if (!item || !item.title) {
      switch (item?.contentType) {
        case 'audio': return 'Audio Content';
        case 'video': return 'Video Content';
        case 'image': return 'Image Content';
        case 'text': return 'Text Content';
        default: return 'Media Content';
      }
    }
    return String(item.title);
  };

  const renderVideoPlayer = () => (
    <View style={[
      styles.videoContainer, 
      isFullscreen && styles.fullscreenContainer
    ]}>
      {!isFullscreen && (
        <>
          <Text style={styles.mediaTitle}>
            {hasPlaylist ? playlistTracks[currentTrackIndex]?.title || getSafeTitle() : getSafeTitle()}
          </Text>
          <Text style={styles.mediaSubtitle}>
            {hasPlaylist ? playlistTracks[currentTrackIndex]?.platform : getSafePlatformName()} • {hasPlaylist ? playlistTracks[currentTrackIndex]?.contentType : 'Video'}
          </Text>
          {hasPlaylist && (
            <View style={styles.playlistContainer}>
              <Text style={styles.playlistIndicator}>
                Track {currentTrackIndex + 1} of {playlistTracks.length}
              </Text>
              <View style={styles.playlistControls}>
                <TouchableOpacity 
                  style={[styles.controlButton, currentTrackIndex === 0 && styles.controlButtonDisabled]}
                  onPress={playPreviousTrack}
                  disabled={currentTrackIndex === 0}
                >
                  <SkipBack size={20} color={currentTrackIndex === 0 ? "#a16207" : "#92400e"} />
                  <Text style={[styles.controlLabel, currentTrackIndex === 0 && styles.controlLabelDisabled]}>Prev</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.controlButton, currentTrackIndex === playlistTracks.length - 1 && styles.controlButtonDisabled]}
                  onPress={playNextTrack}
                  disabled={currentTrackIndex === playlistTracks.length - 1}
                >
                  <SkipForward size={20} color={currentTrackIndex === playlistTracks.length - 1 ? "#a16207" : "#92400e"} />
                  <Text style={[styles.controlLabel, currentTrackIndex === playlistTracks.length - 1 && styles.controlLabelDisabled]}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}
      
      {/* Landscape playlist controls overlay for fullscreen */}
      {isLandscape && hasPlaylist && (
        <View style={styles.landscapePlaylistOverlay}>
          <Text style={styles.landscapePlaylistIndicator}>
            Track {currentTrackIndex + 1} of {playlistTracks.length}
          </Text>
          <View style={styles.landscapePlaylistControls}>
            <TouchableOpacity 
              style={[styles.landscapeControlButton, currentTrackIndex === 0 && styles.controlButtonDisabled]}
              onPress={playPreviousTrack}
              disabled={currentTrackIndex === 0}
            >
              <SkipBack size={18} color={currentTrackIndex === 0 ? "#a16207" : "#92400e"} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.landscapeControlButton, currentTrackIndex === playlistTracks.length - 1 && styles.controlButtonDisabled]}
              onPress={playNextTrack}
              disabled={currentTrackIndex === playlistTracks.length - 1}
            >
              <SkipForward size={18} color={currentTrackIndex === playlistTracks.length - 1 ? "#a16207" : "#92400e"} />
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      <TouchableOpacity 
        style={[styles.videoWrapper, isFullscreen && styles.fullscreenVideoWrapper]}
        onPress={showVideoControls}
        activeOpacity={1}
      >
        {/* Left side - double tap to rewind */}
        <TouchableWithoutFeedback 
          onPress={() => handleDoubleTap('rewind')}
        >
          <View style={styles.videoTapZoneLeft} />
        </TouchableWithoutFeedback>
        
        {/* Right side - double tap to fast forward */}
        <TouchableWithoutFeedback 
          onPress={() => handleDoubleTap('forward')}
        >
          <View style={styles.videoTapZoneRight} />
        </TouchableWithoutFeedback>
        {videoLoadError ? (
          <View style={styles.videoErrorContainer}>
            <Text style={styles.videoErrorText}>Video Load Error</Text>
            <Text style={styles.videoErrorDetails}>{videoLoadError}</Text>
            <Text style={styles.videoErrorPath}>Source: {item.filePath}</Text>
          </View>
        ) : (
          <Video
            key={`video_${forceVideoRemount}_${item.id}`}
            ref={videoRef}
            source={{ uri: item.filePath! }}
            style={styles.video}
            useNativeControls={false}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={false}
            isLooping={false}
            rate={playbackRate}
            isMuted={isMuted}
            onLoad={(loadStatus) => {
              console.log('Video onLoad called with status:', loadStatus.isLoaded, 'isPlaylistMode:', isPlaylistMode, 'item:', item.title);
              console.log('Video onLoad - shouldPlay:', isPlaying, 'currentTrackIndex:', currentTrackIndex);
              if (loadStatus.isLoaded) {
                setDuration(loadStatus.durationMillis || 0);
                setVideoStatus({ isLoaded: true });
                
                console.log('Video loaded successfully, starting playback');
                setIsPlaying(true);
                setShowControls(true);
                
                // Always try to start playing when video loads (for both playlist and non-playlist)
                setTimeout(async () => {
                  if (videoRef.current) {
                    try {
                      console.log('Attempting to play video after load');
                      await videoRef.current.playAsync();
                      console.log('Video play successful after load');
                      setIsPlaying(true);
                    } catch (error) {
                      console.error('Video play failed after load:', error);
                    }
                  }
                }, 300); // Longer delay to ensure component is ready
              }
            }}
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded) {
                setPosition(status.positionMillis || 0);
                setIsPlaying(status.isPlaying || false);
                if (status.durationMillis) {
                  setDuration(status.durationMillis);
                }
                
                // Track when video finishes (auto-advance removed)
                if (hasPlaylist && status.didJustFinish && !status.isPlaying) {
                  console.log('Video finished - user must manually skip to next track');
                }
              } else if (status.error) {
                console.error('Video playbook error:', status.error);
              }
            }}
            onError={(error) => {
              console.error('Video component error:', error);
              setVideoLoadError(`Video failed to load: ${error}`);
              
              // If in playlist mode and video fails to load, show error (auto-advance removed)
              if (hasPlaylist) {
                console.log('Video failed to load in playlist - user must manually skip to next track');
              }
            }}
            onLoadStart={() => {
              console.log('Video load started for:', item.title);
              setVideoLoadError(null);
            }}
            onReadyForDisplay={() => {
              console.log('Video ready for display:', item.title);
            }}
          />
        )}
        
        {/* Custom video controls overlay */}
        {showControls && (
          <View style={styles.videoControls}>
            <View style={styles.videoControlsTop}>
              <TouchableOpacity 
                style={styles.fullscreenButton} 
                onPress={() => {
                  console.log('Fullscreen button pressed, current state:', isFullscreen);
                  toggleFullscreen();
                }}
              >
                {isFullscreen ? <Minimize size={24} color="#ffffff" /> : <Maximize size={24} color="#ffffff" />}
              </TouchableOpacity>
              
            </View>
            
            <View style={styles.videoControlsCenter}>
              <TouchableOpacity style={styles.videoPlayButton} onPress={toggleVideoPlayback}>
                {isPlaying ? <Pause size={40} color="#ffffff" /> : <Play size={40} color="#ffffff" />}
              </TouchableOpacity>
            </View>
            
            <View style={styles.videoControlsBottom}>
              <View style={styles.videoControlsRow}>
                <TouchableOpacity style={styles.videoControlButton} onPress={toggleVideoMute}>
                  {isMuted ? <VolumeX size={20} color="#ffffff" /> : <Volume2 size={20} color="#ffffff" />}
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.videoControlButton} onPress={handlePlaybackRatePress}>
                  <Gauge size={20} color="#ffffff" />
                  <Text style={styles.playbackRateText}>{playbackRate}x</Text>
                </TouchableOpacity>
              </View>
              
              {/* Progress bar */}
              <View style={styles.videoProgressContainer}>
                <TouchableOpacity 
                  style={styles.videoProgressBar}
                  onPress={(e) => {
                    if (duration > 0 && videoRef.current) {
                      const { locationX } = e.nativeEvent;
                      const progressBarWidth = 280; // Approximate width as a fallback
                      const seekPercent = locationX / progressBarWidth;
                      const seekTime = seekPercent * duration;
                      console.log('Video seeking to:', Math.floor(seekTime / 1000), 'seconds');
                      videoRef.current.setPositionAsync(Math.max(0, Math.min(seekTime, duration)));
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <View 
                    style={[
                      styles.videoProgressFill, 
                      { width: duration > 0 ? `${Math.min((position / duration) * 100, 100)}%` : '0%' }
                    ]} 
                  />
                </TouchableOpacity>
                <View style={styles.videoTimeContainer}>
                  <Text style={styles.videoTimeText}>{formatTime(position)}</Text>
                  <Text style={styles.videoTimeText}>{formatTime(duration)}</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderAudioPlayer = () => (
    <View style={styles.audioContainer}>
      <Text style={styles.mediaTitle}>
        {hasPlaylist ? playlistTracks[currentTrackIndex]?.title : getSafeTitle()}
      </Text>
      <Text style={styles.mediaSubtitle}>
        {hasPlaylist ? playlistTracks[currentTrackIndex]?.platform : getSafePlatformName()} • {hasPlaylist ? playlistTracks[currentTrackIndex]?.contentType : 'Audio'}
      </Text>
      {hasPlaylist && (
        <Text style={styles.playlistIndicator}>
          Track {currentTrackIndex + 1} of {playlistTracks.length}
        </Text>
      )}
      
      {/* Playlist Navigation */}
      {hasPlaylist && (
        <View style={styles.playlistControls}>
          <TouchableOpacity 
            style={[styles.controlButton, currentTrackIndex === 0 && styles.controlButtonDisabled]}
            onPress={playPreviousTrack}
            disabled={currentTrackIndex === 0}
          >
            <SkipBack size={20} color={currentTrackIndex === 0 ? "#a16207" : "#92400e"} />
            <Text style={[styles.controlLabel, currentTrackIndex === 0 && styles.controlLabelDisabled]}>Prev</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlButton, currentTrackIndex === playlistTracks.length - 1 && styles.controlButtonDisabled]}
            onPress={playNextTrack}
            disabled={currentTrackIndex === playlistTracks.length - 1}
          >
            <SkipForward size={20} color={currentTrackIndex === playlistTracks.length - 1 ? "#a16207" : "#92400e"} />
            <Text style={[styles.controlLabel, currentTrackIndex === playlistTracks.length - 1 && styles.controlLabelDisabled]}>Next</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {!sound && !useBackgroundAudio && (
        <View style={styles.audioErrorContainer}>
          <Text style={styles.audioErrorText}>⚠️ Audio Loading Issue</Text>
          <Text style={styles.audioErrorDescription}>
            This audio file downloaded successfully but React Native has trouble loading it. 
            The file is saved to your device storage.
          </Text>
          <TouchableOpacity 
            style={styles.showFileButton}
            onPress={() => {
              if (item.filePath) {
                if (item.filePath.startsWith('http://') || item.filePath.startsWith('https://')) {
                  import('expo-linking').then(Linking => {
                    Linking.openURL(item.filePath!);
                  });
                } else {
                  // For iOS, show file path since we can't open files directly
                  const fileName = item.filePath.split('/').pop() || 'Unknown file';
                  const fileSize = item.fileExtension ? `${item.contentType.toUpperCase()} file` : 'File';
                  // Show file info with size for verification
                  import('expo-file-system').then(async (FileSystem) => {
                    try {
                      const fileInfo = await FileSystem.default.getInfoAsync(item.filePath!);
                      const fileSizeMB = fileInfo.exists && fileInfo.size ? (fileInfo.size / (1024 * 1024)).toFixed(2) : 'Unknown';
                      Alert.alert(
                        'File Downloaded Successfully', 
                        `${fileSize}: ${fileName}\nSize: ${fileSizeMB} MB\nExists: ${fileInfo.exists ? 'Yes' : 'No'}\n\nFile is saved to your device storage and can be played from within the app.`,
                        [{ text: 'OK', style: 'default' }]
                      );
                    } catch (error) {
                      Alert.alert(
                        'File Downloaded Successfully', 
                        `${fileSize}: ${fileName}\n\nFile is saved to your device storage and can be played from within the app.`,
                        [{ text: 'OK', style: 'default' }]
                      );
                    }
                  });
                }
              } else {
                Alert.alert('Error', 'File path not available');
              }
            }}
          >
            <Text style={styles.showFileButtonText}>Open File</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {(sound || useBackgroundAudio) && (
        <>
          <View style={styles.progressContainer}>
            <TouchableOpacity 
              style={styles.progressBar}
              onPress={(e) => {
                if (duration > 0) {
                  const { locationX } = e.nativeEvent;
                  const progressBarWidth = 300; // approximate width
                  const seekPercent = locationX / progressBarWidth;
                  const seekTime = seekPercent * duration;
                  console.log('Audio seeking to:', Math.floor(seekTime / 1000), 'seconds');
                  seekAudio(seekTime);
                }
              }}
              activeOpacity={0.8}
            >
              <View 
                style={[
                  styles.progressFill, 
                  { width: duration > 0 ? `${Math.min((position / duration) * 100, 100)}%` : '0%' }
                ]} 
              />
            </TouchableOpacity>
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          </View>

          <View style={styles.audioControls}>
            <TouchableOpacity 
              style={styles.controlButton} 
              onPress={() => {
                const newPosition = Math.max(0, position - 10000);
                console.log('Rewinding to:', Math.floor(newPosition / 1000), 'seconds');
                seekAudio(newPosition);
              }}
            >
              <Rewind size={20} color="#92400e" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton} onPress={toggleAudioMute}>
              {isMuted ? <VolumeX size={20} color="#92400e" /> : <Volume2 size={20} color="#92400e" />}
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.playButton} onPress={toggleAudioPlayback}>
              {isPlaying ? <Pause size={32} color="#ffffff" /> : <Play size={32} color="#ffffff" />}
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton} onPress={handlePlaybackRatePress}>
              <Gauge size={20} color="#92400e" />
              <Text style={styles.audioRateText}>{playbackRate}x</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.controlButton} 
              onPress={() => {
                const newPosition = Math.min(duration, position + 10000);
                console.log('Fast-forwarding to:', Math.floor(newPosition / 1000), 'seconds');
                seekAudio(newPosition);
              }}
            >
              <FastForward size={20} color="#92400e" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );

  const renderImageViewer = () => (
    <View style={styles.imageContainer}>
      <Text style={styles.mediaTitle}>{getSafeTitle()}</Text>
      <Text style={styles.mediaSubtitle}>
        {`${getSafePlatformName()} • Image`}
      </Text>
      
      <ScrollView 
        style={styles.imageScrollView}
        contentContainerStyle={styles.imageScrollContent}
        maximumZoomScale={3}
        minimumZoomScale={1}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        {imageUri ? (
          <Image 
            source={{ uri: imageUri }} 
            style={styles.image}
            resizeMode={ResizeMode.CONTAIN}
          />
        ) : (
          <Text style={styles.errorText}>No image available</Text>
        )}
      </ScrollView>
    </View>
  );

  const renderTextViewer = () => (
    <View style={styles.textContainer}>
      <Text style={styles.mediaTitle}>{getSafeTitle()}</Text>
      <Text style={styles.mediaSubtitle}>
        {`${getSafePlatformName()} • Text Content`}
      </Text>
      
      <ScrollView style={styles.textScrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.textContent}>{String(textContent || 'No content available')}</Text>
      </ScrollView>
    </View>
  );

  const renderContent = () => {
    if (!item) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No content available</Text>
        </View>
      );
    }

    if (isLoading) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Loading content...</Text>
        </View>
      );
    }

    switch (item.contentType) {
      case 'video':
        return renderVideoPlayer();
      case 'audio':
        return renderAudioPlayer();
      case 'image':
        return renderImageViewer();
      case 'text':
        return renderTextViewer();
      default:
        return (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Unsupported content type</Text>
          </View>
        );
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[
        styles.container, 
        isFullscreen && styles.fullscreenContainer
      ]}>
        {!isFullscreen && (
          <View style={styles.header}>
            <View style={styles.headerLeft} />
            <Text style={styles.headerTitle}>Media Viewer</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <X size={24} color="#92400e" />
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.content, isFullscreen && styles.fullscreenContent]}>
          {renderContent()}
        </View>
        
        {isFullscreen && showControls && (
          <TouchableOpacity style={styles.fullscreenCloseButton} onPress={handleClose}>
            <X size={24} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fefce8',
  },
  fullscreenContainer: {
    backgroundColor: '#000000',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fffbeb',
    borderBottomWidth: 2,
    borderBottomColor: '#fbbf24',
  },
  headerLeft: {
    width: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#92400e',
  },
  closeButton: {
    padding: 4,
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  fullscreenContent: {
    padding: 0,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Common Media Styles
  mediaTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#92400e',
    textAlign: 'center',
    marginBottom: 8,
  },
  mediaSubtitle: {
    fontSize: 14,
    color: '#a16207',
    textAlign: 'center',
    marginBottom: 20,
  },
  
  playlistIndicator: {
    color: '#92400e', // Laudate brown theme
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
    backgroundColor: '#fbbf24', // Laudate golden background
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#92400e', // Laudate brown border
    overflow: 'hidden',
  },
  playlistControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    gap: 40,
  },
  controlLabel: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  controlLabelDisabled: {
    color: '#a16207', // Laudate muted brown instead of gray
  },
  controlButtonDisabled: {
    opacity: 0.5,
  },
  
  // Video Player Styles
  videoContainer: {
    flex: 1,
  },
  videoWrapper: {
    position: 'relative',
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fbbf24',
    minHeight: 300,
  },
  fullscreenVideoWrapper: {
    borderRadius: 0,
    borderWidth: 0,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignSelf: 'center',
  },
  videoControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 20,
  },
  videoControlsTop: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoControlsCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -40 }, { translateY: -40 }],
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoControlsBottom: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  videoControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  fullscreenButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(146, 64, 14, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  landscapeToggleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(146, 64, 14, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
    marginLeft: 12,
  },
  landscapeToggleButtonActive: {
    backgroundColor: 'rgba(251, 191, 36, 0.9)',
  },
  landscapeToggleText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  videoPlayButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(217, 119, 6, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoControlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(146, 64, 14, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  playbackRateText: {
    fontSize: 10,
    color: '#ffffff',
    marginLeft: 4,
  },
  videoProgressContainer: {
    width: '100%',
  },
  videoProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginBottom: 8,
  },
  videoProgressFill: {
    height: '100%',
    backgroundColor: '#fbbf24',
    borderRadius: 2,
  },
  videoTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  videoTimeText: {
    fontSize: 12,
    color: '#ffffff',
  },
  videoErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  videoErrorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 8,
    textAlign: 'center',
  },
  videoErrorDetails: {
    fontSize: 14,
    color: '#dc2626',
    marginBottom: 12,
    textAlign: 'center',
  },
  videoErrorPath: {
    fontSize: 10,
    color: '#991b1b',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  videoTapZoneLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '40%',
    zIndex: 10,
  },
  videoTapZoneRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '40%',
    zIndex: 10,
  },
  playlistContainer: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)', // Light Laudate golden background
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  landscapePlaylistOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  landscapePlaylistIndicator: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  landscapePlaylistControls: {
    flexDirection: 'row',
    gap: 8,
  },
  landscapeControlButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(251, 191, 36, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.5)',
  },
  
  // Audio Player Styles
  audioContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  progressContainer: {
    marginBottom: 30,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#d97706',
    borderRadius: 3,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 14,
    color: '#a16207',
    fontFamily: 'monospace',
  },
  audioControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fffbeb',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fbbf24',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#d97706',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  audioRateText: {
    fontSize: 10,
    color: '#92400e',
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '600',
  },
  audioErrorContainer: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    borderWidth: 2,
    borderColor: '#fecaca',
  },
  audioErrorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 8,
    textAlign: 'center',
  },
  audioErrorDescription: {
    fontSize: 14,
    color: '#991b1b',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  showFileButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'center',
  },
  showFileButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Image Viewer Styles
  imageContainer: {
    flex: 1,
  },
  imageScrollView: {
    flex: 1,
  },
  imageScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    maxWidth: 800,
    maxHeight: 600,
  },
  
  // Text Viewer Styles
  textContainer: {
    flex: 1,
  },
  textScrollView: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fbbf24',
    padding: 20,
  },
  textContent: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1f2937',
  },
  
  // Error Styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#dc2626',
    textAlign: 'center',
  },
});