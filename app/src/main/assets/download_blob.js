// download_blob.js
// Handles blob: URL downloads, including blob:null/... URLs created in
// sandboxed iframes. For blob:null/... URLs, creates a sandboxed iframe
// with null origin to fetch the blob (all null origins are considered
// the same for blob URL access).
//
// Usage: set window.__pendingBlobDownload = "blob:null/..." before evaluating this script.
// Result: sets window.__downloadResult to a data: URL string (or '' on failure).

(function() {
  var blobUrl = window.__pendingBlobDownload;
  delete window.__pendingBlobDownload;
  window.__downloadResult = null;

  window.__dlBlobMsg = function(e) {
    if (e.data && e.data.type === 'dlBlobData') {
      window.__downloadResult = e.data.dataUrl || '';
      window.removeEventListener('message', window.__dlBlobMsg);
    }
  };
  window.addEventListener('message', window.__dlBlobMsg);

  function setResult(d) {
    window.__downloadResult = d;
    window.removeEventListener('message', window.__dlBlobMsg);
  }

  function trySandboxedFetch(url) {
    var enc = encodeURIComponent(url);
    var iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.style.display = 'none';
    var html = '<scr' + 'ipt>' +
      'var u=decodeURIComponent("' + enc + '");' +
      'try{fetch(u).then(function(r){return r.blob();}).then(function(b){' +
      'var fr=new FileReader();' +
      'fr.onloadend=function(){try{window.parent.postMessage({type:"dlBlobData",dataUrl:fr.result||""},"*");}catch(e){}};' +
      'fr.onerror=function(){try{window.parent.postMessage({type:"dlBlobData",dataUrl:""},"*");}catch(e){}};' +
      'fr.readAsDataURL(b);}).catch(function(){try{window.parent.postMessage({type:"dlBlobData",dataUrl:""},"*");}catch(e){}});' +
      '}catch(e){try{window.parent.postMessage({type:"dlBlobData",dataUrl:""},"*");}catch(e2){}}' +
      '</scr' + 'ipt>';
    iframe.srcdoc = html;
    document.body.appendChild(iframe);
    setTimeout(function() {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 15000);
  }

  try {
    var ref = window.__blobRefs && window.__blobRefs[blobUrl];
    if (ref) {
      if (typeof ref === 'string') {
        setResult(ref);
      } else if (ref instanceof Blob) {
        var fr = new FileReader();
        fr.onloadend = function() { setResult(fr.result || ''); };
        fr.onerror = function() { setResult(''); };
        fr.readAsDataURL(ref);
      } else {
        setResult('');
      }
    } else {
      // Try direct fetch first (works for same-origin blobs)
      fetch(blobUrl)
        .then(function(r) { return r.blob(); })
        .then(function(b) {
          var fr = new FileReader();
          fr.onloadend = function() { setResult(fr.result || ''); };
          fr.onerror = function() { setResult(''); };
          fr.readAsDataURL(b);
        })
        .catch(function() {
          // Direct fetch failed (cross-origin blob:null/...).
          // Create a sandboxed iframe with null origin to fetch it.
          trySandboxedFetch(blobUrl);
        });
    }
  } catch(e) {
    trySandboxedFetch(blobUrl);
  }
})();
