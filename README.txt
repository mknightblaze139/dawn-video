DAWN VIDEO PLAYER - how to run it in PyCharm
=============================================

1. Unzip this folder anywhere (e.g. Documents\dawn-video-player).

2. Get the video:
   YouTube Studio -> Content -> find "Carrick Addresses Bruno Fernandes Captaincy Row"
   -> three dots (...) -> Download.
   Rename the downloaded file to:  carrick.mp4
   and put it in this folder, next to index.html.

3. PyCharm -> File -> Open -> choose this folder.

4. Right-click server.py -> Run 'server'.
   Your browser opens http://localhost:8000/index.html
   - a Google test ad plays muted, then the Carrick video, muted.
   - "Tap to unmute" turns the sound on.

5. To stop: red square Stop button in PyCharm.

USING YOUR OWN GAM AD
Open index.html, find CONFIG near the top, and replace adTagUrl with the
VAST tag from your GAM video ad unit. Keep "correlator=" and
"description_url=" at the end of the tag; the player fills them in.

USING A DIFFERENT VIDEO
Drop another .mp4 in the folder and change contentUrl in index.html
(and VIDEO_FILE in server.py) to its file name.

Note: GAM test ads work on localhost. Real paid ads (Ad Exchange) only
fill once the player is on dawn.com.


=====================================================
RUNNING VIDEO THROUGH A 1x1 AD UNIT
=====================================================
How it works: GAM serves a small custom creative into a 1x1 slot. The
creative places the video player on the page; the player then calls your
VIDEO ad unit for the actual video ad.

  1x1 ad unit  ->  1x1 line item  ->  custom creative  ->  player
                                                            |
                                         VAST request to the VIDEO ad unit
                                         (Ad Exchange / direct video ads)

Files:
  dawn-player.js         the player (host this on Dawn's server later)
  gam-1x1-creative.html  paste into GAM as the 1x1 custom creative
  gpt-test.html          test article page with the 1x1 slot

GAM SETUP
1. Inventory -> Ad units -> New:  dawn_video_1x1   size 1x1
   (keep your video unit dawn_video_preroll, size 640x480v, too)
2. Delivery -> Creatives -> New creative -> Custom, size 1x1.
   Paste gam-1x1-creative.html. UNTICK "Serve into a SafeFrame".
   Set VIDEO_AD_TAG to your video unit's tag.
3. Orders -> new order -> line item:
   type Sponsorship (or House for testing), size 1x1, 100% of impressions,
   target dawn_video_1x1. Attach the creative from step 2.
4. In gpt-test.html set ONE_BY_ONE_UNIT = '/YOUR_NETWORK_CODE/dawn_video_1x1'

TEST
Run server.py, then open  http://localhost:8000/gpt-test.html?google_console=1
The player should appear under the first paragraph and autoplay muted.
Ctrl+F10 opens GAM's debug panel if it doesn't.
