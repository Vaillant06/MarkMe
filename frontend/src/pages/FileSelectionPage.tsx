import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, ArrowLeft, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import { DriveFile } from '../types';

interface FileSelectionPageProps {
  folderName: string;
  onBackToDriveSetup: () => void;
  onFileSelected: (file: DriveFile) => void;
}

export const FileSelectionPage: React.FC<FileSelectionPageProps> = ({
  folderName,
  onBackToDriveSetup,
  onFileSelected,
}) => {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string>('');

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listFiles();
      setFiles(data);
      if (data.length > 0) {
        setSelectedFileId(data[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to list Excel files from Drive folder.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = () => {
    const file = files.find((f) => f.id === selectedFileId);
    if (file) {
      onFileSelected(file);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-slate-900 px-8 py-6 text-white">
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-blue-300">
            <span>Step 2 of 3</span>
            <span>•</span>
            <span>Workbook Selection</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 tracking-tight text-white">
            Select Attendance Workbook
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Folder: <span className="font-semibold text-white">{folderName}</span>
          </p>
        </div>

        <div className="p-8 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">
              Excel Workbooks in Folder (.xlsx):
            </span>
            <button
              onClick={loadFiles}
              disabled={loading}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading Excel files...
            </div>
          ) : files.length === 0 ? (
            <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-500 text-sm">
              No `.xlsx` attendance files found in this folder.
            </div>
          ) : (
            <div className="grid gap-3 max-h-72 overflow-y-auto pr-1">
              {files.map((file) => {
                const isSelected = file.id === selectedFileId;
                return (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFileId(file.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition flex items-center space-x-3.5 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/40 shadow-xs ring-1 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div
                      className={`p-3 rounded-xl ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{file.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {file.size || '218 KB'} • Last modified: {file.modified_time?.split('T')[0] || 'Recent'}
                      </p>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={onBackToDriveSetup}
              className="py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium transition flex items-center space-x-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Folder Setup</span>
            </button>

            <button
              onClick={handleSelect}
              disabled={loading || !selectedFileId}
              className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition disabled:opacity-50 flex items-center space-x-2"
            >
              <span>Select Workbook</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
