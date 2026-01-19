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
import { Loader2, Trash2, Save, Users, Calendar, Clock, TrendingUp, Lock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CLASS_TYPES = [
  { value: '', label: 'User chooses' },
  { value: 'HIIT', label: 'HIIT' },
  { value: 'Pilates Reformer', label: 'Pilates Reformer' },
  { value: 'Pilates Clinical Rehab', label: 'Pilates Clinical Rehab' },
  { value: 'Pilates Matte', label: 'Pilates Matte' },
];

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([fetchDefaults(), fetchOverrides(), fetchSessions(), fetchStats()]);
    } catch (e) {
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
        <TabsList>
          <TabsTrigger value="schedule">Default Schedule</TabsTrigger>
          <TabsTrigger value="sessions">Manage Sessions</TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  );
}
