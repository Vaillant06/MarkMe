import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderCheck,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Search,
  Link,
  FolderPlus,
  HelpCircle,
  Trash2,
  Unlink,
  RotateCcw
} from 'lucide-react';
import { api } from '../api/client';
import { UserProfile, DriveFolder } from '../types';

interface DriveSetupPageProps {
  user: UserProfile;
  currentFolderId?: string;
  currentFolderName?: string;
  onFolderSelected: (folderId: string, folderName: string) => void;
  onFolderDisconnected?: () => void;
}

export const DriveSetupPage: React.FC<DriveSetupPageProps> = ({
  user,
  currentFolderId,
  currentFolderName,
  onFolderSelected,
  onFolderDisconnected,
}) => {
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(currentFolderId || '');
  const [isChangingFolder, setIsChangingFolder] = useState(!currentFolderId);

  // Tab mode: 'LIST' or 'CUSTOM'
  const [tabMode, setTabMode] = useState<'LIST' | 'CUSTOM'>('LIST');
  const [searchQuery, setSearchQuery] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [resolvingCustom, setResolvingCustom] = useState(false);

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listFolders();
      setFolders(data);
      if (!selectedId && data.length > 0) {
        setSelectedId(data[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load Google Drive folders.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSelect = async () => {
    if (!selectedId) return;
    const folder = folders.find((f) => f.id === selectedId);
    const folderName = folder ? folder.name : 'Attendance Folder';
    setSaving(true);
    try {
      await api.selectFolder(selectedId, folderName);
      onFolderSelected(selectedId, folderName);
    } catch (err: any) {
      setError(err.message || 'Failed to save folder selection.');
      setSaving(false);
    }
  };

  const handleResolveCustomFolder = async () => {
    if (!customInput.trim()) {
      setError('Please enter a Google Drive folder link, folder ID, or local directory path.');
      return;
    }
    setResolvingCustom(true);
    setError(null);
    try {
      const resolved = await api.resolveFolder(customInput.trim());
      await api.selectFolder(resolved.id, resolved.name);
      onFolderSelected(resolved.id, resolved.name);
    } catch (err: any) {
      setError(err.message || 'Failed to resolve folder. Please check the link, ID, or path.');
    } finally {
      setResolvingCustom(false);
    }
  };

  const handleRemoveFolder = async (folderId: string, folderName: string) => {
    if (!window.confirm(`Remove "${folderName}" from the list?`)) {
      return;
    }
    try {
      await api.removeFolder(folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      if (selectedId === folderId) {
        const remaining = folders.filter((f) => f.id !== folderId);
        setSelectedId(remaining.length > 0 ? remaining[0].id : '');
      }
      if (currentFolderId === folderId) {
        onFolderDisconnected?.();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove folder.');
    }
  };

  const handleRestoreFolders = async () => {
    try {
      await api.restoreFolders();
      await loadFolders();
    } catch (err: any) {
      setError(err.message || 'Failed to restore folders.');
    }
  };

  const handleDisconnectActiveFolder = async () => {
    if (!window.confirm('Disconnect the active attendance folder?')) {
      return;
    }
    try {
      await api.disconnectActiveFolder();
      setIsChangingFolder(true);
      setSelectedId('');
      onFolderDisconnected?.();
      await loadFolders();
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect folder.');
    }
  };

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-slate-900 px-8 py-6 text-white">
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-blue-300">
            <span>Step 1 of 3</span>
            <span>•</span>
            <span>Google Drive Storage</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 tracking-tight text-white">
            Connect Attendance Folder
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Authenticated Account: <span className="font-semibold text-white">{user.email}</span>
          </p>
        </div>

        <div className="p-8 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* If already configured and not actively changing */}
          {!isChangingFolder && currentFolderId ? (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                    <FolderCheck className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-semibold uppercase text-emerald-800 tracking-wide">
                      Active Attendance Folder
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                      {currentFolderName || 'College Attendance Folder'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      This folder contains the master Excel attendance sheets.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={() => onFolderSelected(currentFolderId, currentFolderName || 'Attendance Folder')}
                  className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition flex items-center justify-center space-x-2"
                >
                  <span>Continue with this Folder</span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setIsChangingFolder(true)}
                  className="w-full sm:w-auto py-3 px-5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-sm transition"
                >
                  Change Folder
                </button>

                <button
                  onClick={handleDisconnectActiveFolder}
                  className="w-full sm:w-auto py-3 px-4 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-medium text-sm transition flex items-center justify-center space-x-1.5"
                  title="Disconnect and forget this folder"
                >
                  <Unlink className="w-4 h-4" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          ) : (
            /* Folder Picker & Custom Folder Tabs */
            <div className="space-y-5">
              {/* Tab Switcher */}
              <div className="flex border-b border-slate-200">
                <button
                  onClick={() => setTabMode('LIST')}
                  className={`pb-3 px-4 text-xs font-bold transition flex items-center space-x-1.5 border-b-2 ${
                    tabMode === 'LIST'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Available Folders ({folders.length})</span>
                </button>
                <button
                  onClick={() => setTabMode('CUSTOM')}
                  className={`pb-3 px-4 text-xs font-bold transition flex items-center space-x-1.5 border-b-2 ${
                    tabMode === 'CUSTOM'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Enter Folder Link, ID or Path</span>
                </button>
              </div>

              {tabMode === 'LIST' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search folders by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <button
                      onClick={loadFolders}
                      disabled={loading}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1 py-2 px-2.5 bg-blue-50/60 rounded-xl border border-blue-100"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {loading ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Loading folders...
                    </div>
                  ) : filteredFolders.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-500 text-sm space-y-2">
                      <p>
                        {searchQuery
                          ? 'No folders match your search query.'
                          : 'No folders found in the list.'}
                      </p>
                      <button
                        type="button"
                        onClick={handleRestoreFolders}
                        className="text-xs text-blue-600 hover:underline inline-flex items-center space-x-1 font-medium"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore any previously removed folders</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-2.5 max-h-64 overflow-y-auto pr-1">
                      {filteredFolders.map((folder) => {
                        const isSelected = folder.id === selectedId;
                        return (
                          <div
                            key={folder.id}
                            onClick={() => setSelectedId(folder.id)}
                            className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center space-x-3 group ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-600/20'
                                : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                          >
                            <div
                              className={`p-2.5 rounded-lg flex-shrink-0 ${
                                isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <Folder className="w-5 h-5" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {folder.name}
                              </p>
                              <p className="text-xs text-slate-400 font-mono truncate">
                                {folder.id}
                              </p>
                            </div>

                            {/* Radio indicator */}
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-600 text-white'
                                  : 'border-slate-300'
                              }`}
                            >
                              {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>

                            {/* Remove button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFolder(folder.id, folder.name);
                              }}
                              title="Remove folder from list"
                              className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-60 group-hover:opacity-100 transition flex-shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Restore / Helper note */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span className="text-[11px] text-slate-400">
                      Hover over a folder and click <Trash2 className="w-3 h-3 inline mx-0.5 text-slate-400" /> to remove it from this list.
                    </span>
                    <button
                      type="button"
                      onClick={handleRestoreFolders}
                      className="text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1 hover:underline ml-2"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore removed</span>
                    </button>
                  </div>

                  <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                    {currentFolderId && (
                      <button
                        onClick={() => setIsChangingFolder(false)}
                        className="py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium transition"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={handleConfirmSelect}
                      disabled={saving || !selectedId}
                      className="ml-auto py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition disabled:opacity-50 flex items-center space-x-2"
                    >
                      <span>{saving ? 'Connecting...' : 'Select Google Drive Folder'}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Custom Link / ID / Local Path Tab */
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Folder Link, Google Drive ID, or Local Path
                    </label>
                    <div className="relative">
                      <Link className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        placeholder="https://drive.google.com/drive/folders/... or /path/to/folder"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none transition font-mono"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 space-y-2">
                    <div className="flex items-center space-x-1.5 font-semibold">
                      <HelpCircle className="w-4 h-4 text-blue-600" />
                      <span>How to connect any folder:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                      <li>
                        <strong>Google Drive Link:</strong> Open the folder in Google Drive, copy its URL from your browser address bar, and paste it here.
                      </li>
                      <li>
                        <strong>Google Drive Folder ID:</strong> Paste the 33-character string from the URL (e.g. <code className="bg-white px-1 py-0.5 rounded">1BxiMVs0XRA5...</code>).
                      </li>
                      <li>
                        <strong>Local Path (Dev / Offline):</strong> Enter the path on your computer (e.g. <code className="bg-white px-1 py-0.5 rounded">/home/sreenath/Templates</code>).
                      </li>
                    </ul>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    {currentFolderId && (
                      <button
                        onClick={() => setIsChangingFolder(false)}
                        className="py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium transition"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={handleResolveCustomFolder}
                      disabled={resolvingCustom || !customInput.trim()}
                      className="ml-auto py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition disabled:opacity-50 flex items-center space-x-2"
                    >
                      <span>{resolvingCustom ? 'Connecting...' : 'Connect & Open Folder'}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
