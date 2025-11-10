<script>
  // ---- 1. Hardcoded form selector ------------------------------------------------------
  const form = document.querySelector('#wf-form-newsletter');
  if (!form) return;

  // ---- 2. HARDCODED PDF URL & FILENAME ------------------------------------------------
  const PDF_URL     = 'https://cdn.prod.website-files.com/6908eb406bdea5c86f04229d/69119f63e2b3f50d86060031_Golden_Lake_Catalog.pdf';
  const FILE_NAME   = 'Golden_Lake_Catalog.pdf';

  // ---- 3. Force download function ------------------------------------------------------
  function downloadFile(url, name) {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ---- 4. Watch for Webflow success message (w-form-done) -----------------------------
  const successObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      const target = mutation.target;
      if (target.classList.contains('w-form-done') && 
          target.style.display !== 'none' && 
          target.style.display !== '') {

        // Start download immediately
        downloadFile(PDF_URL, FILE_NAME);

        // Optional: hide success message after 1.5 seconds
        setTimeout(() => {
          target.style.display = 'none';
        }, 1500);
      }
    });
  });

  // Observe the success message element
  const successEl = document.querySelector('.success-message');
  if (successEl) {
    successObserver.observe(successEl, {
      attributes: true,
      attributeFilter: ['style']
    });
  }
</script>