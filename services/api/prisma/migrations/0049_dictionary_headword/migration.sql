-- Citation form for a tapped surface. Empty until a dictionary file supplies it.
ALTER TABLE word_dictionary ADD COLUMN IF NOT EXISTS headword TEXT NOT NULL DEFAULT '';
