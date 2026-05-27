"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/layout/Navbar";
import toast from "react-hot-toast";

const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
const interestOptions = [
  "travel", "food", "sports", "tech", "music", "movies", "business", "daily life",
];
const countries = [
  "Brazil", "China", "Colombia", "Egypt", "France", "Germany", "India",
  "Indonesia", "Italy", "Japan", "Mexico", "Morocco", "Philippines",
  "Russia", "Saudi Arabia", "South Korea", "Spain", "Thailand", "Turkey",
  "Ukraine", "United Kingdom", "United States", "Vietnam", "Other",
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, profile, setProfile, isLoading } = useAuthStore();
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [englishLevel, setEnglishLevel] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (profile) {
      setName(profile.name || "");
      setCountry(profile.country || "");
      setEnglishLevel(profile.englishLevel || "");
      setInterests(profile.interests || []);
    }
  }, [user, profile, isLoading]);

  function toggleInterest(interest: string) {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const { updateUser } = await import("@/lib/api/users");
      await updateUser(user.id, { name, country, englishLevel, interests });
      setProfile({ ...profile!, name, country, englishLevel, interests });
      toast.success("Settings saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !profile) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-8">
          <Skeleton className="h-8 w-48" />
          <div className="mt-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Settings</h1>

        <Card className="mt-6">
          <CardHeader>
            <h2 className="font-semibold">Profile</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Display Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Country
              </label>
              <Select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="mt-1"
              >
                <option value="">Select country</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                English Level
              </label>
              <Select
                value={englishLevel}
                onChange={(e) => setEnglishLevel(e.target.value)}
                className="mt-1"
              >
                <option value="">Select level</option>
                {levels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Interests
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {interestOptions.map((interest) => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`rounded-full border px-3 py-1 text-sm transition ${
                      interests.includes(interest)
                        ? "border-primary bg-primary text-white"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <h2 className="font-semibold">Account</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              Email: {user?.email}
            </p>
            <Button
              variant="danger"
              onClick={async () => {
                const confirmed = window.confirm(
                  "Are you sure? This will permanently delete your account."
                );
                if (!confirmed) return;
                try {
                  const { del } = await import("@/lib/api/client");
                  await del(`/api/users/${user?.id}`);
                  await getSupabase().auth.signOut();
                  router.push("/");
                } catch {
                  toast.error("Failed to delete account");
                }
              }}
            >
              Delete Account
            </Button>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
