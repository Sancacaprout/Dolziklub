import { notFound } from "next/navigation";
import { CustomThemeEditor } from "@/components/auth/custom-theme-editor/custom-theme-editor";
import { isProfileCustomThemeEditorEnabled } from "@/lib/profile-custom-theme/feature-flag";

export const dynamic = "force-dynamic";

export default function CustomProfileThemePage() {
  if (!isProfileCustomThemeEditorEnabled()) notFound();
  return <CustomThemeEditor />;
}
