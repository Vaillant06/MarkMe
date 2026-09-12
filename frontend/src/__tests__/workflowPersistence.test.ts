import { describe, it, expect, beforeEach } from 'vitest';

// Browser environment shim for Node.js test runner
class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

class MockLocation {
  pathname = '/';
  search = '';
  get href(): string {
    return `http://localhost:5173${this.pathname}${this.search}`;
  }
}

class MockHistory {
  pushState(_data: any, _title: string, url?: string | null): void {
    if (url) {
      const u = new URL(url, 'http://localhost:5173');
      (globalThis as any).window.location.pathname = u.pathname;
      (globalThis as any).window.location.search = u.search;
    }
  }
  replaceState(_data: any, _title: string, url?: string | null): void {
    if (url) {
      const u = new URL(url, 'http://localhost:5173');
      (globalThis as any).window.location.pathname = u.pathname;
      (globalThis as any).window.location.search = u.search;
    }
  }
  back(): void {}
  forward(): void {}
}

const mockLocalStorage = new MockStorage();
const mockSessionStorage = new MockStorage();
const mockLocation = new MockLocation();
const mockHistory = new MockHistory();

(globalThis as any).localStorage = mockLocalStorage;
(globalThis as any).sessionStorage = mockSessionStorage;
(globalThis as any).window = {
  location: mockLocation,
  history: mockHistory,
  addEventListener: () => {},
  removeEventListener: () => {},
};
(globalThis as any).document = {
  title: 'MarkMe',
};

import {
  STORAGE_KEYS,
  getPersistedWorkflowState,
  setPersistedWorkflowState,
  getAttendanceDraft,
  saveAttendanceDraft,
  clearAttendanceDraft,
  clearAllWorkflowState,
  parseUrlNavigation,
  navigateToStage,
} from '../utils/workflowState';

