/**
 * API Client Service
 * Kết nối Frontend với Cloudflare Workers API thay vì Supabase
 */

// API Base URL - Thay đổi theo môi trường
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://appbanhang-api.vandanfx.workers.dev';

// Token lưu trong localStorage
const TOKEN_KEY = 'auth_token';

/**
 * Lấy token từ localStorage
 */
export function getAuthToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

/**
 * Lưu token vào localStorage
 */
export function setAuthToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Xóa token
 */
export function clearAuthToken(): void {
    localStorage.removeItem(TOKEN_KEY);
}

/**
 * Tạo headers cho request
 */
function getHeaders(includeAuth = true): HeadersInit {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };

    if (includeAuth) {
        const token = getAuthToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }

    return headers;
}

/**
 * Xử lý response
 */
async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || `HTTP ${response.status}`);
    }
    return response.json();
}

// =============================================================================
// AUTH API
// =============================================================================

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
}

export interface AuthResponse {
    status: string;
    message: string;
    user: {
        id: string;
        email: string;
        full_name: string;
        role: string;
    };
    token: string;
}

export const authApi = {
    async login(data: LoginRequest): Promise<AuthResponse> {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: getHeaders(false),
            body: JSON.stringify(data),
        });
        const result = await handleResponse<AuthResponse>(response);
        if (result.token) {
            setAuthToken(result.token);
        }
        return result;
    },

    async register(data: RegisterRequest): Promise<AuthResponse> {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: getHeaders(false),
            body: JSON.stringify(data),
        });
        const result = await handleResponse<AuthResponse>(response);
        if (result.token) {
            setAuthToken(result.token);
        }
        return result;
    },

    async getMe(): Promise<{ user: any }> {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: getHeaders(),
        });
        return handleResponse(response);
    },

    logout(): void {
        clearAuthToken();
    },
};

// =============================================================================
// PRODUCTS API
// =============================================================================

