// blob_capture.js
//
// Injected via WebViewCompat.addDocumentStartJavaScript — runs in EVERY frame
// (main + all iframes, including sandboxed/null-origin ones) at document
// creation time, BEFORE any page JS runs. This eliminates the race condition
// where createObjectURL was called before our override was installed.
//
// Strategy:
// - Override URL.createObjectURL in EVERY frame
// - EAGERLY read the blob via FileReader.readAsDataURL at creation time
//   (not at click time — Gemini may revoke the blob URL before the user clicks)
// - Main frame: store blob data in window.__blobRefs
// - Iframes: send blob data to parent via postMessage (works cross-origin)
// - Main frame: listen for postMessage, store in window.__blobRefs

(function() {
  if (window.__blobCaptureInstalled) return;
  window.__blobCaptureInstalled = true;

  var isTop = (window === window.top);

  // Override createObjectURL to capture blob data eagerly at creation time
  var origCreate = URL.createObjectURL;
  URL.createObjectURL = function(blob) {
    var url = origCreate.call(URL, blob);
    try {
      if (blob) {
        var fr = new FileReader();
        fr.onloadend = function() {
          try {
            var dataUrl = fr.result || '';
            var comma = dataUrl.indexOf(',');
            var b64 = comma > 0 ? dataUrl.substring(comma + 1) : '';
            var header = comma > 0 ? dataUrl.substring(5, comma) : '';
            var mime = blob.type || 'application/octet-stream';
            // Extract mime from data URL header if present
            var semi = header.indexOf(';');
            if (semi > 0) {
              var m = header.substring(0, semi).trim();
              if (m) mime = m;
            }
            if (isTop) {
              // Main frame: store directly
              window.__blobRefs = window.__blobRefs || {};
              window.__blobRefs[url] = { b64: b64, mime: mime };
              console.log('[blob-capture] stored in main frame:', url.substring(0, 50), '(' + b64.length + ' chars)');
            } else {
              // Iframe: send to parent via postMessage
              window.parent.postMessage({
                type: '__blobCaptured',
                url: url,
                b64: b64,
                mime: mime
              }, '*');
              console.log('[blob-capture] sent from iframe:', url.substring(0, 50));
            }
          } catch (e) {
            console.log('[blob-capture] onloadend error:', e);
          }
        };
        fr.onerror = function() {
          console.log('[blob-capture] FileReader error');
          if (!isTop) {
            try {
              window.parent.postMessage({
                type: '__blobCaptured',
                url: url,
                b64: '',
                mime: blob.type || 'application/octet-stream'
              }, '*');
            } catch (e) {}
          }
        };
        fr.readAsDataURL(blob);
      }
    } catch (e) {
      console.log('[blob-capture] createObjectURL hook error:', e);
    }
    return url;
  };

  // Main frame: listen for blob data from iframes
  if (isTop) {
    window.addEventListener('message', function(e) {
      try {
        if (e.data && e.data.type === '__blobCaptured') {
          window.__blobRefs = window.__blobRefs || {};
          window.__blobRefs[e.data.url] = { b64: e.data.b64, mime: e.data.mime };
          console.log('[blob-capture] received from iframe:', e.data.url.substring(0, 50));
        }
      } catch (err) {
        console.log('[blob-capture] message handler error:', err);
      }
    });
    console.log('[blob-capture] installed in main frame');
  } else {
    console.log('[blob-capture] installed in iframe');
  }
})();
