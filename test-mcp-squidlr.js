// Test Squidlr.com using MCP Playwright capabilities
const { spawn } = require('child_process');

async function testSquidlrWithMCP() {
  console.log('🧪 Testing Squidlr.com using Playwright MCP...\n');
  
  const url = 'https://www.tiktok.com/@tiktokyoungboss/video/7492418301063187734';
  console.log(`Testing TikTok URL: ${url}`);
  
  try {
    // Use MCP Playwright through claude mcp command
    const mcpProcess = spawn('claude', ['mcp', 'playwright', 'navigate', 'https://www.squidlr.com/'], {
      stdio: 'pipe'
    });
    
    mcpProcess.stdout.on('data', (data) => {
      console.log(`MCP Output: ${data}`);
    });
    
    mcpProcess.stderr.on('data', (data) => {
      console.error(`MCP Error: ${data}`);
    });
    
    mcpProcess.on('close', (code) => {
      console.log(`MCP process exited with code ${code}`);
    });
    
    // Wait for process
    await new Promise((resolve) => {
      mcpProcess.on('close', resolve);
    });
    
  } catch (error) {
    console.error('MCP Test failed:', error);
  }
}

if (require.main === module) {
  testSquidlrWithMCP().catch(console.error);
}