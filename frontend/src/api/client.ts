import {
  UserProfile,
  DriveFolder,
  DriveFile,
  WorkbookDetails,
  AttendancePreviewResponse,
  AttendanceCommitResponse,
  SubjectStatisticsResponse,
} from '../types';

const rawApiUrl = ((import.meta.env.VITE_API_URL as string | undefined) || '').trim().replace(/\/$/, '');
const API_BASE = rawApiUrl
  ? (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`)
  : '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('markme_token') : null;
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
  });

  if (!res.ok) {
    let errorData: any = null;
    try {
      errorData = await res.json();
    } catch {
      errorData = { detail: res.statusText };
    }
    
    // Extract formatted message
    const message = typeof errorData.detail === 'string'
      ? errorData.detail
      : errorData.detail?.message || JSON.stringify(errorData.detail || 'Request failed');
      
    const err = new Error(message) as any;
    err.status = res.status;
    err.data = errorData.detail;
    throw err;
  }

  return res.json();
}

export const api = {
  // Auth
  getGoogleLoginUrl: () => request<{ auth_url: string | null; message?: string }>('/auth/google/login'),
  getCurrentUser: () =>
    request<{
      user: UserProfile;
      selected_folder_id?: string;
      selected_folder_name?: string;
      selected_file_id?: string;
      selected_file_name?: string;
    }>('/auth/me'),
  logout: () => request<{ success: boolean; message: string }>('/auth/logout', { method: 'POST' }),

  // Drive
  listFolders: () => request<DriveFolder[]>('/drive/folders'),
  resolveFolder: (input: string) =>
    request<DriveFolder>('/drive/folders/resolve', {
      method: 'POST',
      body: JSON.stringify({ input }),
    }),
  selectFolder: (folder_id: string, folder_name: string) =>
    request<{ success: boolean; folder_id: string; folder_name: string }>('/drive/folders/select', {
      method: 'POST',
      body: JSON.stringify({ folder_id, folder_name }),
    }),
  removeFolder: (folder_id: string) =>
    request<{ success: boolean; removed_id: string }>('/drive/folders/remove', {
      method: 'POST',
      body: JSON.stringify({ folder_id }),
    }),
  restoreFolders: () =>
    request<{ success: boolean; message: string }>('/drive/folders/restore', {
      method: 'POST',
    }),
  disconnectActiveFolder: () =>
    request<{ success: boolean; message: string }>('/drive/folders/disconnect', {
      method: 'POST',
    }),
  listFiles: () => request<DriveFile[]>('/drive/files'),

  // Workbooks
  getWorkbookDetails: (file_id: string) => request<WorkbookDetails>(`/workbooks/${file_id}/details`),
  getSubjectStatistics: (fileId: string, sheetName: string, threshold: number = 75.0) =>
    request<SubjectStatisticsResponse>(
      `/workbooks/${encodeURIComponent(fileId)}/subjects/${encodeURIComponent(sheetName)}/statistics?threshold=${threshold}`
    ),
  selectWorkbook: (file_id: string, file_name?: string) =>
    request<{ success: boolean; file_id: string; file_name?: string }>('/workbooks/select', {
      method: 'POST',
      body: JSON.stringify({ file_id, file_name }),
    }),
  clearWorkbook: () =>
    request<{ success: boolean; message: string }>('/workbooks/clear', {
      method: 'POST',
    }),

  // Attendance
  generatePreview: (params: {
    file_id: string;
    sheet_name: string;
    date: string;
    period: string;
    absent_input?: string;
    student_input?: string;
    entry_mode?: 'ABSENT' | 'PRESENT';
  }) =>
    request<AttendancePreviewResponse>('/attendance/preview', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  commitAttendance: (params: {
    file_id: string;
    sheet_name: string;
    date: string;
    period: string;
    absent_suffixes: string[];
    allow_overwrite?: boolean;
    target_col_idx?: number;
    head_revision_id?: string;
  }) =>
    request<AttendanceCommitResponse>('/attendance/commit', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};
