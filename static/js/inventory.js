(() => {
  if (!window.FoodWise) return;

  const tableBody = document.querySelector('#invTable tbody');
  const emptyState = document.getElementById('inventoryEmpty');
  const summary = document.getElementById('inventorySummary');
  const addForm = document.getElementById('inventoryForm');
  const filterForm = document.getElementById('inventoryFilters');
  const editForm = document.getElementById('inventoryEditForm');
  const modalEl = document.getElementById('inventoryModal');
  const modal = modalEl ? new bootstrap.Modal(modalEl) : null;

  let items = [];
  let filters = { status: '', search: '', category: '' };
  let activeItemId = null;

  function statusClass(status) {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'donated') return 'donated';
    if (normalized === 'surplus') return 'wasted';
    return 'available';
  }

  function updateSummary() {
    if (!summary) return;
    const totalCount = items.length;
    const totalQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const totalRemaining = items.reduce((sum, item) => sum + (item.quantity_remaining || 0), 0);
    summary.querySelector('[data-summary="count"]').textContent = totalCount;
    summary.querySelector('[data-summary="quantity"]').textContent = totalQty.toFixed(1);
    summary.querySelector('[data-summary="remaining"]').textContent = totalRemaining.toFixed(1);
  }

  function renderTable() {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    items.forEach((item) => {
      const row = document.createElement('tr');
      const sourceHtml = item.platform
        ? `<div class="fw-semibold">${item.platform.name}</div><div class="text-muted small">${item.platform.address || ''}</div>`
        : '<span class="text-muted small">In-house</span>';
      row.innerHTML = `
        <td>${item.id}</td>
        <td class="fw-semibold">${item.item_type}</td>
        <td>${window.FoodWise.formatDate(item.date_prepared)}</td>
        <td><span class="badge ${item.category === 'Pet' ? 'bg-primary' : 'bg-success'}">${item.category || 'Human'}</span></td>
        <td>${Number(item.quantity ?? 0).toFixed(1)}</td>
        <td>${Number(item.quantity_remaining ?? 0).toFixed(1)}</td>
        <td>${sourceHtml}</td>
        <td>
          <span class="status-pill ${statusClass(item.status)}">${item.status || 'Available'}</span>
        </td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary" data-action="edit" data-id="${item.id}">Edit</button>
            <button class="btn btn-outline-danger" data-action="delete" data-id="${item.id}">Delete</button>
          </div>
        </td>
      `;
      tableBody.appendChild(row);
    });
    if (emptyState) {
      emptyState.classList.toggle('d-none', items.length > 0);
    }
  }

  async function fetchInventory() {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);
      if (filters.category) params.append('category', filters.category);
      const query = params.toString();
      const data = await window.FoodWise.api(query ? `/api/inventory?${query}` : '/api/inventory');
      items = data;
      updateSummary();
      renderTable();
    } catch (error) {
      window.FoodWise.handleError(error, 'Failed to load inventory');
    }
  }

  addForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      item_type: addForm.item_type.value,
      quantity: addForm.quantity.value,
      quantity_remaining: addForm.quantity.value,
      date_prepared: addForm.date_prepared.value,
      category: addForm.item_category?.value,
      platform_id: addForm.item_platform?.value
    };
    const submitButton = addForm.querySelector('button[type="submit"]');
    window.FoodWise.setLoading(submitButton, true);
    try {
      await window.FoodWise.api('/api/inventory', { method: 'POST', body: payload });
      window.FoodWise.notify('Batch added', 'success');
      addForm.reset();
      fetchInventory();
    } catch (error) {
      window.FoodWise.handleError(error, 'Unable to add inventory');
    } finally {
      window.FoodWise.setLoading(submitButton, false);
    }
  });

  filterForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    filters = {
      search: filterForm.filterSearch.value.trim(),
      status: filterForm.filterStatus.value,
      category: filterForm.filterCategory.value
    };
    fetchInventory();
  });

  tableBody?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = Number(button.dataset.id);
    const action = button.dataset.action;
    const item = items.find((entry) => entry.id === id);
    if (!item) return;

    if (action === 'edit') {
      openModal(item);
    } else if (action === 'delete') {
      deleteItem(id);
    }
  });

  function openModal(item) {
    if (!editForm || !modal) return;
    activeItemId = item.id;
    editForm.edit_id.value = item.id;
    editForm.edit_item_type.value = item.item_type;
    editForm.edit_quantity.value = item.quantity;
    editForm.edit_remaining.value = item.quantity_remaining;
    editForm.edit_status.value = item.status || 'Available';
    if (editForm.edit_category) {
      editForm.edit_category.value = item.category || 'Human';
    }
    if (editForm.edit_platform) {
      editForm.edit_platform.value = item.platform?.id || '';
    }
    editForm.edit_date.value = item.date_prepared ? item.date_prepared.slice(0, 10) : '';
    modal.show();
  }

  async function deleteItem(id) {
    if (!confirm('Delete this batch permanently?')) return;
    try {
      await window.FoodWise.api(`/api/inventory/${id}`, { method: 'DELETE' });
      window.FoodWise.notify('Batch removed', 'info');
      fetchInventory();
    } catch (error) {
      window.FoodWise.handleError(error, 'Unable to delete batch');
    }
  }

  editForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!activeItemId) return;
    const payload = {
      item_type: editForm.edit_item_type.value,
      quantity: editForm.edit_quantity.value,
      quantity_remaining: editForm.edit_remaining.value,
      status: editForm.edit_status.value,
      date_prepared: editForm.edit_date.value,
      category: editForm.edit_category?.value,
      platform_id: editForm.edit_platform?.value
    };
    const submitButton = editForm.querySelector('button[type="submit"]');
    window.FoodWise.setLoading(submitButton, true);
    try {
      await window.FoodWise.api(`/api/inventory/${activeItemId}`, {
        method: 'PUT',
        body: payload
      });
      window.FoodWise.notify('Batch updated', 'success');
      modal.hide();
      fetchInventory();
    } catch (error) {
      window.FoodWise.handleError(error, 'Unable to update batch');
    } finally {
      window.FoodWise.setLoading(submitButton, false);
    }
  });

  fetchInventory();
})();

