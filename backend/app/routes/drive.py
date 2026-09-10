from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.models.schemas import DriveFolder, DriveFile, FolderSelectRequest, FolderResolveRequest, FolderRemoveRequest
from app.auth.dependencies import get_current_user
from app.drive.service import DriveService
from app.auth.session import update_session_data

router = APIRouter(prefix="/api/drive", tags=["drive"])

@router.get("/folders", response_model=List[DriveFolder])
async def list_folders(user: dict = Depends(get_current_user)):
    """
    Lists user's Google Drive folders (excluding any removed/hidden folders).
    """
    drive_svc = DriveService(
        access_token=user.get("access_token"),
        refresh_token=user.get("refresh_token")
    )
    try:
        all_folders = drive_svc.list_folders()
        hidden = set(user.get("hidden_folder_ids", []))
        return [f for f in all_folders if f.id not in hidden]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch Drive folders: {str(e)}"
        )

@router.post("/folders/resolve", response_model=DriveFolder)
async def resolve_folder(req: FolderResolveRequest, user: dict = Depends(get_current_user)):
    """
    Resolves a custom folder from a Google Drive URL, folder ID, or local filesystem path.
    """
    drive_svc = DriveService(
        access_token=user.get("access_token"),
        refresh_token=user.get("refresh_token")
    )
    try:
        return drive_svc.resolve_folder(req.input)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resolve folder: {str(e)}"
        )

@router.post("/folders/select")
async def select_folder(req: FolderSelectRequest, user: dict = Depends(get_current_user)):
    """
    Saves the selected Google Drive folder ID to the user's session.
    """
    user_id = user.get("id") or user.get("email")
    update_session_data(user_id, {
        "selected_folder_id": req.folder_id,
        "selected_folder_name": req.folder_name
    })
    return {
        "success": True,
        "folder_id": req.folder_id,
        "folder_name": req.folder_name
    }

@router.post("/folders/remove")
async def remove_folder(req: FolderRemoveRequest, user: dict = Depends(get_current_user)):
    """
    Removes/hides a folder from the user's available folders list.
    """
    user_id = user.get("id") or user.get("email")
    hidden = set(user.get("hidden_folder_ids", []))
    hidden.add(req.folder_id)

    updates = {"hidden_folder_ids": list(hidden)}
    # If the removed folder was currently selected, disconnect it as well
    if user.get("selected_folder_id") == req.folder_id:
        updates["selected_folder_id"] = None
        updates["selected_folder_name"] = None

    update_session_data(user_id, updates)
    return {"success": True, "removed_id": req.folder_id}

@router.post("/folders/restore")
async def restore_folders(user: dict = Depends(get_current_user)):
    """
    Restores all previously removed/hidden folders to the list.
    """
    user_id = user.get("id") or user.get("email")
    update_session_data(user_id, {"hidden_folder_ids": []})
    return {"success": True, "message": "All hidden folders restored."}

@router.post("/folders/disconnect")
async def disconnect_active_folder(user: dict = Depends(get_current_user)):
    """
    Disconnects the active folder from the current session.
    """
    user_id = user.get("id") or user.get("email")
    update_session_data(user_id, {
        "selected_folder_id": None,
        "selected_folder_name": None
    })
    return {"success": True, "message": "Active folder disconnected."}

@router.get("/files", response_model=List[DriveFile])
async def list_files(user: dict = Depends(get_current_user)):
    """
    Lists Excel (.xlsx) workbooks inside the user's selected folder.
    """
    folder_id = user.get("selected_folder_id")
    if not folder_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Drive folder selected. Please select a folder first."
        )
        
    drive_svc = DriveService(
        access_token=user.get("access_token"),
        refresh_token=user.get("refresh_token")
    )
    try:
        return drive_svc.list_excel_files(folder_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch files from selected folder: {str(e)}"
        )
