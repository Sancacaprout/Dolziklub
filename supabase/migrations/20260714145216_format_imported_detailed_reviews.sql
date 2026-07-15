-- Replace Markdown subheadings from the imported archive with readable text.
update public.archived_album_reviews
set review = regexp_replace(
  review,
  E'(?m)^### Commentaire ([0-9]+)\\s*\\n?',
  E'Commentaire \\1 : ',
  'g'
)
where review ~ E'(?m)^### Commentaire [0-9]+';
