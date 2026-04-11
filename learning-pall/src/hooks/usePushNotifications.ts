"use client";

import { useState, useCallback, useEffect } from "react";

type PushState = {
  isSupported: boolean;
  isSubscribed: boolean;
  requestPermission: () => Promise<boolean>;
};

export function usePushNotifications(): PushState {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    setIsSupported(
      typeof window !== "undefined" &&
        "Notification" in window &&
        "serviceWorker" in navigator
    );
    if (typeof window !== "undefined" && Notification.permission === "granted") {
      setIsSubscribed(true);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      // Send subscription to server
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("Push subscription failed:", err);
      return false;
    }
  }, [isSupported]);

  return { isSupported, isSubscribed, requestPermission };
}
