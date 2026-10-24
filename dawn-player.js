/*
 * Dawn video player - reusable version.
 *
 *   DawnPlayer.mount(containerElement, {
 *     adTagUrl:   'VAST tag of your GAM *video* ad unit',
 *     contentUrl: 'https://.../video.mp4',
 *     startWhenVisible: 0.5          // optional
 *   });
 *
 * Muted autoplay when the player is 50% on screen, "Tap to unmute",
 * Google IMA ads, and plays the video anyway if there's no ad.
 * Used by the GAM 1x1 creative (gam-1x1-creative.html) and works on any page.
 */
(function (win) {
  if (win.DawnPlayer) return;
  var doc = win.document;
  var IMA_SRC = 'https://imasdk.googleapis.com/js/sdkloader/ima3.js';
  var imaPromise = null;

  function loadIMA() {
    if (win.google && win.google.ima) return Promise.resolve(true);
    if (imaPromise) return imaPromise;
    imaPromise = new Promise(function (resolve) {
      var s = doc.createElement('script');
      s.src = IMA_SRC;
      s.async = true;
      s.onload = function () { resolve(!!(win.google && win.google.ima)); };
      s.onerror = function () { resolve(false); };   // ad blocker
      doc.head.appendChild(s);
    });
    return imaPromise;
  }

  function addStyles() {
    if (doc.getElementById('dawn-player-css')) return;
    var css = doc.createElement('style');
    css.id = 'dawn-player-css';
    css.textContent =
      '.dawn-player{position:relative;width:100%;aspect-ratio:16/9;background:#000;margin:16px 0;overflow:hidden}' +
      '.dawn-player video{width:100%;height:100%;display:block}' +
      '.dawn-player .dp-ads{position:absolute;inset:0;pointer-events:none}' +
      '.dawn-player .dp-unmute{position:absolute;left:12px;bottom:56px;z-index:3;display:none;border:0;' +
        'border-radius:6px;padding:8px 12px;cursor:pointer;background:rgba(0,0,0,.75);color:#fff;font:14px system-ui,sans-serif}' +
      '.dawn-player .dp-play{position:absolute;inset:0;margin:auto;width:84px;height:84px;z-index:3;display:none;' +
        'border-radius:50%;border:0;background:rgba(0,0,0,.65);color:#fff;font-size:34px;cursor:pointer}';
    doc.head.appendChild(css);
  }

  function log(msg) { if (win.console) console.log('[DawnPlayer]', msg); }

  function mount(container, opts) {
    if (!container || container.dataset.dawnPlayer) return;
    container.dataset.dawnPlayer = '1';
    addStyles();

    var player = doc.createElement('div');
    player.className = 'dawn-player';
    player.innerHTML =
      '<video muted playsinline preload="metadata"></video>' +
      '<div class="dp-ads"></div>' +
      '<button class="dp-unmute">&#128263; Tap to unmute</button>' +
      '<button class="dp-play" aria-label="Play">&#9654;</button>';
    container.appendChild(player);

    var video = player.querySelector('video');
    var adLayer = player.querySelector('.dp-ads');
    var unmuteBtn = player.querySelector('.dp-unmute');
    var playBtn = player.querySelector('.dp-play');
    var adDisplayContainer, adsLoader, adsManager;
    var contentEnded = false, adPlaying = false, imaOK = false;

    video.src = opts.contentUrl;
    video.muted = true;

    function playContent() {
      video.controls = true;
      var p = video.play();
      if (p && p.catch) p.catch(function () { playBtn.style.display = 'block'; });
    }
    function startContent() {
      adPlaying = false;
      adLayer.style.pointerEvents = 'none';
      if (!contentEnded) playContent();
    }

    unmuteBtn.onclick = function () {
      video.muted = false;
      if (adsManager) adsManager.setVolume(1);
      unmuteBtn.style.display = 'none';
    };
    video.addEventListener('volumechange', function () {
      if (!video.muted) unmuteBtn.style.display = 'none';
    });
    playBtn.onclick = function () { playBtn.style.display = 'none'; video.play(); };

    function buildTag() {
      var pageUrl = encodeURIComponent(win.location.href);
      var t = opts.adTagUrl
        .replace('[timestamp]', Date.now())
        .replace('[description_url]', pageUrl)
        .replace('[referrer_url]', pageUrl);
      // also handle tags with empty values ("correlator=&")
      t = t.replace(/([?&]correlator=)(?=&|$)/, '$1' + Date.now())
           .replace(/([?&]description_url=)(?=&|$)/, '$1' + pageUrl);
      return t;
    }

    function setUpIMA() {
      var ima = win.google.ima;
      adDisplayContainer = new ima.AdDisplayContainer(adLayer, video);
      adsLoader = new ima.AdsLoader(adDisplayContainer);
      adsLoader.addEventListener(ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, onLoaded, false);
      adsLoader.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, onError, false);
      video.addEventListener('ended', function () {
        if (adPlaying) return;
        contentEnded = true;
        adsLoader.contentComplete();
      });
    }

    function onLoaded(e) {
      var ima = win.google.ima;
      var settings = new ima.AdsRenderingSettings();
      settings.restoreCustomPlaybackStateOnAdBreakComplete = true;
      adsManager = e.getAdsManager(video, settings);
      adsManager.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, onError);
      adsManager.addEventListener(ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED, function () {
        adPlaying = true;
        video.pause();
        video.controls = false;
        adLayer.style.pointerEvents = 'auto';
      });
      adsManager.addEventListener(ima.AdEvent.Type.CONTENT_RESUME_REQUESTED, startContent);
      adsManager.addEventListener(ima.AdEvent.Type.STARTED, function () { log('ad started'); });
      try {
        adsManager.init(player.clientWidth, player.clientHeight, ima.ViewMode.NORMAL);
        adsManager.setVolume(video.muted ? 0 : 1);
        adsManager.start();
      } catch (err) { log('ad start failed: ' + err); startContent(); }
    }

    function onError(e) {
      log('ad error: ' + (e.getError ? e.getError() : e));
      if (adsManager) adsManager.destroy();
      startContent();
    }

    function start() {
      unmuteBtn.style.display = 'block';
      if (!imaOK) { playContent(); return; }
      adDisplayContainer.initialize();
      video.load();
      var ima = win.google.ima;
      var req = new ima.AdsRequest();
      req.adTagUrl = buildTag();
      req.linearAdSlotWidth = player.clientWidth;
      req.linearAdSlotHeight = player.clientHeight;
      req.nonLinearAdSlotWidth = player.clientWidth;
      req.nonLinearAdSlotHeight = Math.floor(player.clientHeight / 3);
      req.setAdWillAutoPlay(true);
      req.setAdWillPlayMuted(true);
      adsLoader.requestAds(req);
      log('ad request sent');
    }

    win.addEventListener('resize', function () {
      if (adsManager) adsManager.resize(player.clientWidth, player.clientHeight, win.google.ima.ViewMode.NORMAL);
    });

    loadIMA().then(function (ok) {
      imaOK = ok;
      if (ok) setUpIMA(); else log('IMA blocked - content only');
      var started = false;
      var io = new win.IntersectionObserver(function (entries) {
        if (!started && entries[0].isIntersecting) {
          started = true;
          io.disconnect();
          start();
        }
      }, { threshold: opts.startWhenVisible || 0.5 });
      io.observe(player);
    });
  }

  win.DawnPlayer = { mount: mount };
})(window);
