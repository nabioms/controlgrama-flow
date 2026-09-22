import { mkdir, readFile, writeFile } from "node:fs/promises";

const manifestPath = "android/app/src/main/AndroidManifest.xml";
const iconPath = "android/app/src/main/res/drawable/ic_controlgrama.xml";
const iconVector = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<vector xmlns:android=\"http://schemas.android.com/apk/res/android\"\n    android:width=\"108dp\" android:height=\"108dp\"\n    android:viewportWidth=\"512\" android:viewportHeight=\"512\">\n    <path android:fillColor=\"#030706\" android:pathData=\"M118,10 L394,10 Q502,10 502,118 L502,394 Q502,502 394,502 L118,502 Q10,502 10,394 L10,118 Q10,10 118,10Z\"/>\n    <path android:fillColor=\"#42E53C\" android:pathData=\"M377,122 C332,83 270,65 208,76 C123,91 67,159 65,244 C63,315 99,376 157,414 L198,364 C158,338 135,294 135,244 C135,181 186,130 249,130 C279,130 307,140 329,159 L291,197 L421,197 L421,67 Z\"/>\n    <path android:fillColor=\"#42E53C\" android:pathData=\"M142,252 L224,334 L420,138 L420,215 L224,411 L142,329Z\"/>\n    <path android:fillColor=\"#F7FAF8\" android:pathData=\"M202,244 L202,190 L232,160 L232,272Z\"/>\n    <path android:fillColor=\"#F7FAF8\" android:pathData=\"M252,292 L252,144 L282,114 L282,321Z\"/>\n    <path android:fillColor=\"#F7FAF8\" android:pathData=\"M302,335 L302,95 L332,65 L332,365Z\"/>\n    <path android:fillColor=\"#42E53C\" android:pathData=\"M112,371 C168,397 224,410 286,410 C341,410 389,397 430,374 C394,426 341,451 279,451 C215,451 156,426 112,389Z\"/>\n</vector>";

let manifest = await readFile(manifestPath, "utf8");

await mkdir("android/app/src/main/res/drawable", { recursive: true });
await writeFile(iconPath, iconVector);

if (!manifest.includes('android:icon="@drawable/ic_controlgrama"')) {
  manifest = manifest.replace(
    /(<application[^>]*?)android:label=/,
    '$1android:icon="@drawable/ic_controlgrama" android:roundIcon="@drawable/ic_controlgrama" android:label='
  );
}

const marker = "<!-- ControlGrama deep link -->";
if (!manifest.includes(marker)) {
  const intentFilter = [
    "    <!-- ControlGrama deep link -->",
    "    <intent-filter>",
    "      <action android:name=\"android.intent.action.VIEW\" />",
    "      <category android:name=\"android.intent.category.DEFAULT\" />",
    "      <category android:name=\"android.intent.category.BROWSABLE\" />",
    "      <data android:scheme=\"controlgrama\" android:host=\"auth\" android:path=\"/callback\" />",
    "    </intent-filter>",
  ].join("\n") + "\n";

  const activityEnd = manifest.indexOf("</activity>");
  if (activityEnd === -1) throw new Error("Main activity not found in AndroidManifest.xml");
  manifest = manifest.slice(0, activityEnd) + intentFilter + manifest.slice(activityEnd);
}

await writeFile(manifestPath, manifest);
