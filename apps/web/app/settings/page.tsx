"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import toast from "react-hot-toast";

const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
const interestOptions = ["travel", "food", "sports", "tech", "music", "movies", "business", "daily life"];
const countries = ["Brazil", "China", "Colombia", "Egypt", "France", "Germany", "India", "Indonesia", "Italy", "Japan", "Mexico", "Morocco", "Philippines", "Russia", "Saudi Arabia", "South Korea", "Spain", "Thailand", "Turkey", "Ukraine", "United Kingdom", "United States", "Vietnam", "Other"];
const timezones = Intl.supportedValuesOf?.("timeZone") || ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai", "Asia/Kolkata", "Asia/Dubai", "Australia/Sydney", "Pacific/Auckland"];
const languages = ["English", "Spanish", "French", "German", "Italian", "Portuguese", "Russian", "Chinese", "Japanese", "Korean", "Arabic", "Hindi", "Bengali", "Turkish", "Dutch", "Polish", "Vietnamese", "Thai", "Indonesian", "Other"];

export default function SettingsPage() {
  const router = useRouter();
  const { user, profile, setProfile, isLoading } = useAuthStore();
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [englishLevel, setEnglishLevel] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [username, setUsername] = useState("");
  const [timezone, setTimezone] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (profile) {
      setName(profile.name || ""); setCountry(profile.country || ""); setEnglishLevel(profile.englishLevel || "");
      setInterests(profile.interests || []); setUsername(profile.username || ""); setTimezone(profile.timezone || "");
      setNativeLanguage(profile.nativeLanguage || ""); setBio(profile.bio || "");
    }
  }, [user, profile, isLoading]);

  function toggleInterest(interest: string) {
    setInterests((p) => p.includes(interest) ? p.filter((i) => i !== interest) : [...p, interest]);
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const { updateUser } = await import("@/lib/api/users");
      await updateUser(user.id, { name, country, englishLevel, interests, username, timezone, nativeLanguage, bio });
      setProfile({ ...profile!, name, country, englishLevel, interests, username, timezone, nativeLanguage, bio });
      toast.success("Settings saved!");
    } catch (err: any) { toast.error(err.message || "Failed to save"); } finally { setSaving(false); }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2MB"); return; }
    setUploadingAvatar(true);
    try {
      const supabase = getSupabase();
      const ext = file.name.split(".").pop();
      const filePath = `avatars/${user.id}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const { updateUser } = await import("@/lib/api/users");
      await updateUser(user.id, { avatarUrl: urlData.publicUrl });
      setProfile({ ...profile!, avatarUrl: urlData.publicUrl });
      toast.success("Avatar updated!");
    } catch (err: any) { toast.error(err.message || "Failed to upload"); } finally { setUploadingAvatar(false); }
  }

  if (isLoading || !profile) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><div className="space-y-4"><Skeleton className="h-64 w-full rounded-card" /><Skeleton className="h-96 w-full rounded-card" /></div></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your profile and account" />

      <Card>
        <CardHeader><h2 className="text-h4">Avatar</h2></CardHeader>
        <CardContent>
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 text-3xl font-bold text-primary overflow-hidden ring-2 ring-primary/20">
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="size-full object-cover" /> : profile.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" asChild><span>{uploadingAvatar ? "Uploading..." : "Upload Photo"}</span></Button>
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
              </label>
              <p className="text-caption text-text-muted mt-1">Max 2MB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-h4">Profile</h2></CardHeader>
        <CardContent className="space-y-5">
          <div><label className="text-body-sm font-medium text-text-primary">Display Name</label><Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="text-body-sm font-medium text-text-primary">Country</label><Select value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1.5"><option value="">Select</option>{countries.map((c) => <option key={c} value={c}>{c}</option>)}</Select></div>
            <div><label className="text-body-sm font-medium text-text-primary">English Level</label><Select value={englishLevel} onChange={(e) => setEnglishLevel(e.target.value)} className="mt-1.5"><option value="">Select</option>{levels.map((l) => <option key={l} value={l}>{l}</option>)}</Select></div>
          </div>
          <div><label className="text-body-sm font-medium text-text-primary">Interests</label><div className="mt-2 flex flex-wrap gap-2">{interestOptions.map((interest) => (<button key={interest} onClick={() => toggleInterest(interest)} className={`rounded-full border px-3.5 py-1.5 text-body-sm transition-all ${interests.includes(interest) ? "border-primary bg-primary text-white shadow-sm" : "border-border text-text-secondary hover:border-primary/50"}`}>{interest}</button>))}</div></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="text-body-sm font-medium text-text-primary">Username</label><Input value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))} className="mt-1.5" placeholder="3-30 chars alphanumeric" /></div>
            <div><label className="text-body-sm font-medium text-text-primary">Timezone</label><Select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1.5"><option value="">Select</option>{timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}</Select></div>
          </div>
          <div><label className="text-body-sm font-medium text-text-primary">Native Language</label><Select value={nativeLanguage} onChange={(e) => setNativeLanguage(e.target.value)} className="mt-1.5"><option value="">Select</option>{languages.map((l) => <option key={l} value={l}>{l}</option>)}</Select></div>
          <div><label className="text-body-sm font-medium text-text-primary">Bio</label><textarea value={bio} onChange={(e) => { if (e.target.value.length <= 500) setBio(e.target.value); }} className="mt-1.5 flex min-h-[90px] w-full rounded-xl border border-border bg-white px-4 py-3 text-body-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" placeholder="Tell us about yourself..." maxLength={500} /><p className="mt-1 text-caption text-text-muted text-right">{bio.length}/500</p></div>
          <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? "Saving..." : "Save Changes"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-h4">Account</h2></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-body-sm text-text-secondary">Email: {user?.email}</p>
          <Button variant="danger" onClick={async () => {
            if (!window.confirm("This will permanently delete your account. Continue?")) return;
            try {
              const { del } = await import("@/lib/api/client");
              await del(`/api/users/${user?.id}`);
              await getSupabase().auth.signOut();
              router.push("/");
            } catch { toast.error("Failed to delete account"); }
          }}>Delete Account</Button>
        </CardContent>
      </Card>
    </div>
  );
}
