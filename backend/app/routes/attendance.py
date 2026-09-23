import io
import logging
from datetime import datetime
import openpyxl
from fastapi import APIRouter, Depends, HTTPException, status
from app.models.schemas import (
    AttendancePreviewRequest,
    AttendancePreviewResponse,
    AttendanceCommitRequest,
    AttendanceCommitResponse
)
from app.auth.dependencies import get_current_user
from app.drive.service import DriveService, DriveConcurrencyError
from app.attendance.preview import generate_attendance_preview
from app.attendance.validator import SuffixValidationError
from app.excel.updater import apply_attendance_update, DuplicateSessionError, ExcelUpdateError

logger = logging.getLogger("attendance_audit")
router = APIRouter(prefix="/api/attendance", tags=["attendance"])

@router.post("/preview", response_model=AttendancePreviewResponse)
async def preview_attendance(req: AttendancePreviewRequest, user: dict = Depends(get_current_user)):
    """
    Validates absent register suffix list and generates an exact student-by-student preview.
    Detects if the session already exists and flags duplicate warning.
    """
    drive_svc = DriveService(
        access_token=user.get("access_token"),
        refresh_token=user.get("refresh_token"),
        user_id=user.get("id") or user.get("email")
    )
    try:
        content_bytes, _, _ = drive_svc.download_workbook(req.file_id)
        wb = openpyxl.load_workbook(io.BytesIO(content_bytes), data_only=False)
        
        if req.sheet_name not in wb.sheetnames:
            wb.close()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Worksheet '{req.sheet_name}' not found in workbook."
            )
            
        ws = wb[req.sheet_name]
        raw_input = req.student_input if req.student_input is not None else (req.absent_input or "")
        preview_res = generate_attendance_preview(
            ws=ws,
            sheet_name=req.sheet_name,
            date=req.date,
            period=req.period,
            student_input=raw_input,
            entry_mode=req.entry_mode
        )
        wb.close()
        return preview_res
        
    except SuffixValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": e.message, "errors": e.errors}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate attendance preview: {str(e)}"
        )

@router.post("/commit", response_model=AttendanceCommitResponse)
async def commit_attendance(req: AttendanceCommitRequest, user: dict = Depends(get_current_user)):
    """
    Applies confirmed attendance to the workbook, updates summary calculations,
    preserves formulas, formatting, and uploads the revised workbook to Google Drive.
    """
    drive_svc = DriveService(
        access_token=user.get("access_token"),
        refresh_token=user.get("refresh_token"),
        user_id=user.get("id") or user.get("email")
    )
    try:
        content_bytes, file_name, current_rev = drive_svc.download_workbook(req.file_id)
        wb = openpyxl.load_workbook(io.BytesIO(content_bytes), data_only=False)
        
        col_letter, total_st, present_cnt, absent_cnt = apply_attendance_update(
            wb=wb,
            sheet_name=req.sheet_name,
            date=req.date,
            period=req.period,
            absent_suffixes=req.absent_suffixes,
            allow_overwrite=req.allow_overwrite,
            target_col_idx=req.target_col_idx
        )
        
        # Save updated workbook into memory buffer
        out_buf = io.BytesIO()
        wb.save(out_buf)
        wb.close()
        out_bytes = out_buf.getvalue()
        
        # Upload revised workbook to Google Drive with concurrency check
        new_rev = drive_svc.upload_workbook_revision(
            file_id=req.file_id,
            file_bytes=out_bytes,
            head_revision_id=req.head_revision_id
        )
        
        # Audit Log Entry
        user_email = user.get("email", "unknown")
        logger.info(
            f"AUDIT | User: {user_email} | File: {file_name} | Sheet: {req.sheet_name} | "
            f"Date: {req.date} | Period: {req.period} | Total: {total_st} | "
            f"Present: {present_cnt} | Absent: {absent_cnt} | Column: {col_letter} | "
            f"Timestamp: {datetime.utcnow().isoformat()}"
        )
        
        return AttendanceCommitResponse(
            success=True,
            message=f"Attendance saved successfully in column {col_letter}.",
            sheet_name=req.sheet_name,
            subject_code=req.sheet_name,
            date=req.date,
            period=req.period,
            total_students=total_st,
            present_count=present_cnt,
            absent_count=absent_cnt,
            target_col_letter=col_letter,
            new_revision_id=new_rev
        )
        
    except DuplicateSessionError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": str(e),
                "is_duplicate": True,
                "col_idx": e.col_idx,
                "col_letter": e.col_letter
            }
        )
    except DriveConcurrencyError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": str(e), "is_concurrency_conflict": True}
        )
    except ExcelUpdateError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to commit attendance: {str(e)}"
        )
