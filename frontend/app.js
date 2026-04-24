/* ============================================================
   HMCTS Task Manager – Frontend Application
   ============================================================ */

const API_BASE = 'http://localhost:8000/api/tasks/';

// ---- State ----
let editingTaskId = null;
let deletingTaskId = null;

// ---- DOM refs ----
const taskList       = document.getElementById('task-list');
const statusFilter   = document.getElementById('status-filter');
const newTaskBtn     = document.getElementById('new-task-btn');
const modalOverlay   = document.getElementById('modal-overlay');
const modalTitle     = document.getElementById('modal-title');
const saveTaskBtn    = document.getElementById('save-task-btn');
const cancelModal    = document.getElementById('cancel-modal-btn');
const deleteOverlay  = document.getElementById('delete-overlay');
const deleteTaskName = document.getElementById('delete-task-title');
const confirmDelete  = document.getElementById('confirm-delete-btn');
const cancelDelete   = document.getElementById('cancel-delete-btn');
const notification   = document.getElementById('notification');
const notifMsg       = document.getElementById('notification-msg');

// Form fields
const fTitle  = document.getElementById('task-title');
const fDesc   = document.getElementById('task-description');
const fStatus = document.getElementById('task-status');
const fDue    = document.getElementById('task-due');

// ---- API Helpers ----

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail || data || 'An error occurred.';
    throw { status: res.status, detail };
  }
  return data;
}

async function getTasks(statusValue = '') {
  const url = statusValue ? `${API_BASE}?status=${statusValue}` : API_BASE;
  return apiFetch(url);
}

async function getTask(id)             { return apiFetch(`${API_BASE}${id}/`); }
async function createTask(payload)     { return apiFetch(API_BASE, { method: 'POST', body: JSON.stringify(payload) }); }
async function updateTask(id, payload) { return apiFetch(`${API_BASE}${id}/`, { method: 'PUT', body: JSON.stringify(payload) }); }
async function updateStatus(id, st)   { return apiFetch(`${API_BASE}${id}/status/`, { method: 'PATCH', body: JSON.stringify({ status: st }) }); }
async function deleteTask(id)          { return apiFetch(`${API_BASE}${id}/`, { method: 'DELETE' }); }

// ---- Notifications ----

let notifTimer;
function showNotification(message, type = 'success') {
  clearTimeout(notifTimer);
  notification.className = `govuk-notification-banner govuk-notification-banner--${type}`;
  notification.querySelector('.govuk-notification-banner__title').textContent =
    type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notice';
  notifMsg.textContent = message;
  notification.style.display = 'block';
  notification.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  notifTimer = setTimeout(() => { notification.style.display = 'none'; }, 5000);
}

// ---- Formatting Helpers ----

function formatDatetime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function statusLabel(status) {
  return { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed' }[status] || status;
}

function toLocalDatetimeInputValue(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---- Render Tasks ----

function renderTasks(tasks) {
  taskList.innerHTML = '';

  if (!tasks.length) {
    taskList.innerHTML = `
      <div class="empty-state">
        <p>No tasks found. Create your first task to get started.</p>
      </div>`;
    return;
  }

  tasks.forEach(task => {
    const overdue = task.is_overdue;
    const cardClass = overdue ? 'task-card--overdue' : `task-card--${task.status}`;

    const card = document.createElement('div');
    card.className = `task-card ${cardClass}`;
    card.dataset.id = task.id;
    card.innerHTML = `
      <div class="task-card__header">
        <div>
          <h3 class="task-card__title">${escapeHtml(task.title)}</h3>
          ${task.description ? `<p class="task-card__description">${escapeHtml(task.description)}</p>` : ''}
        </div>
      </div>
      <div class="task-card__meta">
        <span class="status-badge status-badge--${task.status}">${statusLabel(task.status)}</span>
        ${overdue ? '<span class="overdue-tag">&#9888; Overdue</span>' : ''}
        <span>Due: ${formatDatetime(task.due_datetime)}</span>
        <span>Created: ${formatDatetime(task.created_at)}</span>
      </div>
      <div class="task-card__status-row">
        <label for="status-select-${task.id}">Update status:</label>
        <select class="govuk-select" id="status-select-${task.id}">
          <option value="pending"     ${task.status === 'pending'     ? 'selected' : ''}>Pending</option>
          <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
          <option value="completed"   ${task.status === 'completed'   ? 'selected' : ''}>Completed</option>
        </select>
        <button class="govuk-button govuk-button--secondary update-status-btn" data-id="${task.id}">Update</button>
      </div>
      <div class="task-card__actions">
        <button class="govuk-button govuk-button--secondary edit-btn" data-id="${task.id}">Edit task</button>
        <button class="govuk-button govuk-button--warning delete-btn" data-id="${task.id}" data-title="${escapeHtml(task.title)}">Delete</button>
      </div>`;

    taskList.appendChild(card);
  });

  // Attach events
  document.querySelectorAll('.update-status-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const sel = document.getElementById(`status-select-${id}`);
      try {
        await updateStatus(id, sel.value);
        showNotification('Status updated successfully.');
        loadTasks();
      } catch (err) {
        showNotification(formatError(err.detail), 'error');
      }
    });
  });

  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(Number(btn.dataset.id)));
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(Number(btn.dataset.id), btn.dataset.title));
  });
}

