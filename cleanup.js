(function () {
    'use strict';
    console.log('[XQ77] cleanup.js initialized');
    var host = window.location.hostname;
    // এই ডায়লগটি moviebox.ph ছাড়াও অন্য hosts (যেমন 123movienow.cc) এ থাকতে পারে
    var isMoviebox = host.includes('moviebox.ph') || host.includes('123movienow.cc') || host.includes('aoneroom.com');
    console.log('[XQ77] Host:', host, '| isMoviebox:', isMoviebox);

    // window.open() — popup/new tab বন্ধ
    // window.open() — পপ-আপ অ্যাড ব্লক করো কিন্তু ইন্টারনাল ন্যাভিগেশন অ্যালাও করো
    var originalOpen = window.open;
    window.open = function(url, target, features) {
        if (!url) return null;
        try {
            var targetHost = new URL(url, window.location.href).hostname;
            // হোয়াইট লিস্টেড ডোমেইন হলে ন্যাভিগেট করতে দাও
            if (targetHost.includes('watchofree.beauty') || targetHost.includes('moviebox.ph') || 
                targetHost.includes('123movienow.cc') || targetHost.includes('aoneroom.com')) {
                return originalOpen.apply(window, arguments);
            }
        } catch(e) {}
        console.log('[XQ77] Blocked popup:', url);
        return null; 
    };

    // ============================================================
    // CSS — primary blocking (React re-render এও কাজ করে)
    // ============================================================
    var CSS_RULES =
        // General ad iframes & containers
        'iframe[src*="ads"], iframe[src*="doubleclick"],' +
        'iframe[src*="vast"], iframe[src*="preroll"],' +
        '.jw-ad-container, .jw-ad, .jw-plugin-googima,' +
        '.vjs-ad-playing, .vjs-ads-overlay,' +
        '#ima-ad-container, .ima-ad-container,' +
        '[class*="preroll"], [id*="preroll"],' +
        '[class*="vast"], [id*="vast"],' +
        'div[id*="google_ads"]' +
        ' { display: none !important; }' +

        // General site elements
        'header, footer, .h5-social-share, #cookiedata, .ann-home.alert, .content-kuss, .content-kuss-ads, ' +
        '.play-bt, .play-button, .player-click-overlay, .over-player, ' +
        '.luYzH, .boIG-, .dtWpL, .tB2ix, .\\+07bz, .IqvVI, .dbb7P, ._1M3Kq, .NYDzf, .Eub3O, .es3ai, .sdnLE, .YSkkR, .Q-B\\+X, .GcPci, ._9xQtM, .lMoGa, .fmxqf, ' +
        '[class*="luYzH"], [class*="boIG-"], [class*="dtWpL"], ' +
        '.jw-ads-ad-click, .jw-ads-click, .jw-display-ads, .jw-hidden-overlay, .jw-ads-view, .jw-ads-tap, .jw-tap-to-play, ' +
        '.click-trap, .click-box, .tap-to-play, .play-over, .dt_mainmeta, .doothemes_widget { display: none !important; }' +
        'iframe[style*="2147483647"][width="140"], iframe[width="140"], [class*="bell-icon"], img[src*="arcaceahelper.cyou"] { display: none !important; }' +

        

        //'.h5-social-share { display: none !important; }' +
        //'.doothemes_widget { display: none !important; }' +

        (host.includes('watchofree.beauty')
            ? '.ml-title, .ml-title-page { display: none !important; }' : '') +

        (isMoviebox ? (
            // Dialog overlay — opacity-100 class দিয়ে target
            // Logcat confirmed: dialog visible হলে 'opacity-100' class যোগ হয়
            '.fixed.inset-0.z-50.bg-black\\/60.opacity-100 { display: none !important; }' +
            '.fixed.inset-0.z-40.bg-black\\/60.opacity-100 { display: none !important; }' +
            '.fixed.inset-0.z-50.bg-black\\/60.transition-opacity { display: none !important; }' +

            // "Download App" modal dialog — Free Movie app promo popup
            '.download-dialog-overlay, .download-dialog-content { display: none !important; }' +
            '.fixed.inset-0.z-50 { display: none !important; }' +
            '.fixed.inset-0.z-40 { display: none !important; }' +
            
            // Generic wide fixed overlays (often used for these modals)
            'div[class*="download-dialog"] { display: none !important; }' +


            // Social share icons
            'a[href*="facebook.com"][target="_blank"],' +
            'a[href*="twitter.com"][target="_blank"],' +
            'a[href*="x.com"][target="_blank"],' +
            'a[href*="linkedin.com"][target="_blank"],' +
            'a[href*="t.me"][target="_blank"],' +
            'a[href*="reddit.com"][target="_blank"],' +
            'a[href*="telegram.me"][target="_blank"]' +
            ' { display: none !important; }'
        ) : '');




    function injectCSS() {
        var existing = document.getElementById('cinoplay-style');
        if (existing) {
            if (existing.textContent === CSS_RULES) return;
            existing.textContent = CSS_RULES;
            return;
        }
        var style = document.createElement('style');
        style.id = 'cinoplay-style';
        style.textContent = CSS_RULES;
        (document.head || document.documentElement).appendChild(style);
    }

    // cinoplay-style remove হলে re-inject
    var styleGuard = new MutationObserver(function() {
        if (!document.getElementById('cinoplay-style')) injectCSS();
    });
    styleGuard.observe(document.head || document.documentElement, { childList: true });

    // ============================================================
    // hideBanners() — text দিয়ে banner/card container hide করো
    // ⚠️ MutationObserver এ call করা হয় না — infinite loop এড়াতে
    // শুধু page load এবং SPA navigation এ একবার চলে
    // ============================================================
    var BANNER_TEXTS = [
        // ছবি ১: bottom bars
        'better on app',
        'download app',
        'download now',
        'download the app to continue',
        // ছবি ২: detail page bottom bar
        'get the app to watch',
        'get it on google play',
        // ছবি ৪: player page bars
        'open app for faster',
        'more free movies and shows',
        'open app to',
        'available in the app'
        // NOTE: 'watch in app' এখানে নেই — hideByKeyword directly handle করে
    ];


    var hiddenContainers = new Set();

    function findBannerContainer(el) {
        var screenH = window.innerHeight;
        // Element নিজেই যদি ছোট standalone element হয় (button/a) তাহলে এটাই return
        var selfTag = el.tagName ? el.tagName.toLowerCase() : '';
        if (selfTag === 'button' || selfTag === 'a') return el;

        // Parent এ উঠো — কিন্তু screen এর ২৫% এর কম height হতে হবে
        var cur = el.parentElement;
        for (var i = 0; i < 4; i++) {
            if (!cur || cur === document.body || cur === document.documentElement) break;
            var tag = cur.tagName ? cur.tagName.toLowerCase() : '';
            if (tag === 'nav' || tag === 'main' || tag === 'article' || tag === 'section') break;
            var rect = cur.getBoundingClientRect();
            // Banner/bar হওয়ার condition: thin strip (height < screen 25%)
            if (rect.height > 0 && rect.height < screenH * 0.25) {
                return cur;
            }
            cur = cur.parentElement;
        }
        return el; // safe fallback — container না পেলে element নিজেই
    }

    function hideBanners() {
        if (!isMoviebox) return;
        try {
            // সব visible text elements scan করো
            var els = document.querySelectorAll(
                'a, button, span, p, div, h1, h2, h3, h4, h5'
            );
            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                // শুধু leaf বা near-leaf elements (children কম)
                if (el.children.length > 8) continue;
                // ইতিমধ্যে hidden container এর child হলে skip
                var alreadyHidden = false;
                var par = el.parentElement;
                for (var p = 0; p < 5; p++) {
                    if (!par) break;
                    if (hiddenContainers.has(par)) { alreadyHidden = true; break; }
                    par = par.parentElement;
                }
                if (alreadyHidden) continue;

                var txt = (el.innerText || el.textContent || '').toLowerCase().trim();
                if (txt.length < 5 || txt.length > 150) continue;

                for (var b = 0; b < BANNER_TEXTS.length; b++) {
                    if (txt.indexOf(BANNER_TEXTS[b]) !== -1) {
                        var container = findBannerContainer(el);
                        if (!hiddenContainers.has(container)) {
                            container.style.setProperty('display', 'none', 'important');
                            hiddenContainers.add(container);
                        }
                        break;
                    }
                }
            }
        } catch(e) {}
    }

    // ============================================================
    // "Don't show it today" click
    // ============================================================
    var dontShowClicked = false;
    function clickDontShow() {
        if (dontShowClicked) return;
        document.querySelectorAll('a, button, span, p').forEach(function(el) {
            var txt = (el.innerText || '').trim().toLowerCase();
            if (txt === "don't show it today") {
                el.click();
                dontShowClicked = true;
            }
        });
    }

    // ============================================================
    // Keyword button hiding (WeakSet tracked — no loop)
    // ============================================================
    var keywords = ['watch in app', 'get the app', 'install app', 'share to'];
    var hiddenEls = new WeakSet();

    function hideByKeyword(root) {
        try {
            var tags = root.querySelectorAll ? root.querySelectorAll('button, a, h4, h3, .main-btn') : [];
            for (var i = 0; i < tags.length; i++) {
                var el = tags[i];
                if (hiddenEls.has(el)) continue;
                var txt = el.textContent ? el.textContent.toLowerCase() : '';
                if (txt.length > 80) continue;
                for (var k = 0; k < keywords.length; k++) {
                    if (txt.indexOf(keywords[k]) !== -1) {
                        el.style.setProperty('display', 'none', 'important');
                        hiddenEls.add(el);
                        break;
                    }
                }
            }
        } catch(e) {}
    }

    // ============================================================
    // SPA Navigation
    // ============================================================
    function onNavigate() {
        dontShowClicked = false;
        hiddenContainers.clear();
        setTimeout(injectCSS, 100);
        setTimeout(hideBanners, 600);
        setTimeout(hideBanners, 1500); // late-loading elements
        setTimeout(clickDontShow, 900);
    }

    var _push = history.pushState;
    history.pushState = function() { _push.apply(history, arguments); onNavigate(); };

    var _replace = history.replaceState;
    history.replaceState = function() { _replace.apply(history, arguments); onNavigate(); };

    window.addEventListener('popstate', onNavigate);

    // ============================================================
    // Visible dialog periodic checker
    // ============================================================
    setInterval(function() {
        try {
            // সব fixed full-screen elements এবং specific download dialog check করো
            var fixedEls = document.querySelectorAll(
                '.download-dialog-overlay, .download-dialog-content, ' +
                'div[class*="fixed"][class*="inset-0"],' +
                'div[class*="fixed"][class*="z-50"],' +
                'div[class*="fixed"][class*="z-40"]'
            );
            // নির্দিষ্ট ডাউনলোড বাটন ডিলিট করা
            document.querySelectorAll('.download-btn-hover').forEach(function(el) {
                if (el.innerText.includes('Download')) {
                    el.remove();
                }
            });

            // Arcaceahelper image ad removal
            document.querySelectorAll('img[src*="arcaceahelper.cyou"]').forEach(function(img) {
                var container = img.closest('.luYzH') || img.closest('.boIG-') || img.parentElement;
                if (container) container.remove();
            });

            // JW Player & Generic Ad Overlays hiding (clickjackers)
            // .jw-reset কন্টেইনার সব সময় হাইড করা যাবে না, প্লেয়ারের কিছু অংশ এতে থাকতে পারে
            document.querySelectorAll('div[class*="click-trap"], div[class*="overlay-player"], .jw-ads-click, .jw-ads-ad-click').forEach(function(el) {
                var style = window.getComputedStyle(el);
                if (style.position === 'absolute' && style.zIndex > 0) {
                   el.style.setProperty('display', 'none', 'important');
                   el.style.setProperty('pointer-events', 'none', 'important');
                }
            });

            // [REFINED-NUCLEAR] Universal DOM & Shadow Scanner
            function nuclearScan(root) {
                if (!root) return;
                
                var allEls = root.querySelectorAll('*');
                allEls.forEach(function(el) {
                    try {
                        var tag = el.tagName;
                        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'HEAD') return;

                        // ১. প্লেয়ার আইফ্রেম সুরক্ষা (Whitelist)
                        if (tag === 'IFRAME') {
                            var src = el.src || '';
                            if (src.indexOf('speedostream') !== -1 || src.indexOf('watchofree') !== -1 || 
                                src.indexOf('moviebox') !== -1 || src.indexOf('aoneroom') !== -1 || 
                                src.indexOf('123movienow') !== -1) {
                                return; // এই আইফ্রেমটি ট্যাপ করবেন না
                            }
                        }

                        var w = el.offsetWidth || 0;
                        var h = el.offsetHeight || 0;
                        var style = window.getComputedStyle(el);
                        var isFixed = (style.position === 'fixed' || style.position === 'absolute');
                        var z = parseInt(style.zIndex) || 0;

                        var cls = el.className || '';
                        var id = el.id || '';
                        if (typeof cls !== 'string') cls = '';
                        if (typeof id !== 'string') id = '';
                        
                        // বেল অ্যাড সিগনেচার (Precision blocks)
                        // Expanded Regex based on user snippet: luY, boI, dtW, Iqv, dbb, IPM3, RXG4, lQnl
                        var hasBellClass = /luY|boI|dtW|Iqv|dbb|fmxq|lMoG|NYD|Eub3|es3a|sdnL|YSkk|_1M3K|IPM3|RXG4|lQnl/.test(cls + '|' + id);
                        var anim = style.animationName || '';
                        var hasBellAnim = /tRmhB|_0TBFj|e3goi|v5v0k|Q3YQI|KoUN2|qGCPb|u99tk|OrxfW|TweZS/.test(anim);

                        // বেল আইকনের নির্দিষ্ট সাইজ চেক (১৪০x১৪০ বা ৭০x৭০ এর কাছাকাছি)
                        var isBellSize = ((w >= 120 && w <= 165) && (h >= 120 && h <= 165)) || 
                                         ((w >= 60 && w <= 95) && (h >= 60 && h <= 95));

                        // "নিউক্লিয়ার কিল": যদি ক্লাস/অ্যানিমেশন ম্যাচ করে, তবে পজিশন নির্বিশেষে ডিলিট করো
                        if (hasBellClass || hasBellAnim || (isFixed && isBellSize)) {
                            // নিশ্চিত হচ্ছি এটি প্লেয়ারের কোনো অংশ নয়
                            if (cls.indexOf('jw-') === -1 && cls.indexOf('player') === -1) {
                                console.log('[XQ77-NUCLEAR-DEL] Killing ad element:', tag, '| Class:', cls, '| Size:', w, 'x', h);
                                el.remove();
                                return;
                            }
                        }

                        // আইফ্রেম টার্গেটিং (যদি এটি কোনো নির্দিষ্ট সেফ হোস্টে না থাকে এবং বেল সাইজ হয়)
                        if (tag === 'IFRAME' && isBellSize) {
                             console.log('[XQ77-IFRAME-DEL] Ad size iframe removed:', w, 'x', h);
                             el.remove();
                             return;
                        }
                        
                        if (el.shadowRoot) {
                            nuclearScan(el.shadowRoot);
                        }
                    } catch(e) {}
                });
            }

            nuclearScan(document);

            // Play limit overlay (.play-limit) ডিলিট করা
            document.querySelectorAll('.play-limit').forEach(function(el) {
                console.log('[XQ77] Play limit overlay found, removing');
                var closeBtn = el.querySelector('.limit-close');
                if (closeBtn) closeBtn.click();
                el.remove();
            });
 
                fixedEls.forEach(function(el) {
                    // computed style দিয়ে visible কিনা check (hidden skip)
                    var style = window.getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden') return;
                    if (style.opacity === '0') return;

                    // এটা কি dialog? — inner text এ banner phrase আছে?
                    var txt = (el.innerText || '').toLowerCase();
                    var isDialog = false;
                    for (var b = 0; b < BANNER_TEXTS.length; b++) {
                        if (txt.indexOf(BANNER_TEXTS[b]) !== -1) {
                            isDialog = true;
                            break;
                        }
                    }
                    if (!isDialog) return;

                    console.log('[XQ77] Visible dialog found, hiding:', el.className.substring(0, 60));

                    // সরাসরি hide করো — X click এর চেয়ে বেশি নির্ভরযোগ্য
                    el.style.setProperty('display', 'none', 'important');

                    // Backdrop/overlay (parent) ও hide করো যদি থাকে
                    var parent = el.parentElement;
                    if (parent && parent !== document.body) {
                        var pCls = (parent.className || '').toString();
                        if (pCls.indexOf('fixed') !== -1 || pCls.indexOf('inset-0') !== -1) {
                            parent.style.setProperty('display', 'none', 'important');
                        }
                    }

                    // ১. X button click
                    var xBtn = el.querySelector(
                        '.dialog-close, .dialog-close img, ' +
                        'button[aria-label="Close"], button[aria-label="close"],' +
                        '[class*="close"] button, button[class*="close"]'
                    );
                    
                    console.log('[XQ77] Found dialog element with classes:', el.className);
                    
                    // Directly set style properties as fallback to CSS
                    el.style.setProperty('display', 'none', 'important');
                    el.style.setProperty('opacity', '0', 'important');
                    el.style.setProperty('pointer-events', 'none', 'important');
                    el.style.setProperty('z-index', '-9999', 'important');
                    if (!xBtn) {
                        var btns = el.querySelectorAll('button');
                        if (btns.length > 0) xBtn = btns[btns.length - 1];
                    }
                    if (xBtn) { setTimeout(function(b){ b.click(); }, 50, xBtn); }

                    // ২. "Don't show it today" click
                    el.querySelectorAll('a, span').forEach(function(child) {
                        var ctxt = (child.innerText || '').toLowerCase().trim();
                        if (ctxt === "don't show it today") child.click();
                    });
                });
            } catch(e) {}
        }, 1000);


    injectCSS();
    hideByKeyword(document);
    setTimeout(hideBanners, 600);
    setTimeout(hideBanners, 1500); // late-loading dialog/banner
    setTimeout(hideBanners, 3000); // extra fallback
    setTimeout(clickDontShow, 900);

    // MutationObserver — নতুন nodes এ keyword + auto-close dialog
    var debounceTimer = null;
    var contentObserver = new MutationObserver(function(mutations) {
        if (debounceTimer) return;
        debounceTimer = setTimeout(function() {
            debounceTimer = null;
            for (var m = 0; m < mutations.length; m++) {
                var added = mutations[m].addedNodes;
                for (var n = 0; n < added.length; n++) {
                    var node = added[n];
                    if (node.nodeType !== 1) continue;

                    // ছোট elements এ keyword check (button/a/h4)
                    hideByKeyword(node);

                    // Newly added node এ banner text আছে?
                    // Hide করা যাবে না (player container থাকতে পারে)
                    // X button click করা যাবে — React নিজেই dialog বন্ধ করবে
                    if (!isMoviebox) continue;
                    try {
                        var nodeText = (node.innerText || '').toLowerCase();
                        if (nodeText.length > 2 && nodeText.length < 800) {
                            var hasBannerText = false;
                            for (var b = 0; b < BANNER_TEXTS.length; b++) {
                                if (nodeText.indexOf(BANNER_TEXTS[b]) !== -1) {
                                    hasBannerText = true;
                                    break;
                                }
                            }
                            if (hasBannerText) {
                                // X close button খুঁজে click করো
                                var closeBtn = node.querySelector(
                                    'button[aria-label="Close"], button[aria-label="close"],' +
                                    'button.close, [data-dismiss="modal"],' +
                                    'button svg, button[class*="close"]'
                                );
                                if (closeBtn) {
                                    // Closest button যেটা X icon ধারণ করে
                                    var btn = closeBtn.tagName.toLowerCase() === 'button'
                                        ? closeBtn
                                        : closeBtn.closest('button');
                                    if (btn) setTimeout(function(b) {
                                        return function() {
                                            console.log('[XQ77] Auto-clicking X on dialog');
                                            b.click();
                                        };
                                    }(btn), 100);
                                } else {
                                    // X button না পেলে শুধু "Don't show" click
                                    var dontShow = node.querySelector('a, span, p');
                                    if (dontShow) {
                                        var dsTxt = (dontShow.innerText || '').toLowerCase().trim();
                                        if (dsTxt === "don't show it today") dontShow.click();
                                    }
                                }
                            }
                        }
                    } catch(e) {}
                }
            }
        }, 300);
    });

    contentObserver.observe(document.documentElement, { childList: true, subtree: true });

    // ============================================================
    // DIAGNOSTIC: Attribute observer — user manually dialog close করলে log করো
    // class attribute change মানে React dialog show/hide করছে
    // ============================================================
    if (isMoviebox) {
        var attrObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(m) {
                if (m.type !== 'attributes' || m.attributeName !== 'class') return;
                var el = m.target;
                var cls = (el.className || '').toString();
                // fixed + inset-0 বা z-50 আছে এমন elements track করো
                if (cls.indexOf('fixed') !== -1 &&
                    (cls.indexOf('inset-0') !== -1 || cls.indexOf('z-50') !== -1)) {
                    var txt = (el.innerText || '').substring(0, 80);
                    console.log('[XQ77-ATTR] Class changed on fixed el | class:',
                        cls.substring(0, 100), '| text:', txt);
                }
            });
        });
        // document body এর direct children watch করো
        attrObserver.observe(document.body || document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
            subtree: true
        });
    }

    // ============================================================
    // DIAGNOSTIC CLICK LOGGING & REDIRECT INTERCEPTION
    // ============================================================
    document.addEventListener('click', function(e) {
        var el = e.target;
        var anchor = el.closest('a');
        
        // Log info
        var info = {
            tag: el.tagName,
            id: el.id || 'N/A',
            classes: el.className || 'N/A',
            zIndex: window.getComputedStyle(el).zIndex,
            href: anchor ? anchor.href : 'N/A'
        };
        console.log('[XQ77-CLICK] Element:', info.tag, '| id:', info.id, '| class:', info.classes, '| zIndex:', info.zIndex);
        if (anchor) console.log('[XQ77-CLICK] Link found:', info.href);

        // Redirect Prevention: লিঙ্কটি যদি অ্যাড ডোমেইন হয় তবে ব্রাউজারের ডিফল্ট ন্যাভিগেশন বন্ধ করো
        if (anchor && anchor.href && anchor.href.startsWith('http')) {
            try {
                var urlObj = new URL(anchor.href);
                var targetHost = urlObj.hostname.toLowerCase();
                var allowed = [
                    'watchofree.beauty', 'moviebox.ph', '123movienow.cc', 'aoneroom.com', 'bongobd.com', 
                    'beskillit.com', 'mkvfun.cyou', 'mkvfun.com', 'speedostream.com', 'bilibili.tv',
                    '1flex.nl', 'yflix.to', 'animesalt.ac', 'toonstream.dad', 'hydrahd.ru', 'lookmovie2.to'
                ];
                var isWhitelisted = allowed.some(h => targetHost.includes(h));

                if (!isWhitelisted) {
                    console.log('[XQ77] Prevented ad navigation to:', anchor.href);
                    e.preventDefault(); // Stop navigation
                    // e.stopPropagation(); // DO NOT call this, let the site's JS handle the player load
                }
            } catch(err) {}
        }

        // Highlight temporarily to show user what was hit
        try {
            var originalOutline = el.style.outline;
            el.style.outline = '2px solid red';
            setTimeout(function(){ el.style.outline = originalOutline; }, 500);
        } catch(err) {}
    }, true); // Capture phase-এ ও ইন্টারসেপ্ট করো

})();

