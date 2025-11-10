<script>
  // ---- 1. Grab the form dynamically ----------------------------------------------------
  const form = document.querySelector('form[data-name="newsletter"]');
  if (!form) return; // safety

  // ---- 2. Extract PDF URL & desired file name from the form ---------------------------
  const pdfUrl     = form.getAttribute('data-redirect') || form.getAttribute('redirect');
  const fileName   = pdfUrl ? pdfUrl.split('/').pop() : 'download.pdf'; // fallback name

  // ---- 3. Helper: force download -------------------------------------------------------
  function downloadFile(url, name) {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ---- 4. Watch for Webflow success (w-form-done becomes visible) --------------------
  const successObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      const target = mutation.target;
      if (target.classList.contains('w-form-done') && 
          target.style.display !== 'none' && 
          target.style.display !== '') {

        // Trigger download
        downloadFile(pdfUrl, fileName);

        // Optional: hide success message after brief flash
        setTimeout(() => { target.style.display = 'none'; }, 1500);
      }
    });
  });

  // Start observing the success container
  const successEl = document.querySelector('.success-message, .w-form-done');
  if (successEl) {
    successObserver.observe(successEl, { 
      attributes: true, 
      attributeFilter: ['style'] 
    });
  }
</script>