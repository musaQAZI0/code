// Data Manager - Handles all data operations for the Crowd application
class DataManager {
  constructor() {
    this.storageKey = "crowdAppData"
    this.sessionKey = "crowdSession"
    this.init()
  }

  init() {
    // Initialize storage if it doesn't exist
    if (!localStorage.getItem(this.storageKey)) {
      const initialData = {
        users: [],
        events: [],
        orders: [],
        settings: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
        },
      }
      localStorage.setItem(this.storageKey, JSON.stringify(initialData))
    }
  }

  // Get all data
  getData() {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey)) || {}
    } catch (error) {
      console.error("Error parsing data:", error)
      return {}
    }
  }

  // Save all data
  saveData(data) {
    try {
      data.settings.lastUpdated = new Date().toISOString()
      localStorage.setItem(this.storageKey, JSON.stringify(data))
      return true
    } catch (error) {
      console.error("Error saving data:", error)
      return false
    }
  }

  // User Management
  async createUser(userData) {
    try {
      const data = this.getData()

      // Check if user already exists
      const existingUser = data.users.find((u) => u.email === userData.email)
      if (existingUser) {
        return { success: false, error: "User with this email already exists" }
      }

      const newUser = {
        id: this.generateId(),
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        password: userData.password, // In production, this should be hashed
        role: userData.role || "organizer",
        createdAt: new Date().toISOString(),
        isActive: true,
        profile: {
          avatar: null,
          bio: "",
          website: "",
          socialLinks: {},
        },
      }

      data.users.push(newUser)
      this.saveData(data)

      // Remove password from returned user object
      const { password, ...userWithoutPassword } = newUser
      return { success: true, user: userWithoutPassword }
    } catch (error) {
      console.error("Error creating user:", error)
      return { success: false, error: "Failed to create user" }
    }
  }

  async authenticateUser(email, password) {
    try {
      const data = this.getData()
      const user = data.users.find((u) => u.email === email && u.password === password && u.isActive)

      if (user) {
        // Create session
        const session = {
          userId: user.id,
          email: user.email,
          loginTime: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        }

        sessionStorage.setItem(this.sessionKey, JSON.stringify(session))

        // Remove password from returned user object
        const { password, ...userWithoutPassword } = user
        return { success: true, user: userWithoutPassword }
      }

      return { success: false, error: "Invalid credentials" }
    } catch (error) {
      console.error("Error authenticating user:", error)
      return { success: false, error: "Authentication failed" }
    }
  }

  getCurrentUser() {
    try {
      const session = JSON.parse(sessionStorage.getItem(this.sessionKey))
      if (!session || new Date() > new Date(session.expiresAt)) {
        this.logout()
        return null
      }

      const data = this.getData()
      const user = data.users.find((u) => u.id === session.userId)
      if (user) {
        const { password, ...userWithoutPassword } = user
        return userWithoutPassword
      }
      return null
    } catch (error) {
      console.error("Error getting current user:", error)
      return null
    }
  }

  isAuthenticated() {
    const user = this.getCurrentUser()
    return user !== null
  }

  logout() {
    sessionStorage.removeItem(this.sessionKey)
  }

  // Event Management
  createEvent(eventData) {
    try {
      const currentUser = this.getCurrentUser()
      if (!currentUser) {
        throw new Error("User not authenticated")
      }

      const data = this.getData()
      const newEvent = {
        id: this.generateId(),
        organizerId: currentUser.id,
        title: eventData.title,
        description: eventData.description || "",
        date: eventData.date,
        startTime: eventData.startTime,
        endTime: eventData.endTime,
        location: eventData.location || "",
        venue: eventData.venue || "",
        category: eventData.category || "Other",
        status: eventData.status || "draft",
        capacity: eventData.capacity || 0,
        isPublic: eventData.isPublic !== false,
        requiresApproval: eventData.requiresApproval || false,
        tags: eventData.tags || [],
        images: eventData.images || [],
        tickets: eventData.tickets || [],
        settings: {
          allowWaitlist: eventData.allowWaitlist || false,
          showAttendeesCount: eventData.showAttendeesCount !== false,
          collectAttendeeInfo: eventData.collectAttendeeInfo !== false,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      data.events.push(newEvent)
      this.saveData(data)
      return newEvent
    } catch (error) {
      console.error("Error creating event:", error)
      throw error
    }
  }

  updateEvent(eventId, updates) {
    try {
      const data = this.getData()
      const eventIndex = data.events.findIndex((e) => e.id === eventId)

      if (eventIndex === -1) {
        throw new Error("Event not found")
      }

      // Verify ownership
      const currentUser = this.getCurrentUser()
      if (data.events[eventIndex].organizerId !== currentUser.id) {
        throw new Error("Not authorized to update this event")
      }

      data.events[eventIndex] = {
        ...data.events[eventIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
      }

      this.saveData(data)
      return data.events[eventIndex]
    } catch (error) {
      console.error("Error updating event:", error)
      throw error
    }
  }

  deleteEvent(eventId) {
    try {
      const data = this.getData()
      const eventIndex = data.events.findIndex((e) => e.id === eventId)

      if (eventIndex === -1) {
        throw new Error("Event not found")
      }

      // Verify ownership
      const currentUser = this.getCurrentUser()
      if (data.events[eventIndex].organizerId !== currentUser.id) {
        throw new Error("Not authorized to delete this event")
      }

      data.events.splice(eventIndex, 1)
      this.saveData(data)
      return true
    } catch (error) {
      console.error("Error deleting event:", error)
      throw error
    }
  }

  getEventById(eventId) {
    const data = this.getData()
    return data.events.find((e) => e.id === eventId)
  }

  getUserEvents() {
    const currentUser = this.getCurrentUser()
    if (!currentUser) return []

    const data = this.getData()
    return data.events.filter((e) => e.organizerId === currentUser.id)
  }

  getAllEvents() {
    const data = this.getData()
    return data.events.filter((e) => e.isPublic && e.status === "published")
  }

  // Ticket Management
  addTicketToEvent(eventId, ticketData) {
    try {
      const event = this.getEventById(eventId)
      if (!event) {
        throw new Error("Event not found")
      }

      const currentUser = this.getCurrentUser()
      if (event.organizerId !== currentUser.id) {
        throw new Error("Not authorized to modify this event")
      }

      const newTicket = {
        id: this.generateId(),
        name: ticketData.name,
        description: ticketData.description || "",
        price: ticketData.price || 0,
        quantity: ticketData.quantity || 0,
        sold: 0,
        type: ticketData.type || "paid", // paid, free, donation
        salesStart: ticketData.salesStart || new Date().toISOString(),
        salesEnd: ticketData.salesEnd || event.date,
        isActive: ticketData.isActive !== false,
        settings: {
          minQuantity: ticketData.minQuantity || 1,
          maxQuantity: ticketData.maxQuantity || 10,
          requiresApproval: ticketData.requiresApproval || false,
        },
        createdAt: new Date().toISOString(),
      }

      if (!event.tickets) {
        event.tickets = []
      }
      event.tickets.push(newTicket)

      this.updateEvent(eventId, { tickets: event.tickets })
      return newTicket
    } catch (error) {
      console.error("Error adding ticket:", error)
      throw error
    }
  }

  updateTicket(eventId, ticketId, updates) {
    try {
      const event = this.getEventById(eventId)
      if (!event) {
        throw new Error("Event not found")
      }

      const currentUser = this.getCurrentUser()
      if (event.organizerId !== currentUser.id) {
        throw new Error("Not authorized to modify this event")
      }

      const ticketIndex = event.tickets.findIndex((t) => t.id === ticketId)
      if (ticketIndex === -1) {
        throw new Error("Ticket not found")
      }

      event.tickets[ticketIndex] = {
        ...event.tickets[ticketIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
      }

      this.updateEvent(eventId, { tickets: event.tickets })
      return event.tickets[ticketIndex]
    } catch (error) {
      console.error("Error updating ticket:", error)
      throw error
    }
  }

  // Order Management
  createOrder(orderData) {
    try {
      const data = this.getData()
      const newOrder = {
        id: this.generateId(),
        orderNumber: this.generateOrderNumber(),
        eventId: orderData.eventId,
        eventTitle: orderData.eventTitle,
        buyerName: orderData.buyerName,
        buyerEmail: orderData.buyerEmail,
        buyerPhone: orderData.buyerPhone || "",
        ticketType: orderData.ticketType,
        ticketQuantity: orderData.ticketQuantity || 1,
        unitPrice: orderData.unitPrice || 0,
        total: orderData.total || 0,
        fees: orderData.fees || 0,
        tax: orderData.tax || 0,
        status: orderData.status || "Pending",
        paymentMethod: orderData.paymentMethod || "Credit Card",
        paymentStatus: orderData.paymentStatus || "Pending",
        orderDate: new Date().toISOString(),
        notes: orderData.notes || "",
        refundAmount: 0,
        isRefunded: false,
      }

      data.orders.push(newOrder)
      this.saveData(data)
      return newOrder
    } catch (error) {
      console.error("Error creating order:", error)
      throw error
    }
  }

  updateOrder(orderId, updates) {
    try {
      const data = this.getData()
      const orderIndex = data.orders.findIndex((o) => o.id === orderId)

      if (orderIndex === -1) {
        throw new Error("Order not found")
      }

      data.orders[orderIndex] = {
        ...data.orders[orderIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
      }

      this.saveData(data)
      return data.orders[orderIndex]
    } catch (error) {
      console.error("Error updating order:", error)
      throw error
    }
  }

  getOrderById(orderId) {
    const data = this.getData()
    return data.orders.find((o) => o.id === orderId)
  }

  getOrdersForOrganizer() {
    const currentUser = this.getCurrentUser()
    if (!currentUser) return []

    const data = this.getData()
    const userEvents = data.events.filter((e) => e.organizerId === currentUser.id)
    const userEventIds = userEvents.map((e) => e.id)

    return data.orders.filter((o) => userEventIds.includes(o.eventId))
  }

  getOrdersForEvent(eventId) {
    const data = this.getData()
    return data.orders.filter((o) => o.eventId === eventId)
  }

  // Get all orders (for the current organizer)
  getOrders() {
    return this.getOrdersForOrganizer()
  }

  // Save a single order
  saveOrder(orderData) {
    try {
      const data = this.getData()

      // Check if order already exists
      const existingOrderIndex = data.orders.findIndex((o) => o.id === orderData.id)

      if (existingOrderIndex !== -1) {
        // Update existing order
        data.orders[existingOrderIndex] = {
          ...data.orders[existingOrderIndex],
          ...orderData,
          updatedAt: new Date().toISOString(),
        }
      } else {
        // Add new order
        const newOrder = {
          ...orderData,
          createdAt: orderData.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        data.orders.push(newOrder)
      }

      this.saveData(data)
      return true
    } catch (error) {
      console.error("Error saving order:", error)
      return false
    }
  }

  // Save event (for sample data generation)
  saveEvent(eventData) {
    try {
      const data = this.getData()

      // Check if event already exists
      const existingEventIndex = data.events.findIndex((e) => e.id === eventData.id)

      if (existingEventIndex !== -1) {
        // Update existing event
        data.events[existingEventIndex] = {
          ...data.events[existingEventIndex],
          ...eventData,
          updatedAt: new Date().toISOString(),
        }
      } else {
        // Add new event
        const newEvent = {
          ...eventData,
          createdAt: eventData.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        data.events.push(newEvent)
      }

      this.saveData(data)
      return true
    } catch (error) {
      console.error("Error saving event:", error)
      return false
    }
  }

  // Analytics and Reporting
  getAnalyticsData(timeRange = 30) {
    const currentUser = this.getCurrentUser()
    if (!currentUser) return null

    const data = this.getData()
    const userEvents = data.events.filter((e) => e.organizerId === currentUser.id)
    const userEventIds = userEvents.map((e) => e.id)
    const orders = data.orders.filter((o) => userEventIds.includes(o.eventId))

    // Filter by time range
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - timeRange)
    const filteredOrders = orders.filter((o) => new Date(o.orderDate) >= cutoffDate)

    // Calculate metrics
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.total, 0)
    const totalTickets = filteredOrders.reduce((sum, o) => sum + o.ticketQuantity, 0)
    const totalEvents = userEvents.length
    const publishedEvents = userEvents.filter((e) => e.status === "published").length
    const avgTicketPrice = totalTickets > 0 ? totalRevenue / totalTickets : 0

    // Monthly breakdown
    const monthlyData = this.calculateMonthlyData(filteredOrders)

    // Top events
    const eventStats = this.calculateEventStats(userEvents, orders)

    return {
      totalRevenue,
      totalTickets,
      totalEvents,
      publishedEvents,
      avgTicketPrice,
      monthlyData,
      topEvents: eventStats.slice(0, 10),
      orders: filteredOrders,
    }
  }

  calculateMonthlyData(orders) {
    const monthlyStats = {}
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    // Initialize all months
    months.forEach((month) => {
      monthlyStats[month] = { tickets: 0, revenue: 0 }
    })

    orders.forEach((order) => {
      const date = new Date(order.orderDate)
      const month = months[date.getMonth()]
      monthlyStats[month].tickets += order.ticketQuantity
      monthlyStats[month].revenue += order.total
    })

    return Object.entries(monthlyStats).map(([month, data]) => ({
      month,
      tickets: data.tickets,
      revenue: data.revenue,
    }))
  }

  calculateEventStats(events, orders) {
    const eventStats = {}

    events.forEach((event) => {
      eventStats[event.id] = {
        id: event.id,
        title: event.title,
        date: event.date,
        status: event.status,
        capacity: event.capacity || 0,
        tickets: 0,
        revenue: 0,
      }
    })

    orders.forEach((order) => {
      if (eventStats[order.eventId]) {
        eventStats[order.eventId].tickets += order.ticketQuantity
        eventStats[order.eventId].revenue += order.total
      }
    })

    return Object.values(eventStats).sort((a, b) => b.tickets - a.tickets)
  }

  // Utility functions
  generateId() {
    return "id_" + Math.random().toString(36).substr(2, 9) + Date.now()
  }

  generateOrderNumber() {
    const prefix = "ORD"
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.random().toString(36).substr(2, 4).toUpperCase()
    return `${prefix}-${timestamp}-${random}`
  }

  // Data export/import
  exportData() {
    const data = this.getData()
    const exportData = {
      ...data,
      exportedAt: new Date().toISOString(),
      version: "1.0.0",
    }
    return JSON.stringify(exportData, null, 2)
  }

  importData(jsonData) {
    try {
      const importedData = JSON.parse(jsonData)
      // Validate data structure
      if (!importedData.users || !importedData.events || !importedData.orders) {
        throw new Error("Invalid data format")
      }
      this.saveData(importedData)
      return true
    } catch (error) {
      console.error("Error importing data:", error)
      return false
    }
  }

  // Clear all data (for development/testing)
  clearAllData() {
    localStorage.removeItem(this.storageKey)
    sessionStorage.removeItem(this.sessionKey)
    this.init()
  }
}

// Create global instance
window.dataManager = new DataManager()
