-- The archive used Markdown headings such as "Commentaire 1 :".
-- They do not add meaning in the table and are removed from the displayed review.
update public.archived_album_reviews
set review = regexp_replace(
  review,
  E'(?i)Commentaire [0-9]+\\s*:\\s*',
  '',
  'g'
)
where review ~ E'(?i)Commentaire [0-9]+\\s*:';
