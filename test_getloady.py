import asyncio
from playwright.async_api import async_playwright
import json
from urllib.parse import urlparse
import time

async def test_getloady_youtube():
    """Test GetLoady's YouTube platform and capture all network responses"""
    
    captured_requests = []
    captured_responses = []
    video_urls = []
    blob_urls = []
    download_events = []
    
    async with async_playwright() as p:
        # Launch browser with additional debugging
        browser = await p.chromium.launch(
            headless=False,  # Keep visible for debugging
            args=[
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-blink-features=AutomationControlled'
            ]
        )
        
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        
        page = await context.new_page()
        
        # Network monitoring
        async def handle_request(request):
            url = request.url
            method = request.method
            headers = request.headers
            
            captured_requests.append({
                'url': url,
                'method': method,
                'headers': dict(headers),
                'timestamp': time.time()
            })
            
            print(f"REQUEST: {method} {url}")
        
        async def handle_response(response):
            url = response.url
            status = response.status
            headers = response.headers
            content_type = headers.get('content-type', '')
            
            captured_responses.append({
                'url': url,
                'status': status,
                'headers': dict(headers),
                'content_type': content_type,
                'timestamp': time.time()
            })
            
            print(f"RESPONSE: {status} {url} ({content_type})")
            
            # Capture video URLs
            if ('googlevideo.com' in url or 
                'video' in content_type.lower() or 
                url.endswith(('.mp4', '.webm', '.m4v'))):
                video_urls.append({
                    'url': url,
                    'content_type': content_type,
                    'status': status,
                    'type': 'video'
                })
                print(f"🎥 VIDEO URL FOUND: {url}")
            
            # Capture blob URLs
            if url.startswith('blob:'):
                blob_urls.append({
                    'url': url,
                    'content_type': content_type,
                    'status': status,
                    'type': 'blob'
                })
                print(f"🔵 BLOB URL FOUND: {url}")
            
            # Capture download-related responses
            if ('download' in url.lower() or 
                'attachment' in headers.get('content-disposition', '').lower()):
                download_events.append({
                    'url': url,
                    'content_type': content_type,
                    'content_disposition': headers.get('content-disposition', ''),
                    'status': status,
                    'type': 'download'
                })
                print(f"💾 DOWNLOAD EVENT: {url}")
        
        # Attach event listeners
        page.on('request', handle_request)
        page.on('response', handle_response)
        
        try:
            print("🚀 Navigating to GetLoady YouTube page...")
            await page.goto('https://getloady.com/youtube', wait_until='networkidle', timeout=30000)
            
            print("⏳ Waiting for page to fully load...")
            await page.wait_for_timeout(3000)
            
            # Look for input field (try multiple selectors)
            input_selectors = [
                'input[type="url"]',
                'input[placeholder*="URL"]',
                'input[placeholder*="url"]',
                'input[placeholder*="YouTube"]',
                'input[placeholder*="youtube"]',
                'input[name*="url"]',
                'input[id*="url"]',
                '.url-input',
                '#url-input',
                'input[type="text"]'
            ]
            
            input_element = None
            for selector in input_selectors:
                try:
                    input_element = await page.wait_for_selector(selector, timeout=2000)
                    if input_element:
                        print(f"✅ Found input field with selector: {selector}")
                        break
                except:
                    continue
            
            if not input_element:
                # Try to find any input on the page
                all_inputs = await page.query_selector_all('input')
                print(f"Found {len(all_inputs)} input elements on the page")
                for i, inp in enumerate(all_inputs):
                    inp_type = await inp.get_attribute('type')
                    inp_placeholder = await inp.get_attribute('placeholder')
                    inp_name = await inp.get_attribute('name')
                    inp_id = await inp.get_attribute('id')
                    print(f"Input {i}: type={inp_type}, placeholder={inp_placeholder}, name={inp_name}, id={inp_id}")
                
                # Use the first visible input
                if all_inputs:
                    input_element = all_inputs[0]
            
            if input_element:
                print("📝 Entering YouTube URL...")
                await input_element.fill('https://www.youtube.com/shorts/0Pwt8wcSjmY')
                await page.wait_for_timeout(1000)
                
                # Look for submit/download button
                button_selectors = [
                    'button[type="submit"]',
                    'input[type="submit"]',
                    'button:has-text("Download")',
                    'button:has-text("download")',
                    'button:has-text("Get")',
                    'button:has-text("Submit")',
                    '.download-btn',
                    '.submit-btn',
                    'button'
                ]
                
                button_element = None
                for selector in button_selectors:
                    try:
                        button_element = await page.wait_for_selector(selector, timeout=2000)
                        if button_element:
                            print(f"✅ Found button with selector: {selector}")
                            break
                    except:
                        continue
                
                if button_element:
                    print("🖱️ Clicking download/submit button...")
                    await button_element.click()
                    
                    print("⏳ Waiting for network activity...")
                    await page.wait_for_timeout(10000)  # Wait 10 seconds for processing
                    
                    # Check for any new elements that might contain download links
                    await page.wait_for_timeout(5000)
                    
                else:
                    print("❌ Could not find submit/download button")
                    # Try pressing Enter as fallback
                    print("🔄 Trying to press Enter instead...")
                    await input_element.press('Enter')
                    await page.wait_for_timeout(10000)
            else:
                print("❌ Could not find input field")
            
            print("📸 Taking screenshot...")
            await page.screenshot(path='/Users/username/Documents/project2/.claude/detach_backend/getloady_test.png')
            
        except Exception as e:
            print(f"❌ Error during test: {e}")
            await page.screenshot(path='/Users/username/Documents/project2/.claude/detach_backend/getloady_error.png')
        
        finally:
            await browser.close()
    
    # Analyze and report results
    print("\n" + "="*80)
    print("📊 NETWORK ANALYSIS RESULTS")
    print("="*80)
    
    print(f"\n🌐 Total Requests: {len(captured_requests)}")
    print(f"📥 Total Responses: {len(captured_responses)}")
    print(f"🎥 Video URLs Found: {len(video_urls)}")
    print(f"🔵 Blob URLs Found: {len(blob_urls)}")
    print(f"💾 Download Events: {len(download_events)}")
    
    # Detailed URL analysis
    print("\n🎥 VIDEO URLs:")
    print("-" * 50)
    for i, video in enumerate(video_urls, 1):
        print(f"{i}. {video['url']}")
        print(f"   Content-Type: {video['content_type']}")
        print(f"   Status: {video['status']}")
        print()
    
    print("🔵 BLOB URLs:")
    print("-" * 50)
    for i, blob in enumerate(blob_urls, 1):
        print(f"{i}. {blob['url']}")
        print(f"   Content-Type: {blob['content_type']}")
        print(f"   Status: {blob['status']}")
        print()
    
    print("💾 DOWNLOAD EVENTS:")
    print("-" * 50)
    for i, download in enumerate(download_events, 1):
        print(f"{i}. {download['url']}")
        print(f"   Content-Type: {download['content_type']}")
        print(f"   Content-Disposition: {download['content_disposition']}")
        print(f"   Status: {download['status']}")
        print()
    
    # Google Video URLs specifically
    google_video_urls = [r for r in captured_responses if 'googlevideo.com' in r['url']]
    print(f"🔍 GOOGLE VIDEO URLs ({len(google_video_urls)}):")
    print("-" * 50)
    for i, gv in enumerate(google_video_urls, 1):
        print(f"{i}. {gv['url']}")
        print(f"   Content-Type: {gv['content_type']}")
        print(f"   Status: {gv['status']}")
        print()
    
    # All unique domains
    domains = set()
    for resp in captured_responses:
        domain = urlparse(resp['url']).netlify
        domains.add(domain)
    
    print(f"🌍 DOMAINS CONTACTED ({len(domains)}):")
    print("-" * 50)
    for domain in sorted(domains):
        print(f"- {domain}")
    
    # Save detailed log
    log_data = {
        'test_timestamp': time.time(),
        'youtube_url': 'https://www.youtube.com/shorts/0Pwt8wcSjmY',
        'getloady_url': 'https://getloady.com/youtube',
        'summary': {
            'total_requests': len(captured_requests),
            'total_responses': len(captured_responses),
            'video_urls_count': len(video_urls),
            'blob_urls_count': len(blob_urls),
            'download_events_count': len(download_events),
            'google_video_urls_count': len(google_video_urls)
        },
        'video_urls': video_urls,
        'blob_urls': blob_urls,
        'download_events': download_events,
        'google_video_urls': google_video_urls,
        'all_requests': captured_requests,
        'all_responses': captured_responses,
        'domains': sorted(list(domains))
    }
    
    with open('/Users/username/Documents/project2/.claude/detach_backend/getloady_test_log.json', 'w') as f:
        json.dump(log_data, f, indent=2)
    
    print(f"\n💾 Detailed log saved to: getloady_test_log.json")
    print(f"📸 Screenshot saved to: getloady_test.png")
    
    return log_data

if __name__ == "__main__":
    asyncio.run(test_getloady_youtube())