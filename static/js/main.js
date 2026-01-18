(() => {
  const toastContainer = document.getElementById('toast-container');

  function notify(message, variant = 'primary', options = {}) {
    if (!toastContainer) {
      alert(message);
      return;
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'toast align-items-center text-bg-' + variant + ' border-0';
    wrapper.role = 'alert';
    wrapper.ariaLive = 'assertive';
    wrapper.ariaAtomic = 'true';
    wrapper.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;
    toastContainer.appendChild(wrapper);
    const toast = new bootstrap.Toast(wrapper, { delay: options.delay ?? 4000 });
    toast.show();
    wrapper.addEventListener('hidden.bs.toast', () => wrapper.remove());
  }

  async function api(url, { method = 'GET', body, headers = {}, ...rest } = {}) {
    const config = {
      method,
      headers: { ...headers },
      ...rest
    };
    if (body !== undefined) {
      if (body instanceof FormData) {
        config.body = body;
      } else if (typeof body === 'string') {
        config.body = body;
        config.headers['Content-Type'] = config.headers['Content-Type'] || 'application/json';
      } else {
        config.body = JSON.stringify(body);
        config.headers['Content-Type'] = 'application/json';
      }
    }
    const response = await fetch(url, config);
    const contentType = response.headers.get('Content-Type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
      const message = payload?.error || payload?.message || response.statusText;
      throw new Error(message);
    }
    return payload;
  }

  function setLoading(element, isLoading) {
    if (!element) return;
    if (isLoading) {
      element.dataset.originalText = element.textContent;
      element.disabled = true;
      element.textContent = 'Saving...';
    } else {
      element.disabled = false;
      if (element.dataset.originalText) {
        element.textContent = element.dataset.originalText;
        delete element.dataset.originalText;
      }
    }
  }

  window.FoodWise = {
    notify,
    api,
    setLoading,
    handleError(error, message = 'Something went wrong') {
      console.error(error);
      notify(error?.message || message, 'danger');
    },
    formatDate(dateStr) {
      if (!dateStr) return '—';
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString();
    }
  };
})();
