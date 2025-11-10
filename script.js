// Newsletter form: start file download on submit without redirecting
// This script safely hooks into Webflow’s AJAX form behavior.

(function () {
  const DOWNLOAD_URL = 'https://cdn.prod.website-files.com/6908eb406bdea5c86f04229d/69119f63e2b3f50d86060031_Golden_Lake_Catalog.pdf';
  const SUGGESTED_NAME = 'Golden_Lake_Catalog.pdf';

  function triggerDownload(url, filename) {
    // Try to download via fetch + blob (best UX, no new tab). Fallback to iframe.
    try {
      fetch(url, { mode: 'cors' })
        .then((res) => {
          if (!res.ok) throw new Error('Network response was not ok');
          return res.blob();
        })
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = filename || '';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        })
        .catch(() => {
          // Fallback: hidden iframe to initiate download without redirecting current page
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = url;
          document.body.appendChild(iframe);
          // Clean up later
          setTimeout(() => iframe.remove(), 60000);
        });
    } catch (_) {
      // If fetch is not available or fails synchronously, fallback immediately
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      setTimeout(() => iframe.remove(), 60000);
    }
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onReady(function () {
    // Find the newsletter form robustly (by id or data-name)
    var form = document.querySelector('#wf-form-newsletter') || document.querySelector('form[data-name="newsletter"]');
    if (!form) return;

    // Ensure Webflow does not redirect by clearing redirect attributes at runtime
    form.removeAttribute('redirect');
    form.removeAttribute('data-redirect');

    // Attach once; avoid duplicate downloads on repeated AJAX submits
    if (form.__downloadHookAttached) return;
    form.__downloadHookAttached = true;

    form.addEventListener('submit', function (e) {
      // Let Webflow handle the AJAX submit; do not preventDefault
      // Only trigger download when basic HTML5 validity passes
      var emailInput = form.querySelector('input[name="email"][type="email"]');
      if (emailInput && !emailInput.checkValidity()) {
        return; // browser will display native validation message
      }

      // Slight delay to avoid racing Webflow’s AJAX binding
      setTimeout(function () {
        triggerDownload(DOWNLOAD_URL, SUGGESTED_NAME);
      }, 100);
    });
  });
})();