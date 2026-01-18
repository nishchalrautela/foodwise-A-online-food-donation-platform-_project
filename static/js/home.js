(() => {
  const summaryEl = document.getElementById('impact-summary');
  if (!summaryEl || !window.FoodWise) return;

  async function loadImpact() {
    try {
      const data = await window.FoodWise.api('/api/analytics');
      ['total_inventory', 'total_donated', 'total_wasted'].forEach((key) => {
        const el = summaryEl.querySelector(`[data-metric="${key}"]`);
        if (el) {
          const value = Number.parseFloat(data[key] ?? 0);
          el.textContent = value.toLocaleString(undefined, { maximumFractionDigits: 1 });
        }
      });
    } catch (error) {
      window.FoodWise.notify(error.message || 'Failed to load analytics', 'danger');
    }
  }

  loadImpact();
})();

