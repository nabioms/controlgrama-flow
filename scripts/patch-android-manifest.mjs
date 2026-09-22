import { readFile, writeFile } from "node:fs/promises";

const manifestPath = "android/app/src/main/AndroidManifest.xml";
let manifest = await readFile(manifestPath, "utf8");

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
  await writeFile(manifestPath, manifest);
}