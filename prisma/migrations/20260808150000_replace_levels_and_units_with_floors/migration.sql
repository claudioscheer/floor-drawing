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
          CASE
            WHEN jsonb_typeof("document" -> 'floors') = 'array'
              THEN "document" -> 'floors'
            WHEN jsonb_typeof("document" -> 'levels') = 'array'
              THEN "document" -> 'levels'
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS stored_floor(floor, ordinal)
        WHERE jsonb_typeof(floor) = 'object'
      ),
      jsonb_build_array(jsonb_build_object('id', 'floor-1', 'name', 'Ground', 'order', 0))
    ),
    'floorSeq',
    CASE
      WHEN jsonb_typeof("document" -> 'floorSeq') = 'number'
        THEN "document" -> 'floorSeq'
      WHEN jsonb_typeof("document" -> 'levelSeq') = 'number'
        THEN "document" -> 'levelSeq'
      ELSE '1'::jsonb
    END,
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
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof("document" -> 'objects') = 'array'
              THEN "document" -> 'objects'
            ELSE '[]'::jsonb
          END
        )
          WITH ORDINALITY AS stored_object(object, ordinal)
        WHERE jsonb_typeof(object) = 'object'
      ),
      '[]'::jsonb
    )
  )
WHERE jsonb_typeof("document") = 'object';
