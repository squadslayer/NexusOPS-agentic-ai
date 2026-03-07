export type LoginCredentials = {
    email: string;
    password?: string;
};

export type AuthApiError = {
    message: string;
};

export async function loginUser(credentials: LoginCredentials) {
    const bffUrl = process.env.NEXT_PUBLIC_BFF_URL || 'http://localhost:8000';
    const response = await fetch(`${bffUrl}/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(credentials)
    });

    const data = await response.json();
    if (!response.ok) {
        throw { message: data.error || "Login failed" };
    }

    // Backwards compatibility for the plan's 'access_token' or the BFF's 'token'
    const token = data.access_token || (data.data && data.data.token) || data.token;
    if (token) {
        localStorage.setItem("token", token);
    }
    return data;
}

export async function apiFetch(url: string, options: any = {}) {
    const token = typeof window !== 'undefined'
        ? (localStorage.getItem("token") || localStorage.getItem("nexusops_token"))
        : null;

    const bffUrl = process.env.NEXT_PUBLIC_BFF_URL || 'http://localhost:8000';
    const fullUrl = url.startsWith('http') ? url : `${bffUrl}${url.startsWith('/') ? '' : '/'}${url}`;

    console.log(`[apiFetch] Requesting: ${fullUrl}`, {
        method: options.method || 'GET',
        hasToken: !!token,
        tokenPrefix: token ? `${token.substring(0, 5)}...` : 'none'
    });

    try {
        const response = await fetch(fullUrl, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(options.headers || {})
            }
        });

        console.log(`[apiFetch] Response: ${fullUrl} | Status: ${response.status} ${response.statusText}`);
        return response;
    } catch (err: any) {
        console.error(`[apiFetch] CRITICAL ERROR for ${fullUrl}:`, err);
        // Special log for CORS/Network failures
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
            console.error(`[apiFetch] Possible CORS block or Backend Offline! Check that ${bffUrl} is reachable.`);
        }
        throw err;
    }
}
