"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import toast from "react-hot-toast";

const levels = [
  { id: "A1", label: "Beginner", desc: "I know basic words and phrases" },
  { id: "A2", label: "Elementary", desc: "I can introduce myself and talk about simple topics" },
  { id: "B1", label: "Intermediate", desc: "I can handle everyday conversations" },
  { id: "B2", label: "Upper Intermediate", desc: "I can speak fluently on familiar topics" },
  { id: "C1", label: "Advanced", desc: "I can express ideas spontaneously" },
  { id: "C2", label: "Proficient", desc: "I speak nearly like a native speaker" },
];

const interestOptions = [
  "travel", "food", "sports", "tech", "music", "movies", "business", "daily life",
];

const countries = [
  "Brazil", "China", "Colombia", "Egypt", "France", "Germany", "India",
  "Indonesia", "Italy", "Japan", "Mexico", "Morocco", "Philippines",
  "Russia", "Saudi Arabia", "South Korea", "Spain", "Thailand", "Turkey",
  "Ukraine", "United Kingdom", "United States", "Vietnam", "Other",
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, setProfile } = useAuthStore();
  const [step, setStep] = useState(1);
  const [englishLevel, setEnglishLevel] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/signup");
      return;
    }
    if (profile?.englishLevel) {
      router.push("/dashboard");
    }
  }, [user, profile, router]);

  function toggleInterest(interest: string) {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
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
      });

      setProfile({
        id: user.id,
        email: user.email ?? "",
        name: name || user.email?.split("@")[0] || null,
        country: country || null,
        avatarUrl: user.user_metadata?.avatar_url || null,
        englishLevel: englishLevel || null,
        interests,
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
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold">Set up your profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          Step {step} of 3
        </p>
        <div className="mt-4 flex justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-12 rounded-full ${
                s <= step ? "bg-primary" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
      </div>

      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold">What is your English level?</h2>
          <p className="mt-1 text-sm text-gray-500">
            This helps us find the best conversation partner for you.
          </p>
          <div className="mt-6 space-y-3">
            {levels.map((l) => (
              <button
                key={l.id}
                onClick={() => setEnglishLevel(l.id)}
                className={`w-full rounded-card border p-4 text-left transition ${
                  englishLevel === l.id
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{l.id}</span>
                  <Badge
                    variant={englishLevel === l.id ? "default" : "outline"}
                  >
                    {l.label}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-gray-500">{l.desc}</p>
              </button>
            ))}
          </div>
          <Button
            className="mt-6 w-full"
            disabled={!englishLevel}
            onClick={() => setStep(2)}
          >
            Next
          </Button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="text-lg font-semibold">Pick your interests</h2>
          <p className="mt-1 text-sm text-gray-500">
            Choose at least 2 so we can match you with like-minded partners.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {interestOptions.map((interest) => (
              <button
                key={interest}
                onClick={() => toggleInterest(interest)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  interests.includes(interest)
                    ? "border-primary bg-primary text-white"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={interests.length < 2}
              onClick={() => setStep(3)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 className="text-lg font-semibold">Almost done!</h2>
          <p className="mt-1 text-sm text-gray-500">
            Set your display name and country.
          </p>
          <div className="mt-6 flex flex-col gap-4">
            <label htmlFor="onboarding-name" className="sr-only">Display name</label>
            <Input
              id="onboarding-name"
              placeholder="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label htmlFor="onboarding-country" className="sr-only">Country</label>
            <Select id="onboarding-country" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">Select your country</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={loading}
              onClick={handleSubmit}
            >
              {loading ? "Saving..." : "Complete Setup"}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
