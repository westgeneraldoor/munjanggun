-- Classify remaining seeded substitute holidays so the close_holidays toggle
-- controls them instead of treating them as manual operator closures.

UPDATE platform.measurement_date_overrides
SET source = 'holiday'
WHERE memo IN (
  '대체공휴일 (광복절)',
  '대체공휴일 (한글날)'
);
