import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { DriveSetupPage } from './pages/DriveSetupPage';
import { FileSelectionPage } from './pages/FileSelectionPage';
import { AttendanceMarkingPage } from './pages/AttendanceMarkingPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { SuccessView } from './components/SuccessView';
import { api } from './api/client';
import { UserProfile, DriveFile, AttendanceCommitResponse } from './types';
import {
  AppStage,
  STORAGE_KEYS,
  getPersistedWorkflowState,
  setPersistedWorkflowState,
  clearAllWorkflowState,
  getAttendanceDraft,
  saveAttendanceDraft,
  parseUrlNavigation,
  navigateToStage,
} from './utils/workflowState';

export const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>();
  const [selectedFolderName, setSelectedFolderName] = useState<string | undefined>();
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [commitResult, setCommitResult] = useState<AttendanceCommitResponse | null>(null);

  // App Navigation Stage: 'AUTH' | 'DRIVE_SETUP' | 'FILE_SELECT' | 'MARK_ATTENDANCE' | 'SUCCESS'
  const [stage, setStage] = useState<AppStage>('AUTH');
  const [initialLoading, setInitialLoading] = useState(true);
  const [workflowNotice, setWorkflowNotice] = useState<string | null>(null);

  useEffect(() => {
    // Check if redirected with OAuth session token in URL
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');
    if (tokenFromUrl) {
      localStorage.setItem(STORAGE_KEYS.TOKEN, tokenFromUrl);
      // Clean query parameter from URL in address bar without full reload
      params.delete('token');
      const remainingSearch = params.toString();
      const cleanUrl = remainingSearch
        ? `${window.location.pathname}?${remainingSearch}`
        : window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    // Listen to browser Back / Forward events
    const handlePopState = async () => {
      const nav = parseUrlNavigation();
      if (nav.stageFromUrl === 'STATISTICS') {
        const fileId = nav.fileId || localStorage.getItem(STORAGE_KEYS.FILE_ID);
        if (fileId) {
          const subject = nav.subject || localStorage.getItem(STORAGE_KEYS.SUBJECT) || undefined;
          if (selectedFile && selectedFile.id === fileId) {
            setStage('STATISTICS');
            if (subject) setPersistedWorkflowState({ subject });
          } else {
            try {
              const wb = await api.getWorkbookDetails(fileId);
              const restoredFile: DriveFile = {
                id: fileId,
                name: wb.file_name,
                mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              };
              setSelectedFile(restoredFile);
              setStage('STATISTICS');
              setPersistedWorkflowState({ step: 'STATISTICS', fileId, subject: subject || null });
            } catch {
              setStage('FILE_SELECT');
              navigateToStage('FILE_SELECT', {}, true);
            }
          }
        } else {
          setStage('FILE_SELECT');
          navigateToStage('FILE_SELECT', {}, true);
        }
      } else if (nav.stageFromUrl === 'MARK_ATTENDANCE') {
        const fileId = nav.fileId || localStorage.getItem(STORAGE_KEYS.FILE_ID);
        if (fileId) {
          if (selectedFile && selectedFile.id === fileId) {
            setStage('MARK_ATTENDANCE');
          } else {
            try {
              const wb = await api.getWorkbookDetails(fileId);
              const restoredFile: DriveFile = {
                id: fileId,
                name: wb.file_name,
                mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              };
              setSelectedFile(restoredFile);
              setStage('MARK_ATTENDANCE');
              setPersistedWorkflowState({ step: 'MARK_ATTENDANCE', fileId });
            } catch {
              setStage('FILE_SELECT');
              navigateToStage('FILE_SELECT', {}, true);
            }
          }
        } else {
          setStage('FILE_SELECT');
          navigateToStage('FILE_SELECT', {}, true);
        }
      } else if (nav.stageFromUrl === 'FILE_SELECT') {
        setStage('FILE_SELECT');
        setPersistedWorkflowState({ step: 'FILE_SELECT' });
      } else if (nav.stageFromUrl === 'DRIVE_SETUP') {
        setStage('DRIVE_SETUP');
        setPersistedWorkflowState({ step: 'DRIVE_SETUP' });
      } else if (nav.stageFromUrl === 'AUTH') {
        setStage('AUTH');
      }
    };

    window.addEventListener('popstate', handlePopState);
    checkCurrentUser();

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const checkCurrentUser = async () => {
    setInitialLoading(true);
    setWorkflowNotice(null);
    try {
      // 1. Validate session with backend (Requirement 10)
      const data = await api.getCurrentUser();
      setUser(data.user);

      // 2. Determine effective folder
      const persisted = getPersistedWorkflowState();
      const effectiveFolderId =
        data.selected_folder_id || persisted.folderId || undefined;
      const effectiveFolderName =
        data.selected_folder_name || persisted.folderName || undefined;

      if (effectiveFolderId) {
        setSelectedFolderId(effectiveFolderId);
        setPersistedWorkflowState({ folderId: effectiveFolderId });
      }
      if (effectiveFolderName) {
        setSelectedFolderName(effectiveFolderName);
        setPersistedWorkflowState({ folderName: effectiveFolderName });
      }

      // 3. Reconstruct workflow from URL and/or persisted state (Requirement 4, 6, 8, 9)
      const nav = parseUrlNavigation();
      const targetStep = nav.stageFromUrl || persisted.step;
      const targetFileId = nav.fileId || data.selected_file_id || persisted.fileId;

      // Handle Step 3 (Mark Attendance) or Statistics
      const wantsStatistics =
        nav.stageFromUrl === 'STATISTICS' ||
        targetStep === 'STATISTICS';

      const wantsAttendance =
        nav.stageFromUrl === 'MARK_ATTENDANCE' ||
        targetStep === 'MARK_ATTENDANCE' ||
        Boolean(nav.fileId);

      if ((wantsStatistics || wantsAttendance) && targetFileId) {
        try {
          // Verify and retrieve fresh workbook details from backend/Drive
          const wb = await api.getWorkbookDetails(targetFileId);
          const restoredFile: DriveFile = {
            id: targetFileId,
            name:
              wb.file_name ||
              data.selected_file_name ||
              persisted.fileName ||
              'Attendance Sheet.xlsx',
            mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          };
          setSelectedFile(restoredFile);

          if (wantsStatistics) {
            const subject = nav.subject || persisted.subject || undefined;
            setPersistedWorkflowState({
              step: 'STATISTICS',
              fileId: targetFileId,
              fileName: restoredFile.name,
              subject: subject || null,
            });
            setStage('STATISTICS');
            navigateToStage('STATISTICS', { fileId: targetFileId, subject }, true);
            return;
          }

          setPersistedWorkflowState({
            step: 'MARK_ATTENDANCE',
            fileId: targetFileId,
            fileName: restoredFile.name,
          });
          setStage('MARK_ATTENDANCE');
          navigateToStage('MARK_ATTENDANCE', { fileId: targetFileId }, true);
          return;
        } catch (err: any) {
          // Requirement 7: Gracefully handle inaccessible or deleted workbook
          console.warn('Persisted workbook inaccessible or deleted:', err);
          setPersistedWorkflowState({ fileId: null, fileName: null });
          try {
            await api.clearWorkbook();
          } catch {}
          setWorkflowNotice(
            err.status === 404
              ? 'The previously selected workbook is no longer accessible or was deleted. Please select an attendance workbook.'
              : 'Unable to access the previously selected workbook. Please select an attendance workbook.'
          );
          setSelectedFile(null);

          if (effectiveFolderId) {
            setStage('FILE_SELECT');
            setPersistedWorkflowState({ step: 'FILE_SELECT' });
            navigateToStage('FILE_SELECT', { folderId: effectiveFolderId }, true);
          } else {
            setStage('DRIVE_SETUP');
            setPersistedWorkflowState({ step: 'DRIVE_SETUP' });
            navigateToStage('DRIVE_SETUP', {}, true);
          }
          return;
        }
      }

      // Handle Step 1 (Drive Setup) explicitly when requested (Requirement 8)
      const wantsDriveSetup =
        nav.stageFromUrl === 'DRIVE_SETUP' ||
        targetStep === 'DRIVE_SETUP' ||
        !effectiveFolderId;

      if (wantsDriveSetup) {
        setStage('DRIVE_SETUP');
        setPersistedWorkflowState({ step: 'DRIVE_SETUP' });
        navigateToStage('DRIVE_SETUP', effectiveFolderId ? { folderId: effectiveFolderId } : undefined, true);
        return;
      }

      // Handle Step 2 (Workbook Selection)
      setStage('FILE_SELECT');
      setPersistedWorkflowState({ step: 'FILE_SELECT' });
      navigateToStage('FILE_SELECT', { folderId: effectiveFolderId }, true);
    } catch {
      // Backend rejected authentication or token expired
      clearAllWorkflowState();
      setUser(null);
      setSelectedFolderId(undefined);
      setSelectedFolderName(undefined);
      setSelectedFile(null);
      setCommitResult(null);
      setStage('AUTH');
      navigateToStage('AUTH', {}, true);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {}
    // Requirement 11: Clear all application workflow state on logout
    clearAllWorkflowState();
    setUser(null);
    setSelectedFolderId(undefined);
    setSelectedFolderName(undefined);
    setSelectedFile(null);
    setCommitResult(null);
    setWorkflowNotice(null);
    setStage('AUTH');
    navigateToStage('AUTH', {}, true);
  };

  const handleLoginSuccess = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    setWorkflowNotice(null);
    const persisted = getPersistedWorkflowState();
    if (persisted.folderId || selectedFolderId) {
      setStage('FILE_SELECT');
      setPersistedWorkflowState({ step: 'FILE_SELECT' });
      navigateToStage('FILE_SELECT', { folderId: persisted.folderId || selectedFolderId });
    } else {
      setStage('DRIVE_SETUP');
      setPersistedWorkflowState({ step: 'DRIVE_SETUP' });
      navigateToStage('DRIVE_SETUP');
    }
  };

  const handleFolderSelected = (folderId: string, folderName: string) => {
    setSelectedFolderId(folderId);
    setSelectedFolderName(folderName);
    setSelectedFile(null);
    setWorkflowNotice(null);
    setPersistedWorkflowState({
      folderId,
      folderName,
      fileId: null,
      fileName: null,
      step: 'FILE_SELECT',
    });
    setStage('FILE_SELECT');
    navigateToStage('FILE_SELECT', { folderId });
  };

  const handleFileSelected = (file: DriveFile) => {
    setSelectedFile(file);
    setWorkflowNotice(null);
    setPersistedWorkflowState({
      fileId: file.id,
      fileName: file.name,
      step: 'MARK_ATTENDANCE',
    });
    api.selectWorkbook(file.id, file.name).catch(() => {});
    setStage('MARK_ATTENDANCE');
    navigateToStage('MARK_ATTENDANCE', { fileId: file.id });
  };

  const handleBackToFileSelect = () => {
    setPersistedWorkflowState({ step: 'FILE_SELECT' });
    setStage('FILE_SELECT');
    navigateToStage('FILE_SELECT', { folderId: selectedFolderId });
  };

  const handleBackToDriveSetup = () => {
    setPersistedWorkflowState({ step: 'DRIVE_SETUP' });
    setStage('DRIVE_SETUP');
    navigateToStage('DRIVE_SETUP');
  };

  const handleCommitSuccess = (res: AttendanceCommitResponse) => {
    setCommitResult(res);
    setPersistedWorkflowState({ step: 'SUCCESS' });
    setStage('SUCCESS');
    navigateToStage('SUCCESS', { fileId: selectedFile?.id });
  };

  const handleResetForAnotherSession = () => {
    setCommitResult(null);
    setPersistedWorkflowState({ step: 'MARK_ATTENDANCE' });
    setStage('MARK_ATTENDANCE');
    navigateToStage('MARK_ATTENDANCE', { fileId: selectedFile?.id });
  };

  const handleNavigateToStatistics = (currentSubject?: string) => {
    if (!selectedFile) return;
    const subject = currentSubject || getPersistedWorkflowState().subject || undefined;
    setPersistedWorkflowState({
      step: 'STATISTICS',
      fileId: selectedFile.id,
      fileName: selectedFile.name,
      subject: subject || null,
    });
    setStage('STATISTICS');
    navigateToStage('STATISTICS', { fileId: selectedFile.id, subject });
  };

  const handleBackToAttendance = (selectedSubject?: string) => {
    if (!selectedFile) return;
    const subject = selectedSubject || getPersistedWorkflowState().subject || undefined;
    if (subject) {
      setPersistedWorkflowState({
        step: 'MARK_ATTENDANCE',
        fileId: selectedFile.id,
        fileName: selectedFile.name,
        subject,
      });
      const draft = getAttendanceDraft(selectedFile.id) || {};
      saveAttendanceDraft(selectedFile.id, { ...draft, selectedSheet: subject });
    } else {
      setPersistedWorkflowState({
        step: 'MARK_ATTENDANCE',
        fileId: selectedFile.id,
        fileName: selectedFile.name,
      });
    }
    setStage('MARK_ATTENDANCE');
    navigateToStage('MARK_ATTENDANCE', { fileId: selectedFile.id, subject });
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-300">Connecting to MarkMe Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header user={user} onLogout={handleLogout} />

      <main className="flex-1">
        {stage === 'AUTH' && (
          <LoginPage onLoginSuccess={handleLoginSuccess} />
        )}

        {stage === 'DRIVE_SETUP' && user && (
          <DriveSetupPage
            user={user}
            currentFolderId={selectedFolderId}
            currentFolderName={selectedFolderName}
            onFolderSelected={handleFolderSelected}
            onFolderDisconnected={() => {
              setSelectedFolderId(undefined);
              setSelectedFolderName(undefined);
              setSelectedFile(null);
              setPersistedWorkflowState({
                folderId: null,
                folderName: null,
                fileId: null,
                fileName: null,
                step: 'DRIVE_SETUP',
              });
            }}
          />
        )}

        {stage === 'FILE_SELECT' && (
          <FileSelectionPage
            folderName={selectedFolderName || 'College Attendance Folder'}
            onBackToDriveSetup={handleBackToDriveSetup}
            onFileSelected={handleFileSelected}
            notice={workflowNotice}
            initialSelectedFileId={selectedFile?.id || getPersistedWorkflowState().fileId}
          />
        )}

        {stage === 'MARK_ATTENDANCE' && selectedFile && (
          <AttendanceMarkingPage
            file={selectedFile}
            onBackToFileSelect={handleBackToFileSelect}
            onNavigateToStatistics={handleNavigateToStatistics}
            onCommitSuccess={handleCommitSuccess}
          />
        )}

        {stage === 'STATISTICS' && selectedFile && (
          <StatisticsPage
            file={selectedFile}
            initialSubject={parseUrlNavigation().subject || getPersistedWorkflowState().subject || undefined}
            onBackToAttendance={handleBackToAttendance}
          />
        )}

        {stage === 'SUCCESS' && commitResult && (
          <SuccessView
            result={commitResult}
            fileName={selectedFile?.name || 'Attendance Sheet.xlsx'}
            fileId={selectedFile?.id}
            onReset={handleResetForAnotherSession}
          />
        )}
      </main>

      <footer className="py-4 border-t border-slate-200 bg-white text-center text-xs text-slate-500">
        <p>SSN College of Engineering • MarkMe Attendance Marking Portal</p>
      </footer>
    </div>
  );
};
