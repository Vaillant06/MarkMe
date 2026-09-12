export type AppStage = 'AUTH' | 'DRIVE_SETUP' | 'FILE_SELECT' | 'MARK_ATTENDANCE' | 'SUCCESS';

export const STORAGE_KEYS = {
  TOKEN: 'markme_token',
  CURRENT_STEP: 'markme_current_step',
  FOLDER_ID: 'markme_selected_folder_id',
  FOLDER_NAME: 'markme_selected_folder_name',
  FILE_ID: 'markme_selected_file_id',
  FILE_NAME: 'markme_selected_file_name',
  DRAFT_PREFIX: 'markme_draft_',
} as const;

export interface AttendanceDraft {
  selectedSheet?: string;
  date?: string;
  period?: string;
  entryMode?: 'ABSENT' | 'PRESENT';
  studentInput?: string;
}

export function getAttendanceDraft(fileId: string): AttendanceDraft | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.DRAFT_PREFIX}${fileId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAttendanceDraft(fileId: string, draft: AttendanceDraft): void {
  try {
    localStorage.setItem(`${STORAGE_KEYS.DRAFT_PREFIX}${fileId}`, JSON.stringify(draft));
  } catch {}
}

export function clearAttendanceDraft(fileId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEYS.DRAFT_PREFIX}${fileId}`);
  } catch {}
}

export function getPersistedWorkflowState(): {
  step: AppStage | null;
  folderId: string | null;
  folderName: string | null;
  fileId: string | null;
  fileName: string | null;
} {
  return {
    step: (localStorage.getItem(STORAGE_KEYS.CURRENT_STEP) as AppStage) || null,
    folderId: localStorage.getItem(STORAGE_KEYS.FOLDER_ID),
    folderName: localStorage.getItem(STORAGE_KEYS.FOLDER_NAME),
    fileId: localStorage.getItem(STORAGE_KEYS.FILE_ID),
    fileName: localStorage.getItem(STORAGE_KEYS.FILE_NAME),
  };
}

export function setPersistedWorkflowState(updates: {
  step?: AppStage | null;
  folderId?: string | null;
  folderName?: string | null;
  fileId?: string | null;
  fileName?: string | null;
}): void {
  try {
    if (updates.step !== undefined) {
      if (updates.step === null) {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_STEP);
      } else {
        localStorage.setItem(STORAGE_KEYS.CURRENT_STEP, updates.step);
      }
    }
    if (updates.folderId !== undefined) {
      if (updates.folderId === null) {
        localStorage.removeItem(STORAGE_KEYS.FOLDER_ID);
      } else {
        localStorage.setItem(STORAGE_KEYS.FOLDER_ID, updates.folderId);
      }
    }
    if (updates.folderName !== undefined) {
      if (updates.folderName === null) {
        localStorage.removeItem(STORAGE_KEYS.FOLDER_NAME);
      } else {
        localStorage.setItem(STORAGE_KEYS.FOLDER_NAME, updates.folderName);
      }
    }
    if (updates.fileId !== undefined) {
      if (updates.fileId === null) {
        localStorage.removeItem(STORAGE_KEYS.FILE_ID);
      } else {
        localStorage.setItem(STORAGE_KEYS.FILE_ID, updates.fileId);
      }
    }
    if (updates.fileName !== undefined) {
      if (updates.fileName === null) {
        localStorage.removeItem(STORAGE_KEYS.FILE_NAME);
      } else {
        localStorage.setItem(STORAGE_KEYS.FILE_NAME, updates.fileName);
      }
    }
  } catch {}
}

export function clearAllWorkflowState(): void {
  try {
    // Clear all markme_ prefixed keys from localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('markme_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    sessionStorage.clear();
  } catch {}
}

export function parseUrlNavigation(): {
  path: string;
  stageFromUrl: AppStage | null;
  fileId: string | null;
  folderId: string | null;
  stepParam: string | null;
} {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const fileId = params.get('fileId');
  const folderId = params.get('folderId');
  const stepParam = params.get('step');

  let stageFromUrl: AppStage | null = null;

  if (path.startsWith('/attendance') || stepParam === 'attendance' || (fileId && !path.startsWith('/files') && !path.startsWith('/drive-setup'))) {
    stageFromUrl = 'MARK_ATTENDANCE';
  } else if (path.startsWith('/files') || stepParam === 'files') {
    stageFromUrl = 'FILE_SELECT';
  } else if (path.startsWith('/drive-setup') || stepParam === 'drive_setup') {
    stageFromUrl = 'DRIVE_SETUP';
  } else if (path.startsWith('/success') || stepParam === 'success') {
    stageFromUrl = 'SUCCESS';
  } else if (path.startsWith('/login') || stepParam === 'login') {
    stageFromUrl = 'AUTH';
  }

  return {
    path,
    stageFromUrl,
    fileId,
    folderId,
    stepParam,
  };
}

export function navigateToStage(
  stage: AppStage,
  params?: { fileId?: string; folderId?: string },
  replace: boolean = false
): void {
  let targetPath = '/';
  const searchParams = new URLSearchParams();

  switch (stage) {
    case 'AUTH':
      targetPath = '/login';
      break;
    case 'DRIVE_SETUP':
      targetPath = '/drive-setup';
      if (params?.folderId) searchParams.set('folderId', params.folderId);
      break;
    case 'FILE_SELECT':
      targetPath = '/files';
      if (params?.folderId) searchParams.set('folderId', params.folderId);
      break;
    case 'MARK_ATTENDANCE':
      targetPath = '/attendance';
      if (params?.fileId) searchParams.set('fileId', params.fileId);
      break;
    case 'SUCCESS':
      targetPath = '/success';
      if (params?.fileId) searchParams.set('fileId', params.fileId);
      break;
  }

  const queryString = searchParams.toString();
  const fullUrl = queryString ? `${targetPath}?${queryString}` : targetPath;

  const currentFullUrl = `${window.location.pathname}${window.location.search}`;
  if (currentFullUrl === fullUrl) {
    return;
  }

  if (replace) {
    window.history.replaceState({ stage, fileId: params?.fileId }, document.title, fullUrl);
  } else {
    window.history.pushState({ stage, fileId: params?.fileId }, document.title, fullUrl);
  }
}