// ---- Load Tasks ----

async function loadTasks() {
  taskList.innerHTML = '<p class="govuk-body">Loading tasks...</p>';
  try {
    const tasks = await getTasks(statusFilter.value);
    renderTasks(tasks);
  } catch (err) {
    taskList.innerHTML = `
      <p class="govuk-body" style="color:var(--govuk-red)">
        Could not load tasks. Make sure the backend is running at
        <code>${API_BASE}</code>
      </p>`;
  }
}

// ---- Modal: New / Edit ----

function openNewModal() {
  editingTaskId = null;
  modalTitle.textContent = 'New task';
  saveTaskBtn.textContent = 'Save task';
  clearForm();
  clearFormErrors();
  modalOverlay.style.display = 'flex';
  fTitle.focus();
}

async function openEditModal(id) {
  editingTaskId = id;
  modalTitle.textContent = 'Edit task';
  saveTaskBtn.textContent = 'Save changes';
  clearFormErrors();
  try {
    const task = await getTask(id);
    fTitle.value  = task.title;
    fDesc.value   = task.description || '';
    fStatus.value = task.status;
    fDue.value    = toLocalDatetimeInputValue(task.due_datetime);
    modalOverlay.style.display = 'flex';
    fTitle.focus();
  } catch (err) {
    showNotification('Could not load task details.', 'error');
  }
}

function closeModal() {
  modalOverlay.style.display = 'none';
  clearForm();
  clearFormErrors();
  editingTaskId = null;
}

function clearForm() {
  fTitle.value  = '';
  fDesc.value   = '';
  fStatus.value = 'pending';
  fDue.value    = '';
}

// ---- Form Validation ----

function clearFormErrors() {
  document.getElementById('form-error').style.display = 'none';
  document.getElementById('form-error-list').innerHTML = '';
  document.getElementById('title-group').classList.remove('govuk-form-group--error');
  document.getElementById('due-group').classList.remove('govuk-form-group--error');
}

function showFormErrors(errors) {
  const list = document.getElementById('form-error-list');
  list.innerHTML = '';
  errors.forEach(e => {
    const li = document.createElement('li');
    li.textContent = e;
    list.appendChild(li);
  });
  document.getElementById('form-error').style.display = 'block';
}

function validateForm() {
  const errors = [];
  clearFormErrors();

  if (!fTitle.value.trim()) {
    errors.push('Enter a task title.');
    document.getElementById('title-group').classList.add('govuk-form-group--error');
  }
  if (!fDue.value) {
    errors.push('Enter a due date and time.');
    document.getElementById('due-group').classList.add('govuk-form-group--error');
  } else if (editingTaskId === null && new Date(fDue.value) <= new Date()) {
    errors.push('Due date and time must be in the future.');
    document.getElementById('due-group').classList.add('govuk-form-group--error');
  }

  if (errors.length) { showFormErrors(errors); return false; }
  return true;
}

// ---- Save Task ----

saveTaskBtn.addEventListener('click', async () => {
  if (!validateForm()) return;

  const payload = {
    title:        fTitle.value.trim(),
    description:  fDesc.value.trim() || null,
    status:       fStatus.value,
    due_datetime: new Date(fDue.value).toISOString(),
  };

  try {
    if (editingTaskId) {
      await updateTask(editingTaskId, payload);
      showNotification('Task updated successfully.');
    } else {
      await createTask(payload);
      showNotification('Task created successfully.');
    }
    closeModal();
    loadTasks();
  } catch (err) {
    const errDetail = err.detail;
    if (typeof errDetail === 'object' && !Array.isArray(errDetail)) {
      const msgs = Object.entries(errDetail).map(([k, v]) =>
        `${k === 'non_field_errors' ? '' : k + ': '}${Array.isArray(v) ? v.join(', ') : v}`
      );
      showFormErrors(msgs);
    } else {
      showFormErrors([formatError(errDetail)]);
    }
  }
});

// ---- Delete Modal ----

function openDeleteModal(id, title) {
  deletingTaskId = id;
  deleteTaskName.textContent = title;
  deleteOverlay.style.display = 'flex';
}

function closeDeleteModal() {
  deleteOverlay.style.display = 'none';
  deletingTaskId = null;
}

confirmDelete.addEventListener('click', async () => {
  try {
    await deleteTask(deletingTaskId);
    showNotification('Task deleted.');
    closeDeleteModal();
    loadTasks();
  } catch (err) {
    showNotification(formatError(err.detail), 'error');
    closeDeleteModal();
  }
});

// ---- Utility ----

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatError(detail) {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.join(', ');
  if (typeof detail === 'object') return Object.values(detail).flat().join(', ');
  return 'An error occurred.';
}

// ---- Event Listeners ----

newTaskBtn.addEventListener('click', openNewModal);
cancelModal.addEventListener('click', closeModal);
cancelDelete.addEventListener('click', closeDeleteModal);
statusFilter.addEventListener('change', loadTasks);

// Close on backdrop click
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
deleteOverlay.addEventListener('click', e => { if (e.target === deleteOverlay) closeDeleteModal(); });

// Close on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (modalOverlay.style.display !== 'none') closeModal();
    if (deleteOverlay.style.display !== 'none') closeDeleteModal();
  }
});

// ---- Init ----
loadTasks();