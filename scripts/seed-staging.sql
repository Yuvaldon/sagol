-- Synthetic data for the staging project only (D-281). Never production: the runner refuses any project whose
-- name does not end in -staging, and this script refuses any database that does not hold exactly one organization
-- (the one the owner's first sign-in bootstraps, D-005). Every row is invented: Hebrew names from a fixed list,
-- personal numbers in a 7-digit range that starts at 9900001, no emails, no phones.
--
-- The company nests under the organization's root unit (D-315), which the root-units migration or the claim
-- creates. The seed never inserts a root: with no live root, or more than one, it stops.
--
-- Re-runnable: every id is derived from the organization's id and a fixed key, every insert is
-- ON CONFLICT DO NOTHING, and every date is anchored to the week the organization was created, so a second run
-- adds nothing and changes nothing. Rows the owner edited in the app keep the owner's edits.

-- An id derived from a key: its md5, with the version and variant bits of an RFC 9562 version-4 UUID set, because
-- the contracts accept only RFC UUIDs (z.uuid()) and an id they reject makes every read of its table fail (D-337).
CREATE OR REPLACE FUNCTION pg_temp.seed_id(key text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $id$
  SELECT overlay(overlay(md5(key) PLACING '4' FROM 13) PLACING '8' FROM 17)::uuid
$id$;

DO $seed$
DECLARE
  org uuid;
  owner_id uuid;
  root_id uuid;
  n_roots integer;
  anchor date;
  n_orgs integer;
  -- 60 soldiers: the HQ (6), then three platoons of 18 (a platoon commander, a sergeant, two squads of 8).
  first_names text[] := ARRAY[
    'איתי','נועם','יונתן','עומר','אורי','דניאל','אריאל','יואב','רועי','עידו',
    'תומר','אלון','נדב','איתמר','עמית','גיא','אביב','ליאור','שחר','יהונתן',
    'אסף','בן','דור','הראל','זיו','טל','ינון','כפיר','לביא','מתן',
    'נתנאל','סהר','עדי','פלג','צור','קובי','רז','שגיא','תום','אוהד',
    'ברק','גל','דביר','הדר','ויקטור','זוהר','חן','טוביה','יאיר','כרמל',
    'לוטם','מאור','ניר','סתיו','ענבר','פז','צליל','קרן','רותם','שירה'];
  last_names text[] := ARRAY[
    'כהן','לוי','מזרחי','פרץ','ביטון','אברהם','פרידמן','דהן','אגבאריה','שפירא',
    'אזולאי','מלכה','חדד','גבאי','בן דוד','אוחיון','קליין','רוזן','יוסף','עמר',
    'חזן','שלום','סעדה','גולן','ברגר','וקנין','נחום','טל','אלמוג','שמעוני',
    'הררי','רבינוביץ','זילברמן','קפלן','סויסה','בוזגלו','אשכנזי','נגר','חיים','גרינברג',
    'ששון','אלון','שושן','מימון','בירנבאום','אפשטיין','דוד','סלים','ליבוביץ','חסון',
    'עזרא','ממן','קורן','ברק','גלעד','אדרי','סגל','ויס','אורן','שרעבי'];
  unit_level_names text[] := ARRAY['פלוגה','מחלקה','כיתה'];
  -- title, short title, seniority, color
  ranks text[][] := ARRAY[
    ['מפקד פלוגה','מ״פ','100','red'],
    ['סגן מפקד פלוגה','סמ״פ','90','orange'],
    ['מפקד מחלקה','מ״מ','70','amber'],
    ['סמל מחלקה','סמל','60','lime'],
    ['מפקד כיתה','מ״כ','50','green'],
    ['לוחם','לוחם','10','gray']];
  -- name, color, icon, availability effect, requires reason, group key
  leave_kinds text[][] := ARRAY[
    ['רגילה','blue','home','unavailable','false','home'],
    ['מיוחדת','purple','family','unavailable','true','home'],
    ['מחלה','red','sick','unavailable','true','health'],
    ['קורס','amber','course','unavailable','false','duty'],
    ['סידורים','teal','other','unavailable','false','home'],
    ['תורנות','gray','mission','available','false','duty']];
  i integer;
  k integer;
  r integer;
  sid uuid;
  unit_key text;
  rank_key text;
  dep_key text;
  dep_start date;
  dep_len integer;
  slot integer;
  l_start date;
  l_len integer;
  l_type integer;
  l_status text;
  l_id uuid;
  reviewer uuid;
  created_ts timestamptz;
BEGIN
  SELECT count(*) INTO n_orgs FROM organizations;
  IF n_orgs <> 1 THEN
    RAISE EXCEPTION 'seed-staging: expected exactly one organization (the bootstrapped one), found %', n_orgs;
  END IF;
  SELECT id, (date_trunc('week', created_at))::date INTO org, anchor FROM organizations;
  -- The owner: the soldier of the first linked account (D-005).
  SELECT soldier_id INTO owner_id FROM soldier_accounts
   WHERE organization_id = org AND revoked_at IS NULL ORDER BY linked_at LIMIT 1;
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'seed-staging: the organization has no linked account; sign in once first';
  END IF;
  -- The root unit (D-315): one live unit with no parent. The seed nests under it and never makes one.
  SELECT count(*), min(id::text)::uuid INTO n_roots, root_id FROM units
   WHERE organization_id = org AND parent_id IS NULL AND archived_at IS NULL;
  IF n_roots <> 1 THEN
    RAISE EXCEPTION 'seed-staging: expected exactly one live root unit, found %; apply the root-units migration first', n_roots;
  END IF;
  -- A run before D-337 used the bare md5 as the id. Its rows cannot be rewritten in place, and a run beside them
  -- would collide on their names and codes: the staging database is reset first.
  IF EXISTS (SELECT 1 FROM units WHERE id = md5(org || ':seed:unit:company')::uuid) THEN
    RAISE EXCEPTION 'seed-staging: the database holds an earlier seed with ids the contracts reject; reset staging first';
  END IF;

  -- Unit levels and units: the company under the root, its HQ, three platoons of two squads each.
  FOR i IN 1..3 LOOP
    INSERT INTO unit_levels (id, organization_id, name, sort_order, created_by, updated_by)
    VALUES (pg_temp.seed_id(org || ':seed:level:' || i), org, unit_level_names[i], i, owner_id, owner_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
  INSERT INTO units (id, organization_id, name, code, parent_id, unit_level_id, color_key, sort_order, created_by, updated_by)
  VALUES (pg_temp.seed_id(org || ':seed:unit:company'), org, 'פלוגה ב׳', 'SEED-B', root_id,
          pg_temp.seed_id(org || ':seed:level:1'), 'blue', 1, owner_id, owner_id)
  ON CONFLICT DO NOTHING;
  INSERT INTO units (id, organization_id, name, code, parent_id, unit_level_id, color_key, sort_order, created_by, updated_by)
  VALUES (pg_temp.seed_id(org || ':seed:unit:hq'), org, 'מפל״ג', 'SEED-B-HQ', pg_temp.seed_id(org || ':seed:unit:company'),
          pg_temp.seed_id(org || ':seed:level:2'), 'gray', 0, owner_id, owner_id)
  ON CONFLICT DO NOTHING;
  FOR i IN 1..3 LOOP
    INSERT INTO units (id, organization_id, name, code, parent_id, unit_level_id, color_key, sort_order, created_by, updated_by)
    VALUES (pg_temp.seed_id(org || ':seed:unit:p' || i), org, 'מחלקה ' || i, 'SEED-B-' || i,
            pg_temp.seed_id(org || ':seed:unit:company'), pg_temp.seed_id(org || ':seed:level:2'),
            (ARRAY['green','purple','cyan'])[i], i, owner_id, owner_id)
    ON CONFLICT DO NOTHING;
    FOR k IN 1..2 LOOP
      INSERT INTO units (id, organization_id, name, code, parent_id, unit_level_id, sort_order, created_by, updated_by)
      VALUES (pg_temp.seed_id(org || ':seed:unit:p' || i || 's' || k), org, 'כיתה ' || i || '.' || k, 'SEED-B-' || i || '-' || k,
              pg_temp.seed_id(org || ':seed:unit:p' || i), pg_temp.seed_id(org || ':seed:level:3'), k, owner_id, owner_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- Command ranks.
  FOR i IN 1..array_length(ranks, 1) LOOP
    INSERT INTO command_ranks (id, organization_id, title, short_title, seniority, color_key, created_by, updated_by)
    VALUES (pg_temp.seed_id(org || ':seed:rank:' || i), org, ranks[i][1], ranks[i][2], ranks[i][3]::integer, ranks[i][4],
            owner_id, owner_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Tags: a multiple-selection category of roles in the field and a single-selection category of shifts.
  INSERT INTO tag_categories (id, organization_id, name, selection_mode, color_key, sort_order, created_by, updated_by)
  VALUES (pg_temp.seed_id(org || ':seed:tagcat:skill'), org, 'מקצוע', 'multiple', 'indigo', 1, owner_id, owner_id),
         (pg_temp.seed_id(org || ':seed:tagcat:shift'), org, 'משמרת', 'single', 'pink', 2, owner_id, owner_id)
  ON CONFLICT DO NOTHING;
  FOR i IN 1..4 LOOP
    INSERT INTO tags (id, organization_id, category_id, name, sort_order, created_by, updated_by)
    VALUES (pg_temp.seed_id(org || ':seed:tag:skill:' || i), org, pg_temp.seed_id(org || ':seed:tagcat:skill'),
            (ARRAY['חובש','נהג','קשר','צלף'])[i], i, owner_id, owner_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
  FOR i IN 1..2 LOOP
    INSERT INTO tags (id, organization_id, category_id, name, sort_order, created_by, updated_by)
    VALUES (pg_temp.seed_id(org || ':seed:tag:shift:' || i), org, pg_temp.seed_id(org || ':seed:tagcat:shift'),
            (ARRAY['משמרת א׳','משמרת ב׳'])[i], i, owner_id, owner_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Leave type groups and leave types.
  INSERT INTO leave_type_groups (id, organization_id, name, sort_order, created_by, updated_by)
  VALUES (pg_temp.seed_id(org || ':seed:ltgroup:home'), org, 'יציאות', 1, owner_id, owner_id),
         (pg_temp.seed_id(org || ':seed:ltgroup:health'), org, 'בריאות', 2, owner_id, owner_id),
         (pg_temp.seed_id(org || ':seed:ltgroup:duty'), org, 'תפקיד', 3, owner_id, owner_id)
  ON CONFLICT DO NOTHING;
  FOR i IN 1..array_length(leave_kinds, 1) LOOP
    INSERT INTO leave_types (id, organization_id, group_id, name, color_key, icon_key, availability_effect,
                             requires_reason, sort_order, created_by, updated_by)
    VALUES (pg_temp.seed_id(org || ':seed:ltype:' || i), org, pg_temp.seed_id(org || ':seed:ltgroup:' || leave_kinds[i][6]),
            leave_kinds[i][1], leave_kinds[i][2], leave_kinds[i][3], leave_kinds[i][4], leave_kinds[i][5]::boolean,
            i, owner_id, owner_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Two rotations on the company: one that ended, and the current one.
  INSERT INTO deployments (id, organization_id, name, unit_id, start_date, end_date, created_by, updated_by)
  VALUES (pg_temp.seed_id(org || ':seed:dep:past'), org, 'סבב קיץ', pg_temp.seed_id(org || ':seed:unit:company'),
          anchor - 63, anchor - 15, owner_id, owner_id),
         (pg_temp.seed_id(org || ':seed:dep:current'), org, 'סבב סתיו', pg_temp.seed_id(org || ':seed:unit:company'),
          anchor - 14, anchor + 69, owner_id, owner_id)
  ON CONFLICT DO NOTHING;

  -- The owner joins the company and both rotations, unless the owner already has a primary unit.
  IF NOT EXISTS (SELECT 1 FROM unit_memberships WHERE soldier_id = owner_id AND membership_type = 'primary') THEN
    INSERT INTO unit_memberships (id, organization_id, soldier_id, unit_id, membership_type, valid_from, created_by, updated_by)
    VALUES (pg_temp.seed_id(org || ':seed:membership:owner'), org, owner_id, pg_temp.seed_id(org || ':seed:unit:company'),
            'primary', anchor - 63, owner_id, owner_id)
    ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO deployment_members (deployment_id, soldier_id, organization_id, created_by)
  VALUES (pg_temp.seed_id(org || ':seed:dep:past'), owner_id, org, owner_id),
         (pg_temp.seed_id(org || ':seed:dep:current'), owner_id, org, owner_id)
  ON CONFLICT DO NOTHING;

  -- Soldiers, their private rows, memberships, tags and rotation memberships.
  FOR i IN 1..60 LOOP
    sid := pg_temp.seed_id(org || ':seed:soldier:' || i);
    IF i <= 6 THEN
      unit_key := 'hq';
      rank_key := CASE WHEN i = 1 THEN '2' ELSE '6' END;
    ELSE
      r := (i - 7) % 18;            -- position inside the platoon, 0..17
      IF r < 2 THEN
        unit_key := 'p' || ((i - 7) / 18 + 1);
        rank_key := CASE WHEN r = 0 THEN '3' ELSE '4' END;
      ELSE
        unit_key := 'p' || ((i - 7) / 18 + 1) || 's' || ((r - 2) / 8 + 1);
        rank_key := CASE WHEN (r - 2) % 8 = 0 THEN '5' ELSE '6' END;
      END IF;
    END IF;
    INSERT INTO soldiers (id, organization_id, first_name, last_name, command_rank_id, created_by, updated_by)
    VALUES (sid, org, first_names[i], last_names[i], pg_temp.seed_id(org || ':seed:rank:' || rank_key), owner_id, owner_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO soldier_private (soldier_id, organization_id, personal_id, updated_by)
    VALUES (sid, org, (9900000 + i)::text, owner_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO unit_memberships (id, organization_id, soldier_id, unit_id, membership_type, valid_from, created_by, updated_by)
    VALUES (pg_temp.seed_id(org || ':seed:membership:' || i), org, sid, pg_temp.seed_id(org || ':seed:unit:' || unit_key),
            'primary', anchor - 63, owner_id, owner_id)
    ON CONFLICT DO NOTHING;
    IF i % 7 = 0 OR i % 11 = 0 THEN
      INSERT INTO soldier_tags (soldier_id, tag_id, organization_id, created_by)
      VALUES (sid, pg_temp.seed_id(org || ':seed:tag:skill:' || (i % 4 + 1)), org, owner_id)
      ON CONFLICT DO NOTHING;
    END IF;
    INSERT INTO soldier_tags (soldier_id, tag_id, organization_id, created_by)
    VALUES (sid, pg_temp.seed_id(org || ':seed:tag:shift:' || (i % 2 + 1)), org, owner_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO deployment_members (deployment_id, soldier_id, organization_id, created_by)
    VALUES (pg_temp.seed_id(org || ':seed:dep:past'), sid, org, owner_id),
           (pg_temp.seed_id(org || ':seed:dep:current'), sid, org, owner_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Leaves: in each rotation, one leave in each third of it, so a soldier's leaves never overlap.
  -- Leaves already behind the organization's first week are settled; those ahead are a mix of requests.
  FOR i IN 1..60 LOOP
    sid := pg_temp.seed_id(org || ':seed:soldier:' || i);
    -- The reviewer: the platoon commander for platoon soldiers, the deputy for the HQ and the platoon commanders.
    IF i <= 7 OR (i - 7) % 18 = 0 THEN
      reviewer := pg_temp.seed_id(org || ':seed:soldier:1');
    ELSE
      reviewer := pg_temp.seed_id(org || ':seed:soldier:' || (7 + ((i - 7) / 18) * 18));
    END IF;
    IF i = 1 THEN
      reviewer := owner_id;
    END IF;
    FOREACH dep_key IN ARRAY ARRAY['past', 'current'] LOOP
      IF dep_key = 'past' THEN
        dep_start := anchor - 63; dep_len := 49;
      ELSE
        dep_start := anchor - 14; dep_len := 84;
      END IF;
      slot := dep_len / 3;
      FOR k IN 0..2 LOOP
        -- Skip some, so the board is not uniform.
        CONTINUE WHEN (i + k * 5) % 9 = 0;
        l_len := 1 + (i + k) % 4;
        l_start := dep_start + k * slot + (i * 7 + k * 3) % (slot - l_len);
        l_type := CASE WHEN (i + k) % 10 < 6 THEN 1 ELSE (i + k) % 6 + 1 END;
        IF l_start < anchor THEN
          l_status := CASE WHEN (i + k) % 13 = 0 THEN 'rejected' WHEN (i + k) % 17 = 0 THEN 'cancelled' ELSE 'approved' END;
        ELSE
          l_status := CASE WHEN (i + k) % 3 = 0 THEN 'pending' WHEN (i + k) % 19 = 0 THEN 'rejected' ELSE 'approved' END;
        END IF;
        l_id := pg_temp.seed_id(org || ':seed:leave:' || dep_key || ':' || i || ':' || k);
        created_ts := (l_start - 10)::timestamp AT TIME ZONE 'UTC' + make_interval(hours => 8 + i % 10);
        INSERT INTO leaves (id, organization_id, soldier_id, leave_type_id, deployment_id, start_date, end_date, status,
                            reason, reviewed_by, reviewed_at, created_at, created_by, updated_at, updated_by)
        VALUES (l_id, org, sid, pg_temp.seed_id(org || ':seed:ltype:' || l_type), pg_temp.seed_id(org || ':seed:dep:' || dep_key),
                l_start, l_start + l_len - 1, l_status,
                CASE WHEN leave_kinds[l_type][5]::boolean THEN
                  (ARRAY['אירוע משפחתי','תור לרופא','בדיקות','חתונה של אח'])[(i + k) % 4 + 1] END,
                CASE WHEN l_status IN ('approved', 'rejected') THEN reviewer END,
                CASE WHEN l_status IN ('approved', 'rejected') THEN created_ts + interval '1 day' END,
                created_ts, sid,
                CASE WHEN l_status = 'pending' THEN created_ts ELSE created_ts + interval '1 day' END,
                CASE WHEN l_status IN ('approved', 'rejected') THEN reviewer ELSE sid END)
        ON CONFLICT DO NOTHING;
        -- The history, written once: the request, then the decision.
        IF NOT EXISTS (SELECT 1 FROM leave_events WHERE leave_id = l_id) THEN
          INSERT INTO leave_events (id, organization_id, leave_id, actor_id, event_type, from_status, to_status, created_at)
          VALUES (pg_temp.seed_id(org || ':seed:event:' || l_id || ':1'), org, l_id, sid, 'created', NULL, 'pending', created_ts);
          IF l_status <> 'pending' THEN
            INSERT INTO leave_events (id, organization_id, leave_id, actor_id, event_type, from_status, to_status, created_at)
            VALUES (pg_temp.seed_id(org || ':seed:event:' || l_id || ':2'), org, l_id,
                    CASE WHEN l_status = 'cancelled' THEN sid ELSE reviewer END,
                    l_status, 'pending', l_status, created_ts + interval '1 day');
          END IF;
        END IF;
        IF (i + k) % 8 = 0 THEN
          INSERT INTO leave_comments (id, organization_id, leave_id, author_id, body, visibility, created_at)
          VALUES (pg_temp.seed_id(org || ':seed:comment:' || l_id), org, l_id, reviewer,
                  CASE WHEN l_status = 'rejected' THEN 'לא מתאפשר, המחלקה בכוננות באותו שבוע'
                       ELSE 'מאושר, לחזור עד 10:00' END,
                  'shared', created_ts + interval '1 day')
          ON CONFLICT DO NOTHING;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Roles: a commander sees and decides the leaves of the soldiers under them; a soldier asks for their own.
  INSERT INTO roles (id, organization_id, name, description, color_key, created_by, updated_by)
  VALUES (pg_temp.seed_id(org || ':seed:role:commander'), org, 'מפקד', 'רואה ומאשר בקשות של הכפופים', 'amber', owner_id, owner_id),
         (pg_temp.seed_id(org || ':seed:role:soldier'), org, 'חייל', 'מבקש יציאות לעצמו', 'gray', owner_id, owner_id)
  ON CONFLICT DO NOTHING;
  INSERT INTO role_permissions (role_id, organization_id, resource, action)
  SELECT pg_temp.seed_id(org || ':seed:role:commander'), org, p[1], p[2]
    FROM (VALUES (ARRAY['soldiers','view']), (ARRAY['memberships','view']), (ARRAY['deployments','view']),
                 (ARRAY['tags','view']), (ARRAY['leave_types','view']), (ARRAY['leaves','view']),
                 (ARRAY['leaves','create']), (ARRAY['leaves','update']), (ARRAY['leaves','approve']),
                 (ARRAY['leave_comments','view']), (ARRAY['leave_comments','create']),
                 (ARRAY['internal_comments','view']), (ARRAY['internal_comments','create'])) AS v(p)
  ON CONFLICT DO NOTHING;
  INSERT INTO role_permissions (role_id, organization_id, resource, action)
  SELECT pg_temp.seed_id(org || ':seed:role:soldier'), org, p[1], p[2]
    FROM (VALUES (ARRAY['soldiers','view']), (ARRAY['leave_types','view']), (ARRAY['leaves','view']),
                 (ARRAY['leaves','create']), (ARRAY['leave_comments','view']),
                 (ARRAY['leave_comments','create'])) AS v(p)
  ON CONFLICT DO NOTHING;
  -- The deputy reaches the whole company (one step up from the HQ); platoon and squad commanders reach their unit.
  INSERT INTO rank_role_bindings (id, organization_id, command_rank_id, role_id, anchor_type, anchor_steps,
                                  include_descendants, subject_rank_constraint, created_by, updated_by)
  VALUES (pg_temp.seed_id(org || ':seed:binding:2'), org, pg_temp.seed_id(org || ':seed:rank:2'),
          pg_temp.seed_id(org || ':seed:role:commander'), 'home_ancestor_steps', 1, true, 'junior', owner_id, owner_id)
  ON CONFLICT DO NOTHING;
  FOR i IN 3..5 LOOP
    INSERT INTO rank_role_bindings (id, organization_id, command_rank_id, role_id, anchor_type, include_descendants,
                                    subject_rank_constraint, created_by, updated_by)
    VALUES (pg_temp.seed_id(org || ':seed:binding:' || i), org, pg_temp.seed_id(org || ':seed:rank:' || i),
            pg_temp.seed_id(org || ':seed:role:commander'), 'home_unit', true, 'junior', owner_id, owner_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
  INSERT INTO rank_role_bindings (id, organization_id, command_rank_id, role_id, anchor_type, created_by, updated_by)
  VALUES (pg_temp.seed_id(org || ':seed:binding:6'), org, pg_temp.seed_id(org || ':seed:rank:6'),
          pg_temp.seed_id(org || ':seed:role:soldier'), 'self', owner_id, owner_id)
  ON CONFLICT DO NOTHING;

  -- Two soft availability rules for the current rotation.
  INSERT INTO availability_rules (id, organization_id, name, description, enforcement, scope_unit_id, scope_mode,
                                  population_filter, metric, min_value, deployment_id, created_by, updated_by)
  VALUES (pg_temp.seed_id(org || ':seed:rule:platoons'), org, '70% בכל מחלקה', 'בכל יום לפחות 70% מכל מחלקה בבסיס',
          'soft', pg_temp.seed_id(org || ':seed:unit:company'), 'each_child', '{}'::jsonb, 'percent', 70,
          pg_temp.seed_id(org || ':seed:dep:current'), owner_id, owner_id),
         (pg_temp.seed_id(org || ':seed:rule:medics'), org, 'חובש אחד לפחות', 'בכל יום לפחות חובש אחד בפלוגה',
          'soft', pg_temp.seed_id(org || ':seed:unit:company'), 'unit_tree',
          jsonb_build_object('where', jsonb_build_object('kind', 'tag', 'match', 'any',
            'tag_ids', jsonb_build_array(pg_temp.seed_id(org || ':seed:tag:skill:1')))),
          'count', 1, pg_temp.seed_id(org || ':seed:dep:current'), owner_id, owner_id)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'seed-staging: organization % seeded', org;
END
$seed$;
