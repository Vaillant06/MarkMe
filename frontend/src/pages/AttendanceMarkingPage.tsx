import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  AlertCircle,
  Eye,
  ArrowLeft,
  FileSpreadsheet,
  Info
} from 'lucide-react';
import { api } from '../api/client';
import {
  DriveFile,
  WorkbookDetails,
  SubjectInfo,
  AttendancePreviewResponse,
  AttendanceCommitResponse
} from '../types';
import { AttendancePreviewModal } from '../components/AttendancePreviewModal';
import { DuplicateWarningModal } from '../components/DuplicateWarningModal';

interface AttendanceMarkingPageProps {
  file: DriveFile;
  onBackToFileSelect: () => void;
  onCommitSuccess: (res: AttendanceCommitResponse) => void;
}

export const AttendanceMarkingPage: React.FC<AttendanceMarkingPageProps> = ({
  file,
  onBackToFileSelect,
  onCommitSuccess,
}) => {
  const [details, setDetails] = useState<WorkbookDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form Fields
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    // Default to 2026-09-10 or current date
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${d}/${m}/${y}`;
  });
  const [period, setPeriod] = useState<string>('3');
  const [entryMode, setEntryMode] = useState<'ABSENT' | 'PRESENT'>('ABSENT');
  const [studentInput, setStudentInput] = useState<string>('067, 080, 114, 129');

  // Preview & Commit States
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<AttendancePreviewResponse | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Duplicate Warning Modal State
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  useEffect(() => {
    loadWorkbook();
  }, [file.id]);

  const loadWorkbook = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.getWorkbookDetails(file.id);
      setDetails(data);
      if (data.subjects.length > 0) {
        // Default to UIT3562 if available, or first subject
        const defaultSub = data.subjects.find((s) => s.code === 'UIT3562') || data.subjects[0];
        setSelectedSheet(defaultSub.sheet_name);
      }
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load workbook details.');
    } finally {
      setLoading(false);
    }
  };

  const currentSubject: SubjectInfo | undefined = useMemo(() => {
    return details?.subjects.find((s) => s.sheet_name === selectedSheet);
  }, [details, selectedSheet]);

  // Client-side quick validation of tokens
  const tokenValidation = useMemo(() => {
    if (!studentInput.trim()) return { tokens: [], duplicates: [], invalids: [] };
    const rawTokens = studentInput.split(/[, \t\r\n]+/).filter(Boolean);
    const seen = new Set<string>();
    const duplicates: string[] = [];
    const invalids: string[] = [];
    const validTokens: string[] = [];

    for (const t of rawTokens) {
      if (!/^\d{3}$/.test(t)) {
        invalids.push(t);
      } else if (seen.has(t)) {
        duplicates.push(t);
      } else {
        seen.add(t);
        validTokens.push(t);
      }
    }
    return { tokens: validTokens, duplicates, invalids };
  }, [studentInput]);

  const handleGeneratePreview = async () => {
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const res = await api.generatePreview({
        file_id: file.id,
        sheet_name: selectedSheet,
        date: date.trim(),
        period: period.trim(),
        student_input: studentInput.trim(),
        absent_input: studentInput.trim(),
        entry_mode: entryMode,
      });

      setPreviewData(res);

      if (res.duplicate_warning) {
        // Session already exists: prompt user with Duplicate Warning Modal first!
        setIsDuplicateModalOpen(true);
      } else {
        setIsPreviewOpen(true);
      }
    } catch (err: any) {
      if (err.data && err.data.errors) {
        setPreviewError(err.data.errors.join(' • '));
      } else {
        setPreviewError(err.message || 'Failed to generate preview.');
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmSave = async (overwrite: boolean = false) => {
    if (!previewData) return;
    setIsSaving(true);
    try {
      const commitRes = await api.commitAttendance({
        file_id: file.id,
        sheet_name: selectedSheet,
        date: previewData.date,
        period: previewData.period,
        absent_suffixes: previewData.absent_suffixes,
        allow_overwrite: overwrite,
        target_col_idx: previewData.existing_session_col,
      });

      setIsPreviewOpen(false);
      setIsDuplicateModalOpen(false);
      onCommitSuccess(commitRes);
    } catch (err: any) {
      alert(`Commit error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-base font-semibold text-slate-800">Reading attendance workbook...</p>
        <p className="text-xs text-slate-500 mt-1">
          Extracting subject sheets, student rosters, and session columns...
        </p>
      </div>
    );
  }

  if (loadError || !details) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-rose-800">
          <AlertCircle className="w-8 h-8 mx-auto text-rose-600 mb-2" />
          <h3 className="font-bold text-base">Unable to Load Workbook</h3>
          <p className="text-xs mt-1 text-rose-700">{loadError}</p>
          <button
            onClick={onBackToFileSelect}
            className="mt-4 px-4 py-2 bg-white border border-rose-300 rounded-lg text-xs font-semibold text-rose-800 hover:bg-rose-100"
          >
            Select Another File
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Top Breadcrumb Bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBackToFileSelect}
          className="flex items-center space-x-1.5 text-xs text-slate-600 hover:text-slate-900 transition font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Change Workbook</span>
        </button>

        <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1 rounded-full text-xs text-slate-700 border border-slate-200">
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          <span className="font-semibold truncate max-w-xs">{file.name}</span>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-blue-950 px-8 py-6 text-white">
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-blue-300">
            <span>Step 3 of 3</span>
            <span>•</span>
            <span>Attendance Entry</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 tracking-tight text-white">
            Mark Session Attendance
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Class: <span className="font-semibold text-white">{details.class_name} {details.section}</span> • Academic Year: <span className="font-semibold text-white">{details.academic_year}</span>
          </p>
        </div>

        {/* Form Body */}
        <div className="p-8 space-y-6">
          {previewError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-3 animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
              <div>
                <p className="font-bold">Validation Error</p>
                <p className="mt-0.5">{previewError}</p>
              </div>
            </div>
          )}

          {/* Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Subject Dropdown */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Subject
              </label>
              <div className="relative">
                <select
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none transition"
                >
                  {details.subjects.map((sub) => (
                    <option key={sub.sheet_name} value={sub.sheet_name}>
                      {sub.code} — {sub.name} ({sub.faculty_name || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>
              {currentSubject && (
                <div className="flex items-center space-x-4 text-xs text-slate-500 pt-1">
                  <span>Enrolled: <strong className="text-slate-800">{currentSubject.student_count}</strong> students</span>
                  <span>•</span>
                  <span>Previous Sessions: <strong className="text-slate-800">{currentSubject.existing_sessions.length}</strong></span>
                  <span>•</span>
                  <span>Next Column: <strong className="text-blue-600 font-mono">Col {currentSubject.next_available_col_letter}</strong></span>
                </div>
              )}
            </div>

            {/* Date Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Date (DD/MM/YYYY)
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="10/09/2026"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none transition font-mono"
                />
              </div>
            </div>

            {/* Period Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Period / Hour
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none transition"
                >
                  <option value="1">Period 1 (1st Hour)</option>
                  <option value="2">Period 2 (2nd Hour)</option>
                  <option value="3">Period 3 (3rd Hour)</option>
                  <option value="4">Period 4 (4th Hour)</option>
                  <option value="5">Period 5 (5th Hour)</option>
                  <option value="6">Period 6 (6th Hour)</option>
                  <option value="7">Period 7 (7th Hour)</option>
                  <option value="8">Period 8 (8th Hour)</option>
                </select>
              </div>
            </div>

            {/* Student Register Suffixes Input */}
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {entryMode === 'ABSENT' ? 'Absent Students' : 'Present Students'} (Last 3 Digits of Register Numbers)
                </label>

                {/* Slider Switch */}
                <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                  <span
                    className={`text-xs font-bold cursor-pointer select-none transition-colors ${
                      entryMode === 'ABSENT' ? 'text-rose-700' : 'text-slate-400 hover:text-slate-600'
                    }`}
                    onClick={() => setEntryMode('ABSENT')}
                  >
                    Absentees
                  </span>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={entryMode === 'PRESENT'}
                    aria-label="Toggle between marking absentees and presentees"
                    onClick={() => setEntryMode(entryMode === 'ABSENT' ? 'PRESENT' : 'ABSENT')}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      entryMode === 'PRESENT' ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        entryMode === 'PRESENT' ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>

                  <span
                    className={`text-xs font-bold cursor-pointer select-none transition-colors ${
                      entryMode === 'PRESENT' ? 'text-emerald-700' : 'text-slate-400 hover:text-slate-600'
                    }`}
                    onClick={() => setEntryMode('PRESENT')}
                  >
                    Presentees
                  </span>
                </div>
              </div>

              <div className="relative">
                <textarea
                  rows={3}
                  value={studentInput}
                  onChange={(e) => setStudentInput(e.target.value)}
                  placeholder={
                    entryMode === 'ABSENT'
                      ? 'e.g. 067, 080, 114, 129 (students who are absent)'
                      : 'e.g. 001, 002, 003, 005 (students who are present)'
                  }
                  className={`w-full bg-slate-50 border rounded-2xl p-4 text-base font-mono text-slate-900 focus:bg-white outline-none transition leading-relaxed shadow-inner ${
                    entryMode === 'ABSENT'
                      ? 'border-slate-300 focus:ring-2 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-2 focus:ring-emerald-500'
                  }`}
                />
              </div>

              {/* Live Input Helper Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-slate-500 font-medium mr-1">
                  Parsed {entryMode === 'ABSENT' ? 'Absentees' : 'Presentees'} ({tokenValidation.tokens.length}):
                </span>
                {tokenValidation.tokens.length === 0 && (
                  <span className="text-xs text-slate-400 italic">
                    {entryMode === 'ABSENT'
                      ? 'No absentees entered (all students will be marked present).'
                      : 'No presentees entered (all students will be marked absent).'}
                  </span>
                )}
                {tokenValidation.tokens.map((t) => (
                  <span
                    key={t}
                    className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                      entryMode === 'ABSENT'
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    <span>{entryMode === 'ABSENT' ? '✕' : '✓'}</span>
                    <span>{t}</span>
                  </span>
                ))}
                {tokenValidation.invalids.map((inv, idx) => (
                  <span
                    key={`inv-${idx}`}
                    className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300 line-through"
                    title="Not a 3-digit number"
                  >
                    <span>{inv} (invalid)</span>
                  </span>
                ))}
                {tokenValidation.duplicates.map((dup, idx) => (
                  <span
                    key={`dup-${idx}`}
                    className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300"
                    title="Duplicate suffix"
                  >
                    <span>{dup} (duplicate)</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Helper Box */}
          <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-start space-x-3 text-xs text-blue-900">
            <Info className="w-4 h-4 flex-shrink-0 text-blue-600 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Attendance Preview Required:</strong> Submitting this form does not immediately modify Google Drive. You will review the full present/absent student breakdown before confirming changes.
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              onClick={handleGeneratePreview}
              disabled={previewLoading || tokenValidation.invalids.length > 0 || tokenValidation.duplicates.length > 0}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {previewLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Generating Preview...</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  <span>Generate Preview</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <AttendancePreviewModal
        isOpen={isPreviewOpen}
        preview={previewData}
        isSaving={isSaving}
        onClose={() => setIsPreviewOpen(false)}
        onConfirmSave={() => handleConfirmSave(Boolean(previewData?.duplicate_warning))}
      />

      {/* Duplicate Warning Modal */}
      <DuplicateWarningModal
        isOpen={isDuplicateModalOpen}
        isSaving={isSaving}
        subjectCode={previewData?.subject_code || selectedSheet}
        date={date}
        period={period}
        colLetter={previewData?.existing_session_col_letter}
        onCancel={() => setIsDuplicateModalOpen(false)}
        onProceedOverwrite={() => handleConfirmSave(true)}
        onReviewPreview={() => {
          setIsDuplicateModalOpen(false);
          setIsPreviewOpen(true);
        }}
      />
    </div>
  );
};
