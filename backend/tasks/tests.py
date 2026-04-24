from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from datetime import timedelta

from .models import Task


def future_dt(days=1):
    return timezone.now() + timedelta(days=days)


def past_dt(days=1):
    return timezone.now() - timedelta(days=days)


class TaskModelTest(TestCase):

    def setUp(self):
        self.task = Task.objects.create(
            title="Review claim",
            description="Check supporting documents",
            status=Task.STATUS_PENDING,
            due_datetime=future_dt(3),
        )

    def test_string_representation(self):
        self.assertIn("Review claim", str(self.task))

    def test_is_overdue_false_for_future_task(self):
        self.assertFalse(self.task.is_overdue)

    def test_is_overdue_true_for_past_pending_task(self):
        self.task.due_datetime = past_dt(1)
        self.task.save()
        self.assertTrue(self.task.is_overdue)

    def test_is_overdue_false_for_completed_past_task(self):
        self.task.due_datetime = past_dt(1)
        self.task.status = Task.STATUS_COMPLETED
        self.task.save()
        self.assertFalse(self.task.is_overdue)

    def test_default_status_is_pending(self):
        task = Task.objects.create(title="Another task", due_datetime=future_dt())
        self.assertEqual(task.status, Task.STATUS_PENDING)

    def test_description_is_optional(self):
        task = Task.objects.create(title="No desc", due_datetime=future_dt())
        self.assertIsNone(task.description)


class TaskAPITest(APITestCase):
    BASE_URL = '/api/tasks/'

    def setUp(self):
        self.task = Task.objects.create(
            title="Initial task",
            description="Some detail",
            status=Task.STATUS_PENDING,
            due_datetime=future_dt(2),
        )

    def test_create_task_success(self):
        data = {
            "title": "New task",
            "description": "Details here",
            "status": "pending",
            "due_datetime": future_dt(5).isoformat(),
        }
        response = self.client.post(self.BASE_URL, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_task_without_description(self):
        data = {
            "title": "No description task",
            "status": "pending",
            "due_datetime": future_dt(1).isoformat(),
        }
        response = self.client.post(self.BASE_URL, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_task_missing_title_returns_400(self):
        data = {"status": "pending", "due_datetime": future_dt(1).isoformat()}
        response = self.client.post(self.BASE_URL, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_task_blank_title_returns_400(self):
        data = {"title": "   ", "status": "pending", "due_datetime": future_dt(1).isoformat()}
        response = self.client.post(self.BASE_URL, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_task_past_due_date_returns_400(self):
        data = {"title": "Past task", "status": "pending", "due_datetime": past_dt(1).isoformat()}
        response = self.client.post(self.BASE_URL, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_task_invalid_status_returns_400(self):
        data = {"title": "Bad status", "status": "unknown", "due_datetime": future_dt(1).isoformat()}
        response = self.client.post(self.BASE_URL, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_tasks(self):
        response = self.client.get(self.BASE_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_retrieve_task_by_id(self):
        response = self.client.get(f'{self.BASE_URL}{self.task.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.task.id)

    def test_retrieve_nonexistent_task_returns_404(self):
        response = self.client.get(f'{self.BASE_URL}99999/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_filter_tasks_by_status(self):
        Task.objects.create(title="Done", status=Task.STATUS_COMPLETED, due_datetime=future_dt(1))
        response = self.client.get(f'{self.BASE_URL}?status=completed')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for task in response.data:
            self.assertEqual(task['status'], 'completed')

    def test_update_task(self):
        data = {"title": "Updated", "status": "in_progress", "due_datetime": future_dt(3).isoformat()}
        response = self.client.put(f'{self.BASE_URL}{self.task.id}/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], "Updated")

    def test_partial_update_task(self):
        response = self.client.patch(f'{self.BASE_URL}{self.task.id}/', {"title": "Patched"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], "Patched")

    def test_update_status_only(self):
        response = self.client.patch(f'{self.BASE_URL}{self.task.id}/status/', {"status": "completed"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], "completed")

    def test_update_status_invalid_value_returns_400(self):
        response = self.client.patch(f'{self.BASE_URL}{self.task.id}/status/', {"status": "invalid"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_task(self):
        response = self.client.delete(f'{self.BASE_URL}{self.task.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Task.objects.filter(id=self.task.id).exists())

    def test_delete_nonexistent_task_returns_404(self):
        response = self.client.delete(f'{self.BASE_URL}99999/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_task_response_contains_is_overdue(self):
        response = self.client.get(f'{self.BASE_URL}{self.task.id}/')
        self.assertIn('is_overdue', response.data)

    def test_task_response_contains_timestamps(self):
        response = self.client.get(f'{self.BASE_URL}{self.task.id}/')
        self.assertIn('created_at', response.data)
        self.assertIn('updated_at', response.data)