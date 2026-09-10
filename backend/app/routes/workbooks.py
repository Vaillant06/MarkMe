import io
import openpyxl
from fastapi import APIRouter, Depends, HTTPException, status
from app.models.schemas import WorkbookDetails
from app.auth.dependencies import get_current_user
from app.drive.service import DriveService
from app.excel.parser import parse_workbook

router = APIRouter(prefix="/api/workbooks", tags=["workbooks"])

@router.get("/{file_id}/details", response_model=WorkbookDetails)
async def get_workbook_details(file_id: str, user: dict = Depends(get_current_user)):
    """
    Downloads and analyzes the selected attendance workbook.
    Extracts class, section, academic year, subject list, student rosters, and existing sessions.
    """
    drive_svc = DriveService(
        access_token=user.get("access_token"),
        refresh_token=user.get("refresh_token")
    )
    try:
        content_bytes, file_name, head_rev = drive_svc.download_workbook(file_id)
        
        # Load in openpyxl without data_only to retain formulas
        wb = openpyxl.load_workbook(io.BytesIO(content_bytes), data_only=False)
        details = parse_workbook(wb, file_id=file_id, file_name=file_name)
        wb.close()
        
        return details
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workbook not found."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error parsing workbook: {str(e)}"
        )
