const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function uploadFile(bucket, filePath, buffer, contentType) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload error: ${error.message}`);
  return data.path;
}

async function downloadFile(bucket, filePath) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(filePath);
  if (error) throw new Error(`Storage download error: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

async function deleteFile(bucket, filePath) {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([filePath]);
  if (error) throw new Error(`Storage delete error: ${error.message}`);
}

async function getPublicUrl(bucket, filePath) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

module.exports = { supabase, uploadFile, downloadFile, deleteFile, getPublicUrl };
