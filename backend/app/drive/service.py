import io
import re
import time
from typing import List, Optional, Tuple, Dict
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from app.config import settings
from app.models.schemas import DriveFolder, DriveFile

class DriveConcurrencyError(Exception):
    pass

# Short-lived in-memory workbook cache: file_id -> (content_bytes, file_name, head_rev, timestamp)
_WORKBOOK_CACHE: Dict[str, Tuple[bytes, str, str, float]] = {}
CACHE_TTL_SECONDS = 120.0  # 2 minutes
MAX_CACHE_ENTRIES = 2

def invalidate_workbook_cache(file_id: Optional[str] = None):
    """
    Invalidates cached workbook bytes. If file_id is None, clears all cached entries.
    """
    if file_id:
        _WORKBOOK_CACHE.pop(file_id, None)
    else:
        _WORKBOOK_CACHE.clear()

class DriveService:
    def __init__(self, access_token: Optional[str] = None, refresh_token: Optional[str] = None, user_id: Optional[str] = None):
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.user_id = user_id
        if access_token or refresh_token:
            self.creds = Credentials(
                token=access_token,
                refresh_token=refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=settings.GOOGLE_CLIENT_ID,
                client_secret=settings.GOOGLE_CLIENT_SECRET,
                scopes=[
                    "openid",
                    "https://www.googleapis.com/auth/userinfo.email",
                    "https://www.googleapis.com/auth/userinfo.profile",
                    "https://www.googleapis.com/auth/drive"
                ]
            )
        else:
            self.creds = None

    def _get_service(self):
        if not self.creds:
            raise ValueError("Google Drive credentials not available.")
        if not self.creds.valid and self.creds.refresh_token:
            try:
                from google.auth.transport.requests import Request as GoogleRequest
                self.creds.refresh(GoogleRequest())
                self.access_token = self.creds.token
                if self.user_id:
                    from app.auth.session import update_session_data
                    update_session_data(self.user_id, {"access_token": self.creds.token})
            except Exception:
                pass
        return build("drive", "v3", credentials=self.creds, cache_discovery=False)

    @staticmethod
    def extract_folder_id(input_str: str) -> str:
        """
        Extracts Google Drive folder ID from a URL or raw ID string.
        Example URLs:
          - https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs
          - https://drive.google.com/drive/u/0/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs?usp=sharing
        """
        cleaned = input_str.strip()
        
        # Check for Google Drive folder URL
        url_match = re.search(r"folders/([a-zA-Z0-9_-]+)", cleaned)
        if url_match:
            return url_match.group(1)
            
        # Check id query parameter (e.g. ?id=...)
        id_param_match = re.search(r"[?&]id=([a-zA-Z0-9_-]+)", cleaned)
        if id_param_match:
            return id_param_match.group(1)
            
        return cleaned

    def resolve_folder(self, folder_input: str) -> DriveFolder:
        """
        Resolves a folder from a Google Drive URL or folder ID.
        """
        raw_input = folder_input.strip()
        extracted_id = self.extract_folder_id(raw_input)
        
        if not self.access_token:
            raise ValueError("Google Drive credentials required to resolve this folder.")

        service = self._get_service()
        try:
            folder_meta = service.files().get(
                fileId=extracted_id,
                fields="id, name, mimeType, trashed",
                supportsAllDrives=True
            ).execute()
            
            if folder_meta.get("trashed"):
                raise ValueError("The requested Google Drive folder is in trash.")
            if folder_meta.get("mimeType") != "application/vnd.google-apps.folder":
                raise ValueError("The provided Google Drive link or ID is not a folder.")
                
            return DriveFolder(
                id=folder_meta["id"],
                name=folder_meta["name"],
                mime_type="application/vnd.google-apps.folder"
            )
        except Exception as e:
            raise ValueError(f"Could not find or access Google Drive folder: {str(e)}")

    def list_folders(self) -> List[DriveFolder]:
        """
        Lists user's Google Drive folders.
        """
        if not self.access_token:
            raise ValueError("Drive access token is required to list folders.")

        service = self._get_service()
        query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        results = service.files().list(
            q=query,
            spaces="drive",
            fields="files(id, name, mimeType)",
            pageSize=100,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True
        ).execute()

        folders = [
            DriveFolder(id=f["id"], name=f["name"], mime_type=f["mimeType"])
            for f in results.get("files", [])
        ]
        return folders

    def list_excel_files(self, folder_id: str) -> List[DriveFile]:
        """
        Lists .xlsx files in the selected Google Drive folder.
        """
        if not self.access_token:
            raise ValueError("Drive access token is required to list files.")

        service = self._get_service()
        query = f"'{folder_id}' in parents and (mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType = 'application/vnd.google-apps.spreadsheet') and trashed = false"
        results = service.files().list(
            q=query,
            spaces="drive",
            fields="files(id, name, mimeType, modifiedTime, size, headRevisionId)",
            pageSize=100,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True
        ).execute()

        files = [
            DriveFile(
                id=f["id"],
                name=f["name"],
                mime_type=f["mimeType"],
                modified_time=f.get("modifiedTime"),
                size=f.get("size") or "Cloud Spreadsheet",
                head_revision_id=f.get("headRevisionId")
            )
            for f in results.get("files", [])
        ]
        return files

    def download_workbook(self, file_id: str, force_refresh: bool = False) -> Tuple[bytes, str, str]:
        """
        Downloads workbook bytes from Google Drive.
        Uses a short-lived in-memory cache (120s TTL) for repeated reads (e.g. preview, statistics),
        bypassing Google Drive network latency.
        Returns: (file_bytes, file_name, head_revision_id)
        """
        now = time.time()
        if not force_refresh and file_id in _WORKBOOK_CACHE:
            cached_bytes, cached_name, cached_rev, cached_time = _WORKBOOK_CACHE[file_id]
            if now - cached_time < CACHE_TTL_SECONDS:
                return cached_bytes, cached_name, cached_rev

        if not self.access_token:
            raise FileNotFoundError(f"Drive access token missing for file: {file_id}")

        service = self._get_service()
        meta = service.files().get(
            fileId=file_id,
            fields="name, mimeType, headRevisionId",
            supportsAllDrives=True
        ).execute()
        file_name = meta.get("name", "attendance.xlsx")
        mime_type = meta.get("mimeType", "")
        head_rev = meta.get("headRevisionId", "")

        if mime_type == "application/vnd.google-apps.spreadsheet":
            request = service.files().export_media(
                fileId=file_id,
                mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
            if not file_name.endswith(".xlsx"):
                file_name = f"{file_name}.xlsx"
        else:
            request = service.files().get_media(fileId=file_id, supportsAllDrives=True)

        raw_content = request.execute()
        content_bytes = raw_content if isinstance(raw_content, bytes) else bytes(raw_content)

        # Store in fast in-memory cache, bounding size to prevent memory spikes
        if len(_WORKBOOK_CACHE) >= MAX_CACHE_ENTRIES:
            oldest_key = min(_WORKBOOK_CACHE.keys(), key=lambda k: _WORKBOOK_CACHE[k][3])
            _WORKBOOK_CACHE.pop(oldest_key, None)
        _WORKBOOK_CACHE[file_id] = (content_bytes, file_name, head_rev, now)
        return content_bytes, file_name, head_rev

    def upload_workbook_revision(
        self,
        file_id: str,
        file_bytes: bytes,
        head_revision_id: Optional[str] = None
    ) -> str:
        """
        Uploads updated workbook to Google Drive.
        Enforces optimistic concurrency checking if head_revision_id is provided.
        """
        if not self.access_token:
            raise FileNotFoundError(f"Drive access token missing for file upload: {file_id}")

        service = self._get_service()

        current_meta = service.files().get(
            fileId=file_id,
            fields="headRevisionId, mimeType",
            supportsAllDrives=True
        ).execute()

        mime_type = current_meta.get("mimeType", "")
        if mime_type == "application/vnd.google-apps.spreadsheet":
            raise ValueError(
                "This file is a native Google Sheet. MarkMe requires standard Excel (.xlsx) workbooks to preserve all formulas, conditional formatting, and attendance registers. Please upload your workbook as an .xlsx file to Google Drive."
            )

        if head_revision_id:
            current_rev = current_meta.get("headRevisionId")
            if current_rev and current_rev != head_revision_id:
                raise DriveConcurrencyError(
                    "The attendance workbook has been modified on Google Drive since you opened it. Please reload the latest version before saving."
                )

        media = MediaIoBaseUpload(
            io.BytesIO(file_bytes),
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            resumable=False
        )

        updated_file = service.files().update(
            fileId=file_id,
            media_body=media,
            fields="id, headRevisionId",
            supportsAllDrives=True
        ).execute()

        new_rev = updated_file.get("headRevisionId", "updated")
        # Invalidate cached workbook so next read fetches the newly committed revision
        invalidate_workbook_cache(file_id)
        return new_rev
