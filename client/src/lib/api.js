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
}

export const api = new ApiClient();
