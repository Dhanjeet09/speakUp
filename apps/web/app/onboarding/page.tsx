"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import toast from "react-hot-toast";

const levels = [
  { id: "A1", label: "Beginner", desc: "Can understand and use basic phrases" },
  { id: "A2", label: "Elementary", desc: "Can introduce themselves and discuss simple topics" },
  { id: "B1", label: "Intermediate", desc: "Can handle everyday conversations" },
  { id: "B2", label: "Upper Intermediate", desc: "Can discuss most topics fluently" },
  { id: "C1", label: "Advanced", desc: "Can express ideas spontaneously and fluently" },
  { id: "C2", label: "Proficient", desc: "Can speak nearly like a native speaker" },
];

const interestOptions = ["travel", "food", "sports", "tech", "music", "movies", "business", "daily life"];

const countries = ["Brazil", "China", "Colombia", "Egypt", "France", "Germany", "India", "Indonesia", "Italy", "Japan", "Mexico", "Morocco", "Philippines", "Russia", "Saudi Arabia", "South Korea", "Spain", "Thailand", "Turkey", "Ukraine", "United Kingdom", "United States", "Vietnam", "Other"];

const timezones = Intl.supportedValuesOf?.("timeZone") || ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai", "Asia/Kolkata", "Asia/Dubai", "Australia/Sydney", "Pacific/Auckland"];

