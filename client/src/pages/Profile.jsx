import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Clock, Trash2, Check, Link, Unlink } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [userInfo, setUserInfo] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
  });

  useEffect(() => {
    if (user) {
      setUserInfo({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phoneNumber: user.phoneNumber || '',
      });
      loadBookings();
      loadCalendarStatus();
    }
  }, [user]);

  const loadCalendarStatus = async () => {
    try {
      const { connected } = await api.getCalendarStatus();
      setCalendarConnected(connected);
    } catch (error) {
      console.log('Calendar status check failed');
    }
  };

  const handleConnectCalendar = async () => {
    setCalendarLoading(true);
    try {
      const { url } = await api.getCalendarAuthUrl();
      window.location.href = url;
    } catch (error) {
      toast.error('Failed to connect calendar');
      setCalendarLoading(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    if (!confirm('Disconnect Google Calendar? New bookings will no longer be added to your calendar.')) return;
    setCalendarLoading(true);
    try {
      await api.disconnectCalendar();
      setCalendarConnected(false);
      toast.success('Calendar disconnected');
    } catch (error) {
      toast.error('Failed to disconnect calendar');
    } finally {
      setCalendarLoading(false);
    }
  };

  const loadBookings = async () => {
    try {
      const response = await api.getBookings();
      setBookings(response.bookings || []);
    } catch (error) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      await api.updateProfile(userInfo);
      updateUser(userInfo);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const handleCancelBooking = async (booking) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await api.cancelBooking(booking.id);
      toast.success('Booking cancelled');
      loadBookings();
    } catch (error) {
      toast.error(error.message || 'Failed to cancel booking');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-halo-pink"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-light text-slate-900">My Account</h1>
      </div>

      <Tabs defaultValue="bookings" className="space-y-6">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="bookings">My Bookings</TabsTrigger>
          <TabsTrigger value="profile">Profile Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings">
          <div className="grid gap-4">
            {bookings.length === 0 ? (
              <Card className="p-8 text-center text-slate-500 border-dashed">
                <p>No bookings yet.</p>
                <Button
                  variant="link"
                  className="text-halo-pink mt-2"
                  onClick={() => (window.location.href = '/schedule')}
                >
                  Book a Class
                </Button>
              </Card>
            ) : (
              bookings.map((booking) => (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card
                    className={`overflow-hidden ${
                      booking.status === 'cancelled' ? 'opacity-60 grayscale' : ''
                    }`}
                  >
                    <CardContent className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <Badge
                            variant={booking.session?.mode === 'Private' ? 'default' : 'secondary'}
                            className="bg-pink-50 text-halo-pink hover:bg-pink-100 border-pink-100"
                          >
                            {booking.session?.mode}
                          </Badge>
                          <Badge variant="outline" className="text-slate-500">
                            {booking.session?.classType}
                          </Badge>
                          {booking.status === 'cancelled' && (
                            <Badge variant="destructive">Cancelled</Badge>
                          )}
                        </div>
                        <h3 className="text-lg font-medium flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4 text-slate-400" />
                          {booking.session?.startTime &&
                            format(new Date(booking.session.startTime), 'EEEE, MMMM d, yyyy')}
                        </h3>
                        <p className="text-slate-500 flex items-center gap-2 mt-1">
                          <Clock className="w-4 h-4 text-slate-400" />
                          {booking.session?.startTime &&
                            format(new Date(booking.session.startTime), 'HH:mm')}{' '}
                          -{' '}
                          {booking.session?.endTime &&
                            format(new Date(booking.session.endTime), 'HH:mm')}
                        </p>
                      </div>

                      {booking.status !== 'cancelled' && (() => {
                        const sessionStart = new Date(booking.session?.startTime);
                        const hoursUntil = differenceInHours(sessionStart, new Date());
                        const canCancel = hoursUntil >= 24;
                        const isPast = sessionStart < new Date();

                        return (
                          <div className="flex items-center gap-4">
                            <div className="text-right mr-4">
                              <p className="text-sm text-slate-400">Price</p>
                              <p className="font-semibold">{booking.price}€</p>
                            </div>
                            {isPast ? (
                              <Badge variant="outline" className="text-slate-400">Completed</Badge>
                            ) : canCancel ? (
                              <Button
                                variant="ghost"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleCancelBooking(booking)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Cancel
                              </Button>
                            ) : (
                              <div className="text-right">
                                <p className="text-xs text-slate-400">Cancellation unavailable</p>
                                <p className="text-xs text-slate-500">(less than 24h before class)</p>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="profile">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      value={userInfo.firstName}
                      onChange={(e) => setUserInfo({ ...userInfo, firstName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={userInfo.lastName}
                      onChange={(e) => setUserInfo({ ...userInfo, lastName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input
                      value={userInfo.phoneNumber}
                      onChange={(e) => setUserInfo({ ...userInfo, phoneNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={user?.email || ''} disabled className="bg-slate-50" />
                  </div>
                </div>
                <div className="pt-4">
                  <Button onClick={handleUpdateProfile}>Save Changes</Button>
                </div>
              </CardContent>
            </Card>

            {/* Google Calendar Integration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  Google Calendar
                </CardTitle>
                <CardDescription>
                  Connect your Google Calendar to automatically add your bookings to your calendar
                </CardDescription>
              </CardHeader>
              <CardContent>
                {calendarConnected ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Check className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">Calendar Connected</p>
                        <p className="text-sm text-slate-500">New bookings will be added to your calendar</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="text-red-500 border-red-200 hover:bg-red-50"
                      onClick={handleDisconnectCalendar}
                      disabled={calendarLoading}
                    >
                      <Unlink className="w-4 h-4 mr-2" />
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                        <CalendarIcon className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">Not Connected</p>
                        <p className="text-sm text-slate-500">Connect to sync your bookings</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="border-halo-pink text-halo-pink hover:bg-pink-50"
                      onClick={handleConnectCalendar}
                      disabled={calendarLoading}
                    >
                      <Link className="w-4 h-4 mr-2" />
                      Connect Calendar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
