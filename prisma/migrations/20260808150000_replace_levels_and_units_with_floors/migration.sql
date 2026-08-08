-- Convert persisted plan JSON to the floor-only document model.
UPDATE "Project"
SET "document" =
  ("document" - 'levels' - 'units' - 'levelSeq' - 'unitSeq') ||
  jsonb_build_object(
    'floors',
    COALESCE(
      (
        SELECT jsonb_agg(
          (floor - 'id') ||
          jsonb_build_object(
            'id',
            regexp_replace(
              COALESCE(floor ->> 'id', 'floor-' || ordinal),
              '^level-',
              'floor-'
            )
          )
          ORDER BY ordinal
        )
        FROM jsonb_array_elements(
          COALESCE("document" -> 'floors', "document" -> 'levels', '[]'::jsonb)
        ) WITH ORDINALITY AS stored_floor(floor, ordinal)
      ),
      jsonb_build_array(jsonb_build_object('id', 'floor-1', 'name', 'Ground', 'order', 0))
    ),
    'floorSeq', COALESCE("document" -> 'floorSeq', "document" -> 'levelSeq', '1'::jsonb),
    'objects',
    COALESCE(
      (
        SELECT jsonb_agg(
          (object - 'levelId' - 'unitId') ||
          jsonb_build_object(
            'floorId',
            regexp_replace(
              COALESCE(object ->> 'floorId', object ->> 'levelId', 'floor-1'),
              '^level-',
              'floor-'
            )
          )
          ORDER BY ordinal
        )
        FROM jsonb_array_elements(COALESCE("document" -> 'objects', '[]'::jsonb))
          WITH ORDINALITY AS stored_object(object, ordinal)
      ),
      '[]'::jsonb
    )
  )
WHERE jsonb_typeof("document") = 'object';
