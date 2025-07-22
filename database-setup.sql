-- Supabase Database Setup for OCR Data Collection App
-- Run these commands in the Supabase SQL Editor

-- Workers table
CREATE TABLE workers (
  worker_id TEXT PRIMARY KEY,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_sessions INTEGER DEFAULT 1,
  is_banned BOOLEAN DEFAULT FALSE
);

-- Sessions table  
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  worker_id TEXT REFERENCES workers(worker_id),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  target_images INTEGER,
  completed_images INTEGER DEFAULT 0,
  skipped_codes INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  status TEXT DEFAULT 'active'
);

-- Codes table
CREATE TABLE codes (
  id SERIAL PRIMARY KEY,
  session_id TEXT REFERENCES sessions(session_id),
  worker_id TEXT REFERENCES workers(worker_id),
  code TEXT,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  skipped_at TIMESTAMP WITH TIME ZONE,
  filename TEXT,
  s3_key TEXT,
  status TEXT DEFAULT 'generated'
);

-- Enable Row Level Security (RLS) for security
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE codes ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for the app (adjust policies as needed)
CREATE POLICY "Allow anonymous access" ON workers FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON sessions FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON codes FOR ALL USING (true);