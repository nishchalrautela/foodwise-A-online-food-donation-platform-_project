(() => {
  if (!window.FoodWise) return;

  const form = document.getElementById('requestForm');
  const tableBody = document.querySelector('#requestsTable tbody');
  const emptyState = document.getElementById('requestsEmpty');
  const refreshBtn = document.getElementById('refreshRequests');
  const filterType = document.getElementById('requestFilterType');
  const filterStatus = document.getElementById('requestFilterStatus');
  const updateModalEl = document.getElementById('requestModal');
  const updateForm = document.getElementById('requestUpdateForm');
  const updateModal = updateModalEl ? new bootstrap.Modal(updateModalEl) : null;

  let requests = [];

  async function loadRequests() {
    try {
      const params = new URLSearchParams();
      if (filterType?.value) params.append('type', filterType.value);
      if (filterStatus?.value) params.append('status', filterStatus.value);
      const data = await window.FoodWise.api(`/api/food-requests?${params.toString()}`);
      requests = data;
      renderRequests();
    } catch (error) {
      window.FoodWise.handleError(error, 'Unable to load requests');
    }
  }

  function renderRequests() {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    if (!requests.length) {
      emptyState?.classList.remove('d-none');
      return;
    }
    emptyState?.classList.add('d-none');
    requests.forEach((req) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <div class="fw-semibold">${req.ngo?.name || 'NGO'}</div>
          <div class="text-muted small">${req.description || ''}</div>
        </td>
        <td><span class="badge ${req.request_type === 'Pet' ? 'bg-primary' : 'bg-success'}">${req.request_type}</span></td>
        <td>${Number(req.quantity_needed).toFixed(1)} kg</td>
        <td><span class="badge ${urgencyClass(req.urgency)}">${req.urgency}</span></td>
        <td><span class="badge ${statusClass(req.status)}">${req.status}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-secondary" data-action="update" data-id="${req.id}">Update</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }

  function urgencyClass(urgency) {
    switch ((urgency || '').toLowerCase()) {
      case 'critical':
        return 'bg-danger';
      case 'high':
        return 'bg-warning text-dark';
      default:
        return 'bg-secondary';
    }
  }

  function statusClass(status) {
    switch ((status || '').toLowerCase()) {
      case 'fulfilled':
        return 'bg-success';
      case 'cancelled':
        return 'bg-dark';
      default:
        return 'bg-info text-dark';
    }
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      ngo_id: form.ngo_id.value,
      request_type: form.request_type.value,
      urgency: form.urgency.value,
      quantity_needed: form.quantity_needed.value,
      needed_by: form.needed_by.value,
      description: form.description.value
    };
    const submitButton = form.querySelector('button[type="submit"]');
    window.FoodWise.setLoading(submitButton, true);
    try {
      await window.FoodWise.api('/api/food-requests', { method: 'POST', body: payload });
      window.FoodWise.notify('Request submitted', 'success');
      form.reset();
      loadRequests();
    } catch (error) {
      window.FoodWise.handleError(error, 'Unable to submit request');
    } finally {
      window.FoodWise.setLoading(submitButton, false);
    }
  });

  tableBody?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="update"]');
    if (!button) return;
    const id = button.dataset.id;
    const request = requests.find((r) => String(r.id) === String(id));
    if (!request || !updateModal) return;
    document.getElementById('update_request_id').value = request.id;
    document.getElementById('update_status').value = request.status || 'Pending';
    document.getElementById('update_urgency').value = request.urgency || 'Normal';
    document.getElementById('update_description').value = request.description || '';
    updateModal.show();
  });

  updateForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const requestId = document.getElementById('update_request_id').value;
    const payload = {
      status: document.getElementById('update_status').value,
      urgency: document.getElementById('update_urgency').value,
      description: document.getElementById('update_description').value
    };
    const submitButton = updateForm.querySelector('button[type="submit"]');
    window.FoodWise.setLoading(submitButton, true);
    try {
      await window.FoodWise.api(`/api/food-requests/${requestId}`, { method: 'PUT', body: payload });
      window.FoodWise.notify('Request updated', 'success');
      updateModal?.hide();
      loadRequests();
    } catch (error) {
      window.FoodWise.handleError(error, 'Unable to update request');
    } finally {
      window.FoodWise.setLoading(submitButton, false);
    }
  });

  filterType?.addEventListener('change', loadRequests);
  filterStatus?.addEventListener('change', loadRequests);
  refreshBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    loadRequests();
  });

  loadRequests();
})();