export interface Product {
    id: string;
    name: string;
    sku?: string;
    barcode?: string;
    description?: string;
    selling_price: number;
    cost_price?: number;
    current_stock: number;
    min_stock?: number;
    base_unit?: string;
    category_id?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ProductsResponse {
    data: Product[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export const productsApi = {
    async getAll(params?: { page?: number; limit?: number; search?: string }): Promise<ProductsResponse> {
        const searchParams = new URLSearchParams();
        if (params?.page) searchParams.set('page', String(params.page));
        if (params?.limit) searchParams.set('limit', String(params.limit));
        if (params?.search) searchParams.set('search', params.search);

        const url = `${API_BASE_URL}/products${searchParams.toString() ? '?' + searchParams : ''}`;
        const response = await fetch(url, { headers: getHeaders() });
        return handleResponse(response);
    },

    async getById(id: string): Promise<Product> {
        const response = await fetch(`${API_BASE_URL}/products/${id}`, { headers: getHeaders() });
        return handleResponse(response);
    },

    async create(data: Partial<Product>): Promise<Product> {
        const response = await fetch(`${API_BASE_URL}/products`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    async update(id: string, data: Partial<Product>): Promise<Product> {
        const response = await fetch(`${API_BASE_URL}/products/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    async delete(id: string): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/products/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        await handleResponse(response);
    },
};

// =============================================================================
// CUSTOMERS API
// =============================================================================

export interface Customer {
    id: string;
    code?: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    gender?: string;
    points_balance: number;
    total_spent: number;
    total_orders: number;
    debt_balance: number;
    notes?: string;
    is_active: boolean;
    created_at: string;
}

export interface CustomersResponse {
    data: Customer[];
    pagination: { page: number; limit: number; total: number };
}

export const customersApi = {
    async getAll(params?: { page?: number; limit?: number; search?: string }): Promise<CustomersResponse> {
        const searchParams = new URLSearchParams();
        if (params?.page) searchParams.set('page', String(params.page));
        if (params?.limit) searchParams.set('limit', String(params.limit));
        if (params?.search) searchParams.set('search', params.search);

        const url = `${API_BASE_URL}/customers${searchParams.toString() ? '?' + searchParams : ''}`;
        const response = await fetch(url, { headers: getHeaders() });
        return handleResponse(response);
    },

    async getById(id: string): Promise<Customer> {
        const response = await fetch(`${API_BASE_URL}/customers/${id}`, { headers: getHeaders() });
        return handleResponse(response);
    },

    async create(data: Partial<Customer>): Promise<Customer> {
        const response = await fetch(`${API_BASE_URL}/customers`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    async update(id: string, data: Partial<Customer>): Promise<Customer> {
        const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    async delete(id: string): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        await handleResponse(response);
    },
};

// =============================================================================
// SUPPLIERS API
// =============================================================================

export interface Supplier {
    id: string;
    code?: string;
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    address?: string;
    tax_id?: string;
    payment_terms?: number;
    notes?: string;
    debt_balance: number;
    is_active: boolean;
    created_at: string;
}

export const suppliersApi = {
    async getAll(): Promise<{ data: Supplier[] }> {
        const response = await fetch(`${API_BASE_URL}/suppliers`, { headers: getHeaders() });
        return handleResponse(response);
    },

    async getById(id: string): Promise<Supplier> {
        const response = await fetch(`${API_BASE_URL}/suppliers/${id}`, { headers: getHeaders() });
        return handleResponse(response);
    },

    async create(data: Partial<Supplier>): Promise<Supplier> {
        const response = await fetch(`${API_BASE_URL}/suppliers`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    async update(id: string, data: Partial<Supplier>): Promise<Supplier> {
        const response = await fetch(`${API_BASE_URL}/suppliers/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    async delete(id: string): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/suppliers/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        await handleResponse(response);
    },
};

// =============================================================================
// ORDERS API
// =============================================================================

export interface OrderItem {
    product_id: string;
    quantity: number;
    unit_price: number;
    discount_amount?: number;
    total_price: number;
}

export interface Order {
    id: string;
    order_number: string;
    customer_id?: string;
    customer_name?: string;
    status: string;
    payment_status: string;
    subtotal: number;
    discount_amount?: number;
    tax_amount?: number;
    total_amount: number;
    payment_method?: string;
    items?: OrderItem[];
    created_at: string;
}

export interface CreateOrderRequest {
    customer_id?: string;
    subtotal: number;
    discount_amount?: number;
    total_amount: number;
    payment_method?: string;
    cash_received?: number;
    change_amount?: number;
    notes?: string;
    seller_name?: string;
    items: OrderItem[];
}

export const ordersApi = {
    async getAll(params?: { page?: number; limit?: number; status?: string }): Promise<{ data: Order[]; pagination: any }> {
        const searchParams = new URLSearchParams();
        if (params?.page) searchParams.set('page', String(params.page));
        if (params?.limit) searchParams.set('limit', String(params.limit));
        if (params?.status) searchParams.set('status', params.status);

        const url = `${API_BASE_URL}/orders${searchParams.toString() ? '?' + searchParams : ''}`;
        const response = await fetch(url, { headers: getHeaders() });
        return handleResponse(response);
    },

    async getById(id: string): Promise<Order> {
        const response = await fetch(`${API_BASE_URL}/orders/${id}`, { headers: getHeaders() });
        return handleResponse(response);
    },

    async create(data: CreateOrderRequest): Promise<Order> {
        const response = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },
};

// =============================================================================
// CATEGORIES API
// =============================================================================

export interface Category {
    id: string;
    name: string;
    description?: string;
    parent_id?: string;
    sort_order?: number;
    created_at: string;
}

export const categoriesApi = {
    async getAll(): Promise<{ data: Category[] }> {
        const response = await fetch(`${API_BASE_URL}/categories`, { headers: getHeaders() });
        return handleResponse(response);
    },

    async create(data: Partial<Category>): Promise<Category> {
        const response = await fetch(`${API_BASE_URL}/categories`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },
};

// Default export
export default {
    auth: authApi,
    products: productsApi,
    customers: customersApi,
    suppliers: suppliersApi,
    orders: ordersApi,
    categories: categoriesApi,
};
