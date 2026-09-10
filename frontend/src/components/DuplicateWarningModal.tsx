import React from 'react';
import { AlertTriangle, X, Check, Eye } from 'lucide-react';

interface DuplicateWarningModalProps {
  isOpen: boolean;
  isSaving?: boolean;
  subjectCode: string;
  date: string;
  period: string;
  colLetter?: string;
  onCancel: () => void;
  onProceedOverwrite: () => void;
  onReviewPreview?: () => void;
}

export const DuplicateWarningModal: React.FC<DuplicateWarningModalProps> = ({
  isOpen,
  isSaving = false,
  subjectCode,
  date,
  period,
  colLetter,
  onCancel,
  onProceedOverwrite,
  onReviewPreview,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 max-w-md w-full overflow-hidden">
        <div className="p-6 bg-amber-50/70 border-b border-amber-100 flex items-start space-x-4">
          <div className="p-3 bg-amber-100 text-amber-700 rounded-xl flex-shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Attendance Already Exists</h3>
            <p className="text-xs text-amber-800 mt-1">
              A record already exists in the workbook for this exact session.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Subject:</span>
              <span className="font-semibold text-slate-800">{subjectCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date:</span>
              <span className="font-semibold text-slate-800">{date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Period:</span>
              <span className="font-semibold text-slate-800">{period}</span>
            </div>
            {colLetter && (
              <div className="flex justify-between">
                <span className="text-slate-500">Workbook Column:</span>
                <span className="font-semibold text-blue-600 font-mono">Col {colLetter}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Overwriting will update the existing column in the Excel workbook. If you did not intend to modify previous attendance, click <span className="font-semibold">Cancel</span>.
          </p>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs sm:text-sm transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>

            {onReviewPreview && (
              <button
                type="button"
                onClick={onReviewPreview}
                disabled={isSaving}
                className="px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-medium text-xs sm:text-sm transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                <Eye className="w-4 h-4" />
                <span>Review Preview</span>
              </button>
            )}

            <button
              type="button"
              onClick={onProceedOverwrite}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs sm:text-sm transition shadow-sm flex items-center justify-center space-x-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Overwriting...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirm & Overwrite</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
