import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { downloadService, DownloadItem } from './downloadService';

export interface BackupData {
  version: string;
  exportDate: string;
  downloads: DownloadItem[];
  totalCount: number;
}

class BackupService {
  private backupDirectory = `${FileSystem.documentDirectory}backups/`;

  constructor() {
    this.initializeBackupDirectory();
  }

  private async initializeBackupDirectory() {
    const dirInfo = await FileSystem.getInfoAsync(this.backupDirectory);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.backupDirectory, { intermediates: true });
    }
  }

  async createBackup(): Promise<string> {
    try {
      const downloads = downloadService.getDownloads();
      const backupData: BackupData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        downloads: downloads,
        totalCount: downloads.length,
      };

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const fileName = `mindful-media-backup-${timestamp}.json`;
      const filePath = `${this.backupDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(
        filePath,
        JSON.stringify(backupData, null, 2),
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      return filePath;
    } catch (error) {
      console.error('Error creating backup:', error);
      throw new Error('Failed to create backup');
    }
  }

  async exportBackup(): Promise<void> {
    try {
      const backupPath = await this.createBackup();
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(backupPath, {
          mimeType: 'application/json',
          dialogTitle: 'Export Mindful Media Backup',
        });
      } else {
        throw new Error('Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error exporting backup:', error);
      throw error;
    }
  }

  async createURLsTextFile(): Promise<string> {
    try {
      const downloads = downloadService.getDownloads();
      const urlsText = downloads
        .map(item => `${item.title}\n${item.url}\n---`)
        .join('\n\n');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const fileName = `mindful-media-urls-${timestamp}.txt`;
      const filePath = `${this.backupDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(
        filePath,
        urlsText,
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      return filePath;
    } catch (error) {
      console.error('Error creating URLs file:', error);
      throw new Error('Failed to create URLs file');
    }
  }

  async exportURLsOnly(): Promise<void> {
    try {
      const urlsPath = await this.createURLsTextFile();
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(urlsPath, {
          mimeType: 'text/plain',
          dialogTitle: 'Export URLs List',
        });
      } else {
        throw new Error('Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error exporting URLs:', error);
      throw error;
    }
  }

  async importBackup(backupData: BackupData): Promise<void> {
    try {
      // Note: This is a simple import - in a real app you'd want more validation
      for (const item of backupData.downloads) {
        // You could re-add these downloads or merge them
        // For now, we'll just log them
        console.log('Import item:', item.title);
      }
      
      // In a full implementation, you'd want to:
      // 1. Validate the backup format
      // 2. Handle conflicts with existing downloads
      // 3. Re-download content if needed
      // 4. Update the local storage
      
    } catch (error) {
      console.error('Error importing backup:', error);
      throw new Error('Failed to import backup');
    }
  }

  async getBackupHistory(): Promise<string[]> {
    try {
      const backupDir = await FileSystem.readDirectoryAsync(this.backupDirectory);
      return backupDir.filter(file => 
        file.endsWith('.json') && file.startsWith('mindful-media-backup-')
      );
    } catch (error) {
      console.error('Error getting backup history:', error);
      return [];
    }
  }

  async deleteOldBackups(keepCount: number = 5): Promise<void> {
    try {
      const backups = await this.getBackupHistory();
      
      // Sort by date (newest first) and keep only the specified count
      const sortedBackups = backups.sort().reverse();
      const backupsToDelete = sortedBackups.slice(keepCount);

      for (const backup of backupsToDelete) {
        const filePath = `${this.backupDirectory}${backup}`;
        await FileSystem.deleteAsync(filePath);
      }
    } catch (error) {
      console.error('Error deleting old backups:', error);
    }
  }
}

export const backupService = new BackupService();