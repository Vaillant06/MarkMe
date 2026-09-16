import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  FileSpreadsheet,
  Users,
  Calendar,
  Percent,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ArrowUpDown,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { api } from '../api/client';
import {
  DriveFile,
  WorkbookDetails,
  SubjectStatisticsResponse,
  SessionStatisticsItem,
} from '../types';
import {
  getPersistedWorkflowState,
  setPersistedWorkflowState,
  getAttendanceDraft,
  saveAttendanceDraft,
} from '../utils/workflowState';

interface StatisticsPageProps {
  file: DriveFile;
  initialSubject?: string;
  onBackToAttendance: (selectedSubject?: string) => void;
}

type SortField = 'date' | 'period' | 'present' | 'absent' | 'attendance';
type SortOrder = 'asc' | 'desc';

export const StatisticsPage: React.FC<StatisticsPageProps> = ({
  file,
  initialSubject,
  onBackToAttendance,
}) => {
  // Workbook details for subject dropdown
  const [workbookDetails, setWorkbookDetails] = useState<WorkbookDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(true);

  // Selected subject sheet
  const [selectedSheet, setSelectedSheet] = useState<string>(() => {
    if (initialSubject) return initialSubject;
    const persisted = getPersistedWorkflowState();
    if (persisted.subject) return persisted.subject;
    const draft = getAttendanceDraft(file.id);
    return draft?.selectedSheet || '';
  });

  // Configurable attendance threshold (default: 75%)
  const [threshold, setThreshold] = useState<number>(75.0);

  // Statistics state
  const [stats, setStats] = useState<SubjectStatisticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Table sorting state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Trend chart tooltip hover state
  const [hoveredSession, setHoveredSession] = useState<SessionStatisticsItem | null>(null);

  // 1. Load workbook details to populate subject dropdown
  useEffect(() => {
    let isMounted = true;
    const loadWorkbook = async () => {
      setDetailsLoading(true);
      try {
        const wb = await api.getWorkbookDetails(file.id);
        if (!isMounted) return;
        setWorkbookDetails(wb);

        if (wb.subjects.length > 0) {
          // If no selected sheet or current selection not in workbook, default to first or UIT3562
          const exists = wb.subjects.some((s) => s.sheet_name === selectedSheet);
          if (!selectedSheet || !exists) {
            const preferred =
              wb.subjects.find((s) => s.code === 'UIT3562') || wb.subjects[0];
            setSelectedSheet(preferred.sheet_name);
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Failed to load workbook details.');
      } finally {
        if (isMounted) setDetailsLoading(false);
      }
    };

    loadWorkbook();
    return () => {
      isMounted = false;
    };
  }, [file.id]);

  // 2. Whenever selectedSheet or threshold changes, fetch statistics
  useEffect(() => {
    if (!selectedSheet) return;

    let isMounted = true;
    const loadStats = async () => {
      setLoading(true);
      setError(null);
      try {
        // Persist selected subject in workflow state and update URL
        setPersistedWorkflowState({ subject: selectedSheet });

        const data = await api.getSubjectStatistics(file.id, selectedSheet, threshold);
        if (!isMounted) return;
        setStats(data);
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Failed to calculate subject statistics.');
        setStats(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadStats();
    return () => {
      isMounted = false;
    };
  }, [file.id, selectedSheet, threshold]);

  // Handle subject change from dropdown
  const handleSubjectChange = (newSheet: string) => {
    setSelectedSheet(newSheet);
    // Also sync with attendance draft so returning to attendance respects this subject
    const draft = getAttendanceDraft(file.id) || {};
    saveAttendanceDraft(file.id, { ...draft, selectedSheet: newSheet });
  };

  // Return to attendance page preserving workbook and current subject
  const handleBack = () => {
    onBackToAttendance(selectedSheet);
  };

  // Sorted sessions for the Session Summary Table
  const sortedSessions = useMemo(() => {
    if (!stats || !stats.sessions) return [];
    const list = [...stats.sessions];

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date':
          cmp = a.col_idx - b.col_idx;
          break;
        case 'period':
          cmp = (parseInt(a.period, 10) || 0) - (parseInt(b.period, 10) || 0);
          break;
        case 'present':
          cmp = a.present_count - b.present_count;
          break;
        case 'absent':
          cmp = a.absent_count - b.absent_count;
          break;
        case 'attendance':
          cmp = a.attendance_percentage - b.attendance_percentage;
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [stats, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Action / Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <button
          onClick={handleBack}
          data-testid="back-to-attendance-top"
          className="flex items-center space-x-1.5 text-xs text-slate-600 hover:text-slate-900 transition font-medium cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Attendance</span>
        </button>

        <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1 rounded-full text-xs text-slate-700 border border-slate-200">
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          <span className="font-semibold truncate max-w-xs">{file.name}</span>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Dark Navy Header with Controls */}
        <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-blue-950 px-6 sm:px-8 py-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-blue-300">
                <span>Analytics & Insights</span>
                <span>•</span>
                <span>Level 1 Statistics</span>
              </div>
              <h1 className="text-2xl font-bold mt-1 tracking-tight text-white">
                Subject Statistics
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                Workbook: <span className="font-semibold text-white">{file.name}</span>
                {stats && stats.class_section && (
                  <>
                    {' '}
                    • Class:{' '}
                    <span className="font-semibold text-white">
                      {stats.class_section}
                    </span>
                  </>
                )}
                {stats && stats.academic_year && (
                  <>
                    {' '}
                    • Academic Year:{' '}
                    <span className="font-semibold text-white">
                      {stats.academic_year}
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* Subject Selector & Threshold Config */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Subject Dropdown */}
              <div className="relative min-w-[200px] sm:min-w-[260px]">
                <label className="block text-[10px] font-bold text-blue-300 uppercase tracking-wider mb-1">
                  Subject
                </label>
                <div className="relative">
                  <select
                    value={selectedSheet}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    disabled={detailsLoading || !workbookDetails}
                    data-testid="subject-select"
                    className="w-full appearance-none bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-xl pl-3.5 pr-8 py-2.5 focus:ring-2 focus:ring-blue-400 outline-none transition cursor-pointer disabled:opacity-50"
                  >
                    {detailsLoading ? (
                      <option>Loading subjects...</option>
                    ) : (
                      workbookDetails?.subjects.map((s) => (
                        <option key={s.sheet_name} value={s.sheet_name}>
                          {s.code} — {s.name}
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Configurable Threshold Toggle */}
              <div className="min-w-[130px]">
                <label className="block text-[10px] font-bold text-blue-300 uppercase tracking-wider mb-1 flex items-center space-x-1">
                  <Sliders className="w-3 h-3" />
                  <span>Threshold</span>
                </label>
                <div className="flex items-center space-x-1 bg-slate-800/90 border border-slate-700 rounded-xl p-1">
                  {[75, 80, 85].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setThreshold(t)}
                      className={`px-2 py-1 text-xs font-bold rounded-lg transition ${
                        threshold === t
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {t}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Body */}
        <div className="p-6 sm:p-8 space-y-8">
          {/* Loading Indicator */}
          {loading && (
            <div className="py-12 text-center space-y-3">
              <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-700">
                Loading subject statistics...
              </p>
              <p className="text-xs text-slate-400">
                Reading attendance marks and calculating analytics for {selectedSheet}
              </p>
            </div>
          )}

          {/* Error View */}
          {error && !loading && (
            <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-sm">Unable to load statistics</p>
                <p className="mt-0.5">{error}</p>
                <button
                  onClick={() => setSelectedSheet(selectedSheet)}
                  className="mt-3 px-3 py-1.5 bg-white border border-rose-300 rounded-lg text-xs font-semibold text-rose-800 hover:bg-rose-100 flex items-center space-x-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Calculation</span>
                </button>
              </div>
            </div>
          )}

          {/* Empty Sessions Notice */}
          {stats && !stats.has_sessions && !loading && !error && (
            <div className="p-10 text-center bg-amber-50/60 rounded-3xl border border-amber-200 text-amber-900 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-amber-900">
                  No Recorded Sessions
                </h3>
                <p className="text-xs text-amber-700 mt-1 max-w-md mx-auto">
                  {stats.message ||
                    'No attendance sessions have been recorded for this subject.'}
                </p>
              </div>
            </div>
          )}

          {/* Core Statistics Content (When stats are loaded) */}
          {stats && !loading && !error && (
            <>
              {/* Section 3: Summary Cards */}
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Card 1: Total Students */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex items-center justify-between shadow-xs">
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Total Students
                      </p>
                      <p className="text-2xl font-black text-slate-900 mt-1">
                        {stats.total_students}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Enrolled in roster</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                      <Users className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Card 2: Total Sessions */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex items-center justify-between shadow-xs">
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Total Sessions
                      </p>
                      <p className="text-2xl font-black text-slate-900 mt-1">
                        {stats.total_sessions}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Hours conducted</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-slate-200/80 text-slate-700 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Card 3: Average Attendance */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex items-center justify-between shadow-xs">
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Average Attendance
                      </p>
                      <p
                        className={`text-2xl font-black mt-1 ${
                          stats.average_attendance >= threshold
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {stats.average_attendance.toFixed(1)}%
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Mean of student percentages
                      </p>
                    </div>
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        stats.average_attendance >= threshold
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      <Percent className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Card 4: Total Present */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex items-center justify-between shadow-xs">
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Total Present
                      </p>
                      <p className="text-2xl font-black text-emerald-700 mt-1">
                        {stats.total_present.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {stats.present_percentage.toFixed(1)}% of recorded marks
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Card 5: Total Absent */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex items-center justify-between shadow-xs">
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Total Absent
                      </p>
                      <p className="text-2xl font-black text-rose-700 mt-1">
                        {stats.total_absent.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {stats.absent_percentage.toFixed(1)}% of recorded marks
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0">
                      <XCircle className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Card 6: Students Below Threshold */}
                  <div
                    className={`border rounded-2xl p-5 flex items-center justify-between shadow-xs transition ${
                      stats.below_threshold_count > 0
                        ? 'bg-amber-50/50 border-amber-200'
                        : 'bg-slate-50 border-slate-200/80'
                    }`}
                  >
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Below {threshold}%
                      </p>
                      <p
                        className={`text-2xl font-black mt-1 ${
                          stats.below_threshold_count > 0
                            ? 'text-amber-700'
                            : 'text-slate-900'
                        }`}
                      >
                        {stats.below_threshold_count}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Students needing attendance alert
                      </p>
                    </div>
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        stats.below_threshold_count > 0
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Attendance Trend (Line Chart) */}
              {stats.sessions.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 tracking-tight">
                        Attendance Trend
                      </h2>
                      <p className="text-xs text-slate-500">
                        Session-by-session attendance percentage over time
                      </p>
                    </div>

                    <div className="flex items-center space-x-3 text-xs text-slate-600">
                      <span className="flex items-center space-x-1.5">
                        <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
                        <span>Session Attendance %</span>
                      </span>
                      <span className="flex items-center space-x-1.5">
                        <span className="w-4 h-0.5 border-t-2 border-dashed border-rose-500 inline-block" />
                        <span>{threshold}% Threshold</span>
                      </span>
                    </div>
                  </div>

                  {/* SVG Responsive Line Chart */}
                  <div className="relative pt-2">
                    <TrendLineChart
                      sessions={stats.sessions}
                      threshold={threshold}
                      onHoverSession={setHoveredSession}
                    />

                    {/* Interactive Tooltip Card on Hover */}
                    {hoveredSession && (
                      <div className="mt-3 p-3 bg-white border border-slate-200 rounded-xl shadow-md text-xs flex flex-wrap items-center justify-between gap-4 animate-fade-in">
                        <div className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                          <span className="font-bold text-slate-900">
                            {hoveredSession.date || 'Col ' + hoveredSession.col_letter} — Hour{' '}
                            {hoveredSession.period}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-slate-600">
                          <span>
                            Attendance:{' '}
                            <strong
                              className={
                                hoveredSession.attendance_percentage >= threshold
                                  ? 'text-emerald-700'
                                  : 'text-rose-700'
                              }
                            >
                              {hoveredSession.attendance_percentage.toFixed(1)}%
                            </strong>
                          </span>
                          <span>
                            Present:{' '}
                            <strong className="text-emerald-700">
                              {hoveredSession.present_count}
                            </strong>
                          </span>
                          <span>
                            Absent:{' '}
                            <strong className="text-rose-700">
                              {hoveredSession.absent_count}
                            </strong>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sections 5 & 6: Attendance Distribution & Overall Attendance */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Section 5: Attendance Distribution (Bar Chart) */}
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-4 flex flex-col justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                      Attendance Distribution
                    </h2>
                    <p className="text-xs text-slate-500">
                      Breakdown of students grouped by individual attendance range
                    </p>
                  </div>

                  <div className="space-y-3.5 pt-2">
                    <DistributionBar
                      label="90–100%"
                      count={stats.distribution_90_100}
                      total={stats.total_students}
                      colorClass="bg-emerald-600"
                      textClass="text-emerald-800"
                    />
                    <DistributionBar
                      label="80–89%"
                      count={stats.distribution_80_89}
                      total={stats.total_students}
                      colorClass="bg-blue-600"
                      textClass="text-blue-800"
                    />
                    <DistributionBar
                      label="75–79%"
                      count={stats.distribution_75_79}
                      total={stats.total_students}
                      colorClass="bg-amber-500"
                      textClass="text-amber-800"
                    />
                    <DistributionBar
                      label="Below 75%"
                      count={stats.distribution_below_75}
                      total={stats.total_students}
                      colorClass="bg-rose-600"
                      textClass="text-rose-800"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-200 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Mutually exclusive ranges</span>
                    <span>Total students: {stats.total_students}</span>
                  </div>
                </div>

                {/* Section 6: Overall Attendance (Part-to-Whole) */}
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-4 flex flex-col justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                      Overall Attendance
                    </h2>
                    <p className="text-xs text-slate-500">
                      Aggregate proportion of Present vs Absent attendance entries
                    </p>
                  </div>

                  {/* Donut Chart Visualization */}
                  <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
                    <DonutChart
                      presentPct={stats.present_percentage}
                      absentPct={stats.absent_percentage}
                    />

                    {/* Breakdown legend */}
                    <div className="space-y-4 min-w-[160px]">
                      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
                        <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-800">
                          <span className="w-3 h-3 rounded-full bg-emerald-600" />
                          <span>Present</span>
                        </div>
                        <p className="text-xl font-black text-slate-900 mt-1">
                          {stats.total_present.toLocaleString()}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {stats.present_percentage.toFixed(1)}% of total entries
                        </p>
                      </div>

                      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
                        <div className="flex items-center space-x-2 text-xs font-semibold text-rose-800">
                          <span className="w-3 h-3 rounded-full bg-rose-600" />
                          <span>Absent</span>
                        </div>
                        <p className="text-xl font-black text-slate-900 mt-1">
                          {stats.total_absent.toLocaleString()}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {stats.absent_percentage.toFixed(1)}% of total entries
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>
                      Total Recorded Entries:{' '}
                      {(stats.total_present + stats.total_absent).toLocaleString()}
                    </span>
                    {stats.unexpected_values_count > 0 && (
                      <span className="text-amber-600">
                        {stats.unexpected_values_count} non-standard values ignored
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 7: Session Summary Table */}
              {stats.sessions.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 tracking-tight">
                        Session Summary
                      </h2>
                      <p className="text-xs text-slate-500">
                        Exact counts and attendance percentages per conducted session
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      {sortedSessions.length} recorded sessions
                    </span>
                  </div>

                  {/* Compact Responsive Table */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-100/90 text-slate-800 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                        <tr>
                          <th
                            onClick={() => toggleSort('date')}
                            className="px-4 py-3.5 cursor-pointer hover:bg-slate-200/70 transition select-none"
                          >
                            <div className="flex items-center space-x-1">
                              <span>Date</span>
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </div>
                          </th>
                          <th
                            onClick={() => toggleSort('period')}
                            className="px-4 py-3.5 cursor-pointer hover:bg-slate-200/70 transition select-none"
                          >
                            <div className="flex items-center space-x-1">
                              <span>Period</span>
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </div>
                          </th>
                          <th
                            onClick={() => toggleSort('present')}
                            className="px-4 py-3.5 cursor-pointer hover:bg-slate-200/70 transition select-none"
                          >
                            <div className="flex items-center space-x-1">
                              <span>Present</span>
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </div>
                          </th>
                          <th
                            onClick={() => toggleSort('absent')}
                            className="px-4 py-3.5 cursor-pointer hover:bg-slate-200/70 transition select-none"
                          >
                            <div className="flex items-center space-x-1">
                              <span>Absent</span>
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </div>
                          </th>
                          <th
                            onClick={() => toggleSort('attendance')}
                            className="px-4 py-3.5 cursor-pointer hover:bg-slate-200/70 transition select-none"
                          >
                            <div className="flex items-center space-x-1">
                              <span>Attendance %</span>
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {sortedSessions.map((sess, idx) => {
                          const isGood = sess.attendance_percentage >= threshold;
                          return (
                            <tr
                              key={sess.col_idx || idx}
                              className="hover:bg-slate-50 transition"
                            >
                              <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                                {sess.date || sess.header_raw.split(/\s+/)[0]}
                              </td>
                              <td className="px-4 py-3">Hour {sess.period}</td>
                              <td className="px-4 py-3 text-emerald-700 font-bold">
                                {sess.present_count}
                              </td>
                              <td className="px-4 py-3 text-rose-700 font-bold">
                                {sess.absent_count}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                                    isGood
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {sess.attendance_percentage.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Bottom Action Bar */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={handleBack}
              data-testid="back-to-attendance-bottom"
              className="py-2.5 px-5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Attendance</span>
            </button>

            {stats && (
              <span className="text-xs text-slate-400">
                Calculated directly from workbook • Read-only
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// Helper Component: SVG Trend Line Chart
// =========================================================================
interface TrendLineChartProps {
  sessions: SessionStatisticsItem[];
  threshold: number;
  onHoverSession: (session: SessionStatisticsItem | null) => void;
}

const TrendLineChart: React.FC<TrendLineChartProps> = ({
  sessions,
  threshold,
  onHoverSession,
}) => {
  if (!sessions || sessions.length === 0) return null;

  const width = 800;
  const height = 240;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 40;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const numPoints = sessions.length;
  const stepX = numPoints > 1 ? chartW / (numPoints - 1) : chartW / 2;

  const points = sessions.map((sess, idx) => {
    const x = padLeft + idx * stepX;
    // Y-axis 0 to 100%
    const y = padTop + chartH - (sess.attendance_percentage / 100) * chartH;
    return { x, y, sess };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${(
    padTop + chartH
  ).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`;

  const thresholdY = padTop + chartH - (threshold / 100) * chartH;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[600px] h-auto select-none"
      >
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal Grid lines */}
        {[0, 25, 50, 75, 100].map((val) => {
          const y = padTop + chartH - (val / 100) * chartH;
          return (
            <g key={val}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                className="text-[10px] fill-slate-400 font-mono"
              >
                {val}%
              </text>
            </g>
          );
        })}

        {/* Threshold dashed reference line */}
        <line
          x1={padLeft}
          y1={thresholdY}
          x2={width - padRight}
          y2={thresholdY}
          stroke="#f43f5e"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        {/* Area under line */}
        <path d={areaD} fill="url(#trendGradient)" />

        {/* Trend Polyline */}
        <path
          d={pathD}
          fill="none"
          stroke="#2563eb"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, idx) => {
          const isAbove = p.sess.attendance_percentage >= threshold;
          return (
            <g
              key={idx}
              className="cursor-pointer group"
              onMouseEnter={() => onHoverSession(p.sess)}
              onMouseLeave={() => onHoverSession(null)}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r="4.5"
                fill={isAbove ? '#2563eb' : '#f43f5e'}
                stroke="#ffffff"
                strokeWidth="2"
                className="transition-transform group-hover:scale-150"
              />
              {/* Invisible larger hit target for easy mouse hover */}
              <circle cx={p.x} cy={p.y} r="12" fill="transparent" />

              {/* X-axis labels (render every 2nd or 3rd label if too dense) */}
              {(numPoints <= 12 || idx % Math.ceil(numPoints / 10) === 0 || idx === numPoints - 1) && (
                <text
                  x={p.x}
                  y={height - 14}
                  textAnchor="middle"
                  className="text-[9px] fill-slate-500 font-mono"
                >
                  {p.sess.session_label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// =========================================================================
// Helper Component: Distribution Bar
// =========================================================================
interface DistributionBarProps {
  label: string;
  count: number;
  total: number;
  colorClass: string;
  textClass: string;
}

const DistributionBar: React.FC<DistributionBarProps> = ({
  label,
  count,
  total,
  colorClass,
  textClass,
}) => {
  const pct = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-slate-700">{label}</span>
        <span className={`${textClass} font-mono font-bold`}>
          {count} students{' '}
          <span className="text-slate-400 font-normal">({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="h-3 w-full bg-slate-200/80 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} rounded-full transition-all duration-500`}
          style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%` }}
        />
      </div>
    </div>
  );
};

// =========================================================================
// Helper Component: Donut Chart (Present vs Absent)
// =========================================================================
interface DonutChartProps {
  presentPct: number;
  absentPct: number;
}

const DonutChart: React.FC<DonutChartProps> = ({ presentPct, absentPct }) => {
  const size = 160;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Present stroke offset
  const presentStroke = (presentPct / 100) * circumference;
  const absentStroke = (absentPct / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background full circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
        />

        {/* Present Arc (Emerald) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#059669"
          strokeWidth={strokeWidth}
          strokeDasharray={`${presentStroke} ${circumference}`}
          strokeLinecap="round"
          className="transition-all duration-700"
        />

        {/* Absent Arc (Rose) */}
        {absentPct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e11d48"
            strokeWidth={strokeWidth}
            strokeDasharray={`${absentStroke} ${circumference}`}
            strokeDashoffset={-presentStroke}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        )}
      </svg>

      {/* Center Label */}
      <div className="absolute text-center">
        <span className="text-2xl font-black text-slate-900 tracking-tight">
          {presentPct.toFixed(1)}%
        </span>
        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Present
        </span>
      </div>
    </div>
  );
};
