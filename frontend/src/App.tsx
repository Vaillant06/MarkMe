import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { DriveSetupPage } from './pages/DriveSetupPage';
import { FileSelectionPage } from './pages/FileSelectionPage';
import { AttendanceMarkingPage } from './pages/AttendanceMarkingPage';
import { SuccessView } from './components/SuccessView';
import { api } from './api/client';
import { UserProfile, DriveFile, AttendanceCommitResponse } from './types';

export const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>();
  const [selectedFolderName, setSelectedFolderName] = useState<string | undefined>();
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [commitResult, setCommitResult] = useState<AttendanceCommitResponse | null>(null);

  // App Navigation Stage: 'AUTH' | 'DRIVE_SETUP' | 'FILE_SELECT' | 'MARK_ATTENDANCE' | 'SUCCESS'
  const [stage, setStage] = useState<'AUTH' | 'DRIVE_SETUP' | 'FILE_SELECT' | 'MARK_ATTENDANCE' | 'SUCCESS'>('AUTH');
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    // Check if redirected with OAuth session token in URL
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');
    if (tokenFromUrl) {
      localStorage.setItem('markme_token', tokenFromUrl);
      // Clean query parameters from URL in address bar without reloading
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
    checkCurrentUser();
  }, []);

  const checkCurrentUser = async () => {
    try {
      const data = await api.getCurrentUser();
      setUser(data.user);
      setSelectedFolderId(data.selected_folder_id);
      setSelectedFolderName(data.selected_folder_name);

      if (data.selected_folder_id) {
        setStage('FILE_SELECT');
      } else {
        setStage('DRIVE_SETUP');
      }
    } catch {
      setUser(null);
      setStage('AUTH');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {}
    localStorage.removeItem('markme_token');
    setUser(null);
    setSelectedFolderId(undefined);
    setSelectedFolderName(undefined);
    setSelectedFile(null);
    setCommitResult(null);
    setStage('AUTH');
  };

  const handleLoginSuccess = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    setStage('DRIVE_SETUP');
  };

  const handleFolderSelected = (folderId: string, folderName: string) => {
    setSelectedFolderId(folderId);
    setSelectedFolderName(folderName);
    setStage('FILE_SELECT');
  };

  const handleFileSelected = (file: DriveFile) => {
    setSelectedFile(file);
    setStage('MARK_ATTENDANCE');
  };

  const handleCommitSuccess = (res: AttendanceCommitResponse) => {
    setCommitResult(res);
    setStage('SUCCESS');
  };

  const handleResetForAnotherSession = () => {
    setCommitResult(null);
    setStage('MARK_ATTENDANCE');
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
            }}
          />
        )}

        {stage === 'FILE_SELECT' && (
          <FileSelectionPage
            folderName={selectedFolderName || 'College Attendance Folder'}
            onBackToDriveSetup={() => setStage('DRIVE_SETUP')}
            onFileSelected={handleFileSelected}
          />
        )}

        {stage === 'MARK_ATTENDANCE' && selectedFile && (
          <AttendanceMarkingPage
            file={selectedFile}
            onBackToFileSelect={() => setStage('FILE_SELECT')}
            onCommitSuccess={handleCommitSuccess}
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
