import React, { useState } from 'react';
import { CheckCircle2, XCircle, ArrowLeft, Save, Search, Filter } from 'lucide-react';
import { AttendancePreviewResponse } from '../types';

interface AttendancePreviewModalProps {
  isOpen: boolean;
  preview: AttendancePreviewResponse | null;
  isSaving: boolean;
  onClose: () => void;
  onConfirmSave: () => void;
}

export const AttendancePreviewModal: React.FC<AttendancePreviewModalProps> = ({
  isOpen,
  preview,
  isSaving,
  onClose,
  onConfirmSave,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'ABSENT' | 'PRESENT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen || !preview) return null;

  const filteredStudents = preview.students.filter((st) => {
    if (filter === 'ABSENT' && st.status !== 'ABSENT') return false;
    if (filter === 'PRESENT' && st.status !== 'PRESENT') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        st.name.toLowerCase().includes(q) ||
        st.register_number.includes(q) ||
        st.suffix.includes(q)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-blue-950 text-white flex-shrink-0 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs bg-blue-500/30 text-blue-300 font-semibold px-2 py-0.5 rounded border border-blue-400/30 uppercase tracking-wide">
                Review Before Saving
              </span>
              {preview.entry_mode && (
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded border uppercase tracking-wide ${
                    preview.entry_mode === 'PRESENT'
                      ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400/30'
                      : 'bg-rose-500/30 text-rose-300 border-rose-400/30'
                  }`}
                >
                  {preview.entry_mode === 'PRESENT' ? 'Mode: Presentees Entered' : 'Mode: Absentees Entered'}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold mt-1 text-white tracking-tight">
              Attendance Preview
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {preview.class_name} {preview.section} • {preview.subject_code} - {preview.subject_name}
            </p>
          </div>

          <div className="flex items-center space-x-2 text-right">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2">
              <div className="text-xs text-slate-400">Date & Period</div>
              <div className="text-sm font-semibold text-white">
                {preview.date} • Period {preview.period}
              </div>
            </div>
          </div>
        </div>

        {/* Metric Cards Banner */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 grid grid-cols-3 gap-4 flex-shrink-0">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Enrolled</div>
            <div className="text-2xl font-bold text-slate-800 mt-0.5">{preview.total_students}</div>
          </div>
          <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 shadow-sm text-center">
            <div className="text-xs text-emerald-700 font-medium uppercase tracking-wider">Present</div>
            <div className="text-2xl font-bold text-emerald-700 mt-0.5">{preview.present_count}</div>
          </div>
          <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200 shadow-sm text-center">
            <div className="text-xs text-rose-700 font-medium uppercase tracking-wider">Absent</div>
            <div className="text-2xl font-bold text-rose-700 mt-0.5">{preview.absent_count}</div>
          </div>
        </div>

        {/* Duplicate Overwrite Warning Banner if Applicable */}
        {preview.duplicate_warning && (
          <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 flex items-center justify-between">
            <span>
              <strong>Overwrite Notice:</strong> Saving will overwrite the existing attendance session for {preview.date} (Period {preview.period}) in <strong>Col {preview.existing_session_col_letter}</strong>.
            </span>
          </div>
        )}

        {/* Toolbar: Search & Filters */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, reg no, suffix..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-1.5 self-end sm:self-auto">
            <span className="text-xs text-slate-400 mr-1 flex items-center">
              <Filter className="w-3 h-3 mr-1" /> View:
            </span>
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                filter === 'ALL'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({preview.total_students})
            </button>
            <button
              onClick={() => setFilter('ABSENT')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                filter === 'ABSENT'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              Absentees ({preview.absent_count})
            </button>
            <button
              onClick={() => setFilter('PRESENT')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                filter === 'PRESENT'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              Present ({preview.present_count})
            </button>
          </div>
        </div>

        {/* Student Table */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4 w-12 text-center">S.No</th>
                  <th className="py-2.5 px-4">Register Number</th>
                  <th className="py-2.5 px-3 text-center">Suffix</th>
                  <th className="py-2.5 px-4">Student Name</th>
                  <th className="py-2.5 px-4 text-center">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No students found matching your filter.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st) => {
                    const isAbsent = st.status === 'ABSENT';
                    return (
                      <tr
                        key={st.register_number}
                        className={`transition ${
                          isAbsent
                            ? 'bg-rose-50/50 hover:bg-rose-50 font-medium'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 px-4 text-center text-slate-500">{st.sno}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-700">{st.register_number}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`font-mono px-2 py-0.5 rounded text-[11px] font-bold ${
                              isAbsent
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {st.suffix}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-800">{st.name}</td>
                        <td className="py-2.5 px-4 text-center">
                          {isAbsent ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-600 text-white shadow-xs">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>ABSENT</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>PRESENT</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs sm:text-sm transition flex items-center space-x-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Edit Attendance</span>
          </button>

          <button
            onClick={onConfirmSave}
            disabled={isSaving}
            className={`px-6 py-2.5 rounded-lg text-white font-semibold text-xs sm:text-sm transition shadow-sm flex items-center space-x-2 disabled:opacity-50 ${
              preview.duplicate_warning
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{preview.duplicate_warning ? 'Overwriting...' : 'Saving to Google Drive...'}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{preview.duplicate_warning ? 'Confirm & Overwrite Session' : 'Confirm & Save Attendance'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
