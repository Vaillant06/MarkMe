import os
import pytest
from app.models.schemas import DriveFolder, DriveFile

FIXTURE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "fixtures/sample_workbook.xlsx"))

@pytest.fixture(autouse=True)
def mock_drive_service(monkeypatch):
    """
    Mock Google Drive service for tests so they run independently
    without requiring live Google Cloud API tokens or dev mode bypasses.
    """
    from app.drive.service import DriveService

    def mock_list_folders(self):
        return [
            DriveFolder(
                id="test_folder_1",
                name="📁 College Attendance Folder",
                mime_type="application/vnd.google-apps.folder"
            )
        ]

    def mock_resolve_folder(self, folder_input):
        extracted = self.extract_folder_id(folder_input)
        return DriveFolder(
            id=extracted,
            name=f"📁 Connected Folder ({extracted})",
            mime_type="application/vnd.google-apps.folder"
        )

    def mock_list_excel_files(self, folder_id):
        return [
            DriveFile(
                id="test_file_1",
                name="V Sem B Attendance sheet.xlsx",
                mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                modified_time="2026-09-09T16:22:00Z",
                size="218 KB",
                head_revision_id="rev-1"
            )
        ]

    def mock_download_workbook(self, file_id, force_refresh=False):
        if "non_existent" in file_id:
            raise FileNotFoundError(f"Workbook with ID '{file_id}' not found.")
        with open(FIXTURE_PATH, "rb") as f:
            content = f.read()
        return content, "V Sem B Attendance sheet.xlsx", "rev-1"

    def mock_upload_workbook_revision(self, file_id, file_bytes, head_revision_id=None):
        return "rev-2"

    monkeypatch.setattr(DriveService, "list_folders", mock_list_folders)
    monkeypatch.setattr(DriveService, "resolve_folder", mock_resolve_folder)
    monkeypatch.setattr(DriveService, "list_excel_files", mock_list_excel_files)
    monkeypatch.setattr(DriveService, "download_workbook", mock_download_workbook)
    monkeypatch.setattr(DriveService, "upload_workbook_revision", mock_upload_workbook_revision)
