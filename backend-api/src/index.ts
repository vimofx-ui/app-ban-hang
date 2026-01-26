import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { neon } from '@neondatabase/serverless'

// Define bindings type
type Bindings = {
  DATABASE_URL: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for all origins (adjust in production)
app.use('*', cors())

// =============================================================================
// HEALTH CHECK
// =============================================================================
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    message: 'AppBanHang API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  })
})

// Test database connection
app.get('/db-test', async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL)
    const result = await sql`SELECT NOW() as current_time`
    return c.json({
      status: 'connected',
      database_time: result[0].current_time
    })
  } catch (error) {
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// =============================================================================
// PRODUCTS API
// =============================================================================

// GET /products - List all products with pagination
app.get('/products', async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL)
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '50')
    const search = c.req.query('search') || ''
    const offset = (page - 1) * limit

    let products
    if (search) {
      products = await sql`
        SELECT * FROM products 
        WHERE name ILIKE ${'%' + search + '%'} 
           OR barcode ILIKE ${'%' + search + '%'}
           OR sku ILIKE ${'%' + search + '%'}
        ORDER BY created_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `
    } else {
      products = await sql`
        SELECT * FROM products 
        ORDER BY created_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `
    }

    // Get total count
    const countResult = await sql`SELECT COUNT(*) as total FROM products`
    const total = parseInt(countResult[0].total)

    return c.json({
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// GET /products/:id - Get single product
app.get('/products/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const sql = neon(c.env.DATABASE_URL)
    const product = await sql`SELECT * FROM products WHERE id = ${id}`
    if (product.length === 0) {
      return c.json({ status: 'error', message: 'Product not found' }, 404)
    }
    return c.json(product[0])
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// POST /products - Create new product
app.post('/products', async (c) => {
  try {
    const body = await c.req.json()
    const sql = neon(c.env.DATABASE_URL)

    const result = await sql`
      INSERT INTO products (name, sku, barcode, description, selling_price, cost_price, current_stock, min_stock, base_unit, category_id, is_active)
      VALUES (
        ${body.name},
        ${body.sku || null},
        ${body.barcode || null},
        ${body.description || null},
        ${body.selling_price},
        ${body.cost_price || 0},
        ${body.current_stock || 0},
        ${body.min_stock || 0},
        ${body.base_unit || 'Cái'},
        ${body.category_id || null},
        ${body.is_active !== false}
      )
      RETURNING *
    `
    return c.json(result[0], 201)
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// PUT /products/:id - Update product
app.put('/products/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const sql = neon(c.env.DATABASE_URL)

    const result = await sql`
      UPDATE products SET
        name = COALESCE(${body.name}, name),
        sku = COALESCE(${body.sku}, sku),
        barcode = COALESCE(${body.barcode}, barcode),
        description = COALESCE(${body.description}, description),
        selling_price = COALESCE(${body.selling_price}, selling_price),
        cost_price = COALESCE(${body.cost_price}, cost_price),
        current_stock = COALESCE(${body.current_stock}, current_stock),
        min_stock = COALESCE(${body.min_stock}, min_stock),
        base_unit = COALESCE(${body.base_unit}, base_unit),
        category_id = COALESCE(${body.category_id}, category_id),
        is_active = COALESCE(${body.is_active}, is_active),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    if (result.length === 0) {
      return c.json({ status: 'error', message: 'Product not found' }, 404)
    }
    return c.json(result[0])
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// DELETE /products/:id - Delete product
app.delete('/products/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const sql = neon(c.env.DATABASE_URL)
    const result = await sql`DELETE FROM products WHERE id = ${id} RETURNING id`
    if (result.length === 0) {
      return c.json({ status: 'error', message: 'Product not found' }, 404)
    }
    return c.json({ status: 'success', message: 'Product deleted' })
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// =============================================================================
// CUSTOMERS API
// =============================================================================

// GET /customers - List all customers
app.get('/customers', async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL)
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '50')
    const search = c.req.query('search') || ''
    const offset = (page - 1) * limit

    let customers
    if (search) {
      customers = await sql`
        SELECT * FROM customers 
        WHERE name ILIKE ${'%' + search + '%'} 
           OR phone ILIKE ${'%' + search + '%'}
           OR code ILIKE ${'%' + search + '%'}
        ORDER BY created_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `
    } else {
      customers = await sql`SELECT * FROM customers ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
    }

    const countResult = await sql`SELECT COUNT(*) as total FROM customers`
    return c.json({
      data: customers,
      pagination: { page, limit, total: parseInt(countResult[0].total) }
    })
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// GET /customers/:id
app.get('/customers/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const sql = neon(c.env.DATABASE_URL)
    const customer = await sql`SELECT * FROM customers WHERE id = ${id}`
    if (customer.length === 0) {
      return c.json({ status: 'error', message: 'Customer not found' }, 404)
    }
    return c.json(customer[0])
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// POST /customers
app.post('/customers', async (c) => {
  try {
    const body = await c.req.json()
    const sql = neon(c.env.DATABASE_URL)
    const result = await sql`
      INSERT INTO customers (name, phone, email, address, code, gender, notes)
      VALUES (${body.name}, ${body.phone || null}, ${body.email || null}, ${body.address || null}, ${body.code || null}, ${body.gender || null}, ${body.notes || null})
      RETURNING *
    `
    return c.json(result[0], 201)
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// PUT /customers/:id
app.put('/customers/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const sql = neon(c.env.DATABASE_URL)
    const result = await sql`
      UPDATE customers SET
        name = COALESCE(${body.name}, name),
        phone = COALESCE(${body.phone}, phone),
        email = COALESCE(${body.email}, email),
        address = COALESCE(${body.address}, address),
        gender = COALESCE(${body.gender}, gender),
        notes = COALESCE(${body.notes}, notes),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    if (result.length === 0) return c.json({ status: 'error', message: 'Customer not found' }, 404)
    return c.json(result[0])
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// DELETE /customers/:id
app.delete('/customers/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const sql = neon(c.env.DATABASE_URL)
    const result = await sql`DELETE FROM customers WHERE id = ${id} RETURNING id`
    if (result.length === 0) return c.json({ status: 'error', message: 'Customer not found' }, 404)
    return c.json({ status: 'success', message: 'Customer deleted' })
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// =============================================================================
// SUPPLIERS API
// =============================================================================

// GET /suppliers
app.get('/suppliers', async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL)
    const suppliers = await sql`SELECT * FROM suppliers ORDER BY created_at DESC`
    return c.json({ data: suppliers })
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// GET /suppliers/:id
app.get('/suppliers/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const sql = neon(c.env.DATABASE_URL)
    const supplier = await sql`SELECT * FROM suppliers WHERE id = ${id}`
    if (supplier.length === 0) return c.json({ status: 'error', message: 'Supplier not found' }, 404)
    return c.json(supplier[0])
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// POST /suppliers
app.post('/suppliers', async (c) => {
  try {
    const body = await c.req.json()
    const sql = neon(c.env.DATABASE_URL)
    const result = await sql`
      INSERT INTO suppliers (name, contact_person, phone, email, address, tax_id, payment_terms, notes, code)
      VALUES (${body.name}, ${body.contact_person || null}, ${body.phone || null}, ${body.email || null}, ${body.address || null}, ${body.tax_id || null}, ${body.payment_terms || 0}, ${body.notes || null}, ${body.code || null})
      RETURNING *
    `
    return c.json(result[0], 201)
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// PUT /suppliers/:id
app.put('/suppliers/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const sql = neon(c.env.DATABASE_URL)
    const result = await sql`
      UPDATE suppliers SET
        name = COALESCE(${body.name}, name),
        contact_person = COALESCE(${body.contact_person}, contact_person),
        phone = COALESCE(${body.phone}, phone),
        email = COALESCE(${body.email}, email),
        address = COALESCE(${body.address}, address),
        tax_id = COALESCE(${body.tax_id}, tax_id),
        payment_terms = COALESCE(${body.payment_terms}, payment_terms),
        notes = COALESCE(${body.notes}, notes),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    if (result.length === 0) return c.json({ status: 'error', message: 'Supplier not found' }, 404)
    return c.json(result[0])
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// DELETE /suppliers/:id
app.delete('/suppliers/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const sql = neon(c.env.DATABASE_URL)
    const result = await sql`DELETE FROM suppliers WHERE id = ${id} RETURNING id`
    if (result.length === 0) return c.json({ status: 'error', message: 'Supplier not found' }, 404)
    return c.json({ status: 'success', message: 'Supplier deleted' })
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// =============================================================================
// ORDERS API
// =============================================================================

// GET /orders - List orders
app.get('/orders', async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL)
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '50')
    const status = c.req.query('status')
    const offset = (page - 1) * limit

    let orders
    if (status) {
      orders = await sql`
        SELECT o.*, c.name as customer_name 
        FROM orders o 
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.status = ${status}
        ORDER BY o.created_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `
    } else {
      orders = await sql`
        SELECT o.*, c.name as customer_name 
        FROM orders o 
        LEFT JOIN customers c ON o.customer_id = c.id
        ORDER BY o.created_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `
    }

    const countResult = await sql`SELECT COUNT(*) as total FROM orders`
    return c.json({
      data: orders,
      pagination: { page, limit, total: parseInt(countResult[0].total) }
    })
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// GET /orders/:id - Get order with items
app.get('/orders/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const sql = neon(c.env.DATABASE_URL)

    const order = await sql`
      SELECT o.*, c.name as customer_name 
      FROM orders o 
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ${id}
    `
    if (order.length === 0) return c.json({ status: 'error', message: 'Order not found' }, 404)

    const items = await sql`
      SELECT oi.*, p.name as product_name, p.barcode, p.sku
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ${id}
    `

    return c.json({ ...order[0], items })
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// POST /orders - Create order with items
app.post('/orders', async (c) => {
  try {
    const body = await c.req.json()
    const sql = neon(c.env.DATABASE_URL)

    // Generate order number
    const orderNumber = `DH${Date.now()}`

    // Create order
    const orderResult = await sql`
      INSERT INTO orders (
        order_number, customer_id, status, payment_status, subtotal, 
        discount_amount, tax_amount, total_amount, payment_method,
        cash_received, change_amount, notes, seller_name
      )
      VALUES (
        ${orderNumber}, ${body.customer_id || null}, ${body.status || 'completed'},
        ${body.payment_status || 'paid'}, ${body.subtotal}, ${body.discount_amount || 0},
        ${body.tax_amount || 0}, ${body.total_amount}, ${body.payment_method || 'cash'},
        ${body.cash_received || 0}, ${body.change_amount || 0}, ${body.notes || null},
        ${body.seller_name || null}
      )
      RETURNING *
    `
    const order = orderResult[0]

    // Insert order items
    if (body.items && body.items.length > 0) {
      for (const item of body.items) {
        await sql`
          INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_amount, total_price)
          VALUES (${order.id}, ${item.product_id}, ${item.quantity}, ${item.unit_price}, ${item.discount_amount || 0}, ${item.total_price})
        `

        // Update product stock
        await sql`
          UPDATE products SET current_stock = current_stock - ${item.quantity}, updated_at = NOW()
          WHERE id = ${item.product_id}
        `
      }
    }

    return c.json(order, 201)
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// =============================================================================
// CATEGORIES API
// =============================================================================

app.get('/categories', async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL)
    const categories = await sql`SELECT * FROM categories ORDER BY sort_order, name`
    return c.json({ data: categories })
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

app.post('/categories', async (c) => {
  try {
    const body = await c.req.json()
    const sql = neon(c.env.DATABASE_URL)
    const result = await sql`
      INSERT INTO categories (name, description, parent_id, sort_order)
      VALUES (${body.name}, ${body.description || null}, ${body.parent_id || null}, ${body.sort_order || 0})
      RETURNING *
    `
    return c.json(result[0], 201)
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// =============================================================================
// AUTH API (Login/Register with JWT)
// =============================================================================

// Simple password hashing (for demo - in production use bcrypt via external service)
function simpleHash(password: string): string {
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return 'h_' + Math.abs(hash).toString(16) + '_' + password.length
}

function verifyPassword(password: string, hash: string): boolean {
  return simpleHash(password) === hash
}

// Simple JWT implementation for Cloudflare Workers
async function createToken(payload: any, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '')
  const encodedPayload = btoa(JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 })).replace(/=/g, '')
  const signature = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(encodedHeader + '.' + encodedPayload + secret)
  )
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '')
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`
}

async function verifyToken(token: string, secret: string): Promise<any | null> {
  try {
    const [header, payload, signature] = token.split('.')
    const expectedSignature = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(header + '.' + payload + secret)
    )
    const encodedExpectedSig = btoa(String.fromCharCode(...new Uint8Array(expectedSignature))).replace(/=/g, '')
    if (signature !== encodedExpectedSig) return null
    const decoded = JSON.parse(atob(payload))
    if (decoded.exp && decoded.exp < Date.now()) return null
    return decoded
  } catch {
    return null
  }
}

// POST /auth/register - Register new user
app.post('/auth/register', async (c) => {
  try {
    const body = await c.req.json()
    const { email, password, full_name, phone } = body

    if (!email || !password || !full_name) {
      return c.json({ status: 'error', message: 'Email, password và tên là bắt buộc' }, 400)
    }

    const sql = neon(c.env.DATABASE_URL)

    // Check if email exists
    const existing = await sql`SELECT id FROM user_profiles WHERE email = ${email}`
    if (existing.length > 0) {
      return c.json({ status: 'error', message: 'Email đã được sử dụng' }, 400)
    }

    // Create user
    const passwordHash = simpleHash(password)
    const result = await sql`
      INSERT INTO user_profiles (email, full_name, phone, role, permissions, is_active)
      VALUES (${email}, ${full_name}, ${phone || null}, 'staff', '["pos.access", "products.view"]'::jsonb, true)
      RETURNING id, email, full_name, phone, role, is_active, created_at
    `

    // Store password hash (in a separate auth table or as metadata)
    await sql`
      UPDATE user_profiles SET avatar_url = ${passwordHash} WHERE id = ${result[0].id}
    `

    // Note: Using avatar_url temporarily to store password hash for demo
    // In production, use a separate auth table

    const user = result[0]
    const token = await createToken({ userId: user.id, email: user.email, role: user.role }, 'your-jwt-secret-key-change-in-production')

    return c.json({
      status: 'success',
      message: 'Đăng ký thành công',
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
      token
    }, 201)
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// POST /auth/login - Login user
app.post('/auth/login', async (c) => {
  try {
    const body = await c.req.json()
    const { email, password } = body

    if (!email || !password) {
      return c.json({ status: 'error', message: 'Email và password là bắt buộc' }, 400)
    }

    const sql = neon(c.env.DATABASE_URL)

    // Find user by email
    const users = await sql`
      SELECT id, email, full_name, phone, role, avatar_url as password_hash, is_active
      FROM user_profiles WHERE email = ${email}
    `

    if (users.length === 0) {
      return c.json({ status: 'error', message: 'Email hoặc mật khẩu không đúng' }, 401)
    }

    const user = users[0]

    if (!user.is_active) {
      return c.json({ status: 'error', message: 'Tài khoản đã bị vô hiệu hóa' }, 401)
    }

    // Verify password
    if (!verifyPassword(password, user.password_hash || '')) {
      return c.json({ status: 'error', message: 'Email hoặc mật khẩu không đúng' }, 401)
    }

    // Generate token
    const token = await createToken(
      { userId: user.id, email: user.email, role: user.role },
      'your-jwt-secret-key-change-in-production'
    )

    return c.json({
      status: 'success',
      message: 'Đăng nhập thành công',
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
      token
    })
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// GET /auth/me - Get current user (protected route)
app.get('/auth/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ status: 'error', message: 'Token không hợp lệ' }, 401)
    }

    const token = authHeader.substring(7)
    const payload = await verifyToken(token, 'your-jwt-secret-key-change-in-production')

    if (!payload) {
      return c.json({ status: 'error', message: 'Token hết hạn hoặc không hợp lệ' }, 401)
    }

    const sql = neon(c.env.DATABASE_URL)
    const users = await sql`
      SELECT id, email, full_name, phone, role, permissions, is_active, created_at
      FROM user_profiles WHERE id = ${payload.userId}
    `

    if (users.length === 0) {
      return c.json({ status: 'error', message: 'Người dùng không tồn tại' }, 404)
    }

    return c.json({ status: 'success', user: users[0] })
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// =============================================================================
// ROLES API
// =============================================================================

app.get('/roles', async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL)
    const roles = await sql`SELECT * FROM roles ORDER BY name`
    return c.json({ data: roles })
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// =============================================================================
// USER PROFILES API
// =============================================================================

app.get('/users', async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL)
    const users = await sql`
      SELECT id, email, full_name, phone, role, permissions, is_active, created_at 
      FROM user_profiles 
      ORDER BY created_at DESC
    `
    return c.json({ data: users })
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

app.get('/users/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const sql = neon(c.env.DATABASE_URL)
    const users = await sql`
      SELECT id, email, full_name, phone, role, permissions, is_active, created_at 
      FROM user_profiles WHERE id = ${id}
    `
    if (users.length === 0) return c.json({ status: 'error', message: 'User not found' }, 404)
    return c.json(users[0])
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

app.put('/users/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const sql = neon(c.env.DATABASE_URL)
    const result = await sql`
      UPDATE user_profiles SET
        full_name = COALESCE(${body.full_name}, full_name),
        phone = COALESCE(${body.phone}, phone),
        role = COALESCE(${body.role}, role),
        permissions = COALESCE(${body.permissions}::jsonb, permissions),
        is_active = COALESCE(${body.is_active}, is_active),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, email, full_name, phone, role, permissions, is_active
    `
    if (result.length === 0) return c.json({ status: 'error', message: 'User not found' }, 404)
    return c.json(result[0])
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// =============================================================================
// SHIFTS API
// =============================================================================

app.get('/shifts', async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL)
    const status = c.req.query('status')
    let shifts
    if (status) {
      shifts = await sql`SELECT * FROM shifts WHERE status = ${status} ORDER BY clock_in DESC LIMIT 50`
    } else {
      shifts = await sql`SELECT * FROM shifts ORDER BY clock_in DESC LIMIT 50`
    }
    return c.json({ data: shifts })
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

app.get('/shifts/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const sql = neon(c.env.DATABASE_URL)
    const shifts = await sql`SELECT * FROM shifts WHERE id = ${id}`
    if (shifts.length === 0) return c.json({ status: 'error', message: 'Shift not found' }, 404)
    return c.json(shifts[0])
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

app.post('/shifts', async (c) => {
  try {
    const body = await c.req.json()
    const sql = neon(c.env.DATABASE_URL)
    const result = await sql`
      INSERT INTO shifts (user_id, clock_in, opening_cash, status)
      VALUES (${body.user_id}, NOW(), ${body.opening_cash || 0}, 'active')
      RETURNING *
    `
    return c.json(result[0], 201)
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

app.put('/shifts/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const sql = neon(c.env.DATABASE_URL)
    const result = await sql`
      UPDATE shifts SET
        clock_out = COALESCE(${body.clock_out}, clock_out),
        closing_cash = COALESCE(${body.closing_cash}, closing_cash),
        total_cash_sales = COALESCE(${body.total_cash_sales}, total_cash_sales),
        total_card_sales = COALESCE(${body.total_card_sales}, total_card_sales),
        total_transfer_sales = COALESCE(${body.total_transfer_sales}, total_transfer_sales),
        total_returns = COALESCE(${body.total_returns}, total_returns),
        status = COALESCE(${body.status}, status),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    if (result.length === 0) return c.json({ status: 'error', message: 'Shift not found' }, 404)
    return c.json(result[0])
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// =============================================================================
// STOCK HISTORY API
// =============================================================================

app.get('/stock-history', async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL)
    const productId = c.req.query('product_id')
    let history
    if (productId) {
      history = await sql`
        SELECT sh.*, p.name as product_name 
        FROM stock_history sh 
        JOIN products p ON sh.product_id = p.id
        WHERE sh.product_id = ${productId}
        ORDER BY sh.created_at DESC LIMIT 100
      `
    } else {
      history = await sql`
        SELECT sh.*, p.name as product_name 
        FROM stock_history sh 
        JOIN products p ON sh.product_id = p.id
        ORDER BY sh.created_at DESC LIMIT 100
      `
    }
    return c.json({ data: history })
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

app.post('/stock-history', async (c) => {
  try {
    const body = await c.req.json()
    const sql = neon(c.env.DATABASE_URL)

    // Get current stock
    const product = await sql`SELECT current_stock FROM products WHERE id = ${body.product_id}`
    if (product.length === 0) return c.json({ status: 'error', message: 'Product not found' }, 404)

    const quantityBefore = parseFloat(product[0].current_stock)
    const quantityAfter = quantityBefore + body.quantity_change

    // Insert stock history
    await sql`
      INSERT INTO stock_history (product_id, quantity_change, quantity_before, quantity_after, reason, reference_type, reference_id)
      VALUES (${body.product_id}, ${body.quantity_change}, ${quantityBefore}, ${quantityAfter}, ${body.reason || null}, ${body.reference_type || 'manual'}, ${body.reference_id || null})
    `

    // Update product stock
    await sql`UPDATE products SET current_stock = ${quantityAfter}, updated_at = NOW() WHERE id = ${body.product_id}`

    return c.json({ status: 'success', quantity_before: quantityBefore, quantity_after: quantityAfter }, 201)
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

// =============================================================================
// AUDIT LOGS API
// =============================================================================

app.get('/audit-logs', async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL)
    const limit = parseInt(c.req.query('limit') || '50')
    const logs = await sql`
      SELECT al.*, u.full_name as user_name 
      FROM audit_logs al 
      LEFT JOIN user_profiles u ON al.user_id = u.id
      ORDER BY al.created_at DESC 
      LIMIT ${limit}
    `
    return c.json({ data: logs })
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

app.post('/audit-logs', async (c) => {
  try {
    const body = await c.req.json()
    const sql = neon(c.env.DATABASE_URL)
    const result = await sql`
      INSERT INTO audit_logs (user_id, action_type, entity_type, entity_id, old_value, new_value, reason)
      VALUES (${body.user_id || null}, ${body.action_type}, ${body.entity_type || null}, ${body.entity_id || null}, ${body.old_value || null}::jsonb, ${body.new_value || null}::jsonb, ${body.reason || null})
      RETURNING *
    `
    return c.json(result[0], 201)
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

export default app


