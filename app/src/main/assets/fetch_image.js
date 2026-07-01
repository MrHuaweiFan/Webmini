// fetch_image.js
// Fetch an image (possibly a blob: URL). Checks __blobRefs first (populated
// by blob_capture.js via addDocumentStartJavaScript), then falls back to fetch.
//
// Usage: set window.__pendingImageFetch = "blob:..." before evaluating.
// Result: calls window.AndroidBridge.deliverImage(base64, mime).

(function() {
  var url = window.__pendingImageFetch;
  delete window.__pendingImageFetch;
  if (!url) return;

  function deliver(b64, mime) {
    try {
      if (window.AndroidBridge && window.AndroidBridge.deliverImage) {
        window.AndroidBridge.deliverImage(b64 || '', mime || 'image/png');
      }
    } catch (e) {
      console.log('[image] bridge call failed:', e);
    }
  }

  // 1. Check __blobRefs (populated eagerly by blob_capture.js).
  //    The capture is async (FileReader + postMessage), so retry a few
  //    times before falling back to fetch.
  function tryBlobRefs() {
    var ref = window.__blobRefs && window.__blobRefs[url];
    if (ref) {
      console.log('[image] found in __blobRefs');
      if (typeof ref === 'object' && ref.b64) {
        deliver(ref.b64, ref.mime || 'image/png');
        return true;
      } else if (typeof ref === 'string') {
        var comma = ref.indexOf(',');
        var b64 = comma > 0 ? ref.substring(comma + 1) : '';
        if (b64) { deliver(b64, 'image/png'); return true; }
      } else if (ref instanceof Blob) {
        var fr1 = new FileReader();
        fr1.onloadend = function() {
          var d = fr1.result || '';
          var c = d.indexOf(',');
          deliver(c > 0 ? d.substring(c + 1) : '', 'image/png');
        };
        fr1.readAsDataURL(ref);
        return true;
      }
    }
    return false;
  }

  if (tryBlobRefs()) return;

  // 2. Retry a few times (iframe postMessage might be in flight)
  var retries = 0;
  function retry() {
    retries++;
    if (tryBlobRefs()) return;
    if (retries < 5) {
      setTimeout(retry, 300);
    } else {
      // 3. Final fallback: try fetch
      console.log('[image] not in __blobRefs after retries, trying fetch');
      tryFetch();
    }
  }

  function tryFetch() {
    try {
      fetch(url)
        .then(function(r) {
          return r.blob().then(function(b) {
            var mime = b.type || 'image/png';
            var fr = new FileReader();
            fr.onloadend = function() {
              var dataUrl = fr.result || '';
              var comma = dataUrl.indexOf(',');
              var b64 = comma > 0 ? dataUrl.substring(comma + 1) : '';
              deliver(b64, mime);
            };
            fr.onerror = function() { deliver('', mime); };
            fr.readAsDataURL(b);
          });
        })
        .catch(function(e) {
          console.log('[image] fetch failed:', e);
          deliver('', 'image/png');
        });
    } catch (e) {
      console.log('[image] exception:', e);
      deliver('', 'image/png');
    }
  }

  setTimeout(retry, 300);
})();
