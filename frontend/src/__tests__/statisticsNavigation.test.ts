import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

// Browser environment shim for Vitest
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
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
class MockHTMLIFrameElement {}
(globalThis as any).HTMLIFrameElement = MockHTMLIFrameElement;
(globalThis as any).window = {
  location: mockLocation,
  history: mockHistory,
  addEventListener: () => {},
  removeEventListener: () => {},
  HTMLIFrameElement: MockHTMLIFrameElement,
};
(globalThis as any).document = {
  title: 'MarkMe',
};

import {
  getPersistedWorkflowState,
  setPersistedWorkflowState,
  parseUrlNavigation,
  navigateToStage,
} from '../utils/workflowState';
import { StatisticsPage } from '../pages/StatisticsPage';
import { DriveFile } from '../types';

describe('Statistics Button and Navigation', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockSessionStorage.clear();
    mockLocation.pathname = '/';
    mockLocation.search = '';
  });

  it('navigates to /statistics with selected fileId preserved', () => {
    const fileId = 'workbook_file_123';
    navigateToStage('STATISTICS', { fileId });

    expect(mockLocation.pathname).toBe('/statistics');
    expect(mockLocation.search).toBe(`?fileId=${fileId}`);

    const nav = parseUrlNavigation();
    expect(nav.stageFromUrl).toBe('STATISTICS');
    expect(nav.fileId).toBe(fileId);
  });

  it('preserves selected workbook on refresh while on /statistics', () => {
    const fileId = 'workbook_sem5_b';
    const fileName = 'V Sem B Attendance sheet.xlsx';

    setPersistedWorkflowState({
      step: 'STATISTICS',
      fileId,
      fileName,
    });
    mockLocation.pathname = '/statistics';
    mockLocation.search = `?fileId=${fileId}`;

    const persisted = getPersistedWorkflowState();
    const nav = parseUrlNavigation();

    expect(persisted.step).toBe('STATISTICS');
    expect(persisted.fileId).toBe(fileId);
    expect(persisted.fileName).toBe(fileName);
    expect(nav.stageFromUrl).toBe('STATISTICS');
    expect(nav.fileId).toBe(fileId);
  });

  it('navigates back to attendance with selected workbook preserved', () => {
    const fileId = 'workbook_sem5_b';
    const fileName = 'V Sem B Attendance sheet.xlsx';

    // Start on statistics
    setPersistedWorkflowState({
      step: 'STATISTICS',
      fileId,
      fileName,
    });
    navigateToStage('STATISTICS', { fileId });
    expect(mockLocation.pathname).toBe('/statistics');

    // Return to attendance
    setPersistedWorkflowState({
      step: 'MARK_ATTENDANCE',
      fileId,
      fileName,
    });
    navigateToStage('MARK_ATTENDANCE', { fileId });

    expect(mockLocation.pathname).toBe('/attendance');
    expect(mockLocation.search).toBe(`?fileId=${fileId}`);

    const persisted = getPersistedWorkflowState();
    const nav = parseUrlNavigation();

    expect(persisted.step).toBe('MARK_ATTENDANCE');
    expect(persisted.fileId).toBe(fileId);
    expect(nav.stageFromUrl).toBe('MARK_ATTENDANCE');
    expect(nav.fileId).toBe(fileId);
  });

  it('handles browser back and forward navigation between attendance and statistics', () => {
    const fileId = 'wb_history_test';

    // 1. User on Attendance page
    navigateToStage('MARK_ATTENDANCE', { fileId });
    expect(mockLocation.pathname).toBe('/attendance');
    expect(mockLocation.search).toBe(`?fileId=${fileId}`);

    // 2. User clicks Statistics
    navigateToStage('STATISTICS', { fileId });
    expect(mockLocation.pathname).toBe('/statistics');
    expect(mockLocation.search).toBe(`?fileId=${fileId}`);

    // 3. User clicks browser back button
    mockLocation.pathname = '/attendance';
    mockLocation.search = `?fileId=${fileId}`;
    const backNav = parseUrlNavigation();
    expect(backNav.stageFromUrl).toBe('MARK_ATTENDANCE');
    expect(backNav.fileId).toBe(fileId);

    // 4. User clicks browser forward button
    mockLocation.pathname = '/statistics';
    mockLocation.search = `?fileId=${fileId}`;
    const fwdNav = parseUrlNavigation();
    expect(fwdNav.stageFromUrl).toBe('STATISTICS');
    expect(fwdNav.fileId).toBe(fileId);
  });

  it('renders StatisticsPage with Title "Subject Statistics", workbook name, and Back button', () => {
    const mockFile: DriveFile = {
      id: 'mock_file_id',
      name: 'V Sem B Attendance sheet.xlsx',
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    const html = renderToString(
      React.createElement(StatisticsPage, {
        file: mockFile,
        onBackToAttendance: () => {},
      })
    );

    // Verify Title
    expect(html).toContain('Subject Statistics');
    // Verify Workbook Name displayed
    expect(html).toContain('V Sem B Attendance sheet.xlsx');
    // Verify Back to Attendance button
    expect(html).toContain('Back to Attendance');
  });

  it('renders Statistics button beside Change Workbook on Attendance page and triggers navigation on click', async () => {
    const { Window } = await import('happy-dom');
    const windowShim = new Window();
    const docShim = windowShim.document;
    const container = docShim.createElement('div');
    docShim.body.appendChild(container);

    const { api } = await import('../api/client');
    const mockDetails = {
      file_id: 'mock_wb_123',
      file_name: 'V Sem B Attendance sheet.xlsx',
      class_name: 'V SEM',
      section: 'B',
      academic_year: '2026-2027',
      subjects: [
        {
          code: 'UIT3562',
          name: 'Operating Systems',
          sheet_name: 'UIT3562',
          faculty_name: 'Dr. Faculty',
          class_section: 'V B',
          academic_year: '2026-2027',
          student_count: 60,
          existing_sessions: [],
          next_available_col: 6,
          next_available_col_letter: 'F',
        },
      ],
    };
    vi.spyOn(api, 'getWorkbookDetails').mockResolvedValue(mockDetails);

    const { AttendanceMarkingPage } = await import('../pages/AttendanceMarkingPage');
    const onNavigateToStatistics = vi.fn();
    const onBackToFileSelect = vi.fn();
    const onCommitSuccess = vi.fn();

    const mockFile: DriveFile = {
      id: 'mock_wb_123',
      name: 'V Sem B Attendance sheet.xlsx',
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');

    const root = createRoot(container as unknown as HTMLElement);

    await act(async () => {
      root.render(
        React.createElement(AttendanceMarkingPage, {
          file: mockFile,
          onBackToFileSelect,
          onNavigateToStatistics,
          onCommitSuccess,
        })
      );
    });

    // Wait for async loadWorkbook to complete and update state
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Verify Change Workbook button exists
    expect(container.innerHTML).toContain('Change Workbook');

    // Verify Statistics button exists in DOM
    const statsBtn = container.querySelector('[data-testid="statistics-button"]');
    expect(statsBtn).not.toBeNull();
    expect(statsBtn?.textContent).toContain('Statistics');

    // Click Statistics button
    await act(async () => {
      statsBtn?.dispatchEvent(new windowShim.MouseEvent('click', { bubbles: true }));
    });

    // Verify navigation handler called
    expect(onNavigateToStatistics).toHaveBeenCalledTimes(1);

    // Unmount root and cleanup
    await act(async () => {
      root.unmount();
    });
  });

  it('does not render Statistics button if no workbook is selected', async () => {
    const { Window } = await import('happy-dom');
    const windowShim = new Window();
    const docShim = windowShim.document;
    const container = docShim.createElement('div');
    docShim.body.appendChild(container);

    const { api } = await import('../api/client');
    vi.spyOn(api, 'getWorkbookDetails').mockResolvedValue({
      file_id: '',
      file_name: '',
      class_name: '',
      section: '',
      academic_year: '',
      subjects: [],
    });

    const { AttendanceMarkingPage } = await import('../pages/AttendanceMarkingPage');
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');

    const emptyFile: DriveFile = {
      id: '',
      name: '',
      mime_type: '',
    };

    const root = createRoot(container as unknown as HTMLElement);
    await act(async () => {
      root.render(
        React.createElement(AttendanceMarkingPage, {
          file: emptyFile,
          onBackToFileSelect: () => {},
          onNavigateToStatistics: () => {},
          onCommitSuccess: () => {},
        })
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const statsBtn = container.querySelector('[data-testid="statistics-button"]');
    expect(statsBtn).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('supports subject query param in parseUrlNavigation and navigateToStage', () => {
    const fileId = 'wb_sub_test';
    const subject = 'UIT3562';

    navigateToStage('STATISTICS', { fileId, subject });
    expect(mockLocation.pathname).toBe('/statistics');
    expect(mockLocation.search).toBe(`?fileId=${fileId}&subject=${subject}`);

    const nav = parseUrlNavigation();
    expect(nav.stageFromUrl).toBe('STATISTICS');
    expect(nav.fileId).toBe(fileId);
    expect(nav.subject).toBe(subject);
  });

  it('renders full Level 1 statistics dashboard with summary cards, charts, and session table', async () => {
    const { Window } = await import('happy-dom');
    const windowShim = new Window();
    const docShim = windowShim.document;
    const container = docShim.createElement('div');
    docShim.body.appendChild(container);

    const { api } = await import('../api/client');
    const mockDetails = {
      file_id: 'wb_full_test',
      file_name: 'V Sem B Attendance sheet.xlsx',
      class_name: 'V SEM',
      section: 'B',
      academic_year: '2026-2027',
      subjects: [
        {
          code: 'UIT3562',
          name: 'Operating Systems',
          sheet_name: 'UIT3562',
          faculty_name: 'Dr. Faculty',
          class_section: 'V B',
          academic_year: '2026-2027',
          student_count: 71,
          existing_sessions: [],
          next_available_col: 25,
          next_available_col_letter: 'Y',
        },
        {
          code: 'UIT3561',
          name: 'Computer Networks',
          sheet_name: 'UIT3561',
          faculty_name: 'Dr. Staff',
          class_section: 'V B',
          academic_year: '2026-2027',
          student_count: 71,
          existing_sessions: [],
          next_available_col: 11,
          next_available_col_letter: 'K',
        },
      ],
    };
    vi.spyOn(api, 'getWorkbookDetails').mockResolvedValue(mockDetails);

    const mockStatsResponse = {
      file_id: 'wb_full_test',
      file_name: 'V Sem B Attendance sheet.xlsx',
      sheet_name: 'UIT3562',
      subject_code: 'UIT3562',
      subject_name: 'Operating Systems',
      faculty_name: 'Dr. Faculty',
      class_section: 'V B',
      academic_year: '2026-2027',
      threshold: 75.0,
      has_sessions: true,
      message: null,
      total_students: 71,
      total_sessions: 19,
      average_attendance: 71.0,
      average_attendance_raw: 71.015,
      total_present: 958,
      total_absent: 391,
      total_unrecorded: 0,
      unexpected_values_count: 0,
      below_threshold_count: 41,
      present_percentage: 71.0,
      absent_percentage: 29.0,
      distribution_90_100: 5,
      distribution_80_89: 16,
      distribution_75_79: 9,
      distribution_below_75: 41,
      sessions: [
        {
          col_idx: 6,
          col_letter: 'F',
          header_raw: '29/06/2026 1st Hour',
          date: '29/06/2026',
          period: '1',
          session_label: '29/06 P1',
          present_count: 70,
          absent_count: 1,
          unrecorded_count: 0,
          attendance_percentage: 98.6,
        },
        {
          col_idx: 7,
          col_letter: 'G',
          header_raw: '30/06/2026 4th Hour',
          date: '30/06/2026',
          period: '4',
          session_label: '30/06 P4',
          present_count: 61,
          absent_count: 10,
          unrecorded_count: 0,
          attendance_percentage: 85.9,
        },
      ],
    };
    const getStatsSpy = vi.spyOn(api, 'getSubjectStatistics').mockResolvedValue(mockStatsResponse);

    const { StatisticsPage } = await import('../pages/StatisticsPage');
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');

    const onBackToAttendance = vi.fn();
    const mockFile: DriveFile = {
      id: 'wb_full_test',
      name: 'V Sem B Attendance sheet.xlsx',
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    const root = createRoot(container as unknown as HTMLElement);
    await act(async () => {
      root.render(
        React.createElement(StatisticsPage, {
          file: mockFile,
          initialSubject: 'UIT3562',
          onBackToAttendance,
        })
      );
    });

    // Wait for workbook details and statistics to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });

    // Assert Header & Subject Selector
    expect(container.innerHTML).toContain('Subject Statistics');
    expect(container.innerHTML).toContain('V Sem B Attendance sheet.xlsx');
    const select = container.querySelector('select[data-testid="subject-select"]') as unknown as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.value).toBe('UIT3562');

    // Assert Core Summary Cards
    expect(container.innerHTML).toContain('Total Students');
    expect(container.innerHTML).toContain('71');
    expect(container.innerHTML).toContain('Total Sessions');
    expect(container.innerHTML).toContain('19');
    expect(container.innerHTML).toContain('Average Attendance');
    expect(container.innerHTML).toContain('71.0%');
    expect(container.innerHTML).toContain('Total Present');
    expect(container.innerHTML).toContain('958');
    expect(container.innerHTML).toContain('Total Absent');
    expect(container.innerHTML).toContain('391');
    expect(container.innerHTML).toContain('Below 75%');
    expect(container.innerHTML).toContain('41');

    // Assert Trend Line Chart
    expect(container.innerHTML).toContain('Attendance Trend');
    expect(container.querySelector('svg')).not.toBeNull();

    // Assert Distribution and verify Overall Attendance is removed
    expect(container.innerHTML).toContain('Attendance Distribution');
    expect(container.innerHTML).toContain('90–100%');
    expect(container.innerHTML).toContain('80–89%');
    expect(container.innerHTML).toContain('75–79%');
    expect(container.innerHTML).not.toContain('Overall Attendance');

    // Assert Session Summary Table
    expect(container.innerHTML).toContain('Session Summary');
    expect(container.innerHTML).toContain('29/06/2026');
    expect(container.innerHTML).toContain('98.6%');
    expect(container.innerHTML).toContain('30/06/2026');
    expect(container.innerHTML).toContain('85.9%');

    // Test Subject Switching
    await act(async () => {
      select.value = 'UIT3561';
      select.dispatchEvent(new windowShim.Event('change', { bubbles: true }) as unknown as Event);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(getStatsSpy).toHaveBeenCalledWith('wb_full_test', 'UIT3561', 75.0);

    // Test Back to Attendance Button
    const backBtn = container.querySelector('[data-testid="back-to-attendance-top"]');
    expect(backBtn).not.toBeNull();
    await act(async () => {
      backBtn?.dispatchEvent(new windowShim.MouseEvent('click', { bubbles: true }));
    });
    expect(onBackToAttendance).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('displays empty sessions message when subject has no recorded attendance', async () => {
    const { Window } = await import('happy-dom');
    const windowShim = new Window();
    const docShim = windowShim.document;
    const container = docShim.createElement('div');
    docShim.body.appendChild(container);

    const { api } = await import('../api/client');
    vi.spyOn(api, 'getWorkbookDetails').mockResolvedValue({
      file_id: 'wb_empty_sess',
      file_name: 'V Sem B Attendance sheet.xlsx',
      class_name: 'V SEM',
      section: 'B',
      academic_year: '2026-2027',
      subjects: [
        {
          code: 'UIT3515',
          name: 'Cloud Computing',
          sheet_name: 'UIT3515',
          faculty_name: 'Staff',
          class_section: 'V B',
          academic_year: '2026-2027',
          student_count: 71,
          existing_sessions: [],
          next_available_col: 6,
          next_available_col_letter: 'F',
        },
      ],
    });

    vi.spyOn(api, 'getSubjectStatistics').mockResolvedValue({
      file_id: 'wb_empty_sess',
      file_name: 'V Sem B Attendance sheet.xlsx',
      sheet_name: 'UIT3515',
      subject_code: 'UIT3515',
      subject_name: 'Cloud Computing',
      faculty_name: 'Staff',
      class_section: 'V B',
      academic_year: '2026-2027',
      threshold: 75.0,
      has_sessions: false,
      message: 'No attendance sessions have been recorded for this subject.',
      total_students: 71,
      total_sessions: 0,
      average_attendance: 0.0,
      average_attendance_raw: 0.0,
      total_present: 0,
      total_absent: 0,
      total_unrecorded: 0,
      unexpected_values_count: 0,
      below_threshold_count: 0,
      present_percentage: 0.0,
      absent_percentage: 0.0,
      distribution_90_100: 0,
      distribution_80_89: 0,
      distribution_75_79: 0,
      distribution_below_75: 0,
      sessions: [],
    });

    const { StatisticsPage } = await import('../pages/StatisticsPage');
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');

    const mockFile: DriveFile = {
      id: 'wb_empty_sess',
      name: 'V Sem B Attendance sheet.xlsx',
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    const root = createRoot(container as unknown as HTMLElement);
    await act(async () => {
      root.render(
        React.createElement(StatisticsPage, {
          file: mockFile,
          initialSubject: 'UIT3515',
          onBackToAttendance: () => {},
        })
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });

    // Assert Empty State Notice
    expect(container.innerHTML).toContain('No Recorded Sessions');
    expect(container.innerHTML).toContain('No attendance sessions have been recorded for this subject.');

    await act(async () => {
      root.unmount();
    });
  });

  it('supports threshold toggle between 50% and 75%, removing 80% and 85%', async () => {
    const { Window } = await import('happy-dom');
    const windowShim = new Window();
    const docShim = windowShim.document;
    const container = docShim.createElement('div');
    docShim.body.appendChild(container);

    const { api } = await import('../api/client');

    const mockWb = {
      file_id: 'wb_thresh_test',
      file_name: 'Attendance.xlsx',
      academic_year: '2025-2026',
      class_section: 'CSE-A',
      subjects: [
        { code: 'UIT3562', name: 'Cloud Computing', sheet_name: 'UIT3562' },
      ],
    };

    const baseStats = {
      class_section: 'CSE-A',
      academic_year: '2025-2026',
      subject_name: 'Cloud Computing',
      subject_code: 'UIT3562',
      sheet_name: 'UIT3562',
      has_sessions: true,
      total_students: 71,
      total_sessions: 20,
      average_attendance: 82.5,
      average_attendance_raw: 82.5,
      total_present: 958,
      total_absent: 391,
      total_unrecorded: 0,
      unexpected_values_count: 0,
      below_threshold_count: 41,
      present_percentage: 71.0,
      absent_percentage: 29.0,
      distribution_90_100: 25,
      distribution_80_89: 30,
      distribution_75_79: 10,
      distribution_below_75: 6,
      sessions: [
        {
          col_idx: 6,
          col_letter: 'F',
          header_raw: '29/06/2026',
          date: '29/06/2026',
          period: '1',
          session_label: '29/06 H1',
          present_count: 70,
          absent_count: 1,
          total_students: 71,
          attendance_percentage: 98.6,
        },
      ],
    };

    vi.spyOn(api, 'getWorkbookDetails').mockResolvedValue(mockWb as any);
    const getStatsSpy = vi.spyOn(api, 'getSubjectStatistics').mockImplementation(async (_f, _s, thresh) => {
      return {
        ...baseStats,
        threshold: thresh ?? 75.0,
        below_threshold_count: thresh === 50 ? 5 : 41,
      } as any;
    });

    const { StatisticsPage } = await import('../pages/StatisticsPage');
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');

    const mockFile: DriveFile = {
      id: 'wb_thresh_test',
      name: 'Attendance.xlsx',
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    const root = createRoot(container as unknown as HTMLElement);
    await act(async () => {
      root.render(
        React.createElement(StatisticsPage, {
          file: mockFile,
          initialSubject: 'UIT3562',
          onBackToAttendance: () => {},
        })
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });

    // 1. Verify threshold 50% and 75% exist
    const btn50 = container.querySelector('[data-testid="threshold-50"]');
    const btn75 = container.querySelector('[data-testid="threshold-75"]');
    const btn80 = container.querySelector('[data-testid="threshold-80"]');
    const btn85 = container.querySelector('[data-testid="threshold-85"]');

    expect(btn50).not.toBeNull();
    expect(btn75).not.toBeNull();
    expect(btn80).toBeNull();
    expect(btn85).toBeNull();

    // Default is 75%
    expect(container.innerHTML).toContain('Below 75%');
    expect(container.innerHTML).toContain('41');

    // 2. Click 50% threshold
    await act(async () => {
      btn50?.dispatchEvent(new windowShim.MouseEvent('click', { bubbles: true }));
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });

    expect(getStatsSpy).toHaveBeenCalledWith('wb_thresh_test', 'UIT3562', 50);
    expect(container.innerHTML).toContain('Below 50%');
    expect(container.innerHTML).toContain('5');

    // 3. Switch back to 75%
    await act(async () => {
      btn75?.dispatchEvent(new windowShim.MouseEvent('click', { bubbles: true }));
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });

    expect(getStatsSpy).toHaveBeenCalledWith('wb_thresh_test', 'UIT3562', 75);
    expect(container.innerHTML).toContain('Below 75%');
    expect(container.innerHTML).toContain('41');

    // 4. Verify Session Summary has max-height and overflow scroll classes
    expect(container.innerHTML).toContain('max-h-[380px]');
    expect(container.innerHTML).toContain('overflow-y-auto');
    expect(container.innerHTML).toContain('sticky top-0');

    await act(async () => {
      root.unmount();
    });
  });

  it('keeps Attendance Trend points stable on click, anchors tooltip, and allows toggling selection', async () => {
    const { Window } = await import('happy-dom');
    const windowShim = new Window();
    const docShim = windowShim.document;
    const container = docShim.createElement('div');
    docShim.body.appendChild(container);

    const { api } = await import('../api/client');

    const mockWb = {
      file_id: 'wb_click_test',
      file_name: 'Attendance.xlsx',
      academic_year: '2025-2026',
      class_section: 'CSE-A',
      subjects: [
        { code: 'UIT3562', name: 'Cloud Computing', sheet_name: 'UIT3562' },
      ],
    };

    const mockStats = {
      class_section: 'CSE-A',
      academic_year: '2025-2026',
      subject_name: 'Cloud Computing',
      subject_code: 'UIT3562',
      sheet_name: 'UIT3562',
      has_sessions: true,
      total_students: 71,
      total_sessions: 2,
      average_attendance: 90.0,
      average_attendance_raw: 90.0,
      total_present: 130,
      total_absent: 12,
      total_unrecorded: 0,
      unexpected_values_count: 0,
      below_threshold_count: 5,
      present_percentage: 91.5,
      absent_percentage: 8.5,
      distribution_90_100: 50,
      distribution_80_89: 15,
      distribution_75_79: 3,
      distribution_below_75: 3,
      sessions: [
        {
          col_idx: 6,
          col_letter: 'F',
          header_raw: '29/06/2026',
          date: '29/06/2026',
          period: '1',
          session_label: '29/06 H1',
          present_count: 68,
          absent_count: 3,
          total_students: 71,
          attendance_percentage: 95.8,
        },
        {
          col_idx: 7,
          col_letter: 'G',
          header_raw: '30/06/2026',
          date: '30/06/2026',
          period: '2',
          session_label: '30/06 H2',
          present_count: 62,
          absent_count: 9,
          total_students: 71,
          attendance_percentage: 87.3,
        },
      ],
    };

    vi.spyOn(api, 'getWorkbookDetails').mockResolvedValue(mockWb as any);
    vi.spyOn(api, 'getSubjectStatistics').mockResolvedValue(mockStats as any);

    const { StatisticsPage } = await import('../pages/StatisticsPage');
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');

    const mockFile: DriveFile = {
      id: 'wb_click_test',
      name: 'Attendance.xlsx',
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    const root = createRoot(container as unknown as HTMLElement);
    await act(async () => {
      root.render(
        React.createElement(StatisticsPage, {
          file: mockFile,
          initialSubject: 'UIT3562',
          onBackToAttendance: () => {},
        })
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });

    // Verify SVG circles do NOT contain transform scale classes that cause shifting
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(container.innerHTML).not.toContain('group-hover:scale-150');
    expect(container.innerHTML).not.toContain('transition-transform');

    // Before clicking: details strip shows instruction placeholder
    expect(container.innerHTML).toContain('Click or hover any session point to view details');

    // Find first interactive data point group
    const pointGroups = container.querySelectorAll('g.cursor-pointer');
    expect(pointGroups.length).toBe(2);

    const firstPoint = pointGroups[0];

    // Click first point
    await act(async () => {
      firstPoint.dispatchEvent(new windowShim.MouseEvent('click', { bubbles: true }));
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    // Details strip now shows the selected session and "Selected" badge
    expect(container.innerHTML).toContain('29/06/2026 — Hour 1');
    expect(container.innerHTML).toContain('Selected');
    expect(container.innerHTML).toContain('95.8%');

    // Anchored tooltip in SVG is rendered with session date and present/absent breakdown
    expect(container.innerHTML).toContain('29/06/2026 • Hour 1');
    expect(container.innerHTML).toContain('68 Present • 3 Absent');

    // Deselect by clicking point again
    await act(async () => {
      firstPoint.dispatchEvent(new windowShim.MouseEvent('click', { bubbles: true }));
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    // Returns to instruction placeholder
    expect(container.innerHTML).toContain('Click or hover any session point to view details');

    await act(async () => {
      root.unmount();
    });
  });
});
