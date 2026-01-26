/**
 * API client for the parallax backend service.
 *
 * Handles job creation, status polling, and asset retrieval.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface JobResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  input_type: 'object' | 'landscape' | 'unknown' | null;
  progress: number;
  error: string | null;
  outputs: {
    color?: string;
    depth?: string;
    mask?: string;
  } | null;
}

export interface AssetResponse {
  id: string;
  job_id: string;
  asset_type: string;
  filename: string;
  content_type: string;
  size: number;
  metadata: Record<string, unknown> | null;
}

/**
 * Create a new processing job by uploading an image.
 */
export async function createJob(
  file: File,
  inputTypeHint?: 'object' | 'landscape'
): Promise<JobResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (inputTypeHint) {
    formData.append('input_type_hint', inputTypeHint);
  }

  const response = await fetch(`${API_BASE_URL}/jobs`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get job status by ID.
 */
export async function getJob(jobId: string): Promise<JobResponse> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Poll job status until completion or failure.
 */
export async function pollJobUntilComplete(
  jobId: string,
  onProgress?: (job: JobResponse) => void,
  pollInterval = 1000,
  maxAttempts = 120
): Promise<JobResponse> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const job = await getJob(jobId);

    if (onProgress) {
      onProgress(job);
    }

    if (job.status === 'completed' || job.status === 'failed') {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('Job polling timed out');
}

/**
 * Get asset metadata by ID.
 */
export async function getAsset(assetId: string): Promise<AssetResponse> {
  const response = await fetch(`${API_BASE_URL}/assets/${assetId}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get asset download URL.
 */
export function getAssetDownloadUrl(assetId: string): string {
  return `${API_BASE_URL}/assets/${assetId}/download`;
}

/**
 * Download asset as blob.
 */
export async function downloadAsset(assetId: string): Promise<Blob> {
  const response = await fetch(getAssetDownloadUrl(assetId));

  if (!response.ok) {
    throw new Error(`Failed to download asset: HTTP ${response.status}`);
  }

  return response.blob();
}

/**
 * Check if the backend API is available.
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
