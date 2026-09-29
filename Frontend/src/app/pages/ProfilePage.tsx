import { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, MapPin, Clock, Bell, Palette, Lock, Save, Loader2, CheckCircle, AlertCircle, Shield, Calendar, Camera, X } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

interface ProfileData {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  avatar_url: string | null;
  address: string | null;
  timezone: string;
  notifications_enabled: number;
  theme_preference: string;
  created_at: string;
  updated_at: string | null;
}

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
  'Asia/Kolkata', 'Asia/Dubai', 'Australia/Sydney', 'Pacific/Auckland',
];

const ROLE_COLORS: Record<string, string> = {
  'Super Admin': 'bg-red-500/15 text-red-400 border-red-500/30',
  'Manager': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Dispatcher': 'bg-green-500/15 text-green-400 border-green-500/30',
  'Safety Officer': 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  'Financial Analyst': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'Driver': 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
};

const MAX_AVATAR_SIZE = 500 * 1024; // 500KB
const MIN_DIMENSION = 100;
const MAX_DIMENSION = 1024;

export function ProfilePage() {
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [themePref, setThemePref] = useState('dark');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      const result = await api.profile.get();
      const p = result.profile;
      setProfile(p);
      setName(p.name || '');
      setPhone(p.phone || '');
      setAddress(p.address || '');
      setTimezone(p.timezone || 'UTC');
      setNotificationsEnabled(!!p.notifications_enabled);
      setThemePref(p.theme_preference || 'dark');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setErrorMsg('');
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  function showError(msg: string) {
    setErrorMsg(msg);
    setSuccessMsg('');
    setTimeout(() => setErrorMsg(''), 5000);
  }

  // ── Theme change handler — syncs with ThemeContext ──
  function handleThemeChange(value: string) {
    setThemePref(value);
    if (value === 'dark' || value === 'light') {
      setTheme(value);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      const result = await api.profile.update({
        name,
        phone: phone || undefined,
        address: address || undefined,
        timezone,
        notifications_enabled: notificationsEnabled,
        theme_preference: themePref,
      });
      setProfile(result.profile);
      showSuccess('Profile updated successfully');
    } catch (err: any) {
      showError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showError('New passwords do not match');
      return;
    }
    try {
      setChangingPw(true);
      await api.profile.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showSuccess('Password changed successfully');
    } catch (err: any) {
      showError(err.message || 'Failed to change password');
    } finally {
      setChangingPw(false);
    }
  }

  // ── Avatar upload with validation ──
  function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showError('Only JPEG, PNG, or WebP images are allowed');
      return;
    }

    // Validate size
    if (file.size > MAX_AVATAR_SIZE) {
      showError(`Image must be under ${MAX_AVATAR_SIZE / 1024}KB (yours is ${Math.round(file.size / 1024)}KB)`);
      return;
    }

    // Validate dimensions
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(url);

      if (img.width < MIN_DIMENSION || img.height < MIN_DIMENSION) {
        showError(`Image must be at least ${MIN_DIMENSION}×${MIN_DIMENSION}px (yours is ${img.width}×${img.height}px)`);
        return;
      }

      // Convert to base64 data URL
      const canvas = document.createElement('canvas');
      const size = Math.min(img.width, img.height, MAX_DIMENSION);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // Center crop to square
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);

      const dataUrl = canvas.toDataURL('image/webp', 0.85);

      try {
        setUploadingAvatar(true);
        const result = await api.profile.updateAvatar(dataUrl);
        setProfile(result.profile);
        showSuccess('Avatar updated successfully');
      } catch (err: any) {
        showError(err.message || 'Failed to upload avatar');
      } finally {
        setUploadingAvatar(false);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      showError('Could not read image file');
    };

    img.src = url;
    // Clear input so same file can be re-selected
    e.target.value = '';
  }

  async function handleRemoveAvatar() {
    try {
      setUploadingAvatar(true);
      const result = await api.profile.updateAvatar(null);
      setProfile(result.profile);
      showSuccess('Avatar removed');
    } catch (err: any) {
      showError(err.message || 'Failed to remove avatar');
    } finally {
      setUploadingAvatar(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Failed to load profile
      </div>
    );
  }

  const initials = profile.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hidden file input for avatar */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleAvatarFile}
      />

      {/* Success/Error Toasts */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-[#22C55E]/10 text-[#22C55E] px-4 py-3 rounded-lg text-sm font-medium animate-in slide-in-from-top">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 bg-[#EF4444]/10 text-[#EF4444] px-4 py-3 rounded-lg text-sm font-medium animate-in slide-in-from-top">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Profile Header Card */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Avatar with upload */}
          <div className="relative group">
            {profile.avatar_url ? (
              <>
                <img src={profile.avatar_url} alt={profile.name} className="w-24 h-24 rounded-full object-cover border-4 border-primary/20" />
                <button
                  onClick={handleRemoveAvatar}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-[#EF4444] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Remove avatar"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </>
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-4 border-primary/20 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">{initials}</span>
              </div>
            )}
            <button
              onClick={handleAvatarClick}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full border-2 border-card flex items-center justify-center cursor-pointer hover:bg-primary/80 transition-colors"
              title="Upload avatar (JPEG/PNG/WebP, max 500KB, min 100×100px)"
            >
              {uploadingAvatar ? (
                <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
              ) : (
                <Camera className="w-4 h-4 text-primary-foreground" />
              )}
            </button>
          </div>

          {/* User Info */}
          <div className="text-center sm:text-left flex-1">
            <h2 className="text-2xl font-bold text-foreground">{profile.name}</h2>
            <p className="text-muted-foreground">{profile.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2 justify-center sm:justify-start">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${ROLE_COLORS[profile.role] || 'bg-muted text-muted-foreground'}`}>
                <Shield className="w-3 h-3" />
                {profile.role}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Max 500KB • JPEG, PNG, or WebP • Min 100×100px
            </p>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Personal Info */}
        <form onSubmit={handleSaveProfile} className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Personal Information
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={name} onChange={e => setName(e.target.value)} className="pl-10 bg-background border-border" placeholder="Your full name" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={profile.email} disabled className="pl-10 bg-muted/30 border-border text-muted-foreground cursor-not-allowed" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={phone} onChange={e => setPhone(e.target.value)} className="pl-10 bg-background border-border" placeholder="+1-555-000-0000" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <textarea
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Your address"
                  rows={2}
                />
              </div>
            </div>
            <Button type="submit" disabled={saving} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>

            {/* Quick Tips */}
            <div className="bg-secondary/50 rounded-lg p-4 mt-2">
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-primary" />
                Quick Tips
              </h4>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  Use the global search bar to find vehicles, trips, and settings.
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  Check the notification bell for maintenance alerts and dispatch updates.
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  Upload an avatar (max 500KB) by clicking the camera icon above.
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  Password must be at least 6 characters. Use a mix of letters, numbers, and symbols.
                </li>
              </ul>
            </div>
          </div>
        </form>

        {/* Preferences */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              Preferences
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  <Clock className="w-3.5 h-3.5 inline mr-1" />
                  Timezone
                </label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border max-h-48">
                    {TIMEZONES.map(tz => (
                      <SelectItem key={tz} value={tz}>{tz.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Current local time: {new Date().toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: true })}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  <Palette className="w-3.5 h-3.5 inline mr-1" />
                  Theme
                </label>
                <Select value={themePref} onValueChange={handleThemeChange}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="dark">🌙 Dark</SelectItem>
                    <SelectItem value="light">☀️ Light</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Active: {theme} mode
                </p>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    <Bell className="w-3.5 h-3.5 inline mr-1" />
                    Notifications
                  </label>
                  <p className="text-xs text-muted-foreground">Receive alerts and updates</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${notificationsEnabled ? 'bg-[#22C55E]' : 'bg-muted'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notificationsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Change Password */}
          <form onSubmit={handleChangePassword} className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Change Password
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Current Password</label>
                <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="bg-background border-border" placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">New Password</label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="bg-background border-border" placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Confirm New Password</label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="bg-background border-border" placeholder="••••••••" />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-[#EF4444] mt-1">Passwords do not match</p>
                )}
              </div>
              <Button type="submit" disabled={changingPw || !currentPassword || !newPassword || newPassword !== confirmPassword} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                {changingPw ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                Update Password
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Account Info Footer */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Account Information
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">User ID</p>
            <p className="text-sm font-mono text-foreground">#{profile.id}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Role</p>
            <p className="text-sm font-medium text-foreground">{profile.role}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="text-sm text-foreground">{new Date(profile.created_at).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Updated</p>
            <p className="text-sm text-foreground">{profile.updated_at ? new Date(profile.updated_at).toLocaleDateString() : 'Never'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
