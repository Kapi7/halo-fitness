import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Loader2,
  Trash2,
  Save,
  Users,
  Calendar,
  Clock,
  TrendingUp,
  Lock,
  DollarSign,
  Plus,
  Search,
  Edit2,
  X,
  MessageSquare,
  Tag,
  CalendarPlus,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const CLASS_TYPES = [
  { value: '', label: 'User chooses' },
  { value: 'HIIT', label: 'HIIT' },
  { value: 'Pilates Reformer', label: 'Pilates Reformer' },
  { value: 'Pilates Clinical Rehab', label: 'Pilates Clinical Rehab' },
  { value: 'Pilates Matte', label: 'Pilates Matte' },
];

const CLASS_TYPE_OPTIONS = [
  { value: 'HIIT', label: 'HIIT' },
  { value: 'Pilates Reformer', label: 'Pilates Reformer' },
  { value: 'Pilates Clinical Rehab', label: 'Pilates Clinical Rehab' },
  { value: 'Pilates Matte', label: 'Pilates Matte' },
];

const MODE_OPTIONS = [
  { value: 'Private', label: 'Private' },
  { value: 'Group', label: 'Group' },
];

const BASE_PRICES = {
  HIIT: { Private: 45, Group: 25 },
  'Pilates Reformer': { Private: 50, Group: 50 },
  'Pilates Clinical Rehab': { Private: 75, Group: 75 },
  'Pilates Matte': { Private: 25, Group: 25 },
};

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [defaults, setDefaults] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [weeklyOverrides, setWeeklyOverrides] = useState({});
  const [stats, setStats] = useState({
    activeRevenue: 0,
    pastRevenue: 0,
    totalScheduledSessions: 0,
    totalHoursToWork: 0,
    totalUsers: 0,
    topUsers: [],
    completedHours: 0,
  });
  const [sessions, setSessions] = useState([]);
  const [newOverride, setNewOverride] = useState({
    date: '',
    start_time: '08:00',
    slots_count: 4,
    is_closed: false,
    class_type: '',
  });
  const [quickClose, setQuickClose] = useState({
    startDate: '',
    endDate: '',
  });
  const [newWeeklyOverrideDate, setNewWeeklyOverrideDate] = useState('');
  const [weeklyOverrideStep, setWeeklyOverrideStep] = useState('date');
  const [tempWeeklyConfig, setTempWeeklyConfig] = useState([]);

  // Slot Closures state
  const [slotClosures, setSlotClosures] = useState([]);
  const [newSlotClosure, setNewSlotClosure] = useState({
    date: '',
    closureType: 'time', // 'time' or 'slot'
    startTime: '',
    endTime: '',
    slotIndex: 0,
    reason: '',
  });

  // Pricing Tiers state
  const [pricingTiers, setPricingTiers] = useState([]);
  const [selectedTier, setSelectedTier] = useState(null);
  const [tierPrices, setTierPrices] = useState([]);
  const [newTier, setNewTier] = useState({
    name: '',
    description: '',
    discountPercent: 0,
    isDefault: false,
  });
  const [editingTier, setEditingTier] = useState(null);

  // Users state
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState({ tier: '', isAdmin: '' });
  const [selectedUser, setSelectedUser] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [userBookings, setUserBookings] = useState([]);
  const [userNotes, setUserNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [userPricingOverrides, setUserPricingOverrides] = useState([]);
  const [newUserPricing, setNewUserPricing] = useState({
    classType: '',
    mode: '',
    customPrice: '',
    discountPercent: '',
  });

  // Admin Booking state
  const [adminBooking, setAdminBooking] = useState({
    userId: '',
    startTime: '',
    classType: '',
    mode: '',
    customPrice: '',
  });
  const [adminBookingSlots, setAdminBookingSlots] = useState([]);
  const [pricePreview, setPricePreview] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load core data first
      await Promise.all([
        fetchDefaults(),
        fetchOverrides(),
        fetchSessions(),
        fetchStats(),
      ]);

      // Load new features separately so failures don't break the page
      await Promise.allSettled([
        fetchSlotClosures(),
        fetchPricingTiers(),
        fetchUsers(),
      ]);
    } catch (e) {
      console.error('Failed to load admin data:', e);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDefaults = async () => {
    const res = await api.getScheduleDefaults();
    const days = [0, 1, 2, 3, 4, 5, 6];
    const fullData = days.map((d) => {
      const existing = (res.defaults || []).find((item) => item.dayOfWeek === d);
      return (
        existing || {
          dayOfWeek: d,
          startTime: '08:00',
          slotsCount: 4,
          isClosed: d === 0 || d === 6,
        }
      );
    });
    setDefaults(fullData);
  };

  const fetchSessions = async () => {
    const res = await api.getSessions();
    setSessions(res.sessions || []);
  };

  const fetchOverrides = async () => {
    const res = await api.getOverrides();
    setOverrides(res.overrides || []);

    const weeklyRes = await api.getWeeklyOverrides();
    setWeeklyOverrides(weeklyRes.overrides || {});
  };

  const fetchStats = async () => {
    const res = await api.getStats();
    setStats(res || { activeRevenue: 0, pastRevenue: 0 });
  };

  const fetchSlotClosures = async () => {
    try {
      const res = await api.getSlotClosures();
      setSlotClosures(res.closures || []);
    } catch (e) {
      console.error('Failed to fetch slot closures:', e);
    }
  };

  const fetchPricingTiers = async () => {
    try {
      const res = await api.getPricingTiers();
      setPricingTiers(res.tiers || []);
    } catch (e) {
      console.error('Failed to fetch pricing tiers:', e);
    }
  };

  const fetchUsers = async (params = {}) => {
    try {
      const res = await api.getUsers({
        search: userSearch,
        tier: userFilter.tier,
        isAdmin: userFilter.isAdmin,
        ...params,
      });
      setUsers(res.users || []);
    } catch (e) {
      console.error('Failed to fetch users:', e);
    }
  };

  const handleAddOverride = async () => {
    if (!newOverride.date) return toast.error('Select a date');
    try {
      const payload = {
        ...newOverride,
        class_type: newOverride.class_type === 'none' ? '' : newOverride.class_type,
      };
      await api.addOverride(payload);
      toast.success('Override added');
      setNewOverride({ date: '', start_time: '08:00', slots_count: 4, is_closed: false, class_type: '' });
      fetchOverrides();
    } catch (e) {
      toast.error('Failed to add override');
    }
  };

  const handleQuickClose = async () => {
    if (!quickClose.startDate || !quickClose.endDate) {
      return toast.error('Select both start and end dates');
    }

    const start = new Date(quickClose.startDate);
    const end = new Date(quickClose.endDate);
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays > 7) {
      return toast.error('Maximum 7 days can be closed at once');
    }
    if (diffDays < 1) {
      return toast.error('End date must be on or after start date');
    }

    try {
      await api.bulkCloseSchedule(quickClose.startDate, quickClose.endDate);
      toast.success(`Closed ${diffDays} day${diffDays > 1 ? 's' : ''}`);
      setQuickClose({ startDate: '', endDate: '' });
      fetchOverrides();
    } catch (e) {
      toast.error(e.message || 'Failed to close days');
    }
  };

  const handleDeleteOverride = async (id) => {
    try {
      await api.deleteOverride(id);
      toast.success('Override removed');
      fetchOverrides();
    } catch (e) {
      toast.error('Failed to remove');
    }
  };

  const handleStartWeeklyOverride = () => {
    if (!newWeeklyOverrideDate) return toast.error('Select a date');
    const initialConfig = [];
    for (let i = 0; i <= 6; i++) {
      const defaultDay = defaults.find((d) => d.dayOfWeek === i);
      initialConfig.push({
        day_of_week: i,
        start_time: defaultDay ? defaultDay.startTime : '08:00',
        slots_count: defaultDay ? defaultDay.slotsCount : 4,
        is_closed: defaultDay ? defaultDay.isClosed : false,
        class_type: '',
      });
    }
    setTempWeeklyConfig(initialConfig);
    setWeeklyOverrideStep('config');
  };

  const handleSaveWeeklyOverride = async () => {
    try {
      const d = new Date(newWeeklyOverrideDate);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const weekStartStr = monday.toISOString().split('T')[0];

      await api.addWeeklyOverride(weekStartStr, tempWeeklyConfig);
      toast.success('Weekly override saved');
      setWeeklyOverrideStep('date');
      setNewWeeklyOverrideDate('');
      fetchOverrides();
    } catch (e) {
      toast.error('Failed to save weekly override');
    }
  };

  const handleDeleteWeeklyOverride = async (date) => {
    try {
      await api.deleteWeeklyOverride(date);
      toast.success('Weekly override removed');
      fetchOverrides();
    } catch (e) {
      toast.error('Failed to remove');
    }
  };

  const handleSaveDefaults = async () => {
    try {
      const config = defaults.map((d) => ({
        id: d.id,
        day_of_week: d.dayOfWeek,
        start_time: d.startTime,
        slots_count: d.slotsCount,
        is_closed: d.isClosed,
      }));
      await api.updateScheduleDefaults(config);
      toast.success('Schedule updated');
    } catch (e) {
      toast.error('Failed to save');
    }
  };

  const handleCancelSession = async (sessionId) => {
    if (!confirm('Are you sure you want to cancel this session?')) return;
    try {
      await api.cancelSession(sessionId);
      toast.success('Session cancelled');
      fetchSessions();
    } catch (e) {
      toast.error('Failed to cancel');
    }
  };

  // Slot Closures handlers
  const handleAddSlotClosure = async () => {
    if (!newSlotClosure.date) return toast.error('Select a date');

    try {
      const payload = {
        date: newSlotClosure.date,
        reason: newSlotClosure.reason || null,
      };

      if (newSlotClosure.closureType === 'time') {
        if (!newSlotClosure.startTime || !newSlotClosure.endTime) {
          return toast.error('Start time and end time are required');
        }
        payload.startTime = newSlotClosure.startTime;
        payload.endTime = newSlotClosure.endTime;
      } else {
        payload.slotIndex = parseInt(newSlotClosure.slotIndex);
      }

      await api.createSlotClosure(payload);
      toast.success('Slot closure added');
      setNewSlotClosure({
        date: '',
        closureType: 'time',
        startTime: '',
        endTime: '',
        slotIndex: 0,
        reason: '',
      });
      fetchSlotClosures();
    } catch (e) {
      toast.error('Failed to add slot closure');
    }
  };

  const handleDeleteSlotClosure = async (id) => {
    try {
      await api.deleteSlotClosure(id);
      toast.success('Slot closure removed');
      fetchSlotClosures();
    } catch (e) {
      toast.error('Failed to remove');
    }
  };

  // Pricing Tiers handlers
  const handleCreateTier = async () => {
    if (!newTier.name) return toast.error('Tier name is required');

    try {
      await api.createPricingTier(newTier);
      toast.success('Pricing tier created');
      setNewTier({ name: '', description: '', discountPercent: 0, isDefault: false });
      fetchPricingTiers();
    } catch (e) {
      toast.error('Failed to create tier');
    }
  };

  const handleUpdateTier = async () => {
    if (!editingTier) return;

    try {
      await api.updatePricingTier(editingTier.id, editingTier);
      toast.success('Pricing tier updated');
      setEditingTier(null);
      fetchPricingTiers();
    } catch (e) {
      toast.error('Failed to update tier');
    }
  };

  const handleDeleteTier = async (id) => {
    if (!confirm('Are you sure? Users with this tier will have it removed.')) return;

    try {
      await api.deletePricingTier(id);
      toast.success('Pricing tier deleted');
      if (selectedTier?.id === id) {
        setSelectedTier(null);
        setTierPrices([]);
      }
      fetchPricingTiers();
    } catch (e) {
      toast.error('Failed to delete tier');
    }
  };

  const handleSelectTier = async (tier) => {
    setSelectedTier(tier);
    try {
      const res = await api.getTierPrices(tier.id);
      setTierPrices(res.prices || []);
    } catch (e) {
      toast.error('Failed to load tier prices');
    }
  };

  const handleSaveTierPrices = async () => {
    if (!selectedTier) return;

    try {
      await api.setTierPrices(selectedTier.id, tierPrices);
      toast.success('Tier prices saved');
    } catch (e) {
      toast.error('Failed to save tier prices');
    }
  };

  // User handlers
  const handleSearchUsers = () => {
    fetchUsers();
  };

  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    setEditingUser({ ...user });

    try {
      const [statsRes, bookingsRes, notesRes, pricingRes] = await Promise.all([
        api.getUserStats(user.id),
        api.getUserBookings(user.id),
        api.getUserNotes(user.id),
        api.getUserPricing(user.id),
      ]);

      setUserStats(statsRes);
      setUserBookings(bookingsRes.bookings || []);
      setUserNotes(notesRes.notes || []);
      setUserPricingOverrides(pricingRes.pricing || []);
    } catch (e) {
      toast.error('Failed to load user details');
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      await api.updateUser(editingUser.id, editingUser);
      toast.success('User updated');
      fetchUsers();
      setSelectedUser({ ...selectedUser, ...editingUser });
    } catch (e) {
      toast.error('Failed to update user');
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedUser) return;

    try {
      await api.addUserNote(selectedUser.id, newNote);
      toast.success('Note added');
      setNewNote('');
      const notesRes = await api.getUserNotes(selectedUser.id);
      setUserNotes(notesRes.notes || []);
    } catch (e) {
      toast.error('Failed to add note');
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await api.deleteUserNote(noteId);
      toast.success('Note deleted');
      const notesRes = await api.getUserNotes(selectedUser.id);
      setUserNotes(notesRes.notes || []);
    } catch (e) {
      toast.error('Failed to delete note');
    }
  };

  const handleAddUserPricing = async () => {
    if (!selectedUser || !newUserPricing.classType || !newUserPricing.mode) {
      return toast.error('Class type and mode are required');
    }

    try {
      await api.addUserPricing(selectedUser.id, {
        classType: newUserPricing.classType,
        mode: newUserPricing.mode,
        customPrice: newUserPricing.customPrice ? parseFloat(newUserPricing.customPrice) : null,
        discountPercent: newUserPricing.discountPercent ? parseFloat(newUserPricing.discountPercent) : null,
      });
      toast.success('Pricing override added');
      setNewUserPricing({ classType: '', mode: '', customPrice: '', discountPercent: '' });
      const pricingRes = await api.getUserPricing(selectedUser.id);
      setUserPricingOverrides(pricingRes.pricing || []);
    } catch (e) {
      toast.error('Failed to add pricing override');
    }
  };

  const handleDeleteUserPricing = async (pricingId) => {
    try {
      await api.deleteUserPricing(pricingId);
      toast.success('Pricing override removed');
      const pricingRes = await api.getUserPricing(selectedUser.id);
      setUserPricingOverrides(pricingRes.pricing || []);
    } catch (e) {
      toast.error('Failed to remove pricing override');
    }
  };

  // Admin Booking handlers
  const handleAdminBookingDateChange = async (date) => {
    setAdminBooking({ ...adminBooking, startTime: '' });
    if (!date) {
      setAdminBookingSlots([]);
      return;
    }

    try {
      const res = await api.getAvailability(date);
      setAdminBookingSlots(res.slots || []);
    } catch (e) {
      toast.error('Failed to load slots');
    }
  };

  const handleAdminBookingChange = async (field, value) => {
    const updated = { ...adminBooking, [field]: value };
    setAdminBooking(updated);

    // Fetch price preview when user, class type, and mode are selected
    if (updated.userId && updated.classType && updated.mode) {
      try {
        const res = await api.getBookingPricePreview(
          updated.userId,
          updated.classType,
          updated.mode
        );
        setPricePreview(res);
      } catch (e) {
        setPricePreview(null);
      }
    } else {
      setPricePreview(null);
    }
  };

  const handleCreateAdminBooking = async () => {
    if (!adminBooking.userId || !adminBooking.startTime || !adminBooking.classType || !adminBooking.mode) {
      return toast.error('All fields are required');
    }

    try {
      await api.createAdminBooking({
        userId: adminBooking.userId,
        startTime: adminBooking.startTime,
        classType: adminBooking.classType,
        mode: adminBooking.mode,
        customPrice: adminBooking.customPrice ? parseFloat(adminBooking.customPrice) : undefined,
      });
      toast.success('Booking created');
      setAdminBooking({ userId: '', startTime: '', classType: '', mode: '', customPrice: '' });
      setAdminBookingSlots([]);
      setPricePreview(null);
      fetchSessions();
    } catch (e) {
      toast.error(e.message || 'Failed to create booking');
    }
  };

  const dayName = (d) =>
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d];

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-light text-slate-900 mb-8">Admin Dashboard</h1>

      <Tabs defaultValue="schedule" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="booking">Book for User</TabsTrigger>
        </TabsList>

        {/* ============== SCHEDULE TAB ============== */}
        <TabsContent value="schedule">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Upcoming Revenue</p>
                    <div className="text-xl font-bold text-emerald-600">{stats.activeRevenue}€</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-100">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Earned Revenue</p>
                    <div className="text-xl font-bold text-slate-700">{stats.pastRevenue}€</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-pink-50 to-white border-pink-100">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pink-100 rounded-lg">
                    <Calendar className="w-5 h-5 text-halo-pink" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Scheduled Sessions</p>
                    <div className="text-xl font-bold text-halo-pink">{stats.totalScheduledSessions}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Hours to Work</p>
                    <div className="text-xl font-bold text-blue-600">{stats.totalHoursToWork}h</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Second row: Users + Top Clients */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total Users</p>
                    <div className="text-xl font-bold text-purple-600">{stats.totalUsers}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Hours Completed</p>
                    <div className="text-xl font-bold text-amber-600">{stats.completedHours}h</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Top Clients
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topUsers.length === 0 ? (
                  <p className="text-sm text-slate-400">No bookings yet</p>
                ) : (
                  <div className="space-y-2">
                    {stats.topUsers.map((u, idx) => (
                      <div key={u.id} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-halo-pink text-white text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="truncate max-w-[120px]">{u.name || u.email}</span>
                        </span>
                        <span className="text-slate-500 font-medium">{u.bookings} bookings</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Close Card */}
          <Card className="mb-6 bg-gradient-to-br from-red-50 to-white border-red-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Lock className="w-5 h-5 text-red-500" /> Quick Close (Up to 7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={quickClose.startDate}
                    onChange={(e) => setQuickClose({ ...quickClose, startDate: e.target.value })}
                  />
                </div>
                <div className="flex-1">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={quickClose.endDate}
                    onChange={(e) => setQuickClose({ ...quickClose, endDate: e.target.value })}
                  />
                </div>
                <Button
                  onClick={handleQuickClose}
                  variant="destructive"
                  className="whitespace-nowrap"
                >
                  <Lock className="w-4 h-4 mr-2" /> Close Selected Days
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                This will mark all selected days as closed. Maximum 7 days at once.
              </p>
            </CardContent>
          </Card>

          {/* Slot Closures Card */}
          <Card className="mb-6 bg-gradient-to-br from-orange-50 to-white border-orange-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" /> Slot Closures (Specific Hours)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={newSlotClosure.date}
                      onChange={(e) => setNewSlotClosure({ ...newSlotClosure, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Closure Type</Label>
                    <Select
                      value={newSlotClosure.closureType}
                      onValueChange={(v) => setNewSlotClosure({ ...newSlotClosure, closureType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="time">Time Range</SelectItem>
                        <SelectItem value="slot">Slot Index</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newSlotClosure.closureType === 'time' ? (
                    <>
                      <div>
                        <Label>Start Time</Label>
                        <Input
                          type="time"
                          value={newSlotClosure.startTime}
                          onChange={(e) => setNewSlotClosure({ ...newSlotClosure, startTime: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>End Time</Label>
                        <Input
                          type="time"
                          value={newSlotClosure.endTime}
                          onChange={(e) => setNewSlotClosure({ ...newSlotClosure, endTime: e.target.value })}
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <Label>Slot Index (0-based)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newSlotClosure.slotIndex}
                        onChange={(e) => setNewSlotClosure({ ...newSlotClosure, slotIndex: e.target.value })}
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label>Reason (optional)</Label>
                    <Input
                      value={newSlotClosure.reason}
                      onChange={(e) => setNewSlotClosure({ ...newSlotClosure, reason: e.target.value })}
                      placeholder="e.g., Personal appointment"
                    />
                  </div>
                  <Button onClick={handleAddSlotClosure} className="bg-orange-500 hover:bg-orange-600">
                    <Plus className="w-4 h-4 mr-2" /> Add Closure
                  </Button>
                </div>

                {slotClosures.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-medium text-slate-500">Active Slot Closures</h4>
                    {slotClosures.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-3 border rounded-md bg-white text-sm"
                      >
                        <div>
                          <span className="font-medium">{format(new Date(c.date), 'MMM d, yyyy')}</span>
                          <span className="mx-2 text-slate-300">|</span>
                          {c.slotIndex !== null ? (
                            <span className="text-orange-600">Slot #{c.slotIndex}</span>
                          ) : (
                            <span className="text-orange-600">{c.startTime} - {c.endTime}</span>
                          )}
                          {c.reason && (
                            <span className="ml-2 text-slate-400">({c.reason})</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSlotClosure(c.id)}
                          className="h-6 w-6 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Schedule (Defaults)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {defaults.map((day, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border rounded-lg bg-slate-50"
                    >
                      <div className="w-24 font-medium">{dayName(day.dayOfWeek)}</div>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!day.isClosed}
                          onCheckedChange={(checked) => {
                            const newDefaults = [...defaults];
                            newDefaults[idx].isClosed = !checked;
                            setDefaults(newDefaults);
                          }}
                        />
                        <span className="text-sm w-12">{day.isClosed ? 'Closed' : 'Open'}</span>
                      </div>

                      {!day.isClosed && (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            type="time"
                            value={day.startTime}
                            onChange={(e) => {
                              const newDefaults = [...defaults];
                              newDefaults[idx].startTime = e.target.value;
                              setDefaults(newDefaults);
                            }}
                            className="w-32"
                          />
                          <Input
                            type="number"
                            value={day.slotsCount}
                            onChange={(e) => {
                              const newDefaults = [...defaults];
                              newDefaults[idx].slotsCount = parseInt(e.target.value);
                              setDefaults(newDefaults);
                            }}
                            className="w-16"
                            min={1}
                            max={10}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  <Button onClick={handleSaveDefaults} className="w-full">
                    <Save className="w-4 h-4 mr-2" /> Save Defaults
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Schedule Overrides</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="single" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="single">Single Day</TabsTrigger>
                    <TabsTrigger value="weekly">Full Week</TabsTrigger>
                  </TabsList>

                  <TabsContent value="single" className="space-y-6">
                    <div className="p-4 border rounded-lg bg-slate-50 space-y-4">
                      <h3 className="font-medium">Add Single Day Override</h3>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <Label>Date</Label>
                          <Input
                            type="date"
                            value={newOverride.date}
                            onChange={(e) =>
                              setNewOverride({ ...newOverride, date: e.target.value })
                            }
                          />
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Label>Closed?</Label>
                            <Switch
                              checked={newOverride.is_closed}
                              onCheckedChange={(checked) =>
                                setNewOverride({ ...newOverride, is_closed: checked })
                              }
                            />
                          </div>
                        </div>
                        {!newOverride.is_closed && (
                          <>
                            <div className="flex gap-4">
                              <div className="flex-1">
                                <Label>Start Time</Label>
                                <Input
                                  type="time"
                                  value={newOverride.start_time}
                                  onChange={(e) =>
                                    setNewOverride({ ...newOverride, start_time: e.target.value })
                                  }
                                />
                              </div>
                              <div className="w-24">
                                <Label>Slots</Label>
                                <Input
                                  type="number"
                                  value={newOverride.slots_count}
                                  onChange={(e) =>
                                    setNewOverride({
                                      ...newOverride,
                                      slots_count: parseInt(e.target.value),
                                    })
                                  }
                                />
                              </div>
                            </div>
                            <div>
                              <Label>Preset Class Type (optional)</Label>
                              <Select
                                value={newOverride.class_type}
                                onValueChange={(value) =>
                                  setNewOverride({ ...newOverride, class_type: value })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="User chooses" />
                                </SelectTrigger>
                                <SelectContent>
                                  {CLASS_TYPES.map((ct) => (
                                    <SelectItem key={ct.value} value={ct.value || 'none'}>
                                      {ct.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}
                        <Button
                          onClick={handleAddOverride}
                          variant="outline"
                          className="w-full border-pink-200 text-halo-pink hover:bg-pink-50"
                        >
                          Add Override
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-medium text-sm text-slate-500">Active Single Overrides</h3>
                      {overrides.length === 0 && (
                        <p className="text-sm text-slate-400">No single day overrides set.</p>
                      )}
                      {overrides.map((ov) => (
                        <div
                          key={ov.id}
                          className="flex items-center justify-between p-3 border rounded-md bg-white text-sm"
                        >
                          <div>
                            <span className="font-medium">
                              {format(new Date(ov.specificDate), 'MMM d, yyyy')}
                            </span>
                            <span className="mx-2 text-slate-300">|</span>
                            {ov.isClosed ? (
                              <span className="text-red-500">Closed</span>
                            ) : (
                              <span>
                                {ov.startTime} ({ov.slotsCount} slots)
                                {ov.classType && (
                                  <span className="ml-2 text-halo-pink font-medium">
                                    [{ov.classType}]
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteOverride(ov.id)}
                            className="h-6 w-6 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="weekly" className="space-y-6">
                    {weeklyOverrideStep === 'date' ? (
                      <div className="p-4 border rounded-lg bg-slate-50 space-y-4">
                        <h3 className="font-medium">Add Weekly Override</h3>
                        <div className="space-y-2">
                          <Label>Select any date in the target week</Label>
                          <Input
                            type="date"
                            value={newWeeklyOverrideDate}
                            onChange={(e) => setNewWeeklyOverrideDate(e.target.value)}
                          />
                        </div>
                        <Button onClick={handleStartWeeklyOverride} className="w-full">
                          Configure Week
                        </Button>
                      </div>
                    ) : (
                      <div className="border rounded-lg bg-slate-50 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium">Configure Week</h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setWeeklyOverrideStep('date')}
                          >
                            Cancel
                          </Button>
                        </div>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                          {tempWeeklyConfig.map((day, idx) => (
                            <div key={idx} className="p-3 bg-white rounded border text-sm">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold">{dayName(day.day_of_week)}</span>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={!day.is_closed}
                                    onCheckedChange={(checked) => {
                                      const newConfig = [...tempWeeklyConfig];
                                      newConfig[idx].is_closed = !checked;
                                      setTempWeeklyConfig(newConfig);
                                    }}
                                  />
                                  <span className="text-xs w-10">
                                    {day.is_closed ? 'Closed' : 'Open'}
                                  </span>
                                </div>
                              </div>
                              {!day.is_closed && (
                                <div className="flex gap-2 flex-wrap">
                                  <Input
                                    type="time"
                                    value={day.start_time}
                                    onChange={(e) => {
                                      const newConfig = [...tempWeeklyConfig];
                                      newConfig[idx].start_time = e.target.value;
                                      setTempWeeklyConfig(newConfig);
                                    }}
                                    className="h-8 text-xs w-24"
                                  />
                                  <Input
                                    type="number"
                                    value={day.slots_count}
                                    onChange={(e) => {
                                      const newConfig = [...tempWeeklyConfig];
                                      newConfig[idx].slots_count = parseInt(e.target.value);
                                      setTempWeeklyConfig(newConfig);
                                    }}
                                    className="h-8 text-xs w-14"
                                  />
                                  <Select
                                    value={day.class_type || 'none'}
                                    onValueChange={(value) => {
                                      const newConfig = [...tempWeeklyConfig];
                                      newConfig[idx].class_type = value === 'none' ? '' : value;
                                      setTempWeeklyConfig(newConfig);
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs flex-1 min-w-[100px]">
                                      <SelectValue placeholder="Class type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {CLASS_TYPES.map((ct) => (
                                        <SelectItem key={ct.value} value={ct.value || 'none'}>
                                          {ct.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <Button onClick={handleSaveWeeklyOverride} className="w-full">
                          Save Weekly Override
                        </Button>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h3 className="font-medium text-sm text-slate-500">Active Weekly Overrides</h3>
                      {Object.keys(weeklyOverrides).length === 0 && (
                        <p className="text-sm text-slate-400">No weekly overrides set.</p>
                      )}
                      {Object.entries(weeklyOverrides).map(([date, configs]) => (
                        <div
                          key={date}
                          className="flex items-center justify-between p-3 border rounded-md bg-white text-sm"
                        >
                          <div>
                            <span className="font-medium">
                              Week of {format(new Date(date), 'MMM d, yyyy')}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteWeeklyOverride(date)}
                            className="h-6 w-6 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============== SESSIONS TAB ============== */}
        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sessions.length === 0 ? (
                  <p className="text-slate-500">No active sessions found.</p>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-lg flex items-center gap-2">
                          {format(new Date(session.startTime), 'EEE, MMM d, HH:mm')}
                          <span className="text-sm font-normal text-slate-500">
                            ({session.classType})
                          </span>
                        </div>
                        <div className="text-sm text-slate-500 mt-1">
                          {session.participants?.length || 0} Participants:{' '}
                          {session.participants?.map((p) => p.firstName).join(', ')}
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleCancelSession(session.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============== USERS TAB ============== */}
        <TabsContent value="users">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* User List */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" /> Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search by name, email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                    />
                    <Button size="icon" onClick={handleSearchUsers}>
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Select
                      value={userFilter.tier || 'all'}
                      onValueChange={(v) => setUserFilter({ ...userFilter, tier: v === 'all' ? '' : v })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="All Tiers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tiers</SelectItem>
                        {pricingTiers.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={userFilter.isAdmin || 'all'}
                      onValueChange={(v) => setUserFilter({ ...userFilter, isAdmin: v === 'all' ? '' : v })}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="true">Admins</SelectItem>
                        <SelectItem value="false">Non-Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => handleSelectUser(user)}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedUser?.id === user.id
                            ? 'border-halo-pink bg-pink-50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-medium text-sm">
                          {user.firstName || user.lastName
                            ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                            : user.email}
                        </div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {user.isAdmin && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                              Admin
                            </span>
                          )}
                          {user.tier && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              {user.tier.name}
                            </span>
                          )}
                          <span className="text-xs text-slate-400 ml-auto">
                            {user.bookingsCount} bookings
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* User Detail */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  {selectedUser ? (
                    <span className="flex items-center gap-2">
                      <Edit2 className="w-5 h-5" />
                      {selectedUser.firstName || selectedUser.email}
                    </span>
                  ) : (
                    'Select a User'
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedUser ? (
                  <p className="text-slate-500">Click on a user from the list to view details.</p>
                ) : (
                  <Tabs defaultValue="profile" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 mb-4">
                      <TabsTrigger value="profile">Profile</TabsTrigger>
                      <TabsTrigger value="stats">Stats</TabsTrigger>
                      <TabsTrigger value="pricing">Pricing</TabsTrigger>
                      <TabsTrigger value="notes">Notes</TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile" className="space-y-4">
                      {editingUser && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>First Name</Label>
                              <Input
                                value={editingUser.firstName || ''}
                                onChange={(e) =>
                                  setEditingUser({ ...editingUser, firstName: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label>Last Name</Label>
                              <Input
                                value={editingUser.lastName || ''}
                                onChange={(e) =>
                                  setEditingUser({ ...editingUser, lastName: e.target.value })
                                }
                              />
                            </div>
                          </div>
                          <div>
                            <Label>Email</Label>
                            <Input
                              value={editingUser.email || ''}
                              onChange={(e) =>
                                setEditingUser({ ...editingUser, email: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <Label>Phone</Label>
                            <Input
                              value={editingUser.phoneNumber || ''}
                              onChange={(e) =>
                                setEditingUser({ ...editingUser, phoneNumber: e.target.value })
                              }
                            />
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Label>Admin</Label>
                              <Switch
                                checked={editingUser.isAdmin || false}
                                onCheckedChange={(checked) =>
                                  setEditingUser({ ...editingUser, isAdmin: checked })
                                }
                              />
                            </div>
                            <div className="flex-1">
                              <Label>Pricing Tier</Label>
                              <Select
                                value={editingUser.pricingTierId || 'none'}
                                onValueChange={(v) =>
                                  setEditingUser({ ...editingUser, pricingTierId: v === 'none' ? '' : v })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="No tier" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No tier</SelectItem>
                                  {pricingTiers.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                      {t.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <Button onClick={handleUpdateUser} className="w-full">
                            <Save className="w-4 h-4 mr-2" /> Save Changes
                          </Button>
                        </>
                      )}
                    </TabsContent>

                    <TabsContent value="stats" className="space-y-4">
                      {userStats && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <Card>
                            <CardContent className="pt-4">
                              <div className="text-2xl font-bold text-halo-pink">
                                {userStats.totalBookings}
                              </div>
                              <div className="text-xs text-slate-500">Total Bookings</div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="pt-4">
                              <div className="text-2xl font-bold text-emerald-600">
                                {userStats.totalSpent}€
                              </div>
                              <div className="text-xs text-slate-500">Total Spent</div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="pt-4">
                              <div className="text-2xl font-bold text-red-500">
                                {userStats.cancellations}
                              </div>
                              <div className="text-xs text-slate-500">Cancellations</div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="pt-4">
                              <div className="text-sm font-medium">
                                {userStats.lastBooking
                                  ? format(new Date(userStats.lastBooking), 'MMM d, yyyy')
                                  : 'Never'}
                              </div>
                              <div className="text-xs text-slate-500">Last Booking</div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="pt-4">
                              <div className="text-sm font-medium">
                                {userStats.favoriteClass || 'N/A'}
                              </div>
                              <div className="text-xs text-slate-500">Favorite Class</div>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Booking History</h4>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {userBookings.length === 0 ? (
                            <p className="text-sm text-slate-400">No bookings yet.</p>
                          ) : (
                            userBookings.map((b) => (
                              <div
                                key={b.id}
                                className="flex items-center justify-between p-2 border rounded text-sm"
                              >
                                <div>
                                  <span className="font-medium">
                                    {b.session
                                      ? format(new Date(b.session.startTime), 'MMM d, HH:mm')
                                      : 'Unknown'}
                                  </span>
                                  <span className="text-slate-500 ml-2">
                                    {b.session?.classType} ({b.session?.mode})
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{b.price}€</span>
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded ${
                                      b.status === 'confirmed'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}
                                  >
                                    {b.status}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="pricing" className="space-y-4">
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <h4 className="font-medium mb-2">Current Tier</h4>
                        {selectedUser.tier ? (
                          <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-blue-600" />
                            <span className="font-medium">{selectedUser.tier.name}</span>
                            {selectedUser.tier.discountPercent > 0 && (
                              <span className="text-sm text-green-600">
                                ({selectedUser.tier.discountPercent}% discount)
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">No tier assigned</p>
                        )}
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Custom Price Overrides</h4>
                        <div className="space-y-2 mb-4">
                          {userPricingOverrides.length === 0 ? (
                            <p className="text-sm text-slate-400">No custom pricing.</p>
                          ) : (
                            userPricingOverrides.map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between p-2 border rounded text-sm"
                              >
                                <div>
                                  <span className="font-medium">{p.classType}</span>
                                  <span className="text-slate-500 ml-1">({p.mode})</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {p.customPrice && (
                                    <span className="text-green-600 font-medium">{p.customPrice}€</span>
                                  )}
                                  {p.discountPercent && (
                                    <span className="text-blue-600">{p.discountPercent}% off</span>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleDeleteUserPricing(p.id)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="p-4 border rounded-lg space-y-3">
                          <h5 className="text-sm font-medium">Add Price Override</h5>
                          <div className="grid grid-cols-2 gap-2">
                            <Select
                              value={newUserPricing.classType}
                              onValueChange={(v) =>
                                setNewUserPricing({ ...newUserPricing, classType: v })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Class Type" />
                              </SelectTrigger>
                              <SelectContent>
                                {CLASS_TYPE_OPTIONS.map((ct) => (
                                  <SelectItem key={ct.value} value={ct.value}>
                                    {ct.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={newUserPricing.mode}
                              onValueChange={(v) =>
                                setNewUserPricing({ ...newUserPricing, mode: v })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Mode" />
                              </SelectTrigger>
                              <SelectContent>
                                {MODE_OPTIONS.map((m) => (
                                  <SelectItem key={m.value} value={m.value}>
                                    {m.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Custom Price (€)</Label>
                              <Input
                                type="number"
                                placeholder="e.g., 30"
                                value={newUserPricing.customPrice}
                                onChange={(e) =>
                                  setNewUserPricing({ ...newUserPricing, customPrice: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label className="text-xs">OR Discount (%)</Label>
                              <Input
                                type="number"
                                placeholder="e.g., 20"
                                value={newUserPricing.discountPercent}
                                onChange={(e) =>
                                  setNewUserPricing({ ...newUserPricing, discountPercent: e.target.value })
                                }
                              />
                            </div>
                          </div>
                          <Button onClick={handleAddUserPricing} className="w-full" size="sm">
                            <Plus className="w-4 h-4 mr-2" /> Add Override
                          </Button>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="notes" className="space-y-4">
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Add a note about this user..."
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          rows={2}
                        />
                        <Button onClick={handleAddNote} className="h-auto">
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {userNotes.length === 0 ? (
                          <p className="text-sm text-slate-400">No notes yet.</p>
                        ) : (
                          userNotes.map((n) => (
                            <div key={n.id} className="p-3 border rounded-lg">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-500">
                                  {n.adminName} - {format(new Date(n.createdAt), 'MMM d, yyyy HH:mm')}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={() => handleDeleteNote(n.id)}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                              <p className="text-sm">{n.note}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============== PRICING TAB ============== */}
        <TabsContent value="pricing">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pricing Tiers List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" /> Pricing Tiers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Create New Tier */}
                  <div className="p-4 border rounded-lg bg-slate-50 space-y-3">
                    <h4 className="font-medium text-sm">Create New Tier</h4>
                    <Input
                      placeholder="Tier Name (e.g., VIP, Friends & Family)"
                      value={newTier.name}
                      onChange={(e) => setNewTier({ ...newTier, name: e.target.value })}
                    />
                    <Input
                      placeholder="Description (optional)"
                      value={newTier.description}
                      onChange={(e) => setNewTier({ ...newTier, description: e.target.value })}
                    />
                    <Button onClick={handleCreateTier} className="w-full" size="sm">
                      <Plus className="w-4 h-4 mr-2" /> Create Tier
                    </Button>
                  </div>

                  {/* Existing Tiers */}
                  <div className="space-y-2">
                    {pricingTiers.length === 0 ? (
                      <p className="text-sm text-slate-400">No pricing tiers yet.</p>
                    ) : (
                      pricingTiers.map((tier) => (
                        <div
                          key={tier.id}
                          onClick={() => handleSelectTier(tier)}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedTier?.id === tier.id
                              ? 'border-halo-pink bg-pink-50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{tier.name}</div>
                              {tier.description && (
                                <div className="text-xs text-slate-500">{tier.description}</div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTier(tier.id);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tier Detail / Pricing */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  {selectedTier ? (
                    <span className="flex items-center gap-2">
                      <Tag className="w-5 h-5" />
                      {selectedTier.name} - Pricing Configuration
                    </span>
                  ) : (
                    'Select a Tier'
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedTier ? (
                  <p className="text-slate-500">Click on a tier to configure its prices.</p>
                ) : (
                  <div className="space-y-4">
                    {/* Edit Tier Name */}
                    {editingTier && editingTier.id === selectedTier.id && (
                      <div className="p-4 border rounded-lg bg-slate-50 space-y-3">
                        <h4 className="font-medium text-sm">Edit Tier</h4>
                        <Input
                          placeholder="Tier Name"
                          value={editingTier.name}
                          onChange={(e) => setEditingTier({ ...editingTier, name: e.target.value })}
                        />
                        <Input
                          placeholder="Description"
                          value={editingTier.description || ''}
                          onChange={(e) =>
                            setEditingTier({ ...editingTier, description: e.target.value })
                          }
                        />
                        <div className="flex gap-2">
                          <Button onClick={handleUpdateTier} size="sm">
                            Save
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setEditingTier(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {!editingTier && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingTier({ ...selectedTier })}
                      >
                        <Edit2 className="w-4 h-4 mr-2" /> Edit Tier Name
                      </Button>
                    )}

                    {/* Base Prices Reference */}
                    <div className="p-4 border rounded-lg bg-blue-50">
                      <h4 className="font-medium text-sm mb-2">Base Prices (Reference)</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        {Object.entries(BASE_PRICES).map(([ct, prices]) => (
                          <div key={ct}>
                            <div className="font-medium">{ct}</div>
                            <div className="text-slate-500">
                              P: {prices.Private}€ / G: {prices.Group}€
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tier-Specific Prices */}
                    <div>
                      <h4 className="font-medium mb-2">Set Prices for Each Class</h4>
                      <p className="text-xs text-slate-500 mb-4">
                        For each class type, choose either a fixed price OR a discount percentage. Leave both empty to use base price.
                      </p>

                      <div className="space-y-4">
                        {CLASS_TYPE_OPTIONS.map((ct) => (
                          <div key={ct.value} className="border rounded-lg p-4 bg-slate-50">
                            <h5 className="font-medium text-sm mb-3 text-halo-pink">{ct.label}</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {MODE_OPTIONS.map((m) => {
                                const existing = tierPrices.find(
                                  (p) => p.classType === ct.value && p.mode === m.value
                                );
                                const basePrice = BASE_PRICES[ct.value]?.[m.value] || 0;
                                const priceKey = `${ct.value}-${m.value}`;
                                const priceMode = existing?.discountPercent !== undefined && existing?.discountPercent !== null
                                  ? 'discount'
                                  : 'fixed';

                                return (
                                  <div
                                    key={priceKey}
                                    className="p-3 bg-white rounded border"
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-medium">{m.label}</span>
                                      <span className="text-xs text-slate-400">Base: {basePrice}€</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Select
                                        value={existing ? (existing.discountPercent !== null ? 'discount' : 'fixed') : 'none'}
                                        onValueChange={(v) => {
                                          const newPrices = tierPrices.filter(
                                            (p) => !(p.classType === ct.value && p.mode === m.value)
                                          );
                                          if (v === 'fixed') {
                                            newPrices.push({
                                              classType: ct.value,
                                              mode: m.value,
                                              price: basePrice,
                                              discountPercent: null,
                                            });
                                          } else if (v === 'discount') {
                                            newPrices.push({
                                              classType: ct.value,
                                              mode: m.value,
                                              price: null,
                                              discountPercent: 10,
                                            });
                                          }
                                          setTierPrices(newPrices);
                                        }}
                                      >
                                        <SelectTrigger className="w-28 h-8 text-xs">
                                          <SelectValue placeholder="Base" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">Use Base</SelectItem>
                                          <SelectItem value="fixed">Fixed €</SelectItem>
                                          <SelectItem value="discount">% Off</SelectItem>
                                        </SelectContent>
                                      </Select>

                                      {existing && existing.discountPercent === null && existing.price !== null && (
                                        <div className="flex items-center gap-1">
                                          <Input
                                            type="number"
                                            value={existing.price || ''}
                                            onChange={(e) => {
                                              const newPrices = tierPrices.map((p) =>
                                                p.classType === ct.value && p.mode === m.value
                                                  ? { ...p, price: parseFloat(e.target.value) || 0 }
                                                  : p
                                              );
                                              setTierPrices(newPrices);
                                            }}
                                            className="w-20 h-8 text-sm"
                                          />
                                          <span className="text-xs text-slate-500">€</span>
                                        </div>
                                      )}

                                      {existing && existing.discountPercent !== null && (
                                        <div className="flex items-center gap-1">
                                          <Input
                                            type="number"
                                            value={existing.discountPercent || ''}
                                            onChange={(e) => {
                                              const newPrices = tierPrices.map((p) =>
                                                p.classType === ct.value && p.mode === m.value
                                                  ? { ...p, discountPercent: parseFloat(e.target.value) || 0 }
                                                  : p
                                              );
                                              setTierPrices(newPrices);
                                            }}
                                            className="w-16 h-8 text-sm"
                                          />
                                          <span className="text-xs text-slate-500">%</span>
                                          <span className="text-xs text-green-600 ml-1">
                                            = {Math.round(basePrice * (1 - (existing.discountPercent || 0) / 100))}€
                                          </span>
                                        </div>
                                      )}

                                      {!existing && (
                                        <span className="text-sm text-slate-500">{basePrice}€</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      <Button onClick={handleSaveTierPrices} className="w-full mt-4">
                        <Save className="w-4 h-4 mr-2" /> Save Tier Prices
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============== ADMIN BOOKING TAB ============== */}
        <TabsContent value="booking">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarPlus className="w-5 h-5" /> Book for User
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-2xl space-y-6">
                <div>
                  <Label>Select User</Label>
                  <Select
                    value={adminBooking.userId}
                    onValueChange={(v) => handleAdminBookingChange('userId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.firstName || u.lastName
                            ? `${u.firstName || ''} ${u.lastName || ''}`.trim()
                            : u.email}{' '}
                          ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    onChange={(e) => handleAdminBookingDateChange(e.target.value)}
                  />
                </div>

                {adminBookingSlots.length > 0 && (
                  <div>
                    <Label>Available Slots</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                      {adminBookingSlots.map((slot, idx) => (
                        <Button
                          key={idx}
                          variant={adminBooking.startTime === slot.start_time ? 'default' : 'outline'}
                          disabled={slot.status === 'closed' || slot.status === 'full' || slot.status === 'busy'}
                          onClick={() => handleAdminBookingChange('startTime', slot.start_time)}
                          className="h-auto py-2"
                        >
                          <div className="text-center">
                            <div className="font-medium">{slot.time}</div>
                            <div className="text-xs opacity-70">
                              {slot.status === 'closed'
                                ? 'Closed'
                                : slot.status === 'full'
                                ? 'Full'
                                : slot.status === 'busy'
                                ? 'Busy'
                                : slot.status === 'partial'
                                ? `${slot.details?.participants || 0}/4`
                                : 'Open'}
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Class Type</Label>
                    <Select
                      value={adminBooking.classType}
                      onValueChange={(v) => handleAdminBookingChange('classType', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select class type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CLASS_TYPE_OPTIONS.map((ct) => (
                          <SelectItem key={ct.value} value={ct.value}>
                            {ct.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Mode</Label>
                    <Select
                      value={adminBooking.mode}
                      onValueChange={(v) => handleAdminBookingChange('mode', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select mode..." />
                      </SelectTrigger>
                      <SelectContent>
                        {MODE_OPTIONS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {pricePreview && (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-slate-500">Calculated Price</div>
                        <div className="text-2xl font-bold text-emerald-600">{pricePreview.price}€</div>
                        <div className="text-xs text-slate-400">
                          Source:{' '}
                          {pricePreview.source === 'user_custom'
                            ? 'User custom price'
                            : pricePreview.source === 'user_discount'
                            ? 'User discount'
                            : pricePreview.source === 'tier_price'
                            ? 'Tier price'
                            : pricePreview.source === 'tier_discount'
                            ? 'Tier discount'
                            : 'Base price'}
                        </div>
                      </div>
                      <div className="text-right">
                        <Label className="text-xs">Override Price (optional)</Label>
                        <Input
                          type="number"
                          placeholder={`${pricePreview.price}€`}
                          value={adminBooking.customPrice}
                          onChange={(e) =>
                            setAdminBooking({ ...adminBooking, customPrice: e.target.value })
                          }
                          className="w-24"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleCreateAdminBooking}
                  className="w-full"
                  disabled={!adminBooking.userId || !adminBooking.startTime || !adminBooking.classType || !adminBooking.mode}
                >
                  <CalendarPlus className="w-4 h-4 mr-2" /> Create Booking
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
