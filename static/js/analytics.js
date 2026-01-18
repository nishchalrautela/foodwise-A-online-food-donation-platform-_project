(() => {
  if (!window.FoodWise) return;

  const summaryEl = document.getElementById('analyticsSummary');
  const trendSelect = document.getElementById('trendRange');
  const totalsCtx = document.getElementById('totalsChart');
  const trendCtx = document.getElementById('trendChart');
  const tableBody = document.querySelector('#analyticsTable tbody');

  let totalsChart;
  let trendChart;

  function updateSummary(data) {
    if (!summaryEl) return;
    Object.entries(data).forEach(([key, value]) => {
      const target = summaryEl.querySelector(`[data-metric="${key}"]`);
      if (target) {
        target.textContent = Number(value || 0).toLocaleString(undefined, {
          maximumFractionDigits: 1
        });
      }
    });
  }

  function renderTotalsChart(data) {
    if (!totalsCtx) return;
    const chartData = {
      labels: ['Produced', 'Remaining', 'Donated', 'Surplus'],
      datasets: [{
        label: 'Kilograms',
        data: [
          data.total_inventory || 0,
          data.total_remaining || 0,
          data.total_donated || 0,
          data.total_wasted || 0
        ],
        backgroundColor: ['#198754', '#20c997', '#0d6efd', '#dc3545']
      }]
    };
    if (totalsChart) {
      totalsChart.destroy();
    }
    totalsChart = new Chart(totalsCtx, {
      type: 'bar',
      data: chartData,
      options: {
        responsive: true,
        plugins: { legend: { display: false } }
      }
    });
  }

  function renderTrendChart(data) {
    if (!trendCtx) return;
    if (trendChart) {
      trendChart.destroy();
    }
    trendChart = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Produced',
            data: data.produced,
            borderColor: '#198754',
            tension: 0.3,
            fill: false
          },
          {
            label: 'Donated',
            data: data.donated,
            borderColor: '#0d6efd',
            tension: 0.3,
            fill: false
          },
          {
            label: 'Surplus',
            data: data.wasted,
            borderColor: '#dc3545',
            tension: 0.3,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  async function loadSummary() {
    try {
      const data = await window.FoodWise.api('/api/analytics');
      updateSummary(data);
      renderTotalsChart(data);
    } catch (error) {
      window.FoodWise.handleError(error, 'Unable to load analytics');
    }
  }

  async function loadTrends(days = 7) {
    try {
      const data = await window.FoodWise.api(`/api/analytics/trends?days=${days}`);
      renderTrendChart(data);
    } catch (error) {
      window.FoodWise.handleError(error, 'Unable to load trends');
    }
  }

  async function loadLatestActivity() {
    try {
      const [donations, surplus] = await Promise.all([
        window.FoodWise.api('/api/donations?limit=5'),
        window.FoodWise.api('/api/surplus-food?limit=5')
      ]);
      const combined = [
        ...donations.map((item) => ({ ...item, type: 'Donation', timestamp: item.donated_at })),
        ...surplus.map((item) => ({ ...item, type: 'Surplus Food', timestamp: item.logged_at }))
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      renderTable(combined);
    } catch (error) {
      window.FoodWise.handleError(error, 'Unable to load activity');
    }
  }

  function renderTable(entries) {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    entries.forEach((entry) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${entry.type}</td>
        <td>#${entry.inventory_id}</td>
        <td>${Number(entry.quantity).toFixed(1)} kg</td>
        <td>${window.FoodWise.formatDate(entry.timestamp)}</td>
      `;
      tableBody.appendChild(row);
    });
  }

  trendSelect?.addEventListener('change', (event) => {
    loadTrends(event.target.value);
  });

  loadSummary();
  loadTrends(trendSelect?.value || 7);
  loadLatestActivity();
})();
