-- 008_storage_no_svg.sql
-- Remove SVG from allowed upload types (XSS risk when served as image/*).

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'Pics';
