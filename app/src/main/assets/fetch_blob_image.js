// fetch_blob_image.js
// Fetches a blob: URL image and converts to data: URL.
// Handles blob:null/... URLs via sandboxed iframe.
//
// Usage: set window.__pendingImageUrl = "blob:null/..." before evaluating.
// Result: sets window.__imageResult to a data: URL string (or '' on failure).

(function() {
  var url = window.__pendingImageUrl;
  delete window.__pendingImageUrl;
  window.__imageResult = null;

  window.__imgBlobMsg = function(e) {
    if (e.data && e.data.type === 'imgBlobData') {
      window.__imageResult = e.data.dataUrl || '';
      window.removeEventListener('message', window.__imgBlobMsg);
    }
  };
  window.addEventListener('message', window.__imgBlobMsg);

  function setResult(d) {
    window.__imageResult = d;
    window.removeEventListener('message', window.__imgBlobMsg);
  }

  function trySandboxedFetch(u) {
    var enc = encodeURIComponent(u);
    var iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.style.display = 'none';
    var html = '<scr' + 'ipt>' +
      'var u=decodeURIComponent("' + enc + '");' +
      'try{fetch(u).then(function(r){return r.blob();}).then(function(b){' +
      'var fr=new FileReader();' +
      'fr.onloadend=function(){try{window.parent.postMessage({type:"imgBlobData",dataUrl:fr.result||""},"*");}catch(e){}};' +
      'fr.onerror=function(){try{window.parent.postMessage({type:"imgBlobData",dataUrl:""},"*");}catch(e){}};' +
      'fr.readAsDataURL(b);}).catch(function(){try{window.parent.postMessage({type:"imgBlobData",dataUrl:""},"*");}catch(e){}});' +
      '}catch(e){try{window.parent.postMessage({type:"imgBlobData",dataUrl:""},"*");}catch(e2){}}' +
      '</scr' + 'ipt>';
    iframe.srcdoc = html;
    document.body.appendChild(iframe);
    setTimeout(function() {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 15000);
  }

  try {
    var ref = window.__blobRefs && window.__blobRefs[url];
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
      fetch(url)
        .then(function(r) { return r.blob(); })
        .then(function(b) {
          var fr = new FileReader();
          fr.onloadend = function() { setResult(fr.result || ''); };
          fr.onerror = function() { setResult(''); };
          fr.readAsDataURL(b);
        })
        .catch(function() { trySandboxedFetch(url); });
    }
  } catch(e) {
    trySandboxedFetch(url);
  }
})();
