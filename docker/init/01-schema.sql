-- HeyyPal PostgreSQL schema (run by docker-entrypoint-initdb.d)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  google_id VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(255) DEFAULT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'expert')),
  expert_status VARCHAR(20) DEFAULT NULL CHECK (expert_status IN ('pending', 'approved', 'rejected')),
  expert_type VARCHAR(20) DEFAULT NULL,
  gender VARCHAR(20) DEFAULT NULL,
  date_of_birth VARCHAR(20) DEFAULT NULL,
  profile_completed SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role_expert ON users (role, expert_status);

-- Profile photo keys (used by media/profile-photo.service)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_photo_1_key VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS profile_photo_2_key VARCHAR(255) DEFAULT NULL;

-- FCM token for push notifications (required by User entity; add on existing DBs if Google login 500s)
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(255) DEFAULT NULL;

-- User notification/settings preferences (GET/PUT /api/users/preferences/notifications)
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  email_alerts BOOLEAN NOT NULL DEFAULT true,
  push_promo BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS expert_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  category VARCHAR(50) NOT NULL,
  bio VARCHAR(300) NOT NULL,
  languages_spoken TEXT NOT NULL,
  photos TEXT DEFAULT NULL,
  intro_video VARCHAR(255) DEFAULT NULL,
  intro_video_compressed VARCHAR(255) DEFAULT NULL,
  degree_certificate VARCHAR(255) DEFAULT NULL,
  aadhar VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expert_profiles_user_id ON expert_profiles (user_id);

-- Expert intro videos (uploaded by experts, admin approves)
CREATE TABLE IF NOT EXISTS expert_videos (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  video_key VARCHAR(255) NOT NULL,
  thumbnail_key VARCHAR(255) DEFAULT NULL,
  duration INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_expert_videos_user_id ON expert_videos (user_id);
CREATE INDEX IF NOT EXISTS idx_expert_videos_status ON expert_videos (status);

CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'seller')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users (email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users (role);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS admin_users_updated_at ON admin_users;
CREATE TRIGGER admin_users_updated_at BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
