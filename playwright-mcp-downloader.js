/**
 * Playwright MCP-Based Universal Video Downloader
 * 
 * This script integrates with Claude Code's Playwright MCP to automate
 * video downloads across ssvid.net, squidlr.com, and getloady.com
 * 
 * Uses the actual MCP tools for maximum compatibility and reliability
 */

class PlaywrightMCPDownloader {
  constructor(mcpTools) {
    this.mcp = mcpTools; // Pass in MCP tools from Claude Code environment
    this.downloadTimeout = 30000;
  }

  detectPlatform(url) {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('tiktok.com')) return 'tiktok';
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
    if (urlLower.includes('instagram.com')) return 'instagram';
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter';
    if (urlLower.includes('pinterest.com')) return 'pinterest';
    if (urlLower.includes('facebook.com')) return 'facebook';
    if (urlLower.includes('linkedin.com')) return 'linkedin';
    if (urlLower.includes('vimeo.com')) return 'vimeo';
    if (urlLower.includes('dailymotion.com')) return 'dailymotion';
    if (urlLower.includes('reddit.com')) return 'reddit';
    if (urlLower.includes('soundcloud.com')) return 'soundcloud';
    return 'unknown';
  }

  /**
   * TIER 1: GetLoady.com - Premium quality downloads
   */
  async downloadWithGetLoady(url, platform) {
    try {
      console.log(`🎯 MCP Tier 1: GetLoady download for ${platform}`);
      
      const platformUrls = {
        'tiktok': 'https://getloady.com/tiktok',
        'instagram': 'https://getloady.com/instagram',
        'pinterest': 'https://getloady.com/pinterest',
        'reddit': 'https://getloady.com/reddit',
        'youtube': 'https://getloady.com/youtube',
        'twitter': 'https://getloady.com/twitter',
        'facebook': 'https://getloady.com/facebook'
      };

      if (!platformUrls[platform]) {
        throw new Error(`GetLoady doesn't support ${platform}`);
      }

      // Navigate using MCP
      await this.mcp.browser_navigate(platformUrls[platform]);
      
      // Close modal if present
      try {
        await this.mcp.browser_wait_for({ time: 2 });
        await this.mcp.browser_click('Close modal button', 'button:has-text("Close")');
        await this.mcp.browser_wait_for({ time: 1 });
      } catch (e) {
        // No modal present
      }

      // Take snapshot to get current DOM structure
      const snapshot = await this.mcp.browser_snapshot();
      
      // Find input field from snapshot and fill it
      const inputElements = this.findElementsInSnapshot(snapshot, ['textbox', 'input']);
      if (inputElements.length === 0) {
        throw new Error(`No input field found for ${platform} on GetLoady`);
      }

      const inputRef = inputElements[0].ref;
      await this.mcp.browser_type(`${platform} URL input`, inputRef, url);
      
      await this.mcp.browser_wait_for({ time: 1 });

      // Find and click download button
      const buttonTexts = [
        'Download Video',
        'Download Video or Image',
        'Get YouTube Video Link',
        'Download'
      ];

      let buttonClicked = false;
      for (const text of buttonTexts) {
        try {
          const buttons = this.findElementsInSnapshot(snapshot, ['button'], text);
          if (buttons.length > 0) {
            await this.mcp.browser_click(`${text} button`, buttons[0].ref);
            buttonClicked = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!buttonClicked) {
        throw new Error(`Could not find download button for ${platform}`);
      }

      // Monitor for downloads
      for (let i = 0; i < 15; i++) {
        await this.mcp.browser_wait_for({ time: 2 });
        
        const currentSnapshot = await this.mcp.browser_snapshot();
        
        // Check for download links
        const downloadLinks = this.findDownloadLinks(currentSnapshot);
        if (downloadLinks.length > 0) {
          return {
            success: true,
            downloadUrl: downloadLinks[0].href,
            platform: platform,
            method: 'getloady_mcp',
            quality: 'HD'
          };
        }

        // Check for processing status
        if (currentSnapshot.includes('Processing') || currentSnapshot.includes('Fetching')) {
          console.log(`GetLoady processing... attempt ${i + 1}/15`);
          continue;
        }

        // For YouTube, check for new tabs
        if (platform === 'youtube') {
          try {
            const tabs = await this.mcp.browser_tab_list();
            for (const tab of tabs) {
              if (tab.url && this.isValidVideoUrl(tab.url)) {
                return {
                  success: true,
                  downloadUrl: tab.url,
                  platform: platform,
                  method: 'getloady_mcp_newtab',
                  quality: 'HD'
                };
              }
            }
          } catch (e) {
            // Tab list not available
          }
        }
      }

      throw new Error('GetLoady: No download found after 30 seconds');

    } catch (error) {
      console.log(`❌ GetLoady MCP failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * TIER 2: SSVid.net - Comprehensive platform support
   */
  async downloadWithSSVid(url, platform) {
    try {
      console.log(`🎯 MCP Tier 2: SSVid download for ${platform}`);
      
      await this.mcp.browser_navigate('https://ssvid.net/en');
      await this.mcp.browser_wait_for({ time: 3 });
      
      const snapshot = await this.mcp.browser_snapshot();
      
      // Find search input
      const searchInputs = this.findElementsInSnapshot(snapshot, ['searchbox']);
      if (searchInputs.length === 0) {
        throw new Error('SSVid search input not found');
      }

      await this.mcp.browser_type('Search input for video URL', searchInputs[0].ref, url);
      
      // Click Start button
      const startButtons = this.findElementsInSnapshot(snapshot, ['button'], 'Start');
      if (startButtons.length === 0) {
        throw new Error('SSVid Start button not found');
      }

      await this.mcp.browser_click('Start button', startButtons[0].ref);

      // Wait for processing and conversion options
      for (let i = 0; i < 20; i++) {
        await this.mcp.browser_wait_for({ time: 2 });
        
        const currentSnapshot = await this.mcp.browser_snapshot();
        
        // Check for convert buttons (SSVid shows quality options)
        const convertButtons = this.findElementsInSnapshot(currentSnapshot, ['button'], 'Convert');
        if (convertButtons.length > 0) {
          console.log(`Found ${convertButtons.length} convert options, clicking first one`);
          await this.mcp.browser_click('Convert button', convertButtons[0].ref);
          
          // Wait for conversion
          for (let j = 0; j < 10; j++) {
            await this.mcp.browser_wait_for({ time: 2 });
            const conversionSnapshot = await this.mcp.browser_snapshot();
            
            const downloadLinks = this.findDownloadLinks(conversionSnapshot);
            if (downloadLinks.length > 0) {
              return {
                success: true,
                downloadUrl: downloadLinks[0].href,
                platform: platform,
                method: 'ssvid_mcp_converted'
              };
            }
          }
        }

        // Check for direct download links
        const downloadLinks = this.findDownloadLinks(currentSnapshot);
        if (downloadLinks.length > 0) {
          return {
            success: true,
            downloadUrl: downloadLinks[0].href,
            platform: platform,
            method: 'ssvid_mcp_direct'
          };
        }

        console.log(`SSVid processing... attempt ${i + 1}/20`);
      }

      throw new Error('SSVid: No download found after 40 seconds');

    } catch (error) {
      console.log(`❌ SSVid MCP failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * TIER 3: Squidlr.com - Fast and clean
   */
  async downloadWithSquidlr(url, platform) {
    try {
      console.log(`🎯 MCP Tier 3: Squidlr download for ${platform}`);
      
      if (platform === 'youtube') {
        throw new Error('Squidlr does not support YouTube');
      }

      await this.mcp.browser_navigate('https://www.squidlr.com/');
      await this.mcp.browser_wait_for({ time: 3 }); // Wait for Blazor initialization
      
      const snapshot = await this.mcp.browser_snapshot();
      
      // Find URL input textbox
      const textboxes = this.findElementsInSnapshot(snapshot, ['textbox']);
      if (textboxes.length === 0) {
        throw new Error('Squidlr URL input not found');
      }

      await this.mcp.browser_type('URL input field', textboxes[0].ref, url);
      
      // Squidlr auto-processes URLs, wait for redirect or processing
      await this.mcp.browser_wait_for({ time: 3 });
      
      // Check if we've been redirected to download page
      for (let i = 0; i < 15; i++) {
        await this.mcp.browser_wait_for({ time: 2 });
        
        const currentSnapshot = await this.mcp.browser_snapshot();
        
        // Check for error message
        if (currentSnapshot.includes('Oh no! Something went wrong') || 
            currentSnapshot.includes('content could not be found')) {
          throw new Error('Squidlr: Content not found or not accessible');
        }

        // Check for download links
        const downloadLinks = this.findDownloadLinks(currentSnapshot);
        if (downloadLinks.length > 0) {
          return {
            success: true,
            downloadUrl: downloadLinks[0].href,
            platform: platform,
            method: 'squidlr_mcp'
          };
        }

        console.log(`Squidlr processing... attempt ${i + 1}/15`);
      }

      throw new Error('Squidlr: No download found after processing');

    } catch (error) {
      console.log(`❌ Squidlr MCP failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper: Find elements in MCP snapshot by type and text
   */
  findElementsInSnapshot(snapshot, elementTypes, containsText = null) {
    const elements = [];
    const lines = snapshot.split('\\n');
    
    for (const line of lines) {
      for (const type of elementTypes) {
        if (line.includes(`${type} `) && line.includes('[ref=')) {
          if (!containsText || line.includes(containsText)) {
            const refMatch = line.match(/\\[ref=([^\\]]+)\\]/);
            if (refMatch) {
              elements.push({
                ref: refMatch[1],
                line: line,
                type: type
              });
            }
          }
        }
      }
    }
    
    return elements;
  }

  /**
   * Helper: Find download links in snapshot
   */
  findDownloadLinks(snapshot) {
    const links = [];
    const lines = snapshot.split('\\n');
    
    for (const line of lines) {
      if (line.includes('link ') && line.includes('[ref=')) {
        // Extract URL from line
        const urlMatch = line.match(/\\/url: ([^\\n]+)/);
        if (urlMatch) {
          const url = urlMatch[1];
          if (this.isValidVideoUrl(url)) {
            const refMatch = line.match(/\\[ref=([^\\]]+)\\]/);
            links.push({
              href: url,
              ref: refMatch ? refMatch[1] : null
            });
          }
        }
      }
    }
    
    return links;
  }

  isValidVideoUrl(url) {
    return url && (
      url.includes('.mp4') ||
      url.includes('.webm') ||
      url.includes('.m4v') ||
      url.includes('blob:') ||
      url.includes('googlevideo') ||
      (url.includes('download') && !url.includes('ko-fi') && !url.includes('support'))
    );
  }

  async download(url) {
    const platform = this.detectPlatform(url);
    console.log(`🚀 Starting MCP download for ${platform}: ${url}`);

    if (platform === 'unknown') {
      return {
        success: false,
        error: 'Unsupported platform detected',
        platform: platform
      };
    }

    const tiers = [
      () => this.downloadWithGetLoady(url, platform),
      () => this.downloadWithSSVid(url, platform),
      () => this.downloadWithSquidlr(url, platform)
    ];

    let lastError = null;

    for (let i = 0; i < tiers.length; i++) {
      try {
        const result = await tiers[i]();
        if (result.success) {
          console.log(`🎉 MCP SUCCESS with Tier ${i + 1}: ${result.method}`);
          return result;
        }
      } catch (error) {
        lastError = error;
        console.log(`⚠️  MCP Tier ${i + 1} failed: ${error.message}`);
        
        if (i < tiers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    console.log(`💥 All MCP tiers failed for ${url}`);
    return {
      success: false,
      error: `All MCP download methods failed. Last error: ${lastError?.message}`,
      platform: platform
    };
  }
}

module.exports = PlaywrightMCPDownloader;