const languages = ["English", "Spanish", "French", "German", "Italian", "Portuguese", "Russian", "Chinese", "Japanese", "Korean", "Arabic", "Hindi", "Bengali", "Turkish", "Dutch", "Polish", "Vietnamese", "Thai", "Indonesian", "Other"];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, setProfile } = useAuthStore();
  const [step, setStep] = useState(1);
  const [englishLevel, setEnglishLevel] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [username, setUsername] = useState("");
  const [timezone, setTimezone] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [bio, setBio] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) { router.push("/signup"); return; }
    if (profile?.englishLevel) { router.push("/dashboard"); }
  }, [user, profile, router]);

  function toggleInterest(interest: string) {
    setInterests((prev) => prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]);
  }

  async function handleSubmit() {
    if (!user) return;
    setLoading(true);
    try {
      const { updateUser } = await import("@/lib/api/users");
      await updateUser(user.id, {
        name: name || user.email?.split("@")[0] || "User",
        country,
        englishLevel,
        interests,
        username: username || undefined,
        timezone: timezone || undefined,
        nativeLanguage: nativeLanguage || undefined,
        bio: bio || undefined,
      });
      setProfile({
        id: user.id,
        email: user.email ?? "",
        name: name || user.email?.split("@")[0] || null,
        username: username || null,
        country: country || null,
        timezone: timezone || null,
        nativeLanguage: nativeLanguage || null,
        bio: bio || null,
        avatarUrl: user.user_metadata?.avatar_url || null,
        englishLevel: englishLevel || null,
        interests,
        role: "learner",
        totalMinutes: 0,
        totalSessions: 0,
        currentStreak: 0,
        createdAt: new Date().toISOString(),
      });
      toast.success("Profile saved!");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4">
      <div className="rounded-2xl border border-border bg-white p-8 shadow-card">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-2xl text-white font-bold shadow-lg shadow-primary/20">
            {step}
          </div>
          <h1 className="text-h3">Set up your profile</h1>
          <p className="mt-1 text-body-sm text-text-secondary">Step {step} of 4</p>
          <div className="mt-5 flex justify-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className={`h-2 w-14 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-gray-200"}`} />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="text-h4 font-semibold">What is your English level?</h2>
            <p className="mt-1 text-body-sm text-text-secondary">This helps us find the best conversation partner for you.</p>
            <div className="mt-6 space-y-3">
              {levels.map((l) => (
                <button key={l.id} onClick={() => setEnglishLevel(l.id)} className={`w-full rounded-xl border p-4 text-left transition-all ${englishLevel === l.id ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/50"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{l.id}</span>
                    <Badge variant={englishLevel === l.id ? "default" : "outline"}>{l.label}</Badge>
                  </div>
                  <p className="mt-1 text-body-sm text-text-secondary">{l.desc}</p>
                </button>
              ))}
            </div>
            <Button className="mt-6 w-full" disabled={!englishLevel} onClick={() => setStep(2)}>Next</Button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="text-h4 font-semibold">Pick your interests</h2>
            <p className="mt-1 text-body-sm text-text-secondary">Choose at least 2 so we can match you with like-minded partners.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {interestOptions.map((interest) => (
                <button key={interest} onClick={() => toggleInterest(interest)} className={`rounded-full border px-5 py-2.5 text-body-sm font-medium transition-all ${interests.includes(interest) ? "border-primary bg-primary text-white shadow-sm" : "border-border hover:border-primary/50"}`}>
                  {interest}
                </button>
              ))}
            </div>
            <div className="mt-8 flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button className="flex-1" disabled={interests.length < 2} onClick={() => setStep(3)}>Next</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in">
            <h2 className="text-h4 font-semibold">Almost done!</h2>
            <p className="mt-1 text-body-sm text-text-secondary">Set your display name and country.</p>
            <div className="mt-6 flex flex-col gap-4">
              <label htmlFor="onboarding-name" className="sr-only">Display name</label>
              <Input id="onboarding-name" placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} />
              <label htmlFor="onboarding-country" className="sr-only">Country</label>
              <Select id="onboarding-country" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">Select your country</option>
                {countries.map((c) => (<option key={c} value={c}>{c}</option>))}
              </Select>
            </div>
            <div className="mt-8 flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
              <Button className="flex-1" onClick={() => setStep(4)}>Next</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-fade-in">
            <h2 className="text-h4 font-semibold">A bit more about you</h2>
            <p className="mt-1 text-body-sm text-text-secondary">Set your username, timezone, and language preferences.</p>
            <div className="mt-6 flex flex-col gap-4">
              <div>
                <label htmlFor="onboarding-username" className="text-body-sm font-medium">Username</label>
                <Input id="onboarding-username" placeholder="Choose a username (3-30 chars)" value={username} onChange={(e) => { const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, ""); setUsername(val); setUsernameError(val.length > 0 && (val.length < 3 || val.length > 30) ? "Must be 3-30 characters" : ""); }} className="mt-1" />
                {usernameError && <p className="mt-1 text-caption text-danger">{usernameError}</p>}
              </div>
              <div>
                <label htmlFor="onboarding-timezone" className="text-body-sm font-medium">Timezone</label>
                <Select id="onboarding-timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1">
                  <option value="">Select your timezone</option>
                  {timezones.map((tz) => (<option key={tz} value={tz}>{tz}</option>))}
                </Select>
              </div>
              <div>
                <label htmlFor="onboarding-language" className="text-body-sm font-medium">Native Language</label>
                <Select id="onboarding-language" value={nativeLanguage} onChange={(e) => setNativeLanguage(e.target.value)} className="mt-1">
                  <option value="">Select your native language</option>
                  {languages.map((lang) => (<option key={lang} value={lang}>{lang}</option>))}
                </Select>
              </div>
              <div>
                <label htmlFor="onboarding-bio" className="text-body-sm font-medium">Bio (optional)</label>
                <textarea id="onboarding-bio" placeholder="Tell us about yourself..." value={bio} onChange={(e) => { if (e.target.value.length <= 500) setBio(e.target.value); }} className="mt-1 flex min-h-[80px] w-full rounded-lg border border-border bg-white px-3 py-2 text-body-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50" maxLength={500} />
                <p className="mt-1 text-caption text-text-muted text-right">{bio.length}/500</p>
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1">Back</Button>
              <Button className="flex-1" disabled={loading || !!usernameError} onClick={handleSubmit}>{loading ? "Saving..." : "Complete Setup"}</Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
