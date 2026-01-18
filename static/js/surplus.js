(() => {
  if (!window.FoodWise) return;

  const form = document.getElementById('surplusForm');
  const select = document.getElementById('w_inventory');
  const quantityInput = document.getElementById('w_quantity');
  const reasonInput = document.getElementById('w_reason');
  const tableBody = document.querySelector('#surplusTable tbody');
  const refreshBtn = document.getElementById('refreshSurplus');

  let inventory = [];

  async function loadInventoryOptions() {
    try {
      const data = await window.FoodWise.api('/api/inventory');
      inventory = data;
      renderOptions();
    } catch (error) {
      window.FoodWise.handleError(error, 'Unable to load inventory');
    }
  }

  function renderOptions() {
    if (!select) return;
    select.innerHTML = '';
    if (!inventory.length) {
      const opt = document.createElement('option');
      opt.textContent = 'No inventory available';
      opt.disabled = true;
      opt.selected = true;
      select.appendChild(opt);
      return;
    }
    inventory.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.item_type} • Remaining: ${Number(item.quantity_remaining ?? 0).toFixed(1)} kg`;
      select.appendChild(option);
    });
  }

  async function loadEntries() {
    try {
      const entries = await window.FoodWise.api('/api/surplus-food?limit=15');
      renderEntries(entries);
    } catch (error) {
      window.FoodWise.handleError(error, 'Unable to load surplus food entries');
    }
  }

  function renderEntries(entries) {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    entries.forEach((entry) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${entry.id}</td>
        <td>#${entry.inventory_id}</td>
        <td>${Number(entry.quantity).toFixed(1)} kg</td>
        <td>${entry.reason}</td>
        <td>${window.FoodWise.formatDate(entry.logged_at)}</td>
      `;
      tableBody.appendChild(row);
    });
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!select.value) {
      window.FoodWise.notify('Please choose a batch', 'warning');
      return;
    }
    const payload = {
      inventory_id: select.value,
      quantity: quantityInput.value,
      reason: reasonInput.value
    };
    const submitButton = form.querySelector('button[type="submit"]');
    window.FoodWise.setLoading(submitButton, true);
    try {
      await window.FoodWise.api('/api/surplus-food', { method: 'POST', body: payload });
      window.FoodWise.notify('Surplus food logged', 'success');
      form.reset();
      await Promise.all([loadInventoryOptions(), loadEntries()]);
    } catch (error) {
      window.FoodWise.handleError(error, 'Unable to log surplus food');
    } finally {
      window.FoodWise.setLoading(submitButton, false);
    }
  });

  refreshBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    loadEntries();
  });

  loadInventoryOptions();
  loadEntries();
})();

