// This file is deprecated - use api-client.ts instead
// Kept for backwards compatibility during migration

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001/api';

// Helper function to make API calls (legacy - use api-client.ts instead)
export async function callEdgeFunction(functionName: string, endpoint: string, options?: RequestInit) {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${error}`);
  }

  return response.json();
}

