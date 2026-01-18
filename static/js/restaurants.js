(() => {
  if (!window.FoodWise) return;

  const form = document.getElementById('restaurantForm');
  const tableBody = document.querySelector('#restaurantTable tbody');
  const emptyState = document.getElementById('restaurantEmpty');
  const refreshBtn = document.getElementById('refreshRestaurantInv');

  const requestsTableBody = document.querySelector('#restaurantRequestsTable tbody');
  const requestsEmpty = document.getElementById('restaurantRequestsEmpty');
  const requestFilter = document.getElementById('restaurantRequestFilter');
  const refreshRequestsBtn = document.getElementById('refreshRestaurantRequests');

  let platformsCache = null;
  let openRequests = [];

  async function loadSubmissions() {
    try {
      const data = await window.FoodWise.api('/api/inventory');
      const restaurantItems = data.filter((item) => item.platform);
      renderTable(restaurantItems);
    } catch (error) {
      window.FoodWise.handleError(error, 'Unable to load submissions');
    }
  }

  function renderTable(items) {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    if (!items.length) {
      emptyState?.classList.remove('d-none');
      return;
    }
    emptyState?.classList.add('d-none');
    items.slice(0, 20).forEach((item) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <div class="fw-semibold">${item.platform?.name || 'Restaurant'}</div>
          <div class="text-muted small">${item.platform?.address || ''}</div>
        </td>
        <td>${item.item_type}</td>
        <td>${Number(item.quantity_remaining ?? item.quantity).toFixed(1)} kg</td>
        <td><span class="badge ${item.category === 'Pet' ? 'bg-primary' : 'bg-success'}">${item.category || 'Human'}</span></td>
        <td>${window.FoodWise.formatDate(item.date_prepared)}</td>
      `;
      tableBody.appendChild(row);
    });
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      platform_id: form.platform_id.value,
      item_type: form.item_type.value,
      quantity: form.quantity.value,
      category: form.category.value,
      date_prepared: form.date_prepared.value
    };
    const submitButton = form.querySelector('button[type="submit"]');
    window.FoodWise.setLoading(submitButton, true);
    try {
      await window.FoodWise.api('/api/restaurants/submissions', { method: 'POST', body: payload });
      window.FoodWise.notify('Submission added', 'success');
      form.reset();
      loadSubmissions();
    } catch (error) {
      window.FoodWise.handleError(error, 'Unable to submit leftovers');
    } finally {
      window.FoodWise.setLoading(submitButton, false);
    }
  });

  refreshBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    loadSubmissions();
  });

  async function loadRequests() {
    if (!requestsTableBody) return;
    try {
      const params = new URLSearchParams();
      params.append('status', 'Pending');
      if (requestFilter?.value) params.append('type', requestFilter.value);
      const data = await window.FoodWise.api(`/api/food-requests?${params.toString()}`);
      openRequests = data;
      renderRequests(openRequests);
    } catch (error) {
      window.FoodWise.handleError(error, 'Unable to load NGO requests');
    }
  }

  function renderRequests(requests) {
    if (!requestsTableBody) return;
    requestsTableBody.innerHTML = '';
    if (!requests.length) {
      requestsEmpty?.classList.remove('d-none');
      return;
    }
    requestsEmpty?.classList.add('d-none');
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
        <td class="text-end">
          <button class="btn btn-sm ${req.status === 'Claimed' ? 'btn-outline-success' : 'btn-outline-primary'}"
                  data-action="claim"
                  data-id="${req.id}"
                  ${req.status === 'Fulfilled' ? 'disabled' : ''}>
            ${req.status === 'Claimed' ? 'Claimed' : 'Claim'}
          </button>
        </td>
      `;
      requestsTableBody.appendChild(row);
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
      case 'claimed':
        return 'bg-info text-dark';
      case 'cancelled':
        return 'bg-dark';
      default:
        return 'bg-secondary';
    }
  }

  requestsTableBody?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="claim"]');
    if (!button) return;
    const requestId = button.dataset.id;
    const request = openRequests.find((r) => String(r.id) === String(requestId));
    if (!request) return;
    openClaimModal(request);
  });

  async function openClaimModal(request) {
    let platforms = platformsCache;
    if (!platforms) {
      platforms = await window.FoodWise.api('/api/food-platforms');
      platformsCache = platforms;
    }
    const modalHtml = `
      <div class="modal fade" id="restaurantClaimModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Claim request</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p class="text-muted mb-3">You're about to claim <strong>${request.quantity_needed} kg</strong> of <strong>${request.request_type}</strong> meals for <strong>${request.ngo?.name || 'NGO'}</strong>.</p>
              <div class="mb-3">
                <label class="form-label">Restaurant</label>
                <select class="form-select" id="restaurantClaimPlatform">
                  <option value="">Select kitchen</option>
                  ${platforms.map((p) => `<option value="${p.id}">${p.name} (${p.address || 'No address'})</option>`).join('')}
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Quantity you can provide (kg)</label>
                <input type="number" min="0" step="0.1" class="form-control" id="restaurantClaimQuantity">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="restaurantClaimSubmit">Confirm claim</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const claimModalEl = document.getElementById('restaurantClaimModal');
    const claimModal = new bootstrap.Modal(claimModalEl);
    claimModalEl.addEventListener('hidden.bs.modal', () => {
      claimModalEl.remove();
    });
    claimModalEl.querySelector('#restaurantClaimSubmit').addEventListener('click', async () => {
      const platformId = claimModalEl.querySelector('#restaurantClaimPlatform').value;
      const quantity = claimModalEl.querySelector('#restaurantClaimQuantity').value;
      if (!platformId) {
        window.FoodWise.notify('Please choose a restaurant', 'warning');
        return;
      }
      try {
        await window.FoodWise.api(`/api/food-requests/${request.id}`, {
          method: 'PUT',
          body: {
            claimed_platform_id: platformId,
            claimed_quantity: quantity,
            status: 'Claimed'
          }
        });
        window.FoodWise.notify('Request claimed', 'success');
        claimModal.hide();
        loadRequests();
      } catch (error) {
        window.FoodWise.handleError(error, 'Unable to claim request');
      }
    });
    claimModal.show();
  }

  requestFilter?.addEventListener('change', loadRequests);
  refreshRequestsBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    loadRequests();
  });

  loadSubmissions();
  loadRequests();
})();

