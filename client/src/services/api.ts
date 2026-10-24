import {
  AuditEvent,
  AuditIntegrityResult,
  DocumentGrant,
  DocumentMetadata,
  Role,
  SecurityStats,
  UserProfile
} from '../types.js';

const API_BASE = '/api';

export function getStoredToken(): string {
  return localStorage.getItem('trustvault_token') || 'dev_owner';
}

export function setStoredToken(token: string): void {
  localStorage.setItem('trustvault_token', token);
}

export function clearStoredToken(): void {
  localStorage.removeItem('trustvault_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Generate correlation request ID
  if (!headers.has('X-Request-Id')) {
    headers.set('X-Request-Id', `req_client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorDetail = 'An error occurred';
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.title || errJson.message || `HTTP ${response.status}`;
    } catch {
      errorDetail = `Request failed with status ${response.status} ${response.statusText}`;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  // Authentication & Profile
  async getMe(): Promise<{ user: UserProfile }> {
    return request<{ user: UserProfile }>('/me');
  },

  async listUsers(): Promise<{ users: UserProfile[] }> {
    return request<{ users: UserProfile[] }>('/users');
  },

  // Documents
  async listDocuments(params: {
    tab?: 'my' | 'shared' | 'all';
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ documents: DocumentMetadata[]; pagination: { total: number; hasMore: boolean } }> {
    const query = new URLSearchParams();
    if (params.tab) query.set('tab', params.tab);
    if (params.category) query.set('category', params.category);
    if (params.search) query.set('search', params.search);
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.offset) query.set('offset', params.offset.toString());
    return request(`/documents?${query.toString()}`);
  },

  async getDocumentMetadata(id: string): Promise<{
    document: DocumentMetadata;
    isOwner: boolean;
    userGrant: string | null;
  }> {
    return request(`/documents/${id}`);
  },

  async downloadDocument(id: string, filename: string): Promise<void> {
    const token = getStoredToken();
    const response = await fetch(`${API_BASE}/documents/${id}/download`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      let detail = 'Download failed';
      try {
        const errJson = await response.json();
        detail = errJson.detail || detail;
      } catch {}
      throw new Error(detail);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async uploadDocument(formData: FormData): Promise<{ document: DocumentMetadata }> {
    const token = getStoredToken();
    const response = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.detail || `Upload failed with status ${response.status}`);
    }

    return response.json();
  },

  async updateDocumentMetadata(
    id: string,
    data: { title?: string; category?: string; description?: string }
  ): Promise<{ document: DocumentMetadata }> {
    return request(`/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  async updateDocumentContent(id: string, formData: FormData): Promise<{ version: number }> {
    const token = getStoredToken();
    const response = await fetch(`${API_BASE}/documents/${id}/content`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.detail || `Content update failed with status ${response.status}`);
    }

    return response.json();
  },

  async deleteDocument(id: string): Promise<void> {
    return request(`/documents/${id}`, { method: 'DELETE' });
  },

  async restoreDocument(id: string): Promise<void> {
    return request(`/documents/${id}/restore`, { method: 'POST' });
  },

  async getDocumentAudit(id: string): Promise<{ events: AuditEvent[] }> {
    return request(`/documents/${id}/audit`);
  },

  // Permissions
  async listGrants(documentId: string): Promise<{ grants: DocumentGrant[] }> {
    return request(`/documents/${documentId}/grants`);
  },

  async createGrant(
    documentId: string,
    targetUserId: string,
    permission: 'READ' | 'EDIT'
  ): Promise<{ grant: DocumentGrant }> {
    return request(`/documents/${documentId}/grants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, permission })
    });
  },

  async revokeGrant(documentId: string, targetUserId: string): Promise<void> {
    return request(`/documents/${documentId}/grants/${targetUserId}`, {
      method: 'DELETE'
    });
  },

  // Admin
  async listAdminUsers(): Promise<{ users: Array<UserProfile & { sharedDocumentsCount?: number }> }> {
    return request('/admin/users');
  },

  async getAdminUserDetails(userId: string): Promise<{
    user: UserProfile;
    grants: Array<DocumentGrant & {
      documentTitle: string;
      documentFilename: string;
      documentCategory: string;
      documentSize: number;
      documentOwnerEmail: string;
    }>;
    ownedDocuments: DocumentMetadata[];
  }> {
    return request(`/admin/users/${userId}/details`);
  },

  async adminShareDocumentWithUser(
    userId: string,
    documentId: string,
    permission: 'READ' | 'EDIT' = 'READ'
  ): Promise<{ message: string; grant: DocumentGrant }> {
    return request(`/admin/users/${userId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId, permission })
    });
  },

  async adminRevokeDocumentForUser(userId: string, documentId: string): Promise<{ message: string }> {
    return request(`/admin/users/${userId}/grants/${documentId}`, {
      method: 'DELETE'
    });
  },

  async registerUser(email: string, displayName: string, password?: string): Promise<{
    message: string;
    user: UserProfile;
    token: string;
  }> {
    return request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, displayName, password })
    });
  },

  async updateMyProfile(displayName: string): Promise<{ user: UserProfile }> {
    return request('/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName })
    });
  },

  async updateAdminUserRole(userId: string, role: Role): Promise<void> {
    return request(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    });
  },

  async listAdminAudit(params: {
    action?: string;
    actorId?: string;
    documentId?: string;
    outcome?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ events: AuditEvent[]; pagination: { total: number; hasMore: boolean } }> {
    const query = new URLSearchParams();
    if (params.action) query.set('action', params.action);
    if (params.actorId) query.set('actorId', params.actorId);
    if (params.documentId) query.set('documentId', params.documentId);
    if (params.outcome) query.set('outcome', params.outcome);
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.offset) query.set('offset', params.offset.toString());
    return request(`/admin/audit?${query.toString()}`);
  },

  async verifyAuditIntegrity(): Promise<{ integrity: AuditIntegrityResult }> {
    return request('/admin/audit/integrity');
  },

  async getSecurityStats(): Promise<{ stats: SecurityStats }> {
    return request('/admin/stats');
  }
};
