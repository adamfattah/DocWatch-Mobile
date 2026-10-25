import { useState } from "react";
import { ActionSheetIOS, Alert } from "react-native";
import { pickFromCamera, pickFromLibrary, pickFile, uploadDocument } from "./upload";

// Take Photo / Choose Photo / Choose File, then upload. Used by the Upcoming camera button and the Documents + button.
export function useAddDocument(uid: string) {
  const [uploading, setUploading] = useState(false);
  const add = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ["Cancel", "Take Photo", "Choose Photo", "Choose File"], cancelButtonIndex: 0 },
      async (i) => {
        const picker = [null, pickFromCamera, pickFromLibrary, pickFile][i];
        if (!picker) return;
        try {
          const picked = await picker();
          if (!picked) return;
          setUploading(true);
          await uploadDocument(uid, picked);
        } catch (e: any) {
          Alert.alert("Upload failed", e?.message ?? String(e));
        } finally { setUploading(false); }
      }
    );
  return { add, uploading };
}
