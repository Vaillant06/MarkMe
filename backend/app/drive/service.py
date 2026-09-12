import os
import io
import re
import time
import base64
from typing import List, Dict, Any, Optional, Tuple
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload
from app.config import settings
from app.models.schemas import DriveFolder, DriveFile

class DriveConcurrencyError(Exception):
    pass

def encode_local_id(prefix: str, path: str) -> str:
    b64 = base64.urlsafe_b64encode(path.encode("utf-8")).decode("utf-8").rstrip("=")
    return f"{prefix}_{b64}"

def decode_local_id(prefix: str, local_id: str) -> Optional[str]:
    if not local_id.startswith(f"{prefix}_"):
        return None
    b64 = local_id[len(prefix) + 1:]
    padded = b64 + "=" * (-len(b64) % 4)
    try:
        return base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
    except Exception:
        return None

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
        Extracts Google Drive folder ID from a URL or raw ID, or handles local paths.
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
        Resolves a folder from a Google Drive URL, folder ID, or local filesystem path.
        """
        raw_input = folder_input.strip()
        
        # 1. Check if it's a local filesystem directory
        expanded_path = os.path.expanduser(raw_input)
        if os.path.isdir(expanded_path):
            abs_path = os.path.abspath(expanded_path)
            folder_name = os.path.basename(abs_path) or abs_path
            return DriveFolder(
                id=encode_local_id("locdir", abs_path),
                name=f"📁 {folder_name} ({abs_path})"
            )
            
        extracted_id = self.extract_folder_id(raw_input)
        
        # 2. If access token is available, resolve via Google Drive API
        if self.access_token:
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
                
        # 3. If in DEV mode without token
        if settings.DEV_MODE:
            return DriveFolder(
                id=extracted_id,
                name=f"📁 Connected Folder ({extracted_id})"
            )
            
        raise ValueError("Google Drive credentials required to resolve this folder.")

    def list_folders(self) -> List[DriveFolder]:
        """
        Lists user's Google Drive folders, or discovers local folders in DEV mode.
        """
        if not self.access_token:
            if settings.DEV_MODE:
                ref_dir = os.path.dirname(settings.DEV_LOCAL_WORKBOOK_PATH)
                discovered: List[DriveFolder] = [
                    DriveFolder(
                        id=encode_local_id("locdir", ref_dir),
                        name="📁 MarkMe Project Folder (Default)"
                    )
                ]
                
                # Check for other local directories containing .xlsx files
                search_dirs = [
                    ref_dir,
                    os.path.expanduser("~/Templates"),
                    os.path.expanduser("~/Downloads"),
                    os.path.expanduser("~/Documents"),
                    "/home/sreenath/Sree/Projects/AI-Attendace-Marker-System/uploads/sreenath2410530@ssn.edu.in"
                ]
                
                seen_paths = {ref_dir}
                
                for d in search_dirs:
                    if d and os.path.isdir(d) and d not in seen_paths:
                        xlsx_files = [f for f in os.listdir(d) if f.endswith(".xlsx") and not f.startswith("~$")]
                        if xlsx_files:
                            seen_paths.add(d)
                            folder_name = os.path.basename(d) or d
                            discovered.append(DriveFolder(
                                id=encode_local_id("locdir", d),
                                name=f"📁 {folder_name} ({len(xlsx_files)} Excel files)"
                            ))
                            
                return discovered
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
        Lists .xlsx files in the selected folder (Google Drive or local directory).
        """
        # 1. Local directory encoded
        dir_path = decode_local_id("locdir", folder_id)
        if dir_path:
            if not os.path.isdir(dir_path):
                raise FileNotFoundError(f"Directory not found: {dir_path}")
                
            files: List[DriveFile] = []
            for fname in sorted(os.listdir(dir_path)):
                if fname.endswith(".xlsx") and not fname.startswith("~$"):
                    fpath = os.path.join(dir_path, fname)
                    if os.path.isfile(fpath):
                        mtime = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(os.path.getmtime(fpath)))
                        size_kb = os.path.getsize(fpath) // 1024
                        files.append(DriveFile(
                            id=encode_local_id("locf", fpath),
                            name=fname,
                            mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            modified_time=mtime,
                            size=f"{size_kb} KB",
                            head_revision_id=f"rev-local-{int(os.path.getmtime(fpath))}"
                        ))
            return files

        # 2. Default local dev folder fallback
        if not self.access_token or folder_id.startswith("local"):
            if settings.DEV_MODE:
                ref_path = settings.DEV_LOCAL_WORKBOOK_PATH
                size_str = f"{os.path.getsize(ref_path) // 1024} KB" if os.path.exists(ref_path) else "218 KB"
                base_dir = os.path.dirname(ref_path)
                
                files = []
                for fname in sorted(os.listdir(base_dir)):
                    if fname.endswith(".xlsx") and not fname.startswith("~$"):
                        fpath = os.path.join(base_dir, fname)
                        mtime = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(os.path.getmtime(fpath)))
                        size_kb = os.path.getsize(fpath) // 1024
                        files.append(DriveFile(
                            id=encode_local_id("locf", fpath),
                            name=fname,
                            mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            modified_time=mtime,
                            size=f"{size_kb} KB",
                            head_revision_id=f"rev-local-{int(os.path.getmtime(fpath))}"
                        ))
                return files if files else [
                    DriveFile(
                        id=encode_local_id("locf", ref_path),
                        name="V Sem B Attendance sheet.xlsx",
                        mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        modified_time="2026-09-09T16:22:00Z",
                        size=size_str,
                        head_revision_id="rev-local-1"
                    )
                ]
            raise ValueError("Drive access token is required to list files.")

        # 3. Google Drive folder
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

    def download_workbook(self, file_id: str) -> Tuple[bytes, str, str]:
        """
        Downloads workbook bytes from Google Drive or local filesystem.
        Returns: (file_bytes, file_name, head_revision_id)
        """
        # 1. Custom local file path encoded
        fpath = decode_local_id("locf", file_id)
        if fpath:
            if not os.path.exists(fpath):
                raise FileNotFoundError(f"Local file not found: {fpath}")
            with open(fpath, "rb") as f:
                content = f.read()
            rev_id = f"rev-local-{int(os.path.getmtime(fpath))}"
            return content, os.path.basename(fpath), rev_id

        # 2. Default local dev file
        if file_id.startswith("local") or file_id == "default_dev_workbook":
            ref_path = settings.DEV_LOCAL_WORKBOOK_PATH
            if not os.path.exists(ref_path):
                raise FileNotFoundError(f"Local file not found: {ref_path}")
            with open(ref_path, "rb") as f:
                content = f.read()
            return content, "V Sem B Attendance sheet.xlsx", "rev-local-1"

        if not self.access_token:
            raise FileNotFoundError(f"Workbook with ID '{file_id}' not found.")

        # 3. Google Drive file
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

        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()

        buffer.seek(0)
        return buffer.getvalue(), file_name, head_rev

    def upload_workbook_revision(
        self,
        file_id: str,
        file_bytes: bytes,
        head_revision_id: Optional[str] = None
    ) -> str:
        """
        Uploads updated workbook to Google Drive or saves back to local filesystem.
        Enforces optimistic concurrency checking if head_revision_id is provided.
        """
        # 1. Custom local file path encoded
        fpath = decode_local_id("locf", file_id)
        if fpath:
            with open(fpath, "wb") as f:
                f.write(file_bytes)
            return f"rev-local-{int(time.time())}"

        # 2. Default local dev file
        if not self.access_token or file_id.startswith("local"):
            ref_path = settings.DEV_LOCAL_WORKBOOK_PATH
            with open(ref_path, "wb") as f:
                f.write(file_bytes)
            return "rev-local-updated"

        # 3. Google Drive file
        service = self._get_service()

        if head_revision_id:
            current_meta = service.files().get(
                fileId=file_id,
                fields="headRevisionId",
                supportsAllDrives=True
            ).execute()
            current_rev = current_meta.get("headRevisionId")
            if current_rev and current_rev != head_revision_id:
                raise DriveConcurrencyError(
                    "The attendance workbook has been modified on Google Drive since you opened it. Please reload the latest version before saving."
                )

        media = MediaIoBaseUpload(
            io.BytesIO(file_bytes),
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            resumable=True
        )

        updated_file = service.files().update(
            fileId=file_id,
            media_body=media,
            fields="id, headRevisionId",
            supportsAllDrives=True
        ).execute()

        return updated_file.get("headRevisionId", "updated")
