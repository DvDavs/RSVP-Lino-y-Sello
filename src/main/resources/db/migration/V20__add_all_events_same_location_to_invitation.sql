-- Add all_events_same_location field to invitation table
-- This field indicates whether all events in the itinerary occur at the same location

ALTER TABLE public.invitation
ADD COLUMN IF NOT EXISTS all_events_same_location BOOLEAN NOT NULL DEFAULT false;

-- Add comment to explain the column purpose (skip if column already has comment)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'invitation' 
        AND column_name = 'all_events_same_location'
    ) THEN
        COMMENT ON COLUMN public.invitation.all_events_same_location IS 'Indicates if all itinerary events occur at the same location. Used to determine single-place vs multi-place rendering in sectionEvent.';
    END IF;
END $$;

