-- V9: Add ON DELETE CASCADE to all foreign keys referencing the 'invitation' table.
-- This script is idempotent: it first drops existing constraints if they exist,
-- then creates them with the ON DELETE CASCADE option.

-- Relation: invitation_activity
ALTER TABLE public.invitation_activity DROP CONSTRAINT IF EXISTS fk214t0kv116gqut7kirkohug6g;
ALTER TABLE public.invitation_activity DROP CONSTRAINT IF EXISTS fk_invitation_activity_invitation; -- Nombre nuevo
ALTER TABLE public.invitation_activity ADD CONSTRAINT fk_invitation_activity_invitation
    FOREIGN KEY (invitation_id) REFERENCES public.invitation(id) ON DELETE CASCADE;

-- Relation: invitation_dress_code
ALTER TABLE public.invitation_dress_code DROP CONSTRAINT IF EXISTS fkt9bx7onjdsrfaj9hev5wkk0ka;
ALTER TABLE public.invitation_dress_code DROP CONSTRAINT IF EXISTS fk_invitation_dress_code_invitation;
ALTER TABLE public.invitation_dress_code ADD CONSTRAINT fk_invitation_dress_code_invitation
    FOREIGN KEY (invitation_id) REFERENCES public.invitation(id) ON DELETE CASCADE;

-- Relation: invitation_gallery
ALTER TABLE public.invitation_gallery DROP CONSTRAINT IF EXISTS fk9tmeb9kpv37xubli22vy0so83;
ALTER TABLE public.invitation_gallery DROP CONSTRAINT IF EXISTS fk_invitation_gallery_invitation;
ALTER TABLE public.invitation_gallery ADD CONSTRAINT fk_invitation_gallery_invitation
    FOREIGN KEY (invitation_id) REFERENCES public.invitation(id) ON DELETE CASCADE;

-- Relation: invitation_gift_registry
ALTER TABLE public.invitation_gift_registry DROP CONSTRAINT IF EXISTS fkqiedkcb3mehvjpjgc1hlb3hhv;
ALTER TABLE public.invitation_gift_registry DROP CONSTRAINT IF EXISTS fk_invitation_gift_registry_invitation;
ALTER TABLE public.invitation_gift_registry ADD CONSTRAINT fk_invitation_gift_registry_invitation
    FOREIGN KEY (invitation_id) REFERENCES public.invitation(id) ON DELETE CASCADE;

-- Relation: invitation_godparent
ALTER TABLE public.invitation_godparent DROP CONSTRAINT IF EXISTS fkrrkvf534tm09fkpg0m31h0xgv;
ALTER TABLE public.invitation_godparent DROP CONSTRAINT IF EXISTS fk_invitation_godparent_invitation;
ALTER TABLE public.invitation_godparent ADD CONSTRAINT fk_invitation_godparent_invitation
    FOREIGN KEY (invitation_id) REFERENCES public.invitation(id) ON DELETE CASCADE;

-- Relation: invitation_itinerary
ALTER TABLE public.invitation_itinerary DROP CONSTRAINT IF EXISTS fksntbbxe0028aj3svhsr7t59qb;
ALTER TABLE public.invitation_itinerary DROP CONSTRAINT IF EXISTS fk_invitation_itinerary_invitation;
ALTER TABLE public.invitation_itinerary ADD CONSTRAINT fk_invitation_itinerary_invitation
    FOREIGN KEY (invitation_id) REFERENCES public.invitation(id) ON DELETE CASCADE;

-- Relation: invitation_music
ALTER TABLE public.invitation_music DROP CONSTRAINT IF EXISTS fky105flm7dytj01ha2tpplbru;
ALTER TABLE public.invitation_music DROP CONSTRAINT IF EXISTS fk_invitation_music_invitation;
ALTER TABLE public.invitation_music ADD CONSTRAINT fk_invitation_music_invitation
    FOREIGN KEY (invitation_id) REFERENCES public.invitation(id) ON DELETE CASCADE;

-- Relation: invitation_parent
ALTER TABLE public.invitation_parent DROP CONSTRAINT IF EXISTS fkqdl0unossnwtm9qriy8yjw660;
ALTER TABLE public.invitation_parent DROP CONSTRAINT IF EXISTS fk_invitation_parent_invitation;
ALTER TABLE public.invitation_parent ADD CONSTRAINT fk_invitation_parent_invitation
    FOREIGN KEY (invitation_id) REFERENCES public.invitation(id) ON DELETE CASCADE;

-- Relation: invitation_people
ALTER TABLE public.invitation_people DROP CONSTRAINT IF EXISTS fko1ovitfyj960p1vxipqyjl5jt;
ALTER TABLE public.invitation_people DROP CONSTRAINT IF EXISTS fk_invitation_people_invitation;
ALTER TABLE public.invitation_people ADD CONSTRAINT fk_invitation_people_invitation
    FOREIGN KEY (invitation_id) REFERENCES public.invitation(id) ON DELETE CASCADE;

-- Relation: invitation_phrase
ALTER TABLE public.invitation_phrase DROP CONSTRAINT IF EXISTS fkmnqls7snyk5x4svr6elu7j1un;
ALTER TABLE public.invitation_phrase DROP CONSTRAINT IF EXISTS fk_invitation_phrase_invitation;
ALTER TABLE public.invitation_phrase ADD CONSTRAINT fk_invitation_phrase_invitation
    FOREIGN KEY (invitation_id) REFERENCES public.invitation(id) ON DELETE CASCADE;

-- Relation: invitation_recommendation
ALTER TABLE public.invitation_recommendation DROP CONSTRAINT IF EXISTS fkqtbj44em6hw6m71lcjem74u4v;
ALTER TABLE public.invitation_recommendation DROP CONSTRAINT IF EXISTS fk_invitation_recommendation_invitation;
ALTER TABLE public.invitation_recommendation ADD CONSTRAINT fk_invitation_recommendation_invitation
    FOREIGN KEY (invitation_id) REFERENCES public.invitation(id) ON DELETE CASCADE;

-- Relation: invitation_story
ALTER TABLE public.invitation_story DROP CONSTRAINT IF EXISTS fkmyxoahwt816c1vpupc3ai1j65;
ALTER TABLE public.invitation_story DROP CONSTRAINT IF EXISTS fk_invitation_story_invitation;
ALTER TABLE public.invitation_story ADD CONSTRAINT fk_invitation_story_invitation
    FOREIGN KEY (invitation_id) REFERENCES public.invitation(id) ON DELETE CASCADE;

-- Relation: invitation_template_extra_modules
ALTER TABLE public.invitation_template_extra_modules DROP CONSTRAINT IF EXISTS fkhpremupslh3u90g8lt4y862ds;
ALTER TABLE public.invitation_template_extra_modules DROP CONSTRAINT IF EXISTS fk_invitation_extra_modules_invitation;
ALTER TABLE public.invitation_template_extra_modules ADD CONSTRAINT fk_invitation_extra_modules_invitation
    FOREIGN KEY (template_id) REFERENCES public.invitation(id) ON DELETE CASCADE;
    
-- Relation: invitation_guest
ALTER TABLE public.invitation_guest DROP CONSTRAINT IF EXISTS fk_invitation_guest_invitation;
ALTER TABLE public.invitation_guest ADD CONSTRAINT fk_invitation_guest_invitation
    FOREIGN KEY (invitation_id) REFERENCES public.invitation(id) ON DELETE CASCADE;