describe('Workflow and State Persistence', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockSessionStorage.clear();
    mockLocation.pathname = '/';
    mockLocation.search = '';
  });

  // Case 1: Step 2 -> refresh
  it('preserves Step 2 (Select Workbook) on refresh with selected folder', () => {
    // Simulate user selecting folder in Step 1 and proceeding to Step 2
    setPersistedWorkflowState({
      step: 'FILE_SELECT',
      folderId: 'ssn_drive_folder_001',
      folderName: 'SSN IT Dept Attendance',
    });
    mockLocation.pathname = '/files';
    mockLocation.search = '';

    // Simulate page refresh
    const persisted = getPersistedWorkflowState();
    const nav = parseUrlNavigation();

    expect(persisted.step).toBe('FILE_SELECT');
    expect(persisted.folderId).toBe('ssn_drive_folder_001');
    expect(persisted.folderName).toBe('SSN IT Dept Attendance');
    expect(nav.stageFromUrl).toBe('FILE_SELECT');
  });

  // Case 2: Step 3 -> refresh
  it('preserves Step 3 (Mark Attendance) on refresh with workbook, sheet, date, period, and absentees', () => {
    const fileId = 'workbook_sem5_it_a';
    const fileName = 'V Sem IT A Attendance.xlsx';

    // Simulate user selecting workbook and filling attendance details
    setPersistedWorkflowState({
      step: 'MARK_ATTENDANCE',
      folderId: 'ssn_drive_folder_001',
      folderName: 'SSN IT Dept Attendance',
      fileId,
      fileName,
    });
    saveAttendanceDraft(fileId, {
      selectedSheet: 'UIT3563',
      date: '12/09/2026',
      period: '4',
      entryMode: 'ABSENT',
      studentInput: '003, 045, 089',
    });
    mockLocation.pathname = '/attendance';
    mockLocation.search = `?fileId=${fileId}`;

    // Simulate page refresh (F5 / Ctrl+R)
    const persisted = getPersistedWorkflowState();
    const nav = parseUrlNavigation();
    const draft = getAttendanceDraft(fileId);

    // Assert navigational & workbook state
    expect(persisted.step).toBe('MARK_ATTENDANCE');
    expect(persisted.fileId).toBe(fileId);
    expect(persisted.fileName).toBe(fileName);
    expect(nav.stageFromUrl).toBe('MARK_ATTENDANCE');
    expect(nav.fileId).toBe(fileId);

    // Assert form draft restoration (subject, date, period, absentee input)
    expect(draft).not.toBeNull();
    expect(draft?.selectedSheet).toBe('UIT3563');
    expect(draft?.date).toBe('12/09/2026');
    expect(draft?.period).toBe('4');
    expect(draft?.entryMode).toBe('ABSENT');
    expect(draft?.studentInput).toBe('003, 045, 089');
  });

  // Case 3: Step 3 -> close/reopen browser simulation
  it('survives browser close/reopen through localStorage persistence', () => {
    const fileId = 'workbook_sem3_it_b';
    setPersistedWorkflowState({
      step: 'MARK_ATTENDANCE',
      fileId,
      fileName: 'III Sem IT B.xlsx',
      folderId: 'folder_it',
    });
    saveAttendanceDraft(fileId, {
      selectedSheet: 'CS8351',
      date: '14/09/2026',
      period: '2',
      entryMode: 'PRESENT',
      studentInput: '001, 002, 003',
    });

    // Simulated reopen: memory wiped, but localStorage intact
    const restoredWorkflow = getPersistedWorkflowState();
    const restoredDraft = getAttendanceDraft(fileId);

    expect(restoredWorkflow.step).toBe('MARK_ATTENDANCE');
    expect(restoredWorkflow.fileId).toBe(fileId);
    expect(restoredDraft?.date).toBe('14/09/2026');
    expect(restoredDraft?.entryMode).toBe('PRESENT');
    expect(restoredDraft?.studentInput).toBe('001, 002, 003');
  });

  // Case 4: Logout -> login again
  it('clears all workflow state and drafts on logout so another user cannot inherit previous session', () => {
    // User 1 logs in, marks attendance, saves draft
    mockLocalStorage.setItem(STORAGE_KEYS.TOKEN, 'user1_session_token');
    setPersistedWorkflowState({
      step: 'MARK_ATTENDANCE',
      fileId: 'user1_workbook',
      fileName: 'User1 Sheet.xlsx',
      folderId: 'user1_folder',
    });
    saveAttendanceDraft('user1_workbook', {
      studentInput: '099, 100',
    });

    // User 1 logs out
    clearAllWorkflowState();

    // Verify all keys cleared
    expect(mockLocalStorage.getItem(STORAGE_KEYS.TOKEN)).toBeNull();
    expect(mockLocalStorage.getItem(STORAGE_KEYS.CURRENT_STEP)).toBeNull();
    expect(mockLocalStorage.getItem(STORAGE_KEYS.FILE_ID)).toBeNull();
    expect(mockLocalStorage.getItem(STORAGE_KEYS.FOLDER_ID)).toBeNull();
    expect(getAttendanceDraft('user1_workbook')).toBeNull();

    // User 2 logs in fresh
    setPersistedWorkflowState({
      step: 'DRIVE_SETUP',
    });
    const user2State = getPersistedWorkflowState();
    expect(user2State.step).toBe('DRIVE_SETUP');
    expect(user2State.fileId).toBeNull();
    expect(user2State.folderId).toBeNull();
  });

  // Case 5: Expired session -> refresh
  it('clears persisted state and resets to AUTH when session expires', () => {
    mockLocalStorage.setItem(STORAGE_KEYS.TOKEN, 'expired_token');
    setPersistedWorkflowState({
      step: 'MARK_ATTENDANCE',
      fileId: 'some_file',
      folderId: 'some_folder',
    });

    // Simulated auth failure handler (as implemented in App.tsx checkCurrentUser catch block)
    const handleAuthFailure = () => {
      clearAllWorkflowState();
      navigateToStage('AUTH', {}, true);
    };

    handleAuthFailure();

    expect(mockLocalStorage.getItem(STORAGE_KEYS.TOKEN)).toBeNull();
    expect(mockLocalStorage.getItem(STORAGE_KEYS.CURRENT_STEP)).toBeNull();
    expect(mockLocation.pathname).toBe('/login');
  });

  // Case 6: Inaccessible / deleted workbook -> refresh
  it('gracefully handles deleted/inaccessible workbook by clearing file and falling back to Step 2', () => {
    const deletedFileId = 'deleted_workbook_id';
    setPersistedWorkflowState({
      step: 'MARK_ATTENDANCE',
      fileId: deletedFileId,
      fileName: 'Deleted Workbook.xlsx',
      folderId: 'existing_valid_folder',
      folderName: 'My Folder',
    });
    mockLocation.pathname = '/attendance';
    mockLocation.search = `?fileId=${deletedFileId}`;

    // Simulated graceful fallback as implemented in App.tsx
    const handleWorkbookLoadFailure = (folderId: string | null) => {
      setPersistedWorkflowState({ fileId: null, fileName: null });
      clearAttendanceDraft(deletedFileId);
      if (folderId) {
        setPersistedWorkflowState({ step: 'FILE_SELECT' });
        navigateToStage('FILE_SELECT', { folderId }, true);
      } else {
        setPersistedWorkflowState({ step: 'DRIVE_SETUP' });
        navigateToStage('DRIVE_SETUP', {}, true);
      }
    };

    handleWorkbookLoadFailure('existing_valid_folder');

    const updatedState = getPersistedWorkflowState();
    expect(updatedState.fileId).toBeNull();
    expect(updatedState.step).toBe('FILE_SELECT');
    expect(mockLocation.pathname).toBe('/files');
    expect(mockLocation.search).toContain('folderId=existing_valid_folder');
  });

  // Case 7: Direct navigation to Step 3
  it('correctly parses direct URL navigation to Step 3 with fileId query param', () => {
    mockLocation.pathname = '/attendance';
    mockLocation.search = '?fileId=direct_nav_file_789';

    const nav = parseUrlNavigation();
    expect(nav.path).toBe('/attendance');
    expect(nav.stageFromUrl).toBe('MARK_ATTENDANCE');
    expect(nav.fileId).toBe('direct_nav_file_789');
  });

  // Case 8: Browser Back/Forward navigation
  it('updates route history accurately for Back and Forward navigation', () => {
    // Step 1: Drive Setup
    navigateToStage('DRIVE_SETUP');
    expect(mockLocation.pathname).toBe('/drive-setup');

    // Step 2: Files
    navigateToStage('FILE_SELECT', { folderId: 'fld_1' });
    expect(mockLocation.pathname).toBe('/files');
    expect(mockLocation.search).toBe('?folderId=fld_1');

    // Step 3: Attendance
    navigateToStage('MARK_ATTENDANCE', { fileId: 'file_1' });
    expect(mockLocation.pathname).toBe('/attendance');
    expect(mockLocation.search).toBe('?fileId=file_1');

    // Simulate Back navigation to Step 2
    mockLocation.pathname = '/files';
    mockLocation.search = '?folderId=fld_1';
    const backNav = parseUrlNavigation();
    expect(backNav.stageFromUrl).toBe('FILE_SELECT');

    // Simulate Forward navigation to Step 3
    mockLocation.pathname = '/attendance';
    mockLocation.search = '?fileId=file_1';
    const fwdNav = parseUrlNavigation();
    expect(fwdNav.stageFromUrl).toBe('MARK_ATTENDANCE');
    expect(fwdNav.fileId).toBe('file_1');
  });
});
