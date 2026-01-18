(() => {
  if (!window.FoodWise) return;

  const form = document.getElementById('donationForm');
  const inventorySelect = document.getElementById('d_inventory');
  const ngoSelect = document.getElementById('d_ngo');
  const quantityInput = document.getElementById('d_quantity');
  const tableBody = document.querySelector('#donationTable tbody');
  const refreshBtn = document.getElementById('refreshDonations');

  let inventory = [];
  let ngos = [];

  async function loadInventory() {
    try {
      inventory = await window.FoodWise.api('/api/inventory');
      renderInventoryOptions();
    } catch (error) {
      window.FoodWise.handleError(error, 'Unable to load inventory');
    }
  }

  function renderInventoryOptions() {
    if (!inventorySelect) return;
    inventorySelect.innerHTML = '';
    if (!inventory.length) {
      const opt = document.createElement('option');
      opt.textContent = 'No inventory available';
      opt.disabled = true;
      opt.selected = true;
      inventorySelect.appendChild(opt);
      return;
    }
    inventory.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.item_type} • Remaining: ${Number(item.quantity_remaining ?? 0).toFixed(1)} kg`;
      inventorySelect.appendChild(option);
    });
  }

  async function loadNGOs() {
    try {
      ngos = await window.FoodWise.api('/api/ngos');
      renderNgoOptions();
    } catch (error) {
      window.FoodWise.handleError(error, 'Unable to load NGOs');
    }
  }

  function renderNgoOptions() {
    if (!ngoSelect) return;
    ngoSelect.innerHTML = '';
    if (!ngos.length) {
      const opt = document.createElement('option');
      opt.textContent = 'No NGOs available';
      opt.disabled = true;
      opt.selected = true;
      ngoSelect.appendChild(opt);
      return;
    }
    ngos.forEach((ngo) => {
      const option = document.createElement('option');
      option.value = ngo.id;
      option.textContent = `${ngo.name} (${ngo.address || 'No address'})`;
      ngoSelect.appendChild(option);
    });
  }

  async function loadDonations() {
    try {
      const entries = await window.FoodWise.api('/api/donations?limit=15');
      renderDonations(entries);
    } catch (error) {
      window.FoodWise.handleError(error, 'Unable to load donations');
    }
  }

  function renderDonations(entries) {
    if (!tableBody) return;
    const ngoMap = new Map(ngos.map((ngo) => [ngo.id, ngo]));
    const invMap = new Map(inventory.map((inv) => [inv.id, inv]));
    tableBody.innerHTML = '';
    entries.forEach((entry) => {
      const row = document.createElement('tr');
      const inv = invMap.get(entry.inventory_id);
      const ngo = ngoMap.get(entry.ngo_id);
      row.innerHTML = `
        <td>${entry.id}</td>
        <td>${inv ? inv.item_type : '#' + entry.inventory_id}</td>
        <td>${ngo ? ngo.name : '#' + entry.ngo_id}</td>
        <td>${Number(entry.quantity).toFixed(1)} kg</td>
        <td>${window.FoodWise.formatDate(entry.donated_at)}</td>
      `;
      tableBody.appendChild(row);
    });
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!inventorySelect.value || !ngoSelect.value) {
      window.FoodWise.notify('Choose inventory and NGO', 'warning');
      return;
    }
    const payload = {
      inventory_id: inventorySelect.value,
      ngo_id: ngoSelect.value,
      quantity: quantityInput.value
    };
    const submitButton = form.querySelector('button[type="submit"]');
    window.FoodWise.setLoading(submitButton, true);
    try {
      await window.FoodWise.api('/api/donations', { method: 'POST', body: payload });
      window.FoodWise.notify('Donation recorded', 'success');
      form.reset();
      await Promise.all([loadInventory(), loadDonations()]);
    } catch (error) {
      window.FoodWise.handleError(error, 'Unable to record donation');
    } finally {
      window.FoodWise.setLoading(submitButton, false);
    }
  });

  refreshBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    loadDonations();
  });

  Promise.all([loadInventory(), loadNGOs()]).then(loadDonations);
})();

