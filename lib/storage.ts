import { supabase } from "@/integrations/supabase/client";

/**
 * Upload an image to the form-uploads bucket
 * @param file - The file to upload
 * @param path - The path within the bucket (e.g., 'responses/form-id/session-id')
 * @returns The public URL of the uploaded file, or null if upload failed
 */
export const uploadFormImage = async (
  file: File,
  path: string,
): Promise<string | null> => {
  try {
    // Generate a unique filename
    const timestamp = Date.now();
    const extension = file.name.split(".").pop() || "jpg";
    const filename = `${timestamp}.${extension}`;
    const fullPath = `${path}/${filename}`;

    // Upload the file
    const { error: uploadError } = await supabase.storage
      .from("form-uploads")
      .upload(fullPath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return null;
    }

    // Get the public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("form-uploads").getPublicUrl(fullPath);

    return publicUrl;
  } catch (error) {
    console.error("Error uploading image:", error);
    return null;
  }
};

/**
 * Upload a response image (customer photo uploads)
 */
export const uploadResponseImage = async (
  file: File,
  formId: string,
  sessionId: string,
): Promise<string | null> => {
  return uploadFormImage(file, `responses/${formId}/${sessionId}`);
};

/**
 * Upload a form section image (for welcome/complete cards)
 */
export const uploadSectionImage = async (
  file: File,
  formId: string,
  sectionId: string,
): Promise<string | null> => {
  return uploadFormImage(file, `forms/${formId}/sections`);
};

/**
 * Delete an image from storage by URL
 */
export const deleteFormImage = async (publicUrl: string): Promise<boolean> => {
  try {
    // Extract the path from the URL
    const url = new URL(publicUrl);
    const pathMatch = url.pathname.match(
      /\/storage\/v1\/object\/public\/form-uploads\/(.+)/,
    );

    if (!pathMatch) {
      console.error("Could not extract path from URL:", publicUrl);
      return false;
    }

    const path = pathMatch[1];

    const { error } = await supabase.storage
      .from("form-uploads")
      .remove([path]);

    if (error) {
      console.error("Delete error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deleting image:", error);
    return false;
  }
};
