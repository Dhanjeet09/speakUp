"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile: currentProfile } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchProfile();
  }, [user, params.userId]);

  async function fetchProfile() {
    try {
      const { getUser } = await import("@/lib/api/users");
      const res = await getUser(params.userId as string);
      setProfile(res.user);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-8">
          <Skeleton className="h-32 w-32 rounded-full" />
          <Skeleton className="mt-4 h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-32" />
        </main>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-8 text-center">
          <p className="text-gray-500">User not found</p>
        </main>
      </>
    );
  }

  const isOwnProfile = user?.id === profile.id;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-primary/10 text-4xl font-bold text-primary">
            {profile.name?.[0]?.toUpperCase() || "?"}
          </div>
          <h1 className="mt-4 text-2xl font-bold">{profile.name || "Anonymous"}</h1>
          <p className="text-sm text-gray-500">{profile.email}</p>
          <div className="mt-3 flex gap-2">
            {profile.englishLevel && <Badge>{profile.englishLevel}</Badge>}
            {profile.country && <Badge variant="outline">{profile.country}</Badge>}
          </div>
          {profile.interests?.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {profile.interests.map((i: string) => (
                <Badge key={i} variant="outline">{i}</Badge>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-gray-500">Total Sessions</p>
              <p className="text-2xl font-bold">{profile.totalSessions}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-gray-500">Total Minutes</p>
              <p className="text-2xl font-bold">{profile.totalMinutes}</p>
            </CardContent>
          </Card>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          Member since {new Date(profile.createdAt).toLocaleDateString()}
        </p>

        {isOwnProfile && (
          <div className="mt-6 text-center">
            <Link href="/settings">
              <Button variant="outline">Edit Profile</Button>
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
