// download_interceptor.js
//
// Intercept blob: URL downloads. blob:null/... URLs are created in sandboxed
// iframes (null origin) and can ONLY be fetched from that iframe's context.
// So this script runs in BOTH the main page AND all iframes.
//
// - Main page: listens for postMessage from iframes (blob data + download
//   requests), calls AndroidBridge. Also checks __blobRefs (populated by
//   the iframe blob-capture bridge) before trying fetch().
// - Iframe: intercepts <a download> clicks, fetches the blob, postMessage
//   to parent.

(function() {
  if (window._downloadInterceptorInstalled) return;
  window._downloadInterceptorInstalled = true;

  var isIframe = (window !== window.top);

  function extractB64(dataUrl) {
    if (!dataUrl || dataUrl.indexOf('data:') !== 0) return {b64: '', mime: ''};
    var comma = dataUrl.indexOf(',');
    if (comma < 0) return {b64: '', mime: ''};
    var header = dataUrl.substring(5, comma);
    var b64 = dataUrl.substring(comma + 1);
    var mime = '';
    var semi = header.indexOf(';');
    if (semi > 0) mime = header.substring(0, semi).trim();
    else mime = header.trim();
    return {b64: b64, mime: mime};
  }

  function fetchBlob(url, cb) {
    try {
      fetch(url)
        .then(function(r) {
          return r.blob().then(function(b) {
            var mime = b.type || 'application/octet-stream';
            var fr = new FileReader();
            fr.onloadend = function() {
              var parts = extractB64(fr.result || '');
              cb(parts.b64, parts.mime || mime);
            };
            fr.onerror = function() { cb('', mime); };
            fr.readAsArrayBuffer(b);
          });
        })
        .catch(function(e) {
          console.log('[dl] fetch failed:', e && e.message);
          cb('', 'application/octet-stream');
        });
    } catch (e) {
      console.log('[dl] exception:', e && e.message);
      cb('', 'application/octet-stream');
    }
  }

  function mimeFromExt(filename) {
    var ext = (filename.split('.').pop() || '').toLowerCase();
    var m = {
      'html': 'text/html', 'htm': 'text/html', 'png': 'image/png',
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'gif': 'image/gif',
      'svg': 'image/svg+xml', 'pdf': 'application/pdf', 'txt': 'text/plain',
      'json': 'application/json', 'py': 'text/x-python', 'js': 'text/javascript',
      'css': 'text/css', 'csv': 'text/csv', 'xml': 'application/xml',
      'zip': 'application/zip'
    };
    return m[ext] || 'application/octet-stream';
  }

  function deliver(filename, b64, mime) {
    if (isIframe) {
      try {
        window.parent.postMessage({
          type: '__nativeDownload',
          filename: filename,
          base64: b64 || '',
          mime: mime || 'application/octet-stream'
        }, '*');
      } catch (err) {
        console.log('[dl] postMessage failed:', err);
      }
    } else {
      try {
        if (window.AndroidBridge && window.AndroidBridge.startNativeDownload) {
          window.AndroidBridge.startNativeDownload(
            filename, b64 || '', mime || 'application/octet-stream'
          );
        } else {
          console.log('[dl] AndroidBridge.startNativeDownload not available');
        }
      } catch (err) {
        console.log('[dl] bridge call failed:', err);
      }
    }
  }

  function doDownload(url, filename, mimeHint) {
    console.log('[dl] doDownload:', url.substring(0, 60), filename);

    // 1. Check __blobRefs — populated eagerly by blob_capture.js (injected
    //    via addDocumentStartJavaScript, runs in ALL frames at doc creation).
    //    Each entry is {b64: "...", mime: "..."}.
    //    NOTE: the capture is async (FileReader), so the entry might not be
    //    populated yet if the user clicks download very quickly. We retry
    //    a few times before giving up.
    function tryBlobRefs(attempt) {
      var ref = window.__blobRefs && window.__blobRefs[url];
      if (ref) {
        console.log('[dl] found in __blobRefs (attempt ' + attempt + ')');
        if (typeof ref === 'object' && ref.b64) {
          deliver(filename, ref.b64, ref.mime || mimeHint);
          return true;
        } else if (typeof ref === 'string') {
          var parts = extractB64(ref);
          if (parts.b64) {
            deliver(filename, parts.b64, parts.mime || mimeHint);
            return true;
          }
        } else if (ref instanceof Blob) {
          var fr = new FileReader();
          fr.onloadend = function() {
            var p = extractB64(fr.result || '');
            deliver(filename, p.b64, p.mime || mimeHint);
          };
          fr.onerror = function() { deliver(filename, '', mimeHint); };
          fr.readAsArrayBuffer(ref);
          return true;
        }
      }
      return false;
    }

    if (tryBlobRefs(1)) return;

    // 2. Not in __blobRefs yet — retry a few times (the iframe postMessage
    //    might still be in flight). 5 retries × 300ms = 1.5s max.
    var retries = 0;
    var maxRetries = 5;
    function retry() {
      retries++;
      if (tryBlobRefs(retries + 1)) return;
      if (retries < maxRetries) {
        setTimeout(retry, 300);
      } else {
        // 3. Final fallback: try direct fetch (works for same-origin blobs)
        console.log('[dl] not in __blobRefs after ' + maxRetries + ' retries, trying fetch');
        fetchBlob(url, function(b64, actualMime) {
          if (b64) {
            deliver(filename, b64, actualMime || mimeHint);
          } else {
            console.log('[dl] fetch returned empty, blob may be revoked or cross-origin');
            deliver(filename, '', mimeHint);
          }
        });
      }
    }
    setTimeout(retry, 300);
  }

  function setupClickInterceptor() {
    document.addEventListener('click', function(e) {
      try {
        var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
        if (!a) return;
        var href = a.href || a.getAttribute('href') || '';
        if (href.indexOf('blob:') !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        var filename = a.getAttribute('download') || 'download';
        var mime = mimeFromExt(filename);
        console.log('[dl] click intercepted:', filename);
        doDownload(href, filename, mime);
      } catch (err) {
        console.log('[dl] click error:', err);
      }
    }, true);
  }

  if (isIframe) {
    // IFRAME: intercept clicks, fetch blob, postMessage to parent
    setupClickInterceptor();
    console.log('[dl] interceptor installed in iframe');
  } else {
    // MAIN PAGE: listen for iframe postMessages
    window.addEventListener('message', function(e) {
      try {
        if (!e.data) return;
        if (e.data.type === '__nativeDownload') {
          // Iframe fetched the blob and is sending us the data
          if (window.AndroidBridge && window.AndroidBridge.startNativeDownload) {
            window.AndroidBridge.startNativeDownload(
              e.data.filename || 'download',
              e.data.base64 || '',
              e.data.mime || 'application/octet-stream'
            );
          }
        }
      } catch (err) {
        console.log('[dl] message handler error:', err);
      }
    });

    // Expose for native DownloadListener calls
    window.__doNativeDownload = function(url, filename, mime) {
      doDownload(url, filename, mime);
    };

    // Intercept clicks on main page
    setupClickInterceptor();
    console.log('[dl] interceptor installed on main page');
  }
})();
