const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('halo_token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('halo_token', token);
    } else {
      localStorage.removeItem('halo_token');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // Auth
  async register(email, password, firstName, lastName, phoneNumber) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, firstName, lastName, phoneNumber }),
    });
    this.setToken(data.token);
    return data;
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async getGoogleAuthUrl() {
    return this.request('/auth/google/url');
  }

  async googleCallback(code) {
    const data = await this.request('/auth/google/callback', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    this.setToken(data.token);
    return data;
  }

  async me() {
    return this.request('/auth/me');
  }

  async updateProfile(userData) {
    return this.request('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  // Calendar integration
  async getCalendarStatus() {
    return this.request('/auth/calendar/status');
  }

  async getCalendarAuthUrl() {
    return this.request('/auth/calendar/url');
  }

  async calendarCallback(code) {
    return this.request('/auth/calendar/callback', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async disconnectCalendar() {
    return this.request('/auth/calendar', {
      method: 'DELETE',
    });
  }

  logout() {
    this.setToken(null);
  }

  // Availability
  async getAvailability(date) {
    return this.request(`/availability/${date}`);
  }

  // Bookings
  async createBooking(data) {
    return this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getBookings() {
    return this.request('/bookings');
  }

  async cancelBooking(bookingId) {
    return this.request(`/bookings/${bookingId}`, {
      method: 'DELETE',
    });
  }

  // Admin
  async getScheduleDefaults() {
    return this.request('/admin/schedule/defaults');
  }

  async updateScheduleDefaults(config) {
    return this.request('/admin/schedule/defaults', {
      method: 'PUT',
      body: JSON.stringify({ config }),
    });
  }

  async getOverrides() {
    return this.request('/admin/schedule/overrides');
  }

  async addOverride(data) {
    return this.request('/admin/schedule/overrides', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteOverride(id) {
    return this.request(`/admin/schedule/overrides/${id}`, {
      method: 'DELETE',
    });
  }

  async bulkCloseSchedule(startDate, endDate) {
    return this.request('/admin/schedule/bulk-close', {
      method: 'POST',
      body: JSON.stringify({ startDate, endDate }),
    });
  }

  async getWeeklyOverrides() {
    return this.request('/admin/schedule/weekly-overrides');
  }

  async addWeeklyOverride(weekStartDate, daysConfig) {
    return this.request('/admin/schedule/weekly-overrides', {
      method: 'POST',
      body: JSON.stringify({ week_start_date: weekStartDate, days_config: daysConfig }),
    });
  }

  async deleteWeeklyOverride(weekStartDate) {
    return this.request(`/admin/schedule/weekly-overrides/${weekStartDate}`, {
      method: 'DELETE',
    });
  }

  async getSessions() {
    return this.request('/admin/sessions');
  }

  async cancelSession(sessionId) {
    return this.request(`/admin/sessions/${sessionId}/cancel`, {
      method: 'POST',
    });
  }

  async getStats() {
    return this.request('/admin/stats');
  }

  // Slot Closures
  async getSlotClosures(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString();
    return this.request(`/admin/schedule/slot-closures${query ? `?${query}` : ''}`);
  }

  async createSlotClosure(data) {
    return this.request('/admin/schedule/slot-closures', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async bulkCreateSlotClosures(closures) {
    return this.request('/admin/schedule/slot-closures/bulk', {
      method: 'POST',
      body: JSON.stringify({ closures }),
    });
  }

  async deleteSlotClosure(id) {
    return this.request(`/admin/schedule/slot-closures/${id}`, {
      method: 'DELETE',
    });
  }

  // Pricing Tiers
  async getPricingTiers() {
    return this.request('/admin/pricing/tiers');
  }

  async createPricingTier(data) {
    return this.request('/admin/pricing/tiers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePricingTier(id, data) {
    return this.request(`/admin/pricing/tiers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePricingTier(id) {
    return this.request(`/admin/pricing/tiers/${id}`, {
      method: 'DELETE',
    });
  }

  async getTierPrices(tierId) {
    return this.request(`/admin/pricing/tiers/${tierId}/prices`);
  }

  async setTierPrices(tierId, prices) {
    return this.request(`/admin/pricing/tiers/${tierId}/prices`, {
      method: 'POST',
      body: JSON.stringify({ prices }),
    });
  }

  // User Management
  async getUsers(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.append('search', params.search);
    if (params.tier) searchParams.append('tier', params.tier);
    if (params.isAdmin !== undefined) searchParams.append('isAdmin', params.isAdmin);
    if (params.limit) searchParams.append('limit', params.limit);
    if (params.offset) searchParams.append('offset', params.offset);
    const query = searchParams.toString();
    return this.request(`/admin/users${query ? `?${query}` : ''}`);
  }

  async createUser(data) {
    return this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUser(id) {
    return this.request(`/admin/users/${id}`);
  }

  async updateUser(id, data) {
    return this.request(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getUserStats(id) {
    return this.request(`/admin/users/${id}/stats`);
  }

  async getUserBookings(id, params = {}) {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.append('limit', params.limit);
    if (params.offset) searchParams.append('offset', params.offset);
    const query = searchParams.toString();
    return this.request(`/admin/users/${id}/bookings${query ? `?${query}` : ''}`);
  }

  async getUserNotes(id) {
    return this.request(`/admin/users/${id}/notes`);
  }

  async addUserNote(userId, note) {
    return this.request(`/admin/users/${userId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  }

  async deleteUserNote(noteId) {
    return this.request(`/admin/user-notes/${noteId}`, {
      method: 'DELETE',
    });
  }

  async assignUserTier(userId, tierId) {
    return this.request(`/admin/users/${userId}/tier`, {
      method: 'PUT',
      body: JSON.stringify({ tierId }),
    });
  }

  // User Pricing Overrides
  async getUserPricing(userId) {
    return this.request(`/admin/users/${userId}/pricing`);
  }

  async addUserPricing(userId, data) {
    return this.request(`/admin/users/${userId}/pricing`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteUserPricing(pricingId) {
    return this.request(`/admin/user-pricing/${pricingId}`, {
      method: 'DELETE',
    });
  }

  async updateBookingPrice(bookingId, price) {
    return this.request(`/admin/bookings/${bookingId}/price`, {
      method: 'PUT',
      body: JSON.stringify({ price }),
    });
  }

  async recalculateUserPrices(userId) {
    return this.request(`/admin/users/${userId}/recalculate-prices`, {
      method: 'POST',
    });
  }

  // Admin Booking
  async getBookingPricePreview(userId, classType, mode) {
    const params = new URLSearchParams({ userId, classType, mode });
    return this.request(`/admin/bookings/price-preview?${params}`);
  }

  async getAdminAvailability(date) {
    return this.request(`/admin/bookings/availability/${date}`);
  }

  async createAdminBooking(data) {
    return this.request('/admin/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
