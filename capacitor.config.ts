import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.controlgrama.app",
  appName: "ControlGrama",
  webDir: ".output/public",
  android: {
    backgroundColor: "#f7faf8",
    allowMixedContent: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert", "banner", "list"],
    },
  },
};

export default config;
