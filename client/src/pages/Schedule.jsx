import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { format, isBefore, startOfToday } from 'date-fns';
import { Loader2, Info, Calendar as CalendarIcon, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function Schedule() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarAddedToBooking, setCalendarAddedToBooking] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Check calendar status on mount
  useEffect(() => {
    if (isAuthenticated) {
      checkCalendarStatus();
    }
  }, [isAuthenticated]);

  const checkCalendarStatus = async () => {
    try {
      const { connected } = await api.getCalendarStatus();
      setCalendarConnected(connected);
    } catch (e) {
      // Ignore - user not authenticated or API error
    }
  };

  useEffect(() => {
    if (selectedDate) {
      fetchSlots(selectedDate);
    }
  }, [selectedDate]);

  const [registrationLocked, setRegistrationLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState('');

  const fetchSlots = async (date) => {
    setLoading(true);
    try {
      const response = await api.getAvailability(format(date, 'yyyy-MM-dd'));
      setSlots(response.slots || []);
      setRegistrationLocked(response.registrationLocked || false);
      setLockMessage(response.message || '');
    } catch (error) {
      toast.error('Failed to fetch availability');
    } finally {
      setLoading(false);
    }
  };

  const handleSlotClick = (slot) => {
    if (slot.status === 'busy' || slot.status === 'full') return;

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    setSelectedSlot(slot);
    setBookingModalOpen(true);
  };

  const handleBookingSuccess = (calendarAdded) => {
    setBookingModalOpen(false);
    setCalendarAddedToBooking(calendarAdded);
    fetchSlots(selectedDate);

    // Check if user dismissed calendar prompt forever
    const dismissedCalendarPrompt = localStorage.getItem('halo_dismiss_calendar_prompt');

    // Show success modal if calendar not connected and not dismissed
    if (!calendarConnected && !dismissedCalendarPrompt) {
      setSuccessModalOpen(true);
    } else {
      toast.success(
        calendarAdded
          ? 'Class booked and added to your Google Calendar!'
          : 'Class booked successfully!'
      );
    }
  };

  const handleConnectCalendar = async () => {
    try {
      const { url } = await api.getCalendarAuthUrl();
      window.location.href = url;
    } catch (error) {
      toast.error('Failed to connect calendar');
    }
  };

  const handleDismissCalendarForever = () => {
    localStorage.setItem('halo_dismiss_calendar_prompt', 'true');
    setSuccessModalOpen(false);
    toast.success('Class booked successfully!');
  };

  const handleSkipCalendar = () => {
    setSuccessModalOpen(false);
    toast.success('Class booked successfully!');
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-light text-slate-900 mb-4">Schedule Your Session</h1>
          <p className="text-slate-500 max-w-xl mx-auto">
            Select a date and time to book your private or group session.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar Section */}
          <Card className="lg:col-span-1 h-fit shadow-md border-none">
            <CardContent className="p-6">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                disabled={(date) => {
                  const day = date.getDay();
                  return day === 0 || day === 6 || isBefore(date, startOfToday());
                }}
                className="rounded-md border-none mx-auto"
              />
              <div className="mt-6 text-sm text-slate-400 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-halo-pink"></div>
                  <span>Selected Date</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-100 border border-slate-200"></div>
                  <span>Available</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Slots Section */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-medium text-slate-800">
                Available Times for {format(selectedDate, 'EEEE, MMM d')}
              </h2>
              {loading && <Loader2 className="w-5 h-5 animate-spin text-halo-pink" />}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence mode="wait">
                {registrationLocked && !loading ? (
                  <div className="col-span-2 text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-amber-200">
                    <Info className="w-8 h-8 mx-auto mb-2 opacity-50 text-amber-500" />
                    <p className="text-amber-600 font-medium">{lockMessage}</p>
                    <p className="text-sm mt-2">Check back later for availability.</p>
                  </div>
                ) : slots.length === 0 && !loading ? (
                  <div className="col-span-2 text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                    <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No slots available for this date.</p>
                  </div>
                ) : (
                  slots.map((slot, idx) => (
                    <SlotCard key={idx} slot={slot} onClick={() => handleSlotClick(slot)} />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <BookingModal
        open={bookingModalOpen}
        onOpenChange={setBookingModalOpen}
        slot={selectedSlot}
        user={user}
        onSuccess={handleBookingSuccess}
      />

      {/* Success Modal with Calendar Prompt */}
      <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <DialogTitle className="text-xl">Booking Confirmed!</DialogTitle>
            <DialogDescription>
              Your class has been booked successfully.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <CalendarIcon className="w-8 h-8 text-halo-pink mx-auto mb-2" />
              <h3 className="font-medium text-slate-900 mb-1">Sync with Google Calendar</h3>
              <p className="text-sm text-slate-500 mb-4">
                Connect your Google Calendar to automatically add your classes and get reminders.
              </p>
              <Button
                onClick={handleConnectCalendar}
                className="w-full bg-halo-pink hover:bg-halo-pink-dark"
              >
                <CalendarIcon className="w-4 h-4 mr-2" />
                Connect Google Calendar
              </Button>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button variant="ghost" onClick={handleSkipCalendar} className="w-full">
              Skip for now
            </Button>
            <button
              onClick={handleDismissCalendarForever}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              Don't show this again
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SlotCard({ slot, onClick }) {
  const isBusy = slot.status === 'busy' || slot.status === 'full';
  const isPartial = slot.status === 'partial';

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={!isBusy ? { scale: 1.02 } : {}}
      onClick={onClick}
      disabled={isBusy}
      className={`
        relative w-full text-left p-6 rounded-xl border transition-all duration-300
        ${
          isBusy
            ? 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed'
            : 'bg-white border-slate-100 hover:border-pink-200 hover:shadow-lg hover:shadow-pink-50/50 cursor-pointer'
        }
      `}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-2xl font-light text-slate-900">{slot.time}</span>
        {isBusy ? (
          <span className="text-xs font-medium bg-slate-200 text-slate-500 px-2 py-1 rounded-full uppercase tracking-wider">
            {slot.status === 'full' ? 'Full' : 'Busy'}
          </span>
        ) : (
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full uppercase tracking-wider ${
              isPartial ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
            }`}
          >
            {isPartial ? 'Join Group' : 'Available'}
          </span>
        )}
      </div>

      {slot.details ? (
        <div className="text-sm text-slate-500">
          <p className="font-medium text-halo-pink">{slot.details.class_type}</p>
          {slot.details.mode === 'Private' ? (
            <p className="text-slate-500 font-medium">Private Session</p>
          ) : (
            <div>
              <p>
                {slot.details.mode} - {slot.details.participants}/4 spots
              </p>
              {slot.details.participant_names && slot.details.participant_names.length > 0 && (
                <p className="text-xs text-slate-400 mt-1 truncate">
                  With: {slot.details.participant_names.join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        !isBusy && <p className="text-sm text-slate-400">Open for booking</p>
      )}
    </motion.button>
  );
}

function BookingModal({ open, onOpenChange, slot, user, onSuccess }) {
  const [bookingData, setBookingData] = useState({
    class_type: '',
    mode: '',
  });
  const [contactInfo, setContactInfo] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
  });
  const [bookForClient, setBookForClient] = useState(false);
  const [clientInfo, setClientInfo] = useState({ name: '', phone: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAdmin = user?.isAdmin;

  useEffect(() => {
    if (open && user) {
      setContactInfo({
        first_name: user.firstName || '',
        last_name: user.lastName || '',
        phone_number: user.phoneNumber || '',
      });
      setBookForClient(false);
      setClientInfo({ name: '', phone: '' });

      if (slot?.details) {
        setBookingData({
          class_type: slot.details.class_type,
          mode: slot.details.mode,
        });
      } else {
        setBookingData({ class_type: '', mode: '' });
      }
    }
  }, [open, slot, user]);

  const handleBook = async () => {
    setIsSubmitting(true);
    try {
      if (bookForClient) {
        if (!clientInfo.name || !clientInfo.phone) {
          toast.error('Please fill in client name and phone');
          setIsSubmitting(false);
          return;
        }
      } else {
        if (!contactInfo.first_name || !contactInfo.last_name || !contactInfo.phone_number) {
          toast.error('Please fill in all contact details');
          setIsSubmitting(false);
          return;
        }
      }

      const payload = {
        start_time: slot.start_time,
        class_type: bookingData.class_type,
        mode: bookingData.mode,
        ...(bookForClient
          ? { client_name: clientInfo.name, client_phone: clientInfo.phone }
          : { user_info: contactInfo }),
      };

      const result = await api.createBooking(payload);
      onSuccess(result.calendarAdded || false);

      // Reset client info for next booking
      if (bookForClient) {
        setClientInfo({ name: '', phone: '' });
      }
    } catch (error) {
      toast.error(error.message || 'Booking failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPrice = () => {
    const { class_type, mode } = bookingData;
    if (!class_type) return 0;
    if (class_type === 'HIIT') return mode === 'Private' ? 45 : 25;
    if (class_type === 'Pilates Reformer') return 50;
    if (class_type === 'Pilates Clinical Rehab') return 75;
    if (class_type === 'Pilates Matte') return 25;
    return 0;
  };

  const isPreset = !!slot?.details;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Confirm Booking</DialogTitle>
          <DialogDescription>
            {slot && format(new Date(slot.start_time), "EEEE, MMMM d 'at' HH:mm")}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-4">
            {!isPreset ? (
              <>
                <div className="space-y-2">
                  <Label>Class Type</Label>
                  <Select
                    value={bookingData.class_type}
                    onValueChange={(val) => {
                      let newMode = bookingData.mode;
                      if (val === 'Pilates Matte') newMode = 'Group';
                      if (val === 'Pilates Clinical Rehab') newMode = 'Private';
                      setBookingData({ class_type: val, mode: newMode });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HIIT">HIIT</SelectItem>
                      <SelectItem value="Pilates Reformer">Pilates Reformer</SelectItem>
                      <SelectItem value="Pilates Clinical Rehab">Pilates Clinical Rehab</SelectItem>
                      <SelectItem value="Pilates Matte">Pilates Matte (Group)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Session Mode</Label>
                  <RadioGroup
                    value={bookingData.mode}
                    onValueChange={(val) => setBookingData({ ...bookingData, mode: val })}
                    className="grid grid-cols-2 gap-4"
                  >
                    <div
                      className={`flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-slate-50 ${
                        bookingData.mode === 'Private' ? 'border-halo-pink bg-pink-50' : ''
                      }`}
                    >
                      <RadioGroupItem
                        value="Private"
                        id="private"
                        disabled={bookingData.class_type === 'Pilates Matte'}
                      />
                      <Label htmlFor="private" className="cursor-pointer">
                        Private
                      </Label>
                    </div>
                    <div
                      className={`flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-slate-50 ${
                        bookingData.mode === 'Group' ? 'border-halo-pink bg-pink-50' : ''
                      }`}
                    >
                      <RadioGroupItem
                        value="Group"
                        id="group"
                        disabled={bookingData.class_type === 'Pilates Clinical Rehab'}
                      />
                      <Label htmlFor="group" className="cursor-pointer">
                        Group (Max 4)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </>
            ) : (
              <div className="bg-pink-50 p-4 rounded-lg border border-pink-100">
                <p className="font-medium text-halo-pink-dark">Joining Existing Session</p>
                <p className="text-halo-pink">
                  {slot.details.class_type} - {slot.details.mode}
                </p>
              </div>
            )}

            <div className="space-y-4 pt-4 border-t">
              {isAdmin && (
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                  <input
                    type="checkbox"
                    id="bookForClient"
                    checked={bookForClient}
                    onChange={(e) => setBookForClient(e.target.checked)}
                    className="rounded border-purple-300"
                  />
                  <Label htmlFor="bookForClient" className="text-sm text-purple-700 cursor-pointer">
                    Book on behalf of a client
                  </Label>
                </div>
              )}

              {bookForClient ? (
                <>
                  <h4 className="font-medium text-sm text-purple-700">Client Details</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Client Name</Label>
                      <Input
                        value={clientInfo.name}
                        onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })}
                        placeholder="e.g. Maria Papadopoulou"
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Client Phone</Label>
                      <Input
                        value={clientInfo.phone}
                        onChange={(e) => setClientInfo({ ...clientInfo, phone: e.target.value })}
                        placeholder="e.g. +357 99 123456"
                        className="h-8"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h4 className="font-medium text-sm text-slate-900">Your Details</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">First Name</Label>
                      <Input
                        value={contactInfo.first_name}
                        onChange={(e) => setContactInfo({ ...contactInfo, first_name: e.target.value })}
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Last Name</Label>
                      <Input
                        value={contactInfo.last_name}
                        onChange={(e) => setContactInfo({ ...contactInfo, last_name: e.target.value })}
                        className="h-8"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Phone Number</Label>
                      <Input
                        value={contactInfo.phone_number}
                        onChange={(e) =>
                          setContactInfo({ ...contactInfo, phone_number: e.target.value })
                        }
                        className="h-8"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div className="text-lg font-bold text-slate-900">Total: {getPrice()}€</div>
          <Button
            onClick={handleBook}
            disabled={isSubmitting || (!isPreset && (!bookingData.class_type || !bookingData.mode))}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
