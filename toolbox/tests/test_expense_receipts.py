# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import base64

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import nowdate

from toolbox.expense_settings import CATEGORY, EXPENSE, PAYMENT_METHOD, RULE
from toolbox.expenses import attach_receipt, remove_receipt, save_expense, setup
from toolbox.receipt_files import detect_receipt_type

USER_A = "receipt-a@example.com"
USER_B = "receipt-b@example.com"

# Raw magic-byte fixtures for the pure detector (never written as Files).
PNG_SIG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
JPEG_SIG = b"\xff\xd8\xff\xe0" + b"\x00" * 16
PDF_SIG = b"%PDF-1.7\r\n" + b"\x00" * 16
NOT_RECEIPT = b"just some text, definitely not an image or pdf"

# Real, minimal valid images for the File-save path — Frappe runs PIL/pypdf on uploads, so a
# stored receipt must be a genuinely decodable file, not merely correct magic bytes.
VALID_PNG = base64.b64decode(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC"
)
VALID_GIF = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")


def _b64(content):
	return base64.b64encode(content).decode()


class TestDetectReceiptType(IntegrationTestCase):
	def test_accepts_images_and_pdf(self):
		self.assertEqual(detect_receipt_type(PNG_SIG[:16]), "png")
		self.assertEqual(detect_receipt_type(JPEG_SIG[:16]), "jpeg")
		self.assertEqual(detect_receipt_type(PDF_SIG[:16]), "pdf")
		self.assertEqual(detect_receipt_type(b"GIF89a" + b"\x00" * 10), "gif")
		self.assertEqual(detect_receipt_type(b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 4), "webp")

	def test_rejects_other_and_short(self):
		self.assertIsNone(detect_receipt_type(NOT_RECEIPT[:16]))
		self.assertIsNone(detect_receipt_type(b"%PDF"))  # too short


class TestExpenseReceipts(IntegrationTestCase):
	def setUp(self):
		for email in (USER_A, USER_B):
			_ensure_user(email)
		frappe.set_user("Administrator")
		for email in (USER_A, USER_B):
			for name in frappe.get_all(EXPENSE, filters={"owner": email}, pluck="name"):
				frappe.delete_doc(EXPENSE, name, ignore_permissions=True, force=True)
			for doctype in (RULE, CATEGORY, PAYMENT_METHOD):
				frappe.db.delete(doctype, {"owner": email})
		frappe.set_user(USER_A)
		self.addCleanup(lambda: frappe.set_user("Administrator"))
		setup()
		self.cat = frappe.get_all(CATEGORY, filters={"owner": USER_A, "category_name": "Food and Dining"}, pluck="name")[0]
		self.expense = save_expense(
			frappe.as_json({"amount": 50, "description": "Lunch", "currency": "INR", "expense_date": nowdate(), "category": self.cat})
		)

	def test_attach_creates_private_receipt(self):
		updated = attach_receipt(self.expense["name"], _b64(VALID_PNG))
		self.assertTrue(updated["receipt"].startswith("/private/files/"))
		self.assertTrue(frappe.db.exists("File", {"file_url": updated["receipt"]}))

	def test_rejects_non_receipt_and_oversize(self):
		with self.assertRaises(frappe.ValidationError):
			attach_receipt(self.expense["name"], _b64(NOT_RECEIPT))

	def test_replacing_receipt_removes_the_old_file(self):
		# Use images for the File-save path; Frappe runs a JavaScript scan on PDF uploads that
		# needs a fully-valid PDF, so PDF acceptance is covered by the pure detector test above.
		first = attach_receipt(self.expense["name"], _b64(VALID_PNG))["receipt"]
		second = attach_receipt(self.expense["name"], _b64(VALID_GIF))["receipt"]
		self.assertNotEqual(first, second)
		self.assertFalse(frappe.db.exists("File", {"file_url": first}))
		self.assertTrue(frappe.db.exists("File", {"file_url": second}))

	def test_remove_receipt_clears_and_deletes_file(self):
		url = attach_receipt(self.expense["name"], _b64(VALID_PNG))["receipt"]
		cleared = remove_receipt(self.expense["name"])
		self.assertIsNone(cleared["receipt"])
		self.assertFalse(frappe.db.exists("File", {"file_url": url}))

	def test_delete_expense_removes_receipt_file(self):
		url = attach_receipt(self.expense["name"], _b64(VALID_PNG))["receipt"]
		frappe.delete_doc(EXPENSE, self.expense["name"])
		self.assertFalse(frappe.db.exists("File", {"file_url": url}))

	def test_owner_cannot_attach_to_another_users_expense(self):
		frappe.set_user(USER_B)
		setup()
		with self.assertRaises(frappe.PermissionError):
			attach_receipt(self.expense["name"], _b64(VALID_PNG))


def _ensure_user(email: str) -> None:
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": "Receipt",
				"enabled": 1,
				"user_type": "System User",
				"send_welcome_email": 0,
			}
		).insert(ignore_permissions=True)
