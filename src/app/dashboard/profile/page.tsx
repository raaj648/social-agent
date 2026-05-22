'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Mail, Shield, Cpu, Save, Loader2, CheckCircle, Lock, Crown } from 'lucide-react';
import { usePageTitle } from '@/lib/use-page-title';

export default function ProfilePage() {
  usePageTitle('Profile');
  const [profile, setProfile] = useState<{ id: string; full_name: string | null; email: string | null; plan: string; credits_remaining: number; credits_total: number; credits_expires_at: string | null; user_number: number } | null>(null);
  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    setLoadError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadError('Not authenticated'); setLoading(false); return; }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id, full_name, email, plan, credits_remaining, credits_total, credits_expires_at, user_number')
        .eq('id', user.id)
        .single();

      if (profileError) throw new Error(profileError.message);
      if (profile) {
        setProfile(profile);
        setFullName(profile.full_name || '');
      }
    } catch (e: any) {
      setLoadError(e.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    setError('');

    const updates: Record<string, any> = {};
    if (fullName !== profile.full_name) updates.full_name = fullName || null;

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase.from('users').update(updates).eq('id', profile.id);
      if (updateError) setError(updateError.message);
    }

    if (password) {
      if (!currentPassword) {
        setError('Current password is required to set a new password');
        setSaving(false);
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email!,
        password: currentPassword,
      });
      if (signInError) {
        setError('Current password is incorrect');
        setSaving(false);
        return;
      }
      const { error: pwdError } = await supabase.auth.updateUser({ password });
      if (pwdError) setError(pwdError.message);
      else { setPassword(''); setCurrentPassword(''); }
    }

    if (!error) {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (profile) setProfile({ ...profile, full_name: updates.full_name ?? profile.full_name });
    } else {
      setSaving(false);
    }
  }

  const planColors: Record<string, string> = {
    free: 'from-gray-400 to-gray-500',
    starter: 'from-blue-500 to-blue-600',
    pro: 'from-purple-500 to-violet-600',
    enterprise: 'from-amber-500 to-orange-600',
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="rounded-xl bg-red-50 dark:bg-red-950/30 px-6 py-4 text-sm text-red-600 dark:text-red-400 max-w-md text-center">
          {loadError}
        </div>
        <button onClick={() => { setLoading(true); loadProfile(); }} className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
          <Loader2 className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl font-bold">
              {(profile.full_name || profile.email || '?')[0].toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-lg">{profile.full_name || 'No name set'}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" />
                {profile.email}
              </p>
            </div>
            <span className={`ml-auto rounded-full bg-gradient-to-r ${planColors[profile.plan] || planColors.free} px-3 py-1 text-xs font-bold uppercase tracking-wider text-white`}>
              {profile.plan}
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Full Name</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">User ID</label>
            <Input value={String(profile.user_number || '')} disabled className="font-mono opacity-60" />
            <p className="text-xs text-muted-foreground">Your permanent numeric ID — share this with support for faster help.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Credits Remaining</label>
            <Input value={`${profile.credits_remaining} / ${profile.credits_total}`} disabled className="opacity-60" />
            <p className="text-xs text-muted-foreground">1 credit = 1 AI reply. {profile.credits_expires_at ? `Expires ${new Date(profile.credits_expires_at).toLocaleDateString()}` : 'No expiry'}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input value={profile.email || ''} disabled className="opacity-60" />
            <p className="text-xs text-muted-foreground">Email cannot be changed. Contact support for email updates.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-600" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="space-y-2">
            <label className="text-sm font-medium">Current Password</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">New Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
            />
            <p className="text-xs text-muted-foreground">Must be at least 6 characters</p>
          </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-purple-600" />
            Usage & Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-purple-50 dark:bg-purple-950/30 p-4">
              <p className="text-xs text-muted-foreground mb-1">Daily AI Quota</p>
              <p className="text-2xl font-bold text-purple-600">{profile.credits_remaining}/{profile.credits_total}</p>
              <div className="mt-2 h-2 rounded-full bg-purple-100 overflow-hidden">
                <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${Math.min((profile.credits_remaining / Math.max(profile.credits_total, 1)) * 100, 100)}%` }} />
              </div>
            </div>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-4">
              <p className="text-xs text-muted-foreground mb-1">Current Plan</p>
              <div className="flex items-center gap-2">
                <Crown className={`h-5 w-5 ${profile.plan === 'free' ? 'text-gray-400' : 'text-amber-500'}`} />
                <p className="text-2xl font-bold capitalize">{profile.plan}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {profile.plan === 'free' ? 'Upgrade for more quota' : 'Enjoy your premium benefits'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2 shadow-sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}