# HMCTS Task Manager

A task management system for caseworkers to create, view, update and delete tasks.

Built with Python/Django (backend) and HTML/CSS/JavaScript (frontend).

---

## Setup

### Requirements
- Python 3.11+
- Git

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

API runs at: `http://localhost:8000/api/tasks/`

### Frontend

Open a second terminal:

```bash
cd frontend
python -m http.server 3000
```

Open browser at: `http://localhost:3000`

### Tests

```bash
cd backend
python manage.py test tasks
```

24 tests — all should pass.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks/` | Get all tasks |
| POST | `/api/tasks/` | Create a task |
| GET | `/api/tasks/{id}/` | Get a task by ID |
| PUT | `/api/tasks/{id}/` | Update a task |
| PATCH | `/api/tasks/{id}/status/` | Update status only |
| DELETE | `/api/tasks/{id}/` | Delete a task |

### Task fields

```json
{
  "title": "Review documents",
  "description": "Optional",
  "status": "pending",
  "due_datetime": "2026-06-01T14:00:00Z"
}
```

Status values: `pending` · `in_progress` · `completed`

---

## Features

- Create, view, edit and delete tasks
- Filter tasks by status
- Overdue task detection
- GOV.UK Design System styling
- Input validation on frontend and backend
- Consistent error responses from the API
