document.addEventListener("DOMContentLoaded", function () {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.classList.add("in-view");
          }, index * 150); // Delay increases by 100ms for each item
        }
      });
    },
    { threshold: 0.1 }
  );

  const items = document.querySelectorAll(".product_item");
  items.forEach((item) => observer.observe(item));
});