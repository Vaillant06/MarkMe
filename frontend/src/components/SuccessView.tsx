import React from 'react';
import { CheckCircle, ArrowRight, Calendar, Clock, BookOpen, ExternalLink } from 'lucide-react';
import { AttendanceCommitResponse } from '../types';

interface SuccessViewProps {
  result: AttendanceCommitResponse;
  fileName: string;
  fileId?: string;
  onReset: () => void;
}

export const SuccessView: React.FC<SuccessViewProps> = ({ result, fileName, fileId, onReset }) => {
  const isGoogleDriveFile = fileId && !fileId.startsWith('locf_') && !fileId.startsWith('local');
  const googleSheetsUrl = isGoogleDriveFile ? `https://docs.google.com/spreadsheets/d/${fileId}/edit` : null;

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl shadow-xl border border-emerald-200 overflow-hidden text-center animate-fade-in">
        {/* Banner */}
        <div className="bg-gradient-to-b from-emerald-600 to-emerald-700 p-8 text-white">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg text-emerald-600">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Attendance Saved Successfully</h2>
          <p className="text-emerald-100 text-xs mt-1">
            {isGoogleDriveFile
              ? 'The updated workbook revision has been committed to Google Drive.'
              : 'The updated workbook has been saved back to your files.'}
          </p>
        </div>

        <div className="p-8 space-y-6">
          {/* Details Card */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-left space-y-3 text-sm">
            <div className="flex items-center space-x-2.5 text-slate-700">
              <BookOpen className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span className="font-semibold">{result.subject_code}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500 font-mono text-xs truncate">{fileName}</span>
            </div>

            <div className="flex items-center space-x-2.5 text-slate-700">
              <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>{result.date}</span>
              <span className="text-slate-400">•</span>
              <span className="font-semibold">Period {result.period}</span>
            </div>

            <div className="flex items-center space-x-2.5 text-slate-700">
              <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>Updated Column:</span>
              <span className="font-mono font-bold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded text-xs">
                Col {result.target_col_letter}
              </span>
            </div>
          </div>

          {/* Counts */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
              <div className="text-xs text-emerald-700 font-medium uppercase tracking-wider">Present</div>
              <div className="text-3xl font-extrabold text-emerald-700 mt-1">{result.present_count}</div>
            </div>
            <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100">
              <div className="text-xs text-rose-700 font-medium uppercase tracking-wider">Absent</div>
              <div className="text-3xl font-extrabold text-rose-700 mt-1">{result.absent_count}</div>
            </div>
          </div>

          <div className="pt-2 space-y-3">
            {googleSheetsUrl && (
              <a
                href={googleSheetsUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 px-6 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-sm transition flex items-center justify-center space-x-2 shadow-xs"
              >
                <span>Open in Google Sheets / Drive</span>
                <ExternalLink className="w-4 h-4 text-emerald-700" />
              </a>
            )}

            <button
              onClick={onReset}
              className="w-full py-3 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-md transition flex items-center justify-center space-x-2"
            >
              <span>Mark Another Session</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
