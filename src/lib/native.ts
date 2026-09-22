import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType } from "@capacitor/camera";
import { Geolocation } from "@capacitor/geolocation";
import { LocalNotifications } from "@capacitor/local-notifications";

export const isNativeApp = () => Capacitor.isNativePlatform();
export const isAndroidApp = () => Capacitor.getPlatform() === "android";

export async function takeNativePhoto() {
  if (!isNativeApp()) {
    throw new Error("A câmera nativa está disponível apenas no aplicativo instalado.");
  }

  const photo = await Camera.takePhoto({
    quality: 90,
    cameraDirection: "rear",
  });

  return photo;
}

export async function getNativeLocation() {
  if (!isNativeApp()) {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });
    return position.coords;
  }

  const permission = await Geolocation.checkPermissions();
  if (permission.location !== "granted") {
    const requested = await Geolocation.requestPermissions();
    if (requested.location !== "granted") {
      throw new Error("Permissão de localização não concedida.");
    }
  }

  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
  });

  return position.coords;
}

export async function scheduleNativeReminder(
  id: number,
  title: string,
  body: string,
  at: Date,
) {
  if (!isNativeApp()) {
    throw new Error("As notificações nativas estão disponíveis apenas no aplicativo instalado.");
  }

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") {
    const requested = await LocalNotifications.requestPermissions();
    if (requested.display !== "granted") {
      throw new Error("Permissão de notificações não concedida.");
    }
  }

  await LocalNotifications.schedule({
    notifications: [{ id, title, body, schedule: { at } }],
  });
}
