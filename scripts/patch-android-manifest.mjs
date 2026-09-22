import { mkdir, readFile, writeFile } from "node:fs/promises";

const manifestPath = "android/app/src/main/AndroidManifest.xml";
const iconPath = "android/app/src/main/res/drawable/ic_controlgrama.xml";
const iconVector = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<vector xmlns:android=\"http://schemas.android.com/apk/res/android\"\n    android:width=\"108dp\"\n    android:height=\"108dp\"\n    android:viewportWidth=\"512\"\n    android:viewportHeight=\"512\">\n    <path android:fillColor=\"#030706\" android:pathData=\"M112,0 L400,0 Q512,0 512,112 L512,400 Q512,512 400,512 L112,512 Q0,512 0,400 L0,112 Q0,0 112,0Z\"/>\n    <path android:fillColor=\"#42E53C\" android:fillType=\"evenOdd\" android:pathData=\"M256,76 A160,160 0,1 1,96,236 A160,160 0,0 1,256,76 M256,124 A112,112 0,1 0,368,236 A112,112 0,0 0,256,124Z\"/>\n    <path android:fillColor=\"#030706\" android:pathData=\"M300,52 L512,52 L512,215 L335,215 L300,180Z\"/>\n    <path android:fillColor=\"#42E53C\" android:pathData=\"M150,248 L235,333 L405,163 L405,220 L235,390 L150,305Z\"/>\n    <path android:fillColor=\"#F7FAF8\" android:pathData=\"M205,238 L205,177 L237,148 L237,275Z\"/>\n    <path android:fillColor=\"#F7FAF8\" android:pathData=\"M256,279 L256,130 L288,99 L288,312Z\"/>\n    <path android:fillColor=\"#F7FAF8\" android:pathData=\"M307,319 L307,83 L339,52 L339,352Z\"/>\n    <path android:fillColor=\"#42E53C\" android:pathData=\"M165,313 C214,333 262,350 314,350 C349,350 383,340 419,321 C386,372 338,394 282,394 C229,394 184,370 145,340Z\"/>\n</vector>";

let manifest = await readFile(manifestPath, "utf8");

await mkdir("android/app/src/main/res/drawable", { recursive: true });
await writeFile(iconPath, iconVector);

const iconMarker = 'android:icon="@drawable/ic_controlgrama"';
if (!manifest.includes(iconMarker)) {
  const labelMarker = 'android:label="@string/app_name"';
  if (!manifest.includes(labelMarker)) throw new Error("Android application label not found in AndroidManifest.xml");
  manifest = manifest.replace(
    labelMarker,
    'android:icon="@drawable/ic_controlgrama"\n        android:roundIcon="@drawable/ic_controlgrama"\n        android:label="@string/app_name"'
